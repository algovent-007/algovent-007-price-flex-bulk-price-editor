/** @typedef {"en" | "cs" | "da" | "nl" | "fi" | "fr" | "de" | "it" | "ko" | "nb" | "pl" | "pt-BR" | "pt-PT" | "es" | "sv" | "tr" | "zh-CN" | "zh-TW" | "ja" | "th"} AppLocale */

/**
 * Single source of truth for supported app languages.
 * Add a language by appending an entry here and adding locales/<code>.json.
 * @type {ReadonlyArray<{ code: AppLocale, name: string, direction: "ltr" | "rtl" }>}
 */
export const SUPPORTED_LOCALES = Object.freeze([
  { code: "en", name: "English", direction: "ltr" },
  { code: "cs", name: "Čeština", direction: "ltr" },
  { code: "da", name: "Dansk", direction: "ltr" },
  { code: "nl", name: "Nederlands", direction: "ltr" },
  { code: "fi", name: "Suomi", direction: "ltr" },
  { code: "fr", name: "Français", direction: "ltr" },
  { code: "de", name: "Deutsch", direction: "ltr" },
  { code: "it", name: "Italiano", direction: "ltr" },
  { code: "ko", name: "한국어", direction: "ltr" },
  { code: "nb", name: "Norsk bokmål", direction: "ltr" },
  { code: "pl", name: "Polski", direction: "ltr" },
  { code: "pt-BR", name: "Português (Brasil)", direction: "ltr" },
  { code: "pt-PT", name: "Português (Portugal)", direction: "ltr" },
  { code: "es", name: "Español", direction: "ltr" },
  { code: "sv", name: "Svenska", direction: "ltr" },
  { code: "tr", name: "Türkçe", direction: "ltr" },
  { code: "zh-CN", name: "简体中文", direction: "ltr" },
  { code: "zh-TW", name: "繁體中文", direction: "ltr" },
  { code: "ja", name: "日本語", direction: "ltr" },
  { code: "th", name: "ไทย", direction: "ltr" },
]);

export const DEFAULT_LOCALE = "en";

export const LOCALE_STORAGE_KEY = "price_flex_locale";
export const LOCALE_COOKIE_NAME = "price_flex_locale";

const LOCALE_BY_CODE = new Map(SUPPORTED_LOCALES.map((locale) => [locale.code, locale]));

export function isSupportedLocale(value) {
  return LOCALE_BY_CODE.has(value);
}

export function getLocaleConfig(code) {
  return LOCALE_BY_CODE.get(code) || LOCALE_BY_CODE.get(DEFAULT_LOCALE);
}

export function getLocaleDirection(code) {
  return getLocaleConfig(code).direction;
}

const LOCALE_ALIASES = {
  "zh-hans": "zh-CN",
  "zh-hant": "zh-TW",
  "pt-br": "pt-BR",
  "pt-pt": "pt-PT",
  no: "nb",
  nn: "nb",
};

/**
 * Map a Shopify/BCP-47 locale onto a supported app locale.
 * @param {string | null | undefined} value
 * @returns {AppLocale | null}
 */
export function matchSupportedLocale(value) {
  if (!value || typeof value !== "string") return null;

  const normalized = value.trim().replace(/_/g, "-");
  if (!normalized) return null;

  if (LOCALE_BY_CODE.has(normalized)) {
    return normalized;
  }

  const lower = normalized.toLowerCase();
  if (LOCALE_ALIASES[lower]) {
    return LOCALE_ALIASES[lower];
  }

  const aliasedPrefix = LOCALE_ALIASES[lower.split("-")[0]];
  if (aliasedPrefix) {
    return aliasedPrefix;
  }

  for (const locale of SUPPORTED_LOCALES) {
    if (locale.code.toLowerCase() === lower) {
      return locale.code;
    }
  }

  const prefix = normalized.split("-")[0].toLowerCase();
  for (const locale of SUPPORTED_LOCALES) {
    if (locale.code.toLowerCase() === prefix) {
      return locale.code;
    }
  }

  for (const locale of SUPPORTED_LOCALES) {
    if (locale.code.toLowerCase().startsWith(`${prefix}-`)) {
      return locale.code;
    }
  }

  return null;
}
