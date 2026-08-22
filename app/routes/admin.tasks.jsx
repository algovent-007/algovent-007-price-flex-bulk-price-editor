import { Form, useLoaderData } from "react-router";
import { requireAdmin } from "../services/admin-auth.server";
import { listAdminTasks } from "../models/admin-tasks.server";
import { TASK_STATUSES } from "../constants/task-status";
import { parsePage, parsePageSize } from "../utils/admin-pagination";
import { formatAdminDateTimeLines } from "../utils/admin-datetime";
import AdminPagination from "../components/admin/AdminPagination";
import { IconSearch } from "../components/admin/AdminIcons";

export const loader = async ({ request }) => {
  await requireAdmin(request);
  const url = new URL(request.url);
  const q = url.searchParams.get("q") || "";
  const status = url.searchParams.get("status") || "";
  const page = parsePage(url.searchParams.get("page"));
  const pageSize = parsePageSize(url.searchParams.get("pageSize"));
  const { total, rows } = await listAdminTasks({ query: q, status, page, pageSize });

  return {
    params: { q, status, page, pageSize },
    page,
    pageSize,
    total,
    tasks: rows,
  };
};

export default function AdminTasks() {
  const { params, page, pageSize, total, tasks } = useLoaderData();

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h2>Task list</h2>
          <p>Bulk price tasks across all staging stores.</p>
        </div>
      </div>

      <div className="admin-search-row">
        <Form method="get" className="admin-search">
          <IconSearch />
          <input type="search" name="q" defaultValue={params.q} placeholder="Search by shop, task name or ID..." />
          {params.status ? <input type="hidden" name="status" value={params.status} /> : null}
          <input type="hidden" name="pageSize" value={pageSize} />
        </Form>
        <Form method="get">
          {params.q ? <input type="hidden" name="q" value={params.q} /> : null}
          <input type="hidden" name="pageSize" value={pageSize} />
          <div className="admin-field">
            <label htmlFor="task-status">Status</label>
            <select id="task-status" name="status" defaultValue={params.status} onChange={(event) => event.target.form.submit()}>
              <option value="">All</option>
              {TASK_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </Form>
        <div className="admin-total">Total tasks: {total.toLocaleString()}</div>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Task ID</th>
              <th>Name</th>
              <th>Shop</th>
              <th>Status</th>
              <th>Progress</th>
              <th>Created</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={8} className="admin-muted">
                  No tasks match the current search or filters.
                </td>
              </tr>
            ) : (
              tasks.map((task, index) => (
                <tr key={task.id}>
                  <td>{(page - 1) * pageSize + index + 1}</td>
                  <td>{task.id}</td>
                  <td>{task.name}</td>
                  <td>{task.shop || "—"}</td>
                  <td>
                    <span className={`admin-badge ${task.status === "completed" ? "success" : task.status === "failed" ? "critical" : "info"}`}>
                      {task.status}
                    </span>
                  </td>
                  <td>
                    {task.processedItems}/{task.totalItems}
                  </td>
                  <td>
                    <div className="admin-datetime">
                      {formatAdminDateTimeLines(task.createdAt).map((line) => (
                        <span key={line}>{line}</span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className="admin-datetime">
                      {formatAdminDateTimeLines(task.updatedAt).map((line) => (
                        <span key={line}>{line}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AdminPagination pathname="/admin/tasks" params={params} page={page} pageSize={pageSize} total={total} />
    </div>
  );
}
