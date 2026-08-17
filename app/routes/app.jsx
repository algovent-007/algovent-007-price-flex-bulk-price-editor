import { useEffect } from "react";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";
import { processDueTasksForShop } from "../services/scheduler.server";
import { requireSubscription } from "../services/subscription.server";
import { appendEmbeddedAppParams } from "../utils/embedded-app-params.server";
import { useI18n } from "../i18n/I18nProvider";

const BILLING_EXEMPT_PATHS = ["/app/plans", "/app/billing"];

function isBillingExemptPath(pathname) {
  return BILLING_EXEMPT_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export const loader = async ({ request }) => {
  try {
    const { admin, session, redirect } = await authenticate.admin(request);

    console.log("Authenticated:", session.shop);

    const url = new URL(request.url);
    const billingExempt = isBillingExemptPath(url.pathname);
    const subscription = await requireSubscription(admin, session);

    if (!billingExempt && !subscription) {
      throw redirect(appendEmbeddedAppParams(request, "/billing/confirm"));
    }

    if (subscription) {
      await processDueTasksForShop({
        admin,
        shop: session.shop,
      });
    }

    const shopifyLocale = session.locale || url.searchParams.get("locale") || "";

    // eslint-disable-next-line no-undef
    return { apiKey: process.env.SHOPIFY_API_KEY || "", shopifyLocale };
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    console.error(error);
    throw error;
  }
};

export default function App() {
  const { apiKey, shopifyLocale } = useLoaderData();
  const { t, applyShopifyLocale } = useI18n();

  useEffect(() => {
    applyShopifyLocale(shopifyLocale);
  }, [applyShopifyLocale, shopifyLocale]);

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">{t("nav.currentTasks")}</s-link>
        <s-link href="/app/new">{t("nav.newTask")}</s-link>
        <s-link href="/app/scheduled">{t("nav.scheduledTasks")}</s-link>
        <s-link href="/app/history">{t("nav.tasksHistory")}</s-link>
        <s-link href="/app/account">{t("nav.account")}</s-link>
        <s-link href="/app/plans">{t("nav.plans")}</s-link>
        <s-link href="/app/support">{t("nav.support")}</s-link>
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
