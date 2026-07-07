import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";
import { processDueTasksForShop } from "../services/scheduler.server";

export const loader = async ({ request }) => {
  try {
    const { admin, session } = await authenticate.admin(request);

    console.log("Authenticated:", session.shop);

    await processDueTasksForShop({
      admin,
      shop: session.shop,
    });

    // eslint-disable-next-line no-undef
    return { apiKey: process.env.SHOPIFY_API_KEY || "" };
  } catch (error) {
    if (error instanceof Response) {
      console.error("===== SHOPIFY AUTH ERROR =====");
      console.error("Status:", error.status);
      console.error("Status Text:", error.statusText);
      console.error("Headers:", Object.fromEntries(error.headers.entries()));

      try {
        const body = await error.text();
        console.error("Body:", body);
      } catch (e) {
        console.error("Couldn't read response body");
      }
    } else {
      console.error(error);
    }

    throw error;
  }
};

export default function App() {
  const { apiKey } = useLoaderData();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">Current Tasks</s-link>
        <s-link href="/app/new">New Task</s-link>
        <s-link href="/app/scheduled">Scheduled Tasks</s-link>
        <s-link href="/app/history">Tasks History</s-link>
        <s-link href="/app/account">Account</s-link>
        <s-link href="/app/plans">Plans</s-link>
        <s-link href="/app/support">Support</s-link>
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
