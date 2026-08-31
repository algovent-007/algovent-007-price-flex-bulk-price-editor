import { useEffect } from "react";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";
import { requireSubscription } from "../services/subscription.server";
import { appendEmbeddedAppParams } from "../utils/embedded-app-params.server";
import { retryAfterRevokedShopifyAccess } from "../utils/shopify-reauth.server";
import { getValidSupportContext } from "../services/admin-support-session.server";
import { useI18n } from "../i18n/I18nProvider";
import AdminSupportBanner from "../components/admin/AdminSupportBanner";
import AdminSupportAppBridge from "../components/admin/AdminSupportAppBridge";
import AppNavLink from "../components/AppNavLink";

const BILLING_EXEMPT_PATHS = ["/app/plans", "/app/billing"];

function isBillingExemptPath(pathname) {
  return BILLING_EXEMPT_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export const loader = async ({ request }) => {
  let shop = new URL(request.url).searchParams.get("shop");

  try {
    const { admin, session, redirect } = await authenticate.admin(request);
    shop = session.shop;

    const url = new URL(request.url);
    const billingExempt = isBillingExemptPath(url.pathname);
    const [support, subscription] = await Promise.all([
      getValidSupportContext(request),
      requireSubscription(admin, session),
    ]);

    if (!billingExempt && !subscription && !support) {
      throw redirect(appendEmbeddedAppParams(request, "/billing/confirm"));
    }

    const shopifyLocale = session.locale || url.searchParams.get("locale") || "";

    return {
      // eslint-disable-next-line no-undef
      apiKey: process.env.SHOPIFY_API_KEY || "",
      shopifyLocale,
      supportMode: support
        ? { shop: support.shop, adminName: support.admin?.name || "Admin" }
        : null,
    };
  } catch (error) {
    await retryAfterRevokedShopifyAccess(error, request, shop);

    if (error instanceof Response) {
      throw error;
    }

    console.error(error);
    throw error;
  }
};

export default function App() {
  const { apiKey, shopifyLocale, supportMode } = useLoaderData();
  const { t, applyShopifyLocale } = useI18n();

  useEffect(() => {
    applyShopifyLocale(shopifyLocale);
  }, [applyShopifyLocale, shopifyLocale]);

  const appChrome = (
    <>
      <s-app-nav>
        <AppNavLink href="/app/current">{t("nav.currentTasks")}</AppNavLink>
        <AppNavLink href="/app/new">{t("nav.newTask")}</AppNavLink>
        <AppNavLink href="/app/scheduled">{t("nav.scheduledTasks")}</AppNavLink>
        <AppNavLink href="/app/history">{t("nav.tasksHistory")}</AppNavLink>
        <AppNavLink href="/app/account">{t("nav.account")}</AppNavLink>
        <AppNavLink href="/app/plans">{t("nav.plans")}</AppNavLink>
        <AppNavLink href="/app/support">{t("nav.support")}</AppNavLink>
      </s-app-nav>
      <Outlet />
    </>
  );

  return (
    <AppProvider embedded={!supportMode} apiKey={apiKey}>
      {supportMode ? <AdminSupportBanner shop={supportMode.shop} /> : null}
      {supportMode ? <AdminSupportAppBridge>{appChrome}</AdminSupportAppBridge> : appChrome}
    </AppProvider>
  );
}

export function shouldRevalidate({ formMethod, currentUrl, nextUrl, defaultShouldRevalidate, actionResult }) {
  if (actionResult?.skipRevalidate || actionResult?.task || Array.isArray(actionResult?.collections)) {
    return false;
  }
  if (formMethod && formMethod !== "GET") {
    return true;
  }
  const currentPath = currentUrl.pathname;
  const nextPath = nextUrl.pathname;
  if (currentPath.includes("/billing") || nextPath.includes("/billing")) {
    return true;
  }
  if (currentPath.startsWith("/app") && nextPath.startsWith("/app")) {
    return false;
  }
  return defaultShouldRevalidate;
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
