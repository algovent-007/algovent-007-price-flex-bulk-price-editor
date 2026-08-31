export function isShopifyAccessRevoked(error) {
  if (error instanceof Response && (error.status === 401 || error.status === 403)) {
    return true;
  }

  const code = Number(
    error?.response?.code ||
      error?.errors?.networkStatusCode ||
      error?.networkStatusCode ||
      error?.statusCode ||
      error?.status ||
      0,
  );
  if (code === 401 || code === 403) {
    return true;
  }

  const message = String(error?.message || error?.errors?.message || error || "").toLowerCase();
  return (
    message.includes("unauthorized") ||
    message.includes("invalid api key") ||
    message.includes("access token") ||
    message.includes("graphql client: forbidden") ||
    message.includes("non-expiring access tokens are no longer accepted")
  );
}
