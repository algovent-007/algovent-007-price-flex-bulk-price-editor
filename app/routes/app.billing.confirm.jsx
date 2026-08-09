import { redirect, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { DEFAULT_INSTALL_PLAN, PLANS } from "../constants/billing";
import { createBillingRequest } from "../services/billing.server";
import { requireSubscription } from "../services/subscription.server";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const existingConfirmationUrl = url.searchParams.get("url");
  const planName = url.searchParams.get("plan") || DEFAULT_INSTALL_PLAN;

  if (existingConfirmationUrl) {
    return {
      confirmationUrl: existingConfirmationUrl,
      planName,
      // eslint-disable-next-line no-undef
      apiKey: process.env.SHOPIFY_API_KEY || "",
    };
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

  return {
    confirmationUrl: result.confirmationUrl,
    planName,
    // eslint-disable-next-line no-undef
    apiKey: process.env.SHOPIFY_API_KEY || "",
  };
};

export default function BillingConfirm() {
  const { confirmationUrl, planName } = useLoaderData();
  const shopify = useAppBridge();
  const plan = PLANS[planName] || PLANS[DEFAULT_INSTALL_PLAN];

  const handleContinue = () => {
    if (shopify?.open) {
      shopify.open(confirmationUrl, "_top");
      return;
    }

    window.open(confirmationUrl, "_top");
  };

  return (
    <s-page heading="Approve subscription">
      <s-box paddingBlockEnd="base">
        <s-banner tone="info">
          Click the button below to open Shopify&apos;s billing page. On development
          stores this is a test charge only — no real payment is collected.
        </s-banner>
      </s-box>

      <s-section heading={`${plan.name} plan — ${plan.displayPrice}/year`}>
        <s-stack direction="block" gap="base">
          <s-text>
            Shopify requires you to approve or decline the subscription before using
            the app.
          </s-text>
          <s-button variant="primary" onClick={handleContinue}>
            Approve subscription on Shopify
          </s-button>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
