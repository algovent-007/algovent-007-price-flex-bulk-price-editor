/* eslint-disable react/prop-types -- this codebase does not use PropTypes */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_LOCALE,
  getLocaleDirection,
  isSupportedLocale,
  matchSupportedLocale,
} from "./locales";
import { getFallbackMessages, getMessages } from "./messages";
import { resolveLocale } from "./resolve-locale";
import { readStoredLocale, writeStoredLocale } from "./storage";
import { formatCurrency, formatDateTime, formatNumber, translate } from "./translate";

const I18nContext = createContext(null);

function applyDocumentLocale(locale) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
  document.documentElement.dir = getLocaleDirection(locale);
}

export function I18nProvider({ children, savedLocale = null, shopifyLocale = null }) {
  const [locale, setLocaleState] = useState(() =>
    resolveLocale({ savedLocale, shopifyLocale }),
  );

  useEffect(() => {
    applyDocumentLocale(locale);
  }, [locale]);

  useEffect(() => {
    const stored = readStoredLocale();
    if (stored) {
      setLocaleState((current) => (current === stored ? current : stored));
    }
  }, []);

  const setLocale = useCallback((nextLocale) => {
    if (!isSupportedLocale(nextLocale)) return;
    setLocaleState(nextLocale);
    writeStoredLocale(nextLocale);
    applyDocumentLocale(nextLocale);
  }, []);

  const applyShopifyLocale = useCallback(
    (nextShopifyLocale) => {
      if (savedLocale || readStoredLocale()) return;
      const matched = matchSupportedLocale(nextShopifyLocale);
      if (!matched || matched === DEFAULT_LOCALE) return;
      setLocaleState((current) => {
        if (current !== DEFAULT_LOCALE) return current;
        writeStoredLocale(matched);
        return matched;
      });
    },
    [savedLocale],
  );

  const value = useMemo(() => {
    const messages = getMessages(locale);
    const fallbackMessages = getFallbackMessages();
    const t = (key, vars) => translate(messages, fallbackMessages, key, vars, locale);
    return {
      locale,
      direction: getLocaleDirection(locale),
      setLocale,
      applyShopifyLocale,
      t,
      formatDateTime: (value, options) => formatDateTime(value, locale, options),
      formatNumber: (value, options) => formatNumber(value, locale, options),
      formatCurrency: (value, currency) => formatCurrency(value, locale, currency),
    };
  }, [applyShopifyLocale, locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}
