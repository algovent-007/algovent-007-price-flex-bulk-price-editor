import { redirect } from "react-router";
import {
  clearSupportSessionCookie,
  endSupportSession,
} from "../services/admin-support-session.server";

async function exitSupport(request) {
  await endSupportSession(request);
  const headers = new Headers();
  clearSupportSessionCookie(headers, request);
  throw redirect("/admin/users", { headers });
}

export const loader = async ({ request }) => exitSupport(request);
export const action = async ({ request }) => exitSupport(request);
