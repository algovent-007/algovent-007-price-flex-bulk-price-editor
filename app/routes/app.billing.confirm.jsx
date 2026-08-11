import { redirect } from "react-router";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  throw redirect(`/billing/confirm?${url.searchParams.toString()}`);
};

export default function LegacyBillingConfirmRedirect() {
  return null;
}
