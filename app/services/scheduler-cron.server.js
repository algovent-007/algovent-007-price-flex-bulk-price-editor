import { unauthenticated } from "../shopify.server";
import { requireSubscription } from "./subscription.server";
import { findShopsWithDueTasks, processDueTasksForShop } from "./scheduler.server";

export async function processAllDueTasksForCron() {
  const shops = await findShopsWithDueTasks();
  const results = [];

  for (const shop of shops) {
    try {
      const { admin, session } = await unauthenticated.admin(shop);
      const subscription = await requireSubscription(admin, session);

      if (!subscription) {
        results.push({ shop, skipped: true, reason: "no_active_subscription" });
        continue;
      }

      const processed = await processDueTasksForShop({ admin, shop });
      results.push({ shop, processed });
    } catch (error) {
      results.push({
        shop,
        error: error?.message || String(error),
      });
    }
  }

  return {
    shopCount: shops.length,
    results,
  };
}
