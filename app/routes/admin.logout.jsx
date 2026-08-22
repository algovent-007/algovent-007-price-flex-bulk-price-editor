import { redirect } from "react-router";
import { clearAdminCookies, logoutAdmin } from "../services/admin-auth.server";

async function completeLogout(request) {
  await logoutAdmin(request);
  const headers = new Headers();
  clearAdminCookies(headers, request);
  throw redirect("/admin/login", { headers });
}

export const loader = async ({ request }) => completeLogout(request);
export const action = async ({ request }) => completeLogout(request);
