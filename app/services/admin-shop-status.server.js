import prisma from "../db.server";
import { ADMIN_GRANT_CHARGE_ID, isValidPlanName, SUBSCRIPTION_STATUS } from "../constants/billing";
import { getSubscriptionByShop, updateSubscriptionByShop, upsertSubscription } from "../models/subscription.server";
import { getShopAccessGrants, clearShopUninstalled, markShopUninstalled } from "../models/shop-settings.server";
import { revokeSupportSessionsForShop } from "./admin-support-session.server";
import { fetchActiveShopifySubscription } from "./billing.server";
import { isShopifyAccessRevoked } from "../utils/admin-shopify-error";
import { resolveAdminGrantPlanName } from "../utils/admin-shop-status";
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

export async function applyAdminShopAccessFlags({
  shop,
  isInstall,
  isPayment,
} = {}) {
  if (!shop) {
    return { ok: false, error: "Shop is required." };
  }

  const installed = Boolean(isInstall);
  const paymentOk = Boolean(isPayment);
  const existing = await getSubscriptionByShop(shop);
  const grants = await getShopAccessGrants(shop);
  const resolvedPlanName = resolveAdminGrantPlanName(grants.adminPlanName, existing?.planName);

  await prisma.shopSettings.upsert({
    where: { shop },
    create: {
      shop,
      adminGrantedInstall: installed,
      adminGrantedPayment: paymentOk,
      ...(installed ? { uninstalledAt: null } : {}),
    },
    update: {
      adminGrantedInstall: installed,
      adminGrantedPayment: paymentOk,
      ...(installed ? { uninstalledAt: null } : {}),
    },
  });

  if (paymentOk) {
    await upsertSubscription({
      shop,
      planName: resolvedPlanName,
      status: SUBSCRIPTION_STATUS.ACTIVE,
      chargeId: ADMIN_GRANT_CHARGE_ID,
    });
  } else if (existing && (existing.chargeId === ADMIN_GRANT_CHARGE_ID || !existing.chargeId)) {
    await updateSubscriptionByShop(shop, { status: SUBSCRIPTION_STATUS.CANCELLED });
  }

  return {
    ok: true,
    installed,
    isPaymentOk: paymentOk,
    planName: resolvedPlanName,
    subscriptionStatus: paymentOk ? SUBSCRIPTION_STATUS.ACTIVE : existing?.status || null,
  };
}

export async function applyAdminPlanChange({ shop, planName } = {}) {
  if (!shop) {
    return { ok: false, error: "Shop is required." };
  }

  if (!isValidPlanName(planName)) {
    return { ok: false, error: "Choose Basic, Pro, or Super." };
  }

  const existing = await getSubscriptionByShop(shop);

  await prisma.shopSettings.upsert({
    where: { shop },
    create: {
      shop,
      adminPlanName: planName,
    },
    update: {
      adminPlanName: planName,
    },
  });

  if (existing) {
    await updateSubscriptionByShop(shop, { planName });
  }

  return {
    ok: true,
    planName,
    previousPlanName: existing?.planName || "",
    subscriptionStatus: existing?.status || null,
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
      const grants = await getShopAccessGrants(shop);
      const shopifyPlanName = isValidPlanName(activeSubscription.name)
        ? activeSubscription.name
        : existing?.planName || activeSubscription.name;
      const planName = resolveAdminGrantPlanName(grants.adminPlanName, shopifyPlanName);
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
