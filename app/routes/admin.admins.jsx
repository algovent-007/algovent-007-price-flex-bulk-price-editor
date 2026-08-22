import { redirect, useLoaderData } from "react-router";
import { requireAdmin } from "../services/admin-auth.server";
import { recordAdminAudit } from "../services/admin-audit.server";
import {
  countAdminUsers,
  createAdminUser,
  deleteAdminUser,
  getAdminUserByEmail,
  listAdminUsers,
} from "../models/admin-user.server";
import { formatAdminDateTimeLines } from "../utils/admin-datetime";

export const loader = async ({ request }) => {
  const admin = await requireAdmin(request);
  const url = new URL(request.url);
  return {
    admin,
    admins: await listAdminUsers(),
    error: url.searchParams.get("error") || "",
  };
};

export const action = async ({ request }) => {
  const admin = await requireAdmin(request);
  const form = await request.formData();
  const intent = String(form.get("intent") || "");

  if (intent === "create") {
    const email = String(form.get("email") || "");
    const name = String(form.get("name") || "");
    const password = String(form.get("password") || "");
    if (!email || !password) {
      throw redirect("/admin/admins?error=Email%20and%20password%20are%20required.");
    }
    if (await getAdminUserByEmail(email)) {
      throw redirect("/admin/admins?error=An%20admin%20with%20that%20email%20already%20exists.");
    }
    const created = await createAdminUser({ email, name, password, role: "admin" });
    await recordAdminAudit({
      adminUser: admin,
      action: "admin.create_admin_user",
      success: true,
      details: { createdAdminId: created.id, createdEmail: created.email },
    });
    throw redirect("/admin/admins");
  }

  if (intent === "delete") {
    if (admin.role !== "owner") {
      await recordAdminAudit({
        adminUser: admin,
        action: "admin.delete_admin_user",
        success: false,
        details: { reason: "not_owner" },
      });
      throw redirect("/admin/admins?error=Only%20an%20owner%20can%20remove%20admin%20users.");
    }

    const id = String(form.get("id") || "");
    if (id === admin.id) {
      throw redirect("/admin/admins?error=You%20cannot%20delete%20your%20own%20account.");
    }
    if ((await countAdminUsers()) <= 1) {
      throw redirect("/admin/admins?error=At%20least%20one%20admin%20user%20is%20required.");
    }
    await deleteAdminUser(id);
    await recordAdminAudit({
      adminUser: admin,
      action: "admin.delete_admin_user",
      success: true,
      details: { deletedAdminId: id },
    });
    throw redirect("/admin/admins");
  }

  return { ok: false };
};

export default function AdminUsersManage() {
  const { admin, admins, error } = useLoaderData();
  const isOwner = admin.role === "owner";

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h2>Admin users</h2>
          <p>Accounts that can open the staging admin dashboard.</p>
        </div>
      </div>

      {error ? <div className="admin-alert">{error}</div> : null}

      <div className="admin-card">
        <h3>Add admin</h3>
        <form method="post" className="admin-form">
          <input type="hidden" name="intent" value="create" />
          <div className="admin-field">
            <label htmlFor="new-admin-name">Name</label>
            <input id="new-admin-name" name="name" required />
          </div>
          <div className="admin-field">
            <label htmlFor="new-admin-email">Email</label>
            <input id="new-admin-email" name="email" type="email" required />
          </div>
          <div className="admin-field">
            <label htmlFor="new-admin-password">Password</label>
            <input id="new-admin-password" name="password" type="password" required minLength={8} />
          </div>
          <button className="admin-btn primary" type="submit">
            Create admin
          </button>
        </form>
      </div>

      <div className="admin-table-wrap" style={{ marginTop: 16 }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Created</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {admins.map((user) => {
              const canRemove = isOwner && user.id !== admin.id;
              return (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>
                    <div className="admin-datetime">
                      {formatAdminDateTimeLines(user.createdAt).map((line) => (
                        <span key={line}>{line}</span>
                      ))}
                    </div>
                  </td>
                  <td>
                    {canRemove ? (
                      <form method="post">
                        <input type="hidden" name="intent" value="delete" />
                        <input type="hidden" name="id" value={user.id} />
                        <button className="admin-btn" type="submit">
                          Remove
                        </button>
                      </form>
                    ) : (
                      <span className="admin-muted">
                        {user.id === admin.id ? "Current user" : "Owner only"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
