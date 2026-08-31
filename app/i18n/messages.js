import en from "../../locales/en.json";
import { DEFAULT_LOCALE, isSupportedLocale } from "./locales.js";

// Eager so catalogs are bundled with the app instead of fetched via /@fs/,
// which Vite blocks for files outside server.fs.allow during Shopify dev.
const localeModules = import.meta.glob("../../locales/*.json", { eager: true });
const loadedMessages = new Map([[DEFAULT_LOCALE, en]]);

function localeModulePath(locale) {
  return `../../locales/${locale}.json`;
}

function readLocaleModule(locale) {
  const relativePath = localeModulePath(locale);
  const direct = localeModules[relativePath];
  if (direct) return direct;

  const suffix = `/locales/${locale}.json`;
  const match = Object.entries(localeModules).find(
    ([path]) => path === relativePath || path.endsWith(suffix),
  );
  return match?.[1] || null;
}

export function getFallbackMessages() {
  return en;
}

export function getMessages(locale) {
  return loadedMessages.get(locale) || loadedMessages.get(DEFAULT_LOCALE) || en;
}

export async function loadMessages(locale) {
  const resolved = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
  const cached = loadedMessages.get(resolved);
  if (cached) return cached;

  const entry = readLocaleModule(resolved);
  if (!entry) return en;

  const mod = typeof entry === "function" ? await entry() : entry;
  const messages = mod.default || mod;
  loadedMessages.set(resolved, messages);
  return messages;
}
