import { redirect } from "react-router";
import { requireAdmin } from "../services/admin-auth.server";
import {
  applySupportSessionCookie,
  startSupportSession,
} from "../services/admin-support-session.server";

export const action = async ({ request }) => {
  await requireAdmin(request);
  const form = await request.formData();
  const shop = String(form.get("shop") || "").trim();
  const result = await startSupportSession({ request, shop });

  if (!result.ok) {
    throw redirect(`/admin/users?error=${encodeURIComponent(result.error)}`);
  }

  const headers = new Headers();
  applySupportSessionCookie(headers, result.supportSessionId, result.maxAgeSeconds, request);
  throw redirect("/app", { headers });
};

export const loader = async () => {
  throw redirect("/admin/users");
};
