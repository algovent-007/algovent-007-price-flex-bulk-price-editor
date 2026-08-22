import { authenticate } from "../shopify.server";
import db from "../db.server";
import { markShopUninstalled } from "../models/shop-settings.server";
import { clearSubscriptionForShop } from "../services/subscription.server";
import { revokeSupportSessionsForShop } from "../services/admin-support-session.server";

export const action = async ({ request }) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // If this webhook already ran, the session may have been deleted previously.
  if (session) {
    await db.session.deleteMany({ where: { shop } });
  }

  await db.task.deleteMany({ where: { shop } });
  await markShopUninstalled(shop);
  await clearSubscriptionForShop(shop);
  await revokeSupportSessionsForShop(shop);

  return new Response();
};
