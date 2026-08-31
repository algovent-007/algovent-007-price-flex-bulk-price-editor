/* eslint-disable react/prop-types -- this codebase does not use PropTypes */
import { useEffect, useRef, useState } from "react";
import { Form, Link, redirect, useFetcher, useLoaderData, useNavigate } from "react-router";
import { requireAdmin } from "../services/admin-auth.server";
import { recordAdminAudit } from "../services/admin-audit.server";
import {
  applySupportSessionCookie,
  startSupportSession,
} from "../services/admin-support-session.server";
import { listAdminShops, setShopReviewFlag } from "../models/admin-shops.server";
import { applyAdminPlanChange, applyAdminShopAccessFlags, refreshAdminShopStatus } from "../services/admin-shop-status.server";
import { PLAN_NAMES } from "../constants/billing";
import { parsePage, parsePageSize } from "../utils/admin-pagination";
import { buildAdminHref, readAdminListParams } from "../utils/admin-query";
import { formatAdminDateTimeLines } from "../utils/admin-datetime";
import AdminPagination from "../components/admin/AdminPagination";
import {
  IconCheck,
  IconCopy,
  IconCross,
  IconExport,
  IconFilter,
  IconMore,
  IconRefresh,
  IconSearch,
} from "../components/admin/AdminIcons";

export const loader = async ({ request }) => {
  await requireAdmin(request);
  const url = new URL(request.url);
  const params = readAdminListParams(url);
  const page = parsePage(params.page);
  const pageSize = parsePageSize(params.pageSize);
  const { total, rows } = await listAdminShops({
    query: params.q,
    status: params.status,
    plan: params.plan,
    payment: params.payment,
    review: params.review,
    page,
    pageSize,
  });

  return {
    params: { ...params, page, pageSize },
    page,
    pageSize,
    total,
    users: rows,
    error: url.searchParams.get("error") || "",
    plans: PLAN_NAMES,
  };
};

export const action = async ({ request }) => {
  const admin = await requireAdmin(request);
  const form = await request.formData();
  const intent = String(form.get("intent") || "");
  const shop = String(form.get("shop") || "").trim();

  if (intent === "toggle_review" && shop) {
    const isReview = form.get("isReview") === "true";
    await setShopReviewFlag(shop, isReview);
    await recordAdminAudit({
      adminUser: admin,
      shop,
      action: "admin.toggle_review",
      success: true,
      details: { isReview },
    });
    return { ok: true };
  }

  if (intent === "set_access" && shop) {
    const result = await applyAdminShopAccessFlags({
      shop,
      isInstall: form.get("isInstall") === "true",
      isPayment: form.get("isPayment") === "true",
      planName: String(form.get("planName") || ""),
    });
    await recordAdminAudit({
      adminUser: admin,
      shop,
      action: "admin.set_access",
      success: Boolean(result.ok),
      details: {
        installed: result.installed,
        isPaymentOk: result.isPaymentOk,
        planName: result.planName,
        subscriptionStatus: result.subscriptionStatus,
        error: result.error || null,
      },
    });
    return result;
  }

  if (intent === "set_plan" && shop) {
    const result = await applyAdminPlanChange({
      shop,
      planName: String(form.get("planName") || ""),
    });
    await recordAdminAudit({
      adminUser: admin,
      shop,
      action: "admin.set_plan",
      success: Boolean(result.ok),
      details: {
        planName: result.planName,
        previousPlanName: result.previousPlanName || null,
        subscriptionStatus: result.subscriptionStatus || null,
        error: result.error || null,
      },
    });
    return result;
  }

  if (intent === "update_status" && shop) {
    const result = await refreshAdminShopStatus(shop);
    await recordAdminAudit({
      adminUser: admin,
      shop,
      action: "admin.update_status",
      success: Boolean(result.ok),
      details: {
        installed: result.installed,
        isPaymentOk: result.isPaymentOk,
        planName: result.planName,
        subscriptionStatus: result.subscriptionStatus,
        error: result.error || null,
      },
    });
    return result;
  }

  if (intent === "access_account" && shop) {
    const result = await startSupportSession({ request, shop });
    if (!result.ok) {
      throw redirect(`/admin/users?error=${encodeURIComponent(result.error)}`);
    }

    const headers = new Headers();
    applySupportSessionCookie(headers, result.supportSessionId, result.maxAgeSeconds, request);
    throw redirect("/app", { headers });
  }

  return { ok: false };
};

function DateTimeCell({ value, timeZone }) {
  const lines = formatAdminDateTimeLines(value, timeZone);
  return (
    <div className="admin-datetime">
      {lines.map((line) => (
        <span key={line}>{line}</span>
      ))}
    </div>
  );
}

function planBadgeClass(planName) {
  const key = String(planName || "").toLowerCase();
  if (key === "pro") return "pro";
  if (key === "super") return "super";
  if (key === "professional") return "professional";
  if (key) return "basic";
  return "info";
}

function statusBadgeClass(status) {
  const key = String(status || "").toLowerCase();
  if (key === "installed") return "installed";
  if (key === "inactive") return "inactive";
  return "uninstalled";
}

export default function AdminUsers() {
  const { params, page, pageSize, total, users, error, plans } = useLoaderData();
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const statusFetcher = useFetcher();
  const [filtersOpen, setFiltersOpen] = useState(
    Boolean(params.status || params.plan || params.payment || params.review),
  );
  const [openMenu, setOpenMenu] = useState("");
  const [statusEditor, setStatusEditor] = useState(null);
  const [planEditor, setPlanEditor] = useState(null);
  const menuRef = useRef(null);
  const exportHref = buildAdminHref("/internal/admin/export-users", params, { page: "", pageSize: "" });
  const updatingShop =
    statusFetcher.state !== "idle" ? String(statusFetcher.formData?.get("shop") || "") : "";
  const statusBusy = statusFetcher.state !== "idle";
  const statusError = statusFetcher.data?.ok === false ? statusFetcher.data.error : "";
  const statusIntent = String(statusFetcher.formData?.get("intent") || "");

  useEffect(() => {
    if (!openMenu) {
      return undefined;
    }

    function closeMenu(event) {
      if (event.type === "keydown" && event.key !== "Escape") {
        return;
      }
      if (event.type === "mousedown" && menuRef.current?.contains(event.target)) {
        return;
      }
      setOpenMenu("");
    }

    document.addEventListener("mousedown", closeMenu);
    document.addEventListener("keydown", closeMenu);
    return () => {
      document.removeEventListener("mousedown", closeMenu);
      document.removeEventListener("keydown", closeMenu);
    };
  }, [openMenu]);

  const statusFetcherState = useRef(statusFetcher.state);
  useEffect(() => {
    const wasBusy = statusFetcherState.current !== "idle";
    statusFetcherState.current = statusFetcher.state;
    if (wasBusy && statusFetcher.state === "idle" && statusFetcher.data?.ok === true) {
      setStatusEditor(null);
      setPlanEditor(null);
    }
  }, [statusFetcher.state, statusFetcher.data]);

  useEffect(() => {
    if (!statusEditor && !planEditor) {
      return undefined;
    }

    function closeEditor(event) {
      if (event.key === "Escape" && statusFetcher.state === "idle") {
        setStatusEditor(null);
        setPlanEditor(null);
      }
    }

    document.addEventListener("keydown", closeEditor);
    return () => document.removeEventListener("keydown", closeEditor);
  }, [statusEditor, planEditor, statusFetcher.state]);

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h2>User list</h2>
          <p>
            Stores still hit the pricing wall until a support ticket is granted with Update Status.
          </p>
        </div>
        <div className="admin-toolbar">
          <button type="button" className="admin-btn" onClick={() => setFiltersOpen((open) => !open)}>
            <IconFilter />
            Filters
          </button>
          <a className="admin-btn" href={exportHref}>
            <IconExport />
            Export
          </a>
          <button type="button" className="admin-btn icon-only" onClick={() => navigate(0)} aria-label="Refresh">
            <IconRefresh />
          </button>
        </div>
      </div>

      {error ? <div className="admin-alert">{error}</div> : null}
      {statusError ? <div className="admin-alert">{statusError}</div> : null}

      <div className="admin-search-row">
        <Form method="get" className="admin-search">
          <IconSearch />
          <input
            type="search"
            name="q"
            defaultValue={params.q}
            placeholder="Search by store name, domain or email..."
          />
          {params.status ? <input type="hidden" name="status" value={params.status} /> : null}
          {params.plan ? <input type="hidden" name="plan" value={params.plan} /> : null}
          {params.payment ? <input type="hidden" name="payment" value={params.payment} /> : null}
          {params.review ? <input type="hidden" name="review" value={params.review} /> : null}
          <input type="hidden" name="pageSize" value={pageSize} />
        </Form>
        <div className="admin-total">Total users: {total.toLocaleString()}</div>
      </div>

      {filtersOpen ? (
        <Form method="get" className="admin-filters">
          <input type="hidden" name="q" value={params.q} />
          <input type="hidden" name="pageSize" value={pageSize} />
          <div className="admin-field">
            <label htmlFor="filter-status">Installation status</label>
            <select id="filter-status" name="status" defaultValue={params.status}>
              <option value="">All</option>
              <option value="Installed">Installed</option>
              <option value="Uninstalled">Uninstalled</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          <div className="admin-field">
            <label htmlFor="filter-plan">Plan</label>
            <select id="filter-plan" name="plan" defaultValue={params.plan}>
              <option value="">All</option>
              {plans.map((plan) => (
                <option key={plan} value={plan}>
                  {plan}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-field">
            <label htmlFor="filter-payment">Payment status</label>
            <select id="filter-payment" name="payment" defaultValue={params.payment}>
              <option value="">All</option>
              <option value="ok">Payment OK</option>
              <option value="not_ok">Payment not OK</option>
            </select>
          </div>
          <div className="admin-field">
            <label htmlFor="filter-review">Review status</label>
            <select id="filter-review" name="review" defaultValue={params.review}>
              <option value="">All</option>
              <option value="yes">In review</option>
              <option value="no">Not in review</option>
            </select>
          </div>
          <div className="admin-field" style={{ alignSelf: "end" }}>
            <button className="admin-btn primary" type="submit">
              Apply
            </button>
          </div>
        </Form>
      ) : null}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Email</th>
              <th>Shop</th>
              <th>Plan</th>
              <th>Is Trial</th>
              <th>Installed On</th>
              <th>Uninstalled On</th>
              <th>Status</th>
              <th>Is Payment Ok</th>
              <th>Is Review</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={11} className="admin-muted">
                  No stores match the current search or filters.
                </td>
              </tr>
            ) : (
              users.map((user) => {
                const shopPlanLabel = [user.planName, user.shopName].filter(Boolean).join(" | ");
                return (
                  <tr key={user.shop}>
                    <td>{user.displayId}</td>
                    <td>
                      <span className="admin-email">
                        {user.email || "—"}
                        {user.email ? (
                          <button
                            type="button"
                            className="admin-copy"
                            aria-label={`Copy ${user.email}`}
                            onClick={() => navigator.clipboard.writeText(user.email)}
                          >
                            <IconCopy />
                          </button>
                        ) : null}
                      </span>
                    </td>
                    <td>
                      <div className="admin-shop-cell">
                        <a href={`https://${user.shop}`} target="_blank" rel="noreferrer">
                          {user.shop}
                        </a>
                        <div className="admin-shop-meta-row">
                          {shopPlanLabel ? <span className="admin-shop-meta">{shopPlanLabel}</span> : null}
                          <button
                            type="button"
                            className="admin-status-link"
                            onClick={() =>
                              setStatusEditor({
                                shop: user.shop,
                                isInstall:
                                  user.adminGrantedInstall || user.installStatus === "Installed",
                                isPayment: Boolean(user.adminGrantedPayment),
                                planName: plans.includes(user.planName) ? user.planName : "Super",
                              })
                            }
                          >
                            Update Status
                          </button>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="admin-shop-cell">
                        {user.planName ? (
                          <span className={`admin-badge ${planBadgeClass(user.planName)}`}>{user.planName}</span>
                        ) : (
                          "—"
                        )}
                        <button
                          type="button"
                          className="admin-status-link"
                          onClick={() =>
                            setPlanEditor({
                              shop: user.shop,
                              planName: plans.includes(user.planName) ? user.planName : "Basic",
                            })
                          }
                        >
                          Change Plan
                        </button>
                      </div>
                    </td>
                    <td>{user.isTrial ? "Yes" : "No"}</td>
                    <td>
                      <DateTimeCell value={user.installedOn} timeZone={user.timezone} />
                    </td>
                    <td>
                      <DateTimeCell value={user.uninstalledOn} timeZone={user.timezone} />
                    </td>
                    <td>
                      <span className={`admin-badge ${statusBadgeClass(user.installStatus)}`}>
                        {user.installStatus}
                      </span>
                    </td>
                    <td>{user.isPaymentOk ? <IconCheck /> : <IconCross />}</td>
                    <td>
                      <fetcher.Form method="post">
                        <input type="hidden" name="intent" value="toggle_review" />
                        <input type="hidden" name="shop" value={user.shop} />
                        <input type="hidden" name="isReview" value={user.isReview ? "false" : "true"} />
                        <button
                          type="submit"
                          className={`admin-toggle${user.isReview ? " on" : ""}`}
                          aria-label={`Toggle review for ${user.shop}`}
                          aria-pressed={user.isReview}
                        />
                      </fetcher.Form>
                    </td>
                    <td>
                      <div className="admin-row-actions">
                        <Form method="post" reloadDocument>
                          <input type="hidden" name="intent" value="access_account" />
                          <input type="hidden" name="shop" value={user.shop} />
                          <button
                            className="admin-btn primary"
                            type="submit"
                            disabled={!user.canAccessAccount}
                            title={
                              user.canAccessAccount
                                ? "Open this merchant account"
                                : "No active app session for this store"
                            }
                          >
                            Access Account
                          </button>
                        </Form>
                        <div
                          ref={openMenu === user.shop ? menuRef : undefined}
                          style={{ position: "relative" }}
                        >
                          <button
                            type="button"
                            className="admin-btn icon-only"
                            aria-label="More actions"
                            onClick={() => setOpenMenu(openMenu === user.shop ? "" : user.shop)}
                          >
                            <IconMore />
                          </button>
                          {openMenu === user.shop ? (
                            <div className="admin-profile-menu">
                              <Link to={`/admin/tasks?q=${encodeURIComponent(user.shop)}`}>View tasks</Link>
                              <Link to={`/admin/audit?q=${encodeURIComponent(user.shop)}`}>View audit</Link>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <AdminPagination pathname="/admin/users" params={params} page={page} pageSize={pageSize} total={total} />

      {statusEditor ? (
        <div className="admin-modal-backdrop">
          <button
            type="button"
            className="admin-modal-scrim"
            aria-label="Close status editor"
            onClick={() => !statusBusy && setStatusEditor(null)}
          />
          <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="status-editor-title">
            <div className="admin-modal-head">
              <div>
                <h3 id="status-editor-title">Update status</h3>
                <p>{statusEditor.shop}</p>
              </div>
              <button
                type="button"
                className="admin-btn icon-only"
                aria-label="Close"
                disabled={statusBusy}
                onClick={() => setStatusEditor(null)}
              >
                ×
              </button>
            </div>
            <p className="admin-muted">
              This store still sees the pricing wall. After a support ticket, turn Payment OK on so they
              can use the app. Development, affiliate, and staff stores are not skipped automatically.
            </p>
            {statusError ? <div className="admin-alert">{statusError}</div> : null}
            <div className="admin-status-toggles">
              <div className="admin-status-toggle">
                <span>Installed</span>
                <button
                  type="button"
                  className={`admin-toggle${statusEditor.isInstall ? " on" : ""}`}
                  aria-label="Toggle installed"
                  aria-pressed={statusEditor.isInstall}
                  onClick={() =>
                    setStatusEditor((current) => ({ ...current, isInstall: !current.isInstall }))
                  }
                />
              </div>
              <div className="admin-status-toggle">
                <span>Payment OK — lifts pricing wall</span>
                <button
                  type="button"
                  className={`admin-toggle${statusEditor.isPayment ? " on" : ""}`}
                  aria-label="Toggle payment OK"
                  aria-pressed={statusEditor.isPayment}
                  onClick={() =>
                    setStatusEditor((current) => ({ ...current, isPayment: !current.isPayment }))
                  }
                />
              </div>
            </div>
            {statusEditor.isPayment ? (
              <div className="admin-field">
                <label htmlFor="status-plan">Plan</label>
                <select
                  id="status-plan"
                  value={statusEditor.planName}
                  onChange={(event) =>
                    setStatusEditor((current) => ({ ...current, planName: event.target.value }))
                  }
                >
                  {plans.map((plan) => (
                    <option key={plan} value={plan}>
                      {plan}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="admin-modal-actions">
              <statusFetcher.Form method="post">
                <input type="hidden" name="intent" value="update_status" />
                <input type="hidden" name="shop" value={statusEditor.shop} />
                <button
                  type="submit"
                  className="admin-btn"
                  disabled={statusBusy}
                >
                  {updatingShop === statusEditor.shop && statusIntent === "update_status"
                    ? "Refreshing…"
                    : "Refresh from Shopify"}
                </button>
              </statusFetcher.Form>
              <div className="admin-modal-actions-end">
                <button
                  type="button"
                  className="admin-btn"
                  disabled={statusBusy}
                  onClick={() => setStatusEditor(null)}
                >
                  Cancel
                </button>
                <statusFetcher.Form method="post">
                  <input type="hidden" name="intent" value="set_access" />
                  <input type="hidden" name="shop" value={statusEditor.shop} />
                  <input type="hidden" name="isInstall" value={statusEditor.isInstall ? "true" : "false"} />
                  <input type="hidden" name="isPayment" value={statusEditor.isPayment ? "true" : "false"} />
                  <input type="hidden" name="planName" value={statusEditor.planName} />
                  <button className="admin-btn primary" type="submit" disabled={statusBusy}>
                    {statusBusy && statusIntent === "set_access" ? "Saving…" : "Save"}
                  </button>
                </statusFetcher.Form>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {planEditor ? (
        <div className="admin-modal-backdrop">
          <button
            type="button"
            className="admin-modal-scrim"
            aria-label="Close plan editor"
            onClick={() => !statusBusy && setPlanEditor(null)}
          />
          <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="plan-editor-title">
            <div className="admin-modal-head">
              <div>
                <h3 id="plan-editor-title">Change plan</h3>
                <p>{planEditor.shop}</p>
              </div>
              <button
                type="button"
                className="admin-btn icon-only"
                aria-label="Close"
                disabled={statusBusy}
                onClick={() => setPlanEditor(null)}
              >
                ×
              </button>
            </div>
            <p className="admin-muted">
              Change this store's plan internally for testing. This does not change Shopify billing or
              lift the pricing wall.
            </p>
            {statusError ? <div className="admin-alert">{statusError}</div> : null}
            <div className="admin-field">
              <label htmlFor="change-plan">Plan</label>
              <select
                id="change-plan"
                value={planEditor.planName}
                onChange={(event) =>
                  setPlanEditor((current) => ({ ...current, planName: event.target.value }))
                }
              >
                {plans.map((plan) => (
                  <option key={plan} value={plan}>
                    {plan}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-modal-actions">
              <span />
              <div className="admin-modal-actions-end">
                <button
                  type="button"
                  className="admin-btn"
                  disabled={statusBusy}
                  onClick={() => setPlanEditor(null)}
                >
                  Cancel
                </button>
                <statusFetcher.Form method="post">
                  <input type="hidden" name="intent" value="set_plan" />
                  <input type="hidden" name="shop" value={planEditor.shop} />
                  <input type="hidden" name="planName" value={planEditor.planName} />
                  <button className="admin-btn primary" type="submit" disabled={statusBusy}>
                    {statusBusy && statusIntent === "set_plan" ? "Saving…" : "Save"}
                  </button>
                </statusFetcher.Form>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
