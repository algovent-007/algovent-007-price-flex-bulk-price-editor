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

function toUrl(value, base) {
  if (value instanceof URL) {
    return new URL(value.toString());
  }

  if (typeof value === "string") {
    return base ? new URL(value, base) : new URL(value);
  }

  if (value?.url) {
    return new URL(value.url);
  }

  throw new TypeError("Invalid URL input");
}

export function copyEmbeddedAppParams(sourceUrl, destinationUrl) {
  const source = toUrl(sourceUrl);
  const destination =
    typeof destinationUrl === "string"
      ? new URL(destinationUrl, source.origin)
      : toUrl(destinationUrl);

  for (const key of EMBEDDED_APP_PARAM_KEYS) {
    const value = source.searchParams.get(key);
    if (value && !destination.searchParams.has(key)) {
      destination.searchParams.set(key, value);
    }
  }

  return destination;
}

export function appendEmbeddedAppParams(sourceUrl, path) {
  const source = toUrl(sourceUrl);
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
