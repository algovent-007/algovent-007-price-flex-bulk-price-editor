import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { syncSubscriptionAfterApproval } from "../services/billing.server";
import { SUBSCRIPTION_STATUS } from "../constants/billing";
import { logBillingError } from "../utils/billing-logger.server";

export const loader = async ({ request }) => {
  const { admin, session, redirect } = await authenticate.admin(request);
  const url = new URL(request.url);
  const planName = url.searchParams.get("plan");

  if (!planName) {
    throw redirect("/app/plans?billing=missing_plan");
  }

  try {
    const subscription = await syncSubscriptionAfterApproval({
      admin,
      session,
      planName,
    });

    if (!subscription || subscription.status !== SUBSCRIPTION_STATUS.ACTIVE) {
      throw redirect("/app/plans?billing=pending");
    }

    throw redirect("/app?billing=success");
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    logBillingError("subscription_update", error, {
      shop: session.shop,
      planName,
      source: "billing_callback",
    });

    throw redirect("/app/plans?billing=error");
  }
};

export default function BillingCallback() {
  return null;
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
