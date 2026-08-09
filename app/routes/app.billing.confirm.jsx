import { useEffect } from "react";
import { redirect, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { DEFAULT_INSTALL_PLAN } from "../constants/billing";
import { createBillingRequest } from "../services/billing.server";
import { requireSubscription } from "../services/subscription.server";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const existingConfirmationUrl = url.searchParams.get("url");

  if (existingConfirmationUrl) {
    return {
      confirmationUrl: existingConfirmationUrl,
      // eslint-disable-next-line no-undef
      apiKey: process.env.SHOPIFY_API_KEY || "",
    };
  }

  const subscription = await requireSubscription(admin, session);
  if (subscription) {
    throw redirect("/app");
  }

  const planName = url.searchParams.get("plan") || DEFAULT_INSTALL_PLAN;
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
    // eslint-disable-next-line no-undef
    apiKey: process.env.SHOPIFY_API_KEY || "",
  };
};

export default function BillingConfirm() {
  const { confirmationUrl } = useLoaderData();
  const shopify = useAppBridge();

  useEffect(() => {
    if (!confirmationUrl) {
      return;
    }

    if (shopify?.open) {
      shopify.open(confirmationUrl, "_top");
      return;
    }

    if (window.top) {
      window.top.location.href = confirmationUrl;
    }
  }, [confirmationUrl, shopify]);

  const handleContinue = () => {
    if (shopify?.open) {
      shopify.open(confirmationUrl, "_top");
      return;
    }

    if (window.top) {
      window.top.location.href = confirmationUrl;
    }
  };

  return (
    <s-page heading="Billing">
      <s-stack direction="block" gap="base">
        <s-text>Redirecting to Shopify to approve your subscription...</s-text>
        <s-button variant="primary" onClick={handleContinue}>
          Continue to billing approval
        </s-button>
      </s-stack>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
