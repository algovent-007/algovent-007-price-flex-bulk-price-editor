/* eslint-disable react/prop-types -- this codebase does not use PropTypes */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_LOCALE,
  getLocaleDirection,
  isSupportedLocale,
  matchSupportedLocale,
} from "./locales";
import { getFallbackMessages, loadMessages } from "./messages";
import { resolveLocale } from "./resolve-locale";
import { readStoredLocale, writeStoredLocale } from "./storage";
import { formatCurrency, formatDateTime, formatNumber, translate } from "./translate";

const I18nContext = createContext(null);

function applyDocumentLocale(locale) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
  document.documentElement.dir = getLocaleDirection(locale);
}

function buildMessageMap({ locale, messages, fallbackMessages }) {
  const fallback = fallbackMessages || messages || getFallbackMessages();
  const map = { [DEFAULT_LOCALE]: fallback };
  if (locale && messages) {
    map[locale] = messages;
  }
  return map;
}

export function I18nProvider({
  children,
  savedLocale = null,
  shopifyLocale = null,
  initialMessages = null,
  initialFallbackMessages = null,
}) {
  const initialLocale = resolveLocale({ savedLocale, shopifyLocale });
  const [locale, setLocaleState] = useState(initialLocale);
  const [messagesByLocale, setMessagesByLocale] = useState(() =>
    buildMessageMap({
      locale: initialLocale,
      messages: initialMessages,
      fallbackMessages: initialFallbackMessages,
    }),
  );

  useEffect(() => {
    applyDocumentLocale(locale);
  }, [locale]);

  useEffect(() => {
    if (savedLocale) {
      if (readStoredLocale() !== savedLocale) {
        writeStoredLocale(savedLocale);
      }
      return;
    }

    const stored = readStoredLocale();
    if (stored) {
      setLocaleState((current) => (current === stored ? current : stored));
    }
  }, []); // hydrate from cookie/localStorage once; ignore later loader stale cookie

  useEffect(() => {
    if (messagesByLocale[locale]) return undefined;

    let cancelled = false;
    loadMessages(locale)
      .then((next) => {
        if (cancelled) return;
        setMessagesByLocale((current) => ({ ...current, [locale]: next }));
      })
      .catch((error) => {
        console.error(`Failed to load locale "${locale}"`, error);
      });

    return () => {
      cancelled = true;
    };
  }, [locale, messagesByLocale]);

  const setLocale = useCallback((nextLocale) => {
    if (!isSupportedLocale(nextLocale)) return;
    writeStoredLocale(nextLocale);
    applyDocumentLocale(nextLocale);

    if (messagesByLocale[nextLocale]) {
      setLocaleState(nextLocale);
      return;
    }

    loadMessages(nextLocale)
      .then((next) => {
        setMessagesByLocale((current) => ({ ...current, [nextLocale]: next }));
        setLocaleState(nextLocale);
      })
      .catch((error) => {
        console.error(`Failed to load locale "${nextLocale}"`, error);
        setLocaleState(nextLocale);
      });
  }, [messagesByLocale]);

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
    const fallbackMessages = messagesByLocale[DEFAULT_LOCALE] || getFallbackMessages();
    const messages = messagesByLocale[locale] || fallbackMessages;
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
  }, [applyShopifyLocale, locale, messagesByLocale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}
