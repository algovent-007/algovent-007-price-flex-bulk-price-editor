import { redirect, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { DEFAULT_INSTALL_PLAN, PLANS } from "../constants/billing";
import {
  appendEmbeddedAppParams,
  isValidShopifyBillingConfirmationUrl,
} from "../utils/embedded-app-params.server";
import { useI18n } from "../i18n/I18nProvider";
import AppPage from "../components/AppPage";

export const loader = async ({ request }) => {
  const url = new URL(request.url);

  if (!url.searchParams.get("url")) {
    throw redirect(`/billing/confirm?${url.searchParams.toString()}`);
  }

  const { redirect: shopifyRedirect } = await authenticate.admin(request);
  const confirmationUrl = url.searchParams.get("url");

  if (!isValidShopifyBillingConfirmationUrl(confirmationUrl)) {
    throw shopifyRedirect(
      appendEmbeddedAppParams(
        request,
        "/app/plans?billing=error&error=Invalid+billing+confirmation+URL",
      ),
    );
  }

  const planName = url.searchParams.get("plan") || DEFAULT_INSTALL_PLAN;
  // eslint-disable-next-line no-undef
  const apiKey = process.env.SHOPIFY_API_KEY || "";

  return { confirmationUrl, planName, apiKey };
};

export default function AppBillingConfirm() {
  const { confirmationUrl, planName } = useLoaderData();
  const shopify = useAppBridge();
  const { t } = useI18n();
  const plan = PLANS[planName] || PLANS[DEFAULT_INSTALL_PLAN];

  const openBilling = () => {
    if (shopify?.open) {
      shopify.open(confirmationUrl, "_top");
      return;
    }

    window.open(confirmationUrl, "_top");
  };

  return (
    <AppPage heading={t("plans.approveHeading")}>
      <s-box paddingBlockEnd="base">
        <s-banner tone="info">
          {t("plans.approveBanner", { plan: plan.name, price: plan.displayPrice })}
        </s-banner>
      </s-box>
      <s-button variant="primary" onClick={openBilling}>
        {t("plans.openBilling")}
      </s-button>
    </AppPage>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
