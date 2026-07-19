export function getProductNumericId(productId) {
  if (!productId) return null;
  const numericId = String(productId).split("/").pop();
  return numericId && /^\d+$/.test(numericId) ? numericId : null;
}

export function getShopHandleFromDomain(shopDomain) {
  return String(shopDomain || "")
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(".myshopify.com", "")
    .split("/")[0];
}

export function getAdminStoreHandle(shopDomain) {
  if (typeof window !== "undefined") {
    const match = window.location.pathname.match(/\/store\/([^/]+)/);
    if (match?.[1]) return match[1];
  }

  return getShopHandleFromDomain(shopDomain) || null;
}

export function getShopifyAdminProductPath(productId) {
  const numericId = getProductNumericId(productId);
  if (!numericId) return null;
  return `shopify://admin/products/${numericId}`;
}

export function getShopifyAdminProductUrl(productId, shopDomain) {
  const numericId = getProductNumericId(productId);
  if (!numericId) return null;

  const storeHandle = getAdminStoreHandle(shopDomain);
  if (storeHandle) {
    return `https://admin.shopify.com/store/${storeHandle}/products/${numericId}`;
  }

  return getShopifyAdminProductPath(productId);
}

export function openShopifyAdminProduct(productId, shopDomain) {
  const httpsUrl = getShopifyAdminProductUrl(productId, shopDomain);
  const shopifyPath = getShopifyAdminProductPath(productId);

  if (typeof window === "undefined") return;

  const targetWindow = window.top ?? window;

  if (httpsUrl?.startsWith("https://")) {
    targetWindow.location.href = httpsUrl;
    return;
  }

  if (shopifyPath) {
    targetWindow.location.href = shopifyPath;
  }
}
