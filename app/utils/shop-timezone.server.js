import { getShopSettings } from "../models/shop-settings.server";

const DEFAULT_TIMEZONE = "Asia/Kolkata";

export async function getShopTimezone({ shop, admin }) {
  const settings = await getShopSettings(shop);
  if (settings?.timezone) {
    return settings.timezone;
  }

  if (admin) {
    try {
      const response = await admin.graphql(
        `#graphql
        query getShopTimezone {
          shop {
            ianaTimezone
          }
        }`
      );
      const json = await response.json();
      return json.data?.shop?.ianaTimezone || DEFAULT_TIMEZONE;
    } catch {
      return DEFAULT_TIMEZONE;
    }
  }

  return DEFAULT_TIMEZONE;
}
