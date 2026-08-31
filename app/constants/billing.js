export const PLAN_NAMES = ["Basic", "Pro", "Super"];

/** Local subscription charge id used when an admin grants access without Shopify billing. */
export const ADMIN_GRANT_CHARGE_ID = "admin-grant";

/** Default plan charged on first install before the merchant can use the app. */
export const DEFAULT_INSTALL_PLAN = "Basic";

export const SUBSCRIPTION_STATUS = {
  ACTIVE: "ACTIVE",
  PENDING: "PENDING",
  CANCELLED: "CANCELLED",
  DECLINED: "DECLINED",
  EXPIRED: "EXPIRED",
  FROZEN: "FROZEN",
};

export const BILLING_FEATURES = {
  RECURRING_TASKS: "recurring_tasks",
  MARKETS: "markets",
};

export const PLANS = {
  Basic: {
    name: "Basic",
    displayPrice: "$20",
    amount: 20,
    currencyCode: "USD",
    interval: "ANNUAL",
    order: 1,
    features: {
      [BILLING_FEATURES.RECURRING_TASKS]: false,
      [BILLING_FEATURES.MARKETS]: false,
    },
  },
  Pro: {
    name: "Pro",
    displayPrice: "$40",
    amount: 40,
    currencyCode: "USD",
    interval: "ANNUAL",
    order: 2,
    features: {
      [BILLING_FEATURES.RECURRING_TASKS]: true,
      [BILLING_FEATURES.MARKETS]: false,
    },
  },
  Super: {
    name: "Super",
    displayPrice: "$60",
    amount: 60,
    currencyCode: "USD",
    interval: "ANNUAL",
    order: 3,
    features: {
      [BILLING_FEATURES.RECURRING_TASKS]: true,
      [BILLING_FEATURES.MARKETS]: true,
    },
  },
};

export function getPlanDefinition(planName) {
  return PLANS[planName] || null;
}

export function isValidPlanName(planName) {
  return Boolean(getPlanDefinition(planName));
}

export function comparePlans(currentPlanName, targetPlanName) {
  const current = getPlanDefinition(currentPlanName);
  const target = getPlanDefinition(targetPlanName);

  if (!current || !target) {
    return 0;
  }

  if (target.order > current.order) {
    return 1;
  }

  if (target.order < current.order) {
    return -1;
  }

  return 0;
}

export function planIncludesFeature(planName, feature) {
  const plan = getPlanDefinition(planName);
  return Boolean(plan?.features?.[feature]);
}

export function getReplacementBehavior(currentPlanName, targetPlanName) {
  const comparison = comparePlans(currentPlanName, targetPlanName);

  if (comparison > 0) {
    return "APPLY_IMMEDIATELY";
  }

  if (comparison < 0) {
    return "STANDARD";
  }

  return "STANDARD";
}
