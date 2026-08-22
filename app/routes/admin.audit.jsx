import { Form, useLoaderData } from "react-router";
import { requireAdmin } from "../services/admin-auth.server";
import { listAdminAuditLogs } from "../services/admin-audit.server";
import { parsePage, parsePageSize } from "../utils/admin-pagination";
import { formatAdminDateTimeLines } from "../utils/admin-datetime";
import { parseAuditDetails } from "../utils/admin-sanitize.server";
import AdminPagination from "../components/admin/AdminPagination";
import { IconSearch } from "../components/admin/AdminIcons";

export const loader = async ({ request }) => {
  await requireAdmin(request);
  const url = new URL(request.url);
  const q = url.searchParams.get("q") || "";
  const page = parsePage(url.searchParams.get("page"));
  const pageSize = parsePageSize(url.searchParams.get("pageSize"));
  const { total, rows } = await listAdminAuditLogs({ query: q, page, pageSize });

  return {
    params: { q, page, pageSize },
    page,
    pageSize,
    total,
    logs: rows.map((row) => ({
      ...row,
      details: parseAuditDetails(row.details),
    })),
  };
};

export default function AdminAudit() {
  const { params, page, pageSize, total, logs } = useLoaderData();

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h2>Audit log</h2>
          <p>Admin activity across staging stores. Credentials and access tokens are never stored.</p>
        </div>
      </div>

      <div className="admin-search-row">
        <Form method="get" className="admin-search">
          <IconSearch />
          <input type="search" name="q" defaultValue={params.q} placeholder="Search by admin, shop, action or task ID..." />
          <input type="hidden" name="pageSize" value={pageSize} />
        </Form>
        <div className="admin-total">Total entries: {total.toLocaleString()}</div>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Admin user</th>
              <th>Merchant / user ID</th>
              <th>Store domain</th>
              <th>Action</th>
              <th>Task / action ID</th>
              <th>Timestamp</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="admin-muted">
                  No audit activity yet.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id}>
                  <td>{log.adminEmail}</td>
                  <td>{log.merchantUserId || "—"}</td>
                  <td>{log.shop || "—"}</td>
                  <td>{log.action}</td>
                  <td>{log.taskId || log.details?.supportSessionId || "—"}</td>
                  <td>
                    <div className="admin-datetime">
                      {formatAdminDateTimeLines(log.createdAt).map((line) => (
                        <span key={line}>{line}</span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <span className={`admin-badge ${log.success ? "success" : "critical"}`}>
                      {log.success ? "Success" : "Failure"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AdminPagination pathname="/admin/audit" params={params} page={page} pageSize={pageSize} total={total} />
    </div>
  );
}
