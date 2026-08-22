import { redirect, useLoaderData } from "react-router";
import { applyAdminSessionCookie, getAdminFromRequest, loginAdmin } from "../services/admin-auth.server";
import { ensureBootstrapAdmin } from "../models/admin-user.server";

export const loader = async ({ request }) => {
  await ensureBootstrapAdmin();
  const admin = await getAdminFromRequest(request);
  if (admin) {
    throw redirect("/admin/users");
  }

  return {
    error: new URL(request.url).searchParams.get("error") || "",
  };
};

export const action = async ({ request }) => {
  const form = await request.formData();
  const result = await loginAdmin({
    email: form.get("email"),
    password: form.get("password"),
    request,
  });

  if (!result.ok) {
    throw redirect(`/admin/login?error=${encodeURIComponent(result.error)}`);
  }

  const next = new URL(request.url).searchParams.get("next") || "/admin/users";
  const safeNext = next.startsWith("/admin") ? next : "/admin/users";
  const headers = new Headers();
  applyAdminSessionCookie(headers, result.admin.id, request);
  throw redirect(safeNext, { headers });
};

export default function AdminLogin() {
  const { error } = useLoaderData();

  return (
    <div className="admin-root admin-login">
      <div className="admin-login-card">
        <h1>Staging Admin Dashboard</h1>
        <p>Sign in with an authorized admin account.</p>
        {error ? <div className="admin-alert">{error}</div> : null}
        <form method="post" className="admin-form">
          <div className="admin-field">
            <label htmlFor="admin-email">Email</label>
            <input id="admin-email" name="email" type="email" autoComplete="username" required />
          </div>
          <div className="admin-field">
            <label htmlFor="admin-password">Password</label>
            <input id="admin-password" name="password" type="password" autoComplete="current-password" required />
          </div>
          <button className="admin-btn primary" type="submit">
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
