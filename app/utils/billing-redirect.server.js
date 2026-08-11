/**
 * HTML document that breaks out of the embedded iframe and opens Shopify billing.
 * Same approach as @shopify/shopify-app-react-router redirect(..., { target: "_top" }).
 */
export function createBillingRedirectResponse(confirmationUrl, apiKey) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" data-api-key="${apiKey}"></script>
</head>
<body>
  <script>window.open(${JSON.stringify(confirmationUrl)}, "_top");</script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export function isDocumentNavigation(request) {
  const url = new URL(request.url);

  if (url.pathname.endsWith(".data")) {
    return false;
  }

  const purpose = request.headers.get("Purpose") || request.headers.get("Sec-Purpose");
  if (purpose === "prefetch") {
    return false;
  }

  const accept = request.headers.get("Accept") || "";
  return accept.includes("text/html");
}
