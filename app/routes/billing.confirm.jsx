import { redirect } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { DEFAULT_INSTALL_PLAN } from "../constants/billing";
import { createBillingRequest } from "../services/billing.server";
import { requireSubscription } from "../services/subscription.server";
import { createBillingRedirectResponse } from "../utils/billing-redirect.server";

async function resolveConfirmationUrl({ admin, session, request }) {
  const url = new URL(request.url);
  const existingConfirmationUrl = url.searchParams.get("url");
  const planName = url.searchParams.get("plan") || DEFAULT_INSTALL_PLAN;

  if (existingConfirmationUrl) {
    return existingConfirmationUrl;
  }

  const subscription = await requireSubscription(admin, session);
  if (subscription) {
    throw redirect("/app");
  }

  const result = await createBillingRequest({
    admin,
    session,
    planName,
    request,
  });

  if (result.error) {
    throw redirect(
      `/app/plans?billing=error&error=${encodeURIComponent(result.error)}`,
    );
  }

  if (!result.confirmationUrl) {
    throw redirect("/app/plans?billing=error");
  }

  return result.confirmationUrl;
}

/** Resource route — no UI export; returns raw HTML to break out of the iframe. */
export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const confirmationUrl = await resolveConfirmationUrl({
    admin,
    session,
    request,
  });
  // eslint-disable-next-line no-undef
  const apiKey = process.env.SHOPIFY_API_KEY || "";

  return createBillingRedirectResponse(confirmationUrl, apiKey);
};

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
