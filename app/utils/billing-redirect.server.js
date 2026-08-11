export function createBillingRedirectHtml(confirmationUrl, apiKey) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Redirecting to Shopify billing</title>
  <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" data-api-key="${apiKey}"></script>
</head>
<body>
  <p>Redirecting to Shopify billing approval...</p>
  <script>window.open(${JSON.stringify(confirmationUrl)}, "_top");</script>
</body>
</html>`;
}

export function createBillingRedirectResponse(confirmationUrl, apiKey) {
  return new Response(createBillingRedirectHtml(confirmationUrl, apiKey), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
