import { getShopSettings, saveShopSettings } from "../models/shop-settings.server";

export const DEFAULT_TIMEZONE = "Asia/Kolkata";

const TIMEZONE_ALIASES = {
  "Asia/Calcutta": "Asia/Kolkata",
};

export function normalizeShopTimezone(timezone) {
  const trimmed = String(timezone || "").trim();
  if (!trimmed) return "";
  return TIMEZONE_ALIASES[trimmed] || trimmed;
}

export async function getShopTimezoneFromShopify(admin) {
  if (!admin) return "";

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
    return normalizeShopTimezone(json.data?.shop?.ianaTimezone);
  } catch {
    return "";
  }
}

export async function getShopTimezone({ shop, admin }) {
  const settings = await getShopSettings(shop);
  const savedTimezone = normalizeShopTimezone(settings?.timezone);
  if (savedTimezone) {
    return savedTimezone;
  }

  const shopifyTimezone = await getShopTimezoneFromShopify(admin);
  if (shopifyTimezone) {
    return shopifyTimezone;
  }

  return DEFAULT_TIMEZONE;
}

export async function resolveScheduleTimezone({ shop, admin, browserTimezone }) {
  const settings = await getShopSettings(shop);
  const savedTimezone = normalizeShopTimezone(settings?.timezone);
  if (savedTimezone) {
    return savedTimezone;
  }

  const browserTz = normalizeShopTimezone(browserTimezone);
  if (browserTz) {
    return browserTz;
  }

  return getShopTimezone({ shop, admin });
}

export async function getShopTimezoneContext({ shop, admin }) {
  const settings = await getShopSettings(shop);
  const savedTimezone = normalizeShopTimezone(settings?.timezone);
  const shopifyTimezone = savedTimezone
    ? ""
    : await getShopTimezoneFromShopify(admin);

  return {
    timezone: savedTimezone || shopifyTimezone || DEFAULT_TIMEZONE,
    hasSavedTimezone: Boolean(savedTimezone),
    shopifyTimezone: shopifyTimezone || null,
  };
}

export async function ensureShopTimezoneSaved({ shop, timezone, admin }) {
  const normalized = normalizeShopTimezone(timezone);
  if (!normalized) return;

  const settings = await getShopSettings(shop);
  if (normalizeShopTimezone(settings?.timezone)) {
    return;
  }

  let name = settings?.name || "";
  let email = settings?.email || "";

  if ((!name || !email) && admin) {
    try {
      const response = await admin.graphql(
        `#graphql
        query getShopContact {
          shop {
            name
            email
          }
        }`
      );
      const json = await response.json();
      name = name || json.data?.shop?.name || "";
      email = email || json.data?.shop?.email || "";
    } catch {
      // Best effort only.
    }
  }

  await saveShopSettings({
    shop,
    name: name || shop,
    email: email || "merchant@example.com",
    timezone: normalized,
  });
}
