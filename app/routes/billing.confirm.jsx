import { useEffect } from "react";
import { redirect, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { DEFAULT_INSTALL_PLAN, PLANS } from "../constants/billing";
import { createBillingRequest } from "../services/billing.server";
import { requireSubscription } from "../services/subscription.server";

function isDataRequest(request) {
  const url = new URL(request.url);
  return url.pathname.endsWith(".data");
}

async function resolveConfirmationUrl({ admin, session, request }) {
  const url = new URL(request.url);
  const existingConfirmationUrl = url.searchParams.get("url");
  const planName = url.searchParams.get("plan") || DEFAULT_INSTALL_PLAN;

  if (existingConfirmationUrl) {
    return { confirmationUrl: existingConfirmationUrl, planName };
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

  return { confirmationUrl: result.confirmationUrl, planName };
}

export const loader = async ({ request }) => {
  const { admin, session, redirect: shopifyRedirect } = await authenticate.admin(
    request,
  );
  const { confirmationUrl, planName } = await resolveConfirmationUrl({
    admin,
    session,
    request,
  });
  // eslint-disable-next-line no-undef
  const apiKey = process.env.SHOPIFY_API_KEY || "";

  if (!isDataRequest(request)) {
    throw shopifyRedirect(confirmationUrl, { target: "_top" });
  }

  return { confirmationUrl, planName, apiKey };
};

export default function BillingConfirmRedirect() {
  const { confirmationUrl, planName, apiKey } = useLoaderData();
  const shopify = useAppBridge();
  const plan = PLANS[planName] || PLANS[DEFAULT_INSTALL_PLAN];

  const openBilling = () => {
    if (shopify?.open) {
      shopify.open(confirmationUrl, "_top");
      return;
    }

    window.open(confirmationUrl, "_top");
  };

  useEffect(() => {
    try {
      if (shopify?.open) {
        shopify.open(confirmationUrl, "_top");
        return;
      }

      window.open(confirmationUrl, "_top");
    } catch {
      // Browser may block automatic top-frame navigation; button fallback remains.
    }
  }, [confirmationUrl, shopify]);

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-page heading="Approve subscription">
        <s-box paddingBlockEnd="base">
          <s-banner tone="info">
            Approve the {plan.name} plan ({plan.displayPrice}/year) on Shopify to
            continue. Development stores use test charges only.
          </s-banner>
        </s-box>
        <s-button variant="primary" onClick={openBilling}>
          Open Shopify billing approval
        </s-button>
      </s-page>
    </AppProvider>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
