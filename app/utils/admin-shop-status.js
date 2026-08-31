import { ADMIN_GRANT_CHARGE_ID, SUBSCRIPTION_STATUS, isValidPlanName } from "../constants/billing.js";

export function derivePaymentOk(subscriptionStatus, adminGrantedPayment = false) {
  return subscriptionStatus === SUBSCRIPTION_STATUS.ACTIVE || Boolean(adminGrantedPayment);
}

export function deriveInstallStatus({
  hasSession,
  subscriptionStatus,
  adminGrantedInstall = false,
} = {}) {
  if (adminGrantedInstall) {
    return "Installed";
  }

  if (!hasSession) {
    return "Uninstalled";
  }

  if (
    subscriptionStatus === SUBSCRIPTION_STATUS.FROZEN ||
    subscriptionStatus === SUBSCRIPTION_STATUS.EXPIRED ||
    subscriptionStatus === SUBSCRIPTION_STATUS.CANCELLED
  ) {
    return "Inactive";
  }

  return "Installed";
}

export function isAdminGrantedSubscription(record, adminGrantedPayment = false) {
  if (!record || record.status !== SUBSCRIPTION_STATUS.ACTIVE || !isValidPlanName(record.planName)) {
    return false;
  }

  return Boolean(adminGrantedPayment) || record.chargeId === ADMIN_GRANT_CHARGE_ID;
}

export function resolveAdminGrantPlanName(planName, currentPlanName) {
  if (isValidPlanName(planName)) {
    return planName;
  }
  if (isValidPlanName(currentPlanName)) {
    return currentPlanName;
  }
  return "Super";
}

export function resolveDisplayedPlanName(subscriptionPlanName, adminPlanName) {
  if (isValidPlanName(adminPlanName)) {
    return adminPlanName;
  }
  return subscriptionPlanName || "";
}
