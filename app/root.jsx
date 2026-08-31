import { Links, Meta, Outlet, Scripts, ScrollRestoration, useLoaderData } from "react-router";
import { I18nProvider } from "./i18n/I18nProvider";
import { DEFAULT_LOCALE, getLocaleDirection } from "./i18n/locales";
import { loadMessages } from "./i18n/messages";
import { resolveLocale } from "./i18n/resolve-locale";
import { readLocaleCookie } from "./i18n/storage";

export function shouldRevalidate({ currentUrl, nextUrl }) {
  return currentUrl.searchParams.get("locale") !== nextUrl.searchParams.get("locale");
}

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const savedLocale = readLocaleCookie(request.headers.get("Cookie"));
  const shopifyLocale = url.searchParams.get("locale");
  const locale = resolveLocale({ savedLocale, shopifyLocale });
  const [messages, fallbackMessages] = await Promise.all([
    loadMessages(locale),
    locale === DEFAULT_LOCALE ? Promise.resolve(null) : loadMessages(DEFAULT_LOCALE),
  ]);
  return {
    savedLocale,
    shopifyLocale,
    locale,
    messages,
    fallbackMessages: fallbackMessages || messages,
  };
};

export default function App() {
  const { savedLocale, shopifyLocale, locale, messages, fallbackMessages } = useLoaderData();

  return (
    <html lang={locale || DEFAULT_LOCALE} dir={getLocaleDirection(locale)}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <Meta />
        <Links />
      </head>
      <body>
        <I18nProvider
          savedLocale={savedLocale}
          shopifyLocale={shopifyLocale}
          initialMessages={messages}
          initialFallbackMessages={fallbackMessages}
        >
          <Outlet />
        </I18nProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
