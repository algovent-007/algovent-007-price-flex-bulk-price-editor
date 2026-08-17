import { LOCALE_COOKIE_NAME, LOCALE_STORAGE_KEY, isSupportedLocale } from "./locales.js";

export function readLocaleCookie(cookieHeader) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|; )${LOCALE_COOKIE_NAME}=([^;]*)`));
  if (!match) return null;
  try {
    const value = decodeURIComponent(match[1]);
    return isSupportedLocale(value) ? value : null;
  } catch {
    return null;
  }
}

export function localeCookieHeader(locale) {
  const secure =
    typeof document !== "undefined" && document.location?.protocol === "https:"
      ? "; Secure"
      : "";
  return `${LOCALE_COOKIE_NAME}=${encodeURIComponent(locale)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

export function readStoredLocale() {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isSupportedLocale(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeStoredLocale(locale) {
  if (typeof window === "undefined" || !isSupportedLocale(locale)) return;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    document.cookie = localeCookieHeader(locale);
  } catch {
    // Ignore storage failures in private browsing.
  }
}
