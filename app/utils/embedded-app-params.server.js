const EMBEDDED_APP_PARAM_KEYS = [
  "host",
  "shop",
  "embedded",
  "locale",
  "session",
  "id_token",
  "timestamp",
  "hmac",
];

export function copyEmbeddedAppParams(sourceUrl, destinationUrl) {
  const source =
    typeof sourceUrl === "string" ? new URL(sourceUrl) : new URL(sourceUrl.url);
  const destination =
    typeof destinationUrl === "string"
      ? new URL(destinationUrl, source.origin)
      : new URL(destinationUrl.url);

  for (const key of EMBEDDED_APP_PARAM_KEYS) {
    const value = source.searchParams.get(key);
    if (value && !destination.searchParams.has(key)) {
      destination.searchParams.set(key, value);
    }
  }

  return destination;
}

export function appendEmbeddedAppParams(sourceUrl, path) {
  const source =
    typeof sourceUrl === "string" ? new URL(sourceUrl) : new URL(sourceUrl.url);
  const destination = copyEmbeddedAppParams(source, new URL(path, source.origin));
  return `${destination.pathname}${destination.search}`;
}

export function isValidShopifyBillingConfirmationUrl(urlString) {
  try {
    const url = new URL(urlString);
    const host = url.hostname.toLowerCase();
    const isShopifyHost =
      host === "admin.shopify.com" ||
      host.endsWith(".myshopify.com") ||
      host.endsWith(".shopify.com");

    if (!isShopifyHost) {
      return false;
    }

    return /charges|billing|confirm|app_subscription/i.test(`${url.pathname}${url.search}`);
  } catch {
    return false;
  }
}
