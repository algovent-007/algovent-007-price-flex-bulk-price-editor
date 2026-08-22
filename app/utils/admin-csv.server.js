function csvEscape(value) {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(headers, rows) {
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export function shopsToExportRows(shops) {
  return shops.map((shop) => ({
    id: shop.displayId,
    shop: shop.shop,
    shop_name: shop.shopName,
    email: shop.email,
    plan: shop.planName,
    install_status: shop.installStatus,
    subscription_status: shop.subscriptionStatus || "",
    is_payment_ok: shop.isPaymentOk ? "yes" : "no",
    is_review: shop.isReview ? "yes" : "no",
    installed_on: shop.installedOn ? new Date(shop.installedOn).toISOString() : "",
    uninstalled_on: shop.uninstalledOn ? new Date(shop.uninstalledOn).toISOString() : "",
  }));
}

export const SHOP_EXPORT_HEADERS = [
  "id",
  "shop",
  "shop_name",
  "email",
  "plan",
  "install_status",
  "subscription_status",
  "is_payment_ok",
  "is_review",
  "installed_on",
  "uninstalled_on",
];
