import {
  comparePlans,
  getPlanDefinition,
  getReplacementBehavior,
  isValidPlanName,
  SUBSCRIPTION_STATUS,
} from "../constants/billing";
import { getSubscriptionByShop, upsertSubscription } from "../models/subscription.server";
import { logBilling, logBillingError } from "../utils/billing-logger.server";
import { copyEmbeddedAppParams } from "../utils/embedded-app-params.server";

const ACTIVE_SUBSCRIPTION_QUERY = `#graphql
  query ActiveAppSubscription {
    currentAppInstallation {
      activeSubscriptions {
        id
        name
        status
        createdAt
        currentPeriodEnd
        test
      }
    }
  }
`;

const SHOP_BILLING_CONTEXT_QUERY = `#graphql
  query ShopBillingContext {
    shop {
      plan {
        partnerDevelopment
      }
      currencyCode
    }
  }
`;

const APP_SUBSCRIPTION_CREATE_MUTATION = `#graphql
  mutation AppSubscriptionCreate(
    $name: String!
    $returnUrl: URL!
    $lineItems: [AppSubscriptionLineItemInput!]!
    $replacementBehavior: AppSubscriptionReplacementBehavior
    $test: Boolean
  ) {
    appSubscriptionCreate(
      name: $name
      returnUrl: $returnUrl
      lineItems: $lineItems
      replacementBehavior: $replacementBehavior
      test: $test
    ) {
      appSubscription {
        id
        name
        status
      }
      confirmationUrl
      userErrors {
        field
        message
      }
    }
  }
`;

const APP_LAUNCH_URL_QUERY = `#graphql
  query AppLaunchUrl {
    currentAppInstallation {
      launchUrl
    }
  }
`;

const APP_SUBSCRIPTION_CANCEL_MUTATION = `#graphql
  mutation AppSubscriptionCancel($id: ID!) {
    appSubscriptionCancel(id: $id) {
      appSubscription {
        id
        status
      }
      userErrors {
        field
        message
      }
    }
  }
`;

async function runGraphql(admin, query, variables = {}) {
  const response = await admin.graphql(query, { variables });
  const json = await response.json();

  if (json.errors?.length) {
    throw new Error(json.errors[0].message);
  }

  return json.data;
}

export async function isDevelopmentStore(admin) {
  const data = await runGraphql(admin, SHOP_BILLING_CONTEXT_QUERY);
  return Boolean(data?.shop?.plan?.partnerDevelopment);
}

export async function fetchShopBillingContext(admin) {
  const data = await runGraphql(admin, SHOP_BILLING_CONTEXT_QUERY);
  return {
    partnerDevelopment: Boolean(data?.shop?.plan?.partnerDevelopment),
    currencyCode: data?.shop?.currencyCode || "USD",
  };
}

export async function fetchActiveShopifySubscription(admin) {
  const data = await runGraphql(admin, ACTIVE_SUBSCRIPTION_QUERY);
  const subscriptions = data?.currentAppInstallation?.activeSubscriptions || [];
  return subscriptions[0] || null;
}

async function buildReturnUrl({ admin, session, planName, request }) {
  const requestUrl = request ? new URL(request.url) : null;
  const host = requestUrl?.searchParams.get("host");

  try {
    const data = await runGraphql(admin, APP_LAUNCH_URL_QUERY);
    const launchUrl = data?.currentAppInstallation?.launchUrl;

    if (launchUrl) {
      const base = launchUrl.replace(/\/$/, "");
      let url = new URL(`${base}/app/billing/callback`);
      url.searchParams.set("plan", planName);
      url.searchParams.set("shop", session.shop);
      if (requestUrl) {
        url = copyEmbeddedAppParams(requestUrl, url);
      }
      return url.toString();
    }
  } catch (error) {
    logBillingError("billing_return_url", error, {
      shop: session.shop,
      planName,
    });
  }

  const appUrl = process.env.SHOPIFY_APP_URL || requestUrl?.origin || "";
  if (!appUrl) {
    throw new Error("SHOPIFY_APP_URL is not configured");
  }
  let url = new URL("/app/billing/callback", appUrl);
  url.searchParams.set("plan", planName);
  url.searchParams.set("shop", session.shop);
  if (requestUrl) {
    url = copyEmbeddedAppParams(requestUrl, url);
  } else if (host) {
    url.searchParams.set("host", host);
    url.searchParams.set("embedded", "1");
  }

  return url.toString();
}

function buildLineItems(plan) {
  return [
    {
      plan: {
        appRecurringPricingDetails: {
          price: {
            amount: plan.amount,
            currencyCode: plan.currencyCode,
          },
          interval: plan.interval,
        },
      },
    },
  ];
}

export async function syncSubscriptionFromShopify({ admin, shop, expectedPlanName = null }) {
  const activeSubscription = await fetchActiveShopifySubscription(admin);

  if (!activeSubscription) {
    return getSubscriptionByShop(shop);
  }

  let planName = activeSubscription.name;
  if (!isValidPlanName(planName) && expectedPlanName && isValidPlanName(expectedPlanName)) {
    planName = expectedPlanName;
  }

  if (!isValidPlanName(planName)) {
    throw new Error(`Unable to map Shopify subscription to a known plan: ${planName}`);
  }

  const subscription = await upsertSubscription({
    shop,
    planName,
    status: String(activeSubscription.status || SUBSCRIPTION_STATUS.ACTIVE).toUpperCase(),
    chargeId: activeSubscription.id,
  });

  logBilling("subscription_update", {
    shop,
    planName: subscription.planName,
    status: subscription.status,
    chargeId: subscription.chargeId,
    source: "shopify_sync",
  });

  return subscription;
}

export async function createBillingRequest({ admin, session, planName, request }) {
  const shop = session.shop;

  if (!isValidPlanName(planName)) {
    return { error: "Invalid plan selected." };
  }

  const plan = getPlanDefinition(planName);
  const existingSubscription = await getSubscriptionByShop(shop);
  const devStore = await isDevelopmentStore(admin);

  if (
    existingSubscription &&
    existingSubscription.planName === planName &&
    existingSubscription.status === SUBSCRIPTION_STATUS.ACTIVE
  ) {
    return { error: "You are already subscribed to this plan." };
  }

  const activeShopifySubscription = await fetchActiveShopifySubscription(admin);
  if (
    activeShopifySubscription &&
    activeShopifySubscription.name === planName &&
    String(activeShopifySubscription.status).toUpperCase() === SUBSCRIPTION_STATUS.ACTIVE
  ) {
    await upsertSubscription({
      shop,
      planName: plan.name,
      status: SUBSCRIPTION_STATUS.ACTIVE,
      chargeId: activeShopifySubscription.id,
    });
    return { error: "You are already subscribed to this plan." };
  }

  if (
    activeShopifySubscription &&
    String(activeShopifySubscription.status).toUpperCase() === SUBSCRIPTION_STATUS.ACTIVE &&
    isValidPlanName(activeShopifySubscription.name)
  ) {
    await upsertSubscription({
      shop,
      planName: activeShopifySubscription.name,
      status: SUBSCRIPTION_STATUS.ACTIVE,
      chargeId: activeShopifySubscription.id,
    });
  } else if (existingSubscription?.status === SUBSCRIPTION_STATUS.PENDING) {
    return {
      error:
        "You already have a pending billing request. Approve or decline it in Shopify before trying again.",
    };
  }

  const replacementBehavior = (existingSubscription?.planName || activeShopifySubscription?.name)
    ? getReplacementBehavior(
        existingSubscription?.planName || activeShopifySubscription.name,
        planName,
      )
    : "STANDARD";

  const comparison = (existingSubscription?.planName || activeShopifySubscription?.name)
    ? comparePlans(
        existingSubscription?.planName || activeShopifySubscription.name,
        planName,
      )
    : 0;

  try {
    const data = await runGraphql(admin, APP_SUBSCRIPTION_CREATE_MUTATION, {
      name: plan.name,
      returnUrl: await buildReturnUrl({
        admin,
        session,
        planName: plan.name,
        request,
      }),
      lineItems: buildLineItems(plan),
      replacementBehavior,
      test: devStore,
    });

    const result = data?.appSubscriptionCreate;
    const userErrors = result?.userErrors || [];

    if (userErrors.length > 0) {
      logBillingError("billing_creation", new Error(userErrors[0].message), {
        shop,
        planName,
      });
      return { error: userErrors[0].message };
    }

    const appSubscription = result?.appSubscription;
    const confirmationUrl = result?.confirmationUrl;

    if (!confirmationUrl) {
      return { error: "Shopify did not return a billing confirmation URL." };
    }

    await upsertSubscription({
      shop,
      planName: plan.name,
      status: String(appSubscription?.status || SUBSCRIPTION_STATUS.PENDING).toUpperCase(),
      chargeId: appSubscription?.id || null,
    });

    logBilling("billing_creation", {
      shop,
      planName: plan.name,
      status: appSubscription?.status || SUBSCRIPTION_STATUS.PENDING,
      chargeId: appSubscription?.id || null,
      replacementBehavior,
      changeType: comparison > 0 ? "upgrade" : comparison < 0 ? "downgrade" : "new",
      test: devStore,
    });

    return { confirmationUrl };
  } catch (error) {
    logBillingError("billing_creation", error, { shop, planName });
    return { error: error.message || "Failed to create billing request." };
  }
}

export async function cancelBillingSubscription({ admin, session }) {
  const shop = session.shop;
  const existingSubscription = await getSubscriptionByShop(shop);

  if (!existingSubscription) {
    return { error: "No subscription found for this shop." };
  }

  let chargeId = existingSubscription.chargeId;
  if (!chargeId) {
    const activeSubscription = await fetchActiveShopifySubscription(admin);
    if (!activeSubscription?.id) {
      return { error: "No active Shopify subscription found to cancel." };
    }

    chargeId = activeSubscription.id;
  }

  try {
    const data = await runGraphql(admin, APP_SUBSCRIPTION_CANCEL_MUTATION, {
      id: chargeId,
    });

    const userErrors = data?.appSubscriptionCancel?.userErrors || [];
    if (userErrors.length > 0) {
      logBillingError("plan_change", new Error(userErrors[0].message), {
        shop,
        chargeId,
      });
      return { error: userErrors[0].message };
    }

    const cancelledSubscription = data?.appSubscriptionCancel?.appSubscription;
    await upsertSubscription({
      shop,
      planName: existingSubscription.planName,
      status: String(cancelledSubscription?.status || SUBSCRIPTION_STATUS.CANCELLED).toUpperCase(),
      chargeId,
    });

    logBilling("plan_change", {
      shop,
      planName: existingSubscription.planName,
      status: cancelledSubscription?.status || SUBSCRIPTION_STATUS.CANCELLED,
      source: "merchant_cancel",
    });

    return { redirectTo: "/app/plans" };
  } catch (error) {
    logBillingError("plan_change", error, { shop, chargeId });
    return { error: error.message || "Failed to cancel subscription." };
  }
}

export async function syncSubscriptionAfterApproval({ admin, session, planName }) {
  const shop = session.shop;

  if (!isValidPlanName(planName)) {
    throw new Error("Invalid plan in billing callback.");
  }

  const subscription = await syncSubscriptionFromShopify({
    admin,
    shop,
    expectedPlanName: planName,
  });

  if (!subscription || subscription.status !== SUBSCRIPTION_STATUS.ACTIVE) {
    logBillingError(
      "subscription_update",
      new Error("Subscription was not active after billing approval."),
      { shop, planName, status: subscription?.status || "missing" },
    );
  } else {
    logBilling("subscription_update", {
      shop,
      planName: subscription.planName,
      status: subscription.status,
      source: "billing_callback",
    });
  }

  return subscription;
}
