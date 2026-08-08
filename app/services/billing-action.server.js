import { authenticate } from "../shopify.server";
import {
  cancelBillingSubscription,
  createBillingRequest,
} from "./billing.server";

export async function handleBillingAction({ request }) {
  const { admin, session, redirect } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") || "select";
  const planName = formData.get("planName");

  if (intent === "cancel") {
    const result = await cancelBillingSubscription({ admin, session });
    if (result.error) {
      return Response.json({ success: false, error: result.error }, { status: 400 });
    }
    if (result.redirectTo) {
      return redirect(result.redirectTo);
    }
    return Response.json({ success: true });
  }

  if (!planName) {
    return Response.json({ success: false, error: "Plan name is required." }, { status: 400 });
  }

  const result = await createBillingRequest({
    admin,
    session,
    planName: String(planName),
    request,
  });

  if (result.error) {
    return Response.json({ success: false, error: result.error }, { status: 400 });
  }

  if (result.confirmationUrl) {
    return redirect(result.confirmationUrl, { target: "_top" });
  }

  if (result.redirectTo) {
    return redirect(result.redirectTo);
  }

  return Response.json({ success: true });
}
