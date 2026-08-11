import { redirect } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { DEFAULT_INSTALL_PLAN } from "../constants/billing";
import { createBillingRequest } from "../services/billing.server";
import { requireSubscription } from "../services/subscription.server";
import {
  createBillingRedirectResponse,
  isDocumentNavigation,
} from "../utils/billing-redirect.server";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const existingConfirmationUrl = url.searchParams.get("url");
  const planName = url.searchParams.get("plan") || DEFAULT_INSTALL_PLAN;
  // eslint-disable-next-line no-undef
  const apiKey = process.env.SHOPIFY_API_KEY || "";

  let confirmationUrl = existingConfirmationUrl;

  if (!confirmationUrl) {
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

    confirmationUrl = result.confirmationUrl;
  }

  if (isDocumentNavigation(request)) {
    return createBillingRedirectResponse(confirmationUrl, apiKey);
  }

  return { confirmationUrl, apiKey, planName };
};

export default function BillingConfirmRedirect() {
  return null;
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
