export function isShopifyAccessRevoked(error) {
  const code = Number(error?.response?.code || error?.statusCode || error?.status || 0);
  if (code === 401 || code === 403) {
    return true;
  }

  const message = String(error?.message || error || "").toLowerCase();
  return (
    message.includes("unauthorized") ||
    message.includes("invalid api key") ||
    message.includes("access token")
  );
}
