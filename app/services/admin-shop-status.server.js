import prisma from "../db.server";
import { isValidPlanName, SUBSCRIPTION_STATUS } from "../constants/billing";
import { getSubscriptionByShop, updateSubscriptionByShop, upsertSubscription } from "../models/subscription.server";
import { clearShopUninstalled, markShopUninstalled } from "../models/shop-settings.server";
import { revokeSupportSessionsForShop } from "./admin-support-session.server";
import { fetchActiveShopifySubscription } from "./billing.server";
import { isShopifyAccessRevoked } from "../utils/admin-shopify-error";
import { unauthenticated } from "../shopify.server";

async function markShopAccessRevoked(shop) {
  await prisma.session.deleteMany({ where: { shop } });
  await markShopUninstalled(shop);
  await revokeSupportSessionsForShop(shop);

  const existing = await getSubscriptionByShop(shop);
  if (existing && existing.status !== SUBSCRIPTION_STATUS.CANCELLED) {
    await updateSubscriptionByShop(shop, { status: SUBSCRIPTION_STATUS.CANCELLED });
  }

  return {
    installed: false,
    isPaymentOk: false,
    planName: existing?.planName || "",
    subscriptionStatus: existing ? SUBSCRIPTION_STATUS.CANCELLED : null,
  };
}

export async function refreshAdminShopStatus(shop) {
  const offlineSession = await prisma.session.findFirst({
    where: { shop, isOnline: false },
    select: { id: true },
  });

  if (!offlineSession) {
    return {
      ok: false,
      error: "No active app session for this store.",
    };
  }

  try {
    const { admin } = await unauthenticated.admin(shop);
    const activeSubscription = await fetchActiveShopifySubscription(admin);

    await clearShopUninstalled(shop);

    if (activeSubscription) {
      const existing = await getSubscriptionByShop(shop);
      const planName = isValidPlanName(activeSubscription.name)
        ? activeSubscription.name
        : existing?.planName || activeSubscription.name;
      const subscription = await upsertSubscription({
        shop,
        planName,
        status: String(activeSubscription.status || SUBSCRIPTION_STATUS.ACTIVE).toUpperCase(),
        chargeId: activeSubscription.id,
      });

      return {
        ok: true,
        installed: true,
        isPaymentOk: subscription.status === SUBSCRIPTION_STATUS.ACTIVE,
        planName: subscription.planName,
        subscriptionStatus: subscription.status,
      };
    }

    const existing = await getSubscriptionByShop(shop);
    if (existing && existing.status === SUBSCRIPTION_STATUS.ACTIVE) {
      await updateSubscriptionByShop(shop, { status: SUBSCRIPTION_STATUS.CANCELLED });
    }

    return {
      ok: true,
      installed: true,
      isPaymentOk: false,
      planName: existing?.planName || "",
      subscriptionStatus: existing ? SUBSCRIPTION_STATUS.CANCELLED : null,
    };
  } catch (error) {
    if (isShopifyAccessRevoked(error)) {
      const status = await markShopAccessRevoked(shop);
      return { ok: true, ...status };
    }

    return {
      ok: false,
      error: error?.message || "Unable to refresh store status from Shopify.",
    };
  }
}
