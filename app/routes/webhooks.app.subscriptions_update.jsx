import { authenticate } from "../shopify.server";
import { handleSubscriptionWebhookUpdate } from "../services/subscription.server";
import { logBillingError } from "../utils/billing-logger.server";

export const action = async ({ request }) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  try {
    await handleSubscriptionWebhookUpdate({ shop, payload });
  } catch (error) {
    logBillingError("webhook_processing", error, { shop, topic });
    return new Response(null, { status: 500 });
  }

  return new Response();
};
