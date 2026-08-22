import { useLoaderData } from "react-router";
import { requireAdmin } from "../services/admin-auth.server";
import { countAdminUsers } from "../models/admin-user.server";

export const loader = async ({ request }) => {
  const admin = await requireAdmin(request);
  return {
    admin,
    adminCount: await countAdminUsers(),
    // eslint-disable-next-line no-undef
    appUrl: process.env.SHOPIFY_APP_URL || "",
    // eslint-disable-next-line no-undef
    hasBootstrap: Boolean(process.env.ADMIN_EMAIL),
  };
};

export default function AdminSettings() {
  const { admin, adminCount, appUrl, hasBootstrap } = useLoaderData();

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h2>Settings</h2>
          <p>Staging admin dashboard configuration.</p>
        </div>
      </div>

      <div className="admin-card">
        <h3>Signed-in admin</h3>
        <p>
          {admin.name} · {admin.email} · {admin.role}
        </p>
      </div>

      <div className="admin-card">
        <h3>Environment</h3>
        <p>App URL: {appUrl || "Not set"}</p>
        <p>Authorized admin users: {adminCount}</p>
        <p>Bootstrap admin from environment: {hasBootstrap ? "Configured" : "Not configured"}</p>
        <p className="admin-muted">
          This dashboard uses the existing staging PostgreSQL database. Shopify access tokens and
          merchant credentials are never displayed.
        </p>
      </div>
    </div>
  );
}
