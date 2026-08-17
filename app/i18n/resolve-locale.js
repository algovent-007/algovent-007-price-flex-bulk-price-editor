import { DEFAULT_LOCALE, matchSupportedLocale } from "./locales.js";

/**
 * Resolve the active locale:
 * 1. Saved merchant preference
 * 2. Shopify/user locale
 * 3. English
 */
export function resolveLocale({ savedLocale, shopifyLocale } = {}) {
  return (
    matchSupportedLocale(savedLocale) ||
    matchSupportedLocale(shopifyLocale) ||
    DEFAULT_LOCALE
  );
}
