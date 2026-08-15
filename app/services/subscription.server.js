import {
  BILLING_FEATURES,
  SUBSCRIPTION_STATUS,
  getPlanDefinition,
  isValidPlanName,
  planIncludesFeature,
} from "../constants/billing";
import {
  deleteSubscriptionByShop,
  getSubscriptionByShop,
  upsertSubscription,
} from "../models/subscription.server";
import {
  fetchActiveShopifySubscription,
  fetchShopBillingContext,
  isDevelopmentStore,
  syncSubscriptionFromShopify,
} from "./billing.server";
import { logBilling, logBillingError } from "../utils/billing-logger.server";

const SUBSCRIPTION_CACHE_FALLBACK_MAX_AGE_MS = 6 * 60 * 60 * 1000;

function isRecentSubscriptionRecord(record) {
  if (!record?.updatedAt) {
    return false;
  }

  return Date.now() - new Date(record.updatedAt).getTime() < SUBSCRIPTION_CACHE_FALLBACK_MAX_AGE_MS;
}

export function isActiveSubscriptionStatus(status) {
  return status === SUBSCRIPTION_STATUS.ACTIVE;
}

export function isBlockedSubscriptionStatus(status) {
  return [
    SUBSCRIPTION_STATUS.DECLINED,
    SUBSCRIPTION_STATUS.EXPIRED,
    SUBSCRIPTION_STATUS.FROZEN,
  ].includes(status);
}

export async function getSubscriptionRecord(shop) {
  return getSubscriptionByShop(shop);
}

export async function requireSubscription(admin, session) {
  const shop = session.shop;

  try {
    const activeShopifySubscription = await fetchActiveShopifySubscription(admin);

    if (
      activeShopifySubscription &&
      String(activeShopifySubscription.status).toUpperCase() === SUBSCRIPTION_STATUS.ACTIVE &&
      isValidPlanName(activeShopifySubscription.name)
    ) {
      const subscription = await upsertSubscription({
        shop,
        planName: activeShopifySubscription.name,
        status: SUBSCRIPTION_STATUS.ACTIVE,
        chargeId: activeShopifySubscription.id,
      });

      logBilling("subscription_update", {
        shop,
        planName: subscription.planName,
        status: subscription.status,
        chargeId: subscription.chargeId,
        source: "requireSubscription_shopify",
      });

      return subscription;
    }
  } catch (error) {
    logBillingError("subscription_update", error, { shop, source: "requireSubscription" });

    const cached = await getSubscriptionByShop(shop);
    if (
      cached &&
      cached.status === SUBSCRIPTION_STATUS.ACTIVE &&
      isValidPlanName(cached.planName) &&
      isRecentSubscriptionRecord(cached)
    ) {
      logBilling("subscription_update", {
        shop,
        planName: cached.planName,
        status: cached.status,
        chargeId: cached.chargeId,
        source: "requireSubscription_cache_fallback",
      });
      return cached;
    }
  }

  return null;
}

export async function clearSubscriptionForShop(shop) {
  await deleteSubscriptionByShop(shop);
  logBilling("subscription_update", { shop, status: "deleted", source: "app_uninstalled" });
}

export async function getPlansPageData(admin, session) {
  const shop = session.shop;
  const devStore = await isDevelopmentStore(admin);
  const subscription = await getSubscriptionByShop(shop);
  let renewalDate = null;
  let billingStatus = subscription?.status || "NONE";
  let shopifyPlanName = null;

  try {
    const activeShopifySubscription = await fetchActiveShopifySubscription(admin);
    shopifyPlanName = activeShopifySubscription?.name || null;
    renewalDate = activeShopifySubscription?.currentPeriodEnd || null;
    billingStatus = activeShopifySubscription?.status || billingStatus;
  } catch (error) {
    logBillingError("billing_error", error, { shop, source: "getPlansPageData" });
  }

  const currentPlan =
    shopifyPlanName && isValidPlanName(shopifyPlanName)
      ? shopifyPlanName
      : subscription?.planName || null;

  return {
    shop,
    isDevelopmentStore: devStore,
    currentPlan,
    subscriptionStatus: subscription?.status || null,
    billingStatus,
    renewalDate,
    chargeId: subscription?.chargeId || null,
    updatedAt: subscription?.updatedAt?.toISOString?.() || null,
    requiresShopifyApproval: !shopifyPlanName || billingStatus !== SUBSCRIPTION_STATUS.ACTIVE,
  };
}

export async function assertPlanFeature(admin, session, feature) {
  const subscription = await requireSubscription(admin, session);

  if (!subscription) {
    throw new Response(JSON.stringify({ success: false, error: "An active subscription is required." }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!planIncludesFeature(subscription.planName, feature)) {
    const planLabel = getPlanDefinition(subscription.planName)?.name || subscription.planName;
    const message =
      feature === BILLING_FEATURES.RECURRING_TASKS
        ? `Recurring tasks are not included in your ${planLabel} plan. Upgrade to Pro or Super.`
        : `Markets are not included in your ${planLabel} plan. Upgrade to Super.`;

    throw new Response(JSON.stringify({ success: false, error: message }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  return subscription;
}

export async function getShopBillingSummary(admin, session) {
  const subscription = await requireSubscription(admin, session);
  const billingContext = await fetchShopBillingContext(admin);

  return {
    subscription,
    billingContext,
  };
}

export async function handleSubscriptionWebhookUpdate({ shop, payload }) {
  const appSubscription = payload?.app_subscription;
  if (!appSubscription) {
    logBillingError("webhook_processing", new Error("Missing app_subscription payload"), { shop });
    return null;
  }

  const planName = appSubscription.name;
  const status = String(appSubscription.status || "").toUpperCase();
  const chargeId = appSubscription.admin_graphql_api_id || null;

  if (!isValidPlanName(planName)) {
    logBillingError("webhook_processing", new Error(`Unknown plan in webhook: ${planName}`), { shop });
    return null;
  }

  if (isBlockedSubscriptionStatus(status)) {
    logBilling("payment_failure", { shop, planName, status, chargeId });
  } else {
    logBilling("webhook_processing", { shop, planName, status, chargeId });
  }

  return upsertSubscription({
    shop,
    planName,
    status,
    chargeId,
  });
}
