const billingEvents = [
  "billing_creation",
  "subscription_update",
  "webhook_processing",
  "payment_failure",
  "plan_change",
];

export function logBilling(event, details = {}) {
  if (!billingEvents.includes(event) && event !== "billing_error") {
    console.warn(`[billing] Unknown billing event type: ${event}`);
  }

  console.log(
    `[billing:${event}]`,
    JSON.stringify({
      timestamp: new Date().toISOString(),
      ...details,
    }),
  );
}

export function logBillingError(event, error, details = {}) {
  console.error(
    `[billing:${event}]`,
    JSON.stringify({
      timestamp: new Date().toISOString(),
      message: error?.message || String(error),
      ...details,
    }),
  );
}
