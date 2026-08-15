import { getShopSettings } from "../models/shop-settings.server";

const DEFAULT_TIMEZONE = "Asia/Kolkata";

const TIMEZONE_ALIASES = {
  "Asia/Calcutta": "Asia/Kolkata",
};

export function normalizeShopTimezone(timezone) {
  const trimmed = String(timezone || "").trim();
  if (!trimmed) return "";
  return TIMEZONE_ALIASES[trimmed] || trimmed;
}

export async function getShopTimezone({ shop, admin }) {
  const settings = await getShopSettings(shop);
  const savedTimezone = normalizeShopTimezone(settings?.timezone);
  if (savedTimezone) {
    return savedTimezone;
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
      return normalizeShopTimezone(json.data?.shop?.ianaTimezone) || DEFAULT_TIMEZONE;
    } catch {
      return DEFAULT_TIMEZONE;
    }
  }

  return DEFAULT_TIMEZONE;
}
