import { redirect } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { handleBillingAction } from "../services/billing-action.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  throw redirect("/app/plans");
};

export const action = handleBillingAction;

export default function BillingRoute() {
  return null;
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
