import { authenticate } from "../shopify.server";
import {
  cancelBillingSubscription,
  createBillingRequest,
} from "./billing.server";
import { appendEmbeddedAppParams } from "../utils/embedded-app-params.server";

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
      return redirect(appendEmbeddedAppParams(request, result.redirectTo));
    }
    return Response.json({ success: true });
  }

  if (!planName) {
    return redirect(
      appendEmbeddedAppParams(
        request,
        `/app/plans?billing=error&error=${encodeURIComponent("Plan name is required.")}`,
      ),
    );
  }

  const result = await createBillingRequest({
    admin,
    session,
    planName: String(planName),
    request,
  });

  if (result.error) {
    return redirect(
      appendEmbeddedAppParams(
        request,
        `/app/plans?billing=error&error=${encodeURIComponent(result.error)}`,
      ),
    );
  }

  if (result.confirmationUrl) {
    return redirect(result.confirmationUrl, { target: "_top" });
  }

  if (result.redirectTo) {
    return redirect(result.redirectTo);
  }

  return Response.json({ success: true });
}
