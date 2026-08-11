import { redirect, useLoaderData } from "react-router";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { login, authenticate } from "../../shopify.server";
import { requireSubscription } from "../../services/subscription.server";
import styles from "./styles.module.css";

export const loader = async ({ request }) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    try {
      const { admin, session } = await authenticate.admin(request);
      const subscription = await requireSubscription(admin, session);

      if (!subscription) {
        throw redirect(`/billing/confirm?${url.searchParams.toString()}`);
      }
    } catch (error) {
      if (error instanceof Response) {
        throw error;
      }
    }

    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  useLoaderData();

  return (
    <AppProvider embedded={false}>
      <div className={styles.landing}>
        <s-box background="base" padding="none">
          <s-stack direction="block" alignItems="center" justifyContent="center">
            <s-text color="subdued" type="generic">
              <span className={styles.title}>Price Flex Bulk Price Editor</span>
            </s-text>
          </s-stack>
        </s-box>
      </div>
    </AppProvider>
  );
}
