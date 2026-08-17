import { DEFAULT_LOCALE } from "./locales.js";

function getByPath(source, path) {
  if (!source || !path) return undefined;
  return path.split(".").reduce((current, segment) => {
    if (current == null) return undefined;
    return current[segment];
  }, source);
}

function interpolate(template, vars = {}, locale = DEFAULT_LOCALE) {
  return String(template).replace(/\{\{(\w+)\}\}/g, (_, name) => {
    if (!Object.prototype.hasOwnProperty.call(vars, name) || vars[name] == null) {
      return "";
    }
    const value = vars[name];
    if (typeof value === "number" && Number.isFinite(value)) {
      try {
        return new Intl.NumberFormat(locale).format(value);
      } catch {
        return String(value);
      }
    }
    return String(value);
  });
}

function resolvePlural(raw, vars, locale, fallbackRaw) {
  const count = Number(vars.count);
  let category = "other";
  try {
    category = new Intl.PluralRules(locale).select(Number.isFinite(count) ? count : 0);
  } catch {
    category = "other";
  }

  const fallback =
    typeof fallbackRaw === "object" && fallbackRaw
      ? fallbackRaw[category] ?? fallbackRaw.other ?? fallbackRaw.one
      : fallbackRaw;

  const chosen =
    raw[category] ?? raw.other ?? raw.one ?? fallback;

  return typeof chosen === "string" ? chosen : "";
}

/**
 * Look up a translation key with English fallback, interpolation, and pluralization.
 * Never returns undefined or the raw key.
 */
export function translate(messages, fallbackMessages, key, vars = {}, locale = DEFAULT_LOCALE) {
  if (!key) return "";

  const raw = getByPath(messages, key);
  const fallbackRaw = getByPath(fallbackMessages, key);
  const value = raw ?? fallbackRaw;

  if (value == null) {
    return "";
  }

  if (typeof value === "object") {
    const template = resolvePlural(value, vars, locale, fallbackRaw);
    return interpolate(template, vars, locale);
  }

  return interpolate(value, vars, locale);
}

export function formatDateTime(value, locale = DEFAULT_LOCALE, options) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  try {
    return date.toLocaleString(locale, options);
  } catch {
    return date.toLocaleString(DEFAULT_LOCALE, options);
  }
}

export function formatNumber(value, locale = DEFAULT_LOCALE, options) {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value ?? "");
  try {
    return new Intl.NumberFormat(locale, options).format(number);
  } catch {
    return new Intl.NumberFormat(DEFAULT_LOCALE, options).format(number);
  }
}

export function formatCurrency(value, locale = DEFAULT_LOCALE, currency = "USD") {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value ?? "");
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(number);
  } catch {
    return new Intl.NumberFormat(DEFAULT_LOCALE, { style: "currency", currency: "USD" }).format(
      number,
    );
  }
}
