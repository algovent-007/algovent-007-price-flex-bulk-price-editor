/* eslint-disable react/prop-types -- this codebase does not use PropTypes */
import { useEffect, useState } from "react";
import { Form, Link, NavLink, Outlet, useLoaderData, useLocation } from "react-router";
import { requireAdmin } from "../services/admin-auth.server";
import {
  IconAdmins,
  IconAudit,
  IconBag,
  IconBell,
  IconChevron,
  IconLogout,
  IconMenu,
  IconSettings,
  IconSidebarCollapse,
  IconSidebarExpand,
  IconSupport,
  IconTasks,
  IconUsers,
} from "../components/admin/AdminIcons";
import "../components/admin/admin.css";

const NAV_ITEMS = [
  { to: "/admin/users", label: "User list", icon: IconUsers },
  { to: "/admin/tasks", label: "Task list", icon: IconTasks },
  { to: "/admin/audit", label: "Audit log", icon: IconAudit },
  { to: "/admin/settings", label: "Settings", icon: IconSettings },
  { to: "/admin/admins", label: "Admin users", icon: IconAdmins },
  { to: "/admin/support", label: "Support center", icon: IconSupport },
];

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  if (url.pathname === "/admin/login") {
    return { isPublic: true, admin: null };
  }

  const admin = await requireAdmin(request);
  return { isPublic: false, admin };
};

export default function AdminLayout() {
  const { isPublic, admin } = useLoaderData();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    setSidebarCollapsed(window.localStorage.getItem("admin_sidebar_collapsed") === "true");
  }, []);

  function toggleSidebarCollapsed() {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("admin_sidebar_collapsed", String(next));
      return next;
    });
  }

  if (isPublic) {
    return <Outlet />;
  }

  const initial = (admin?.name || admin?.email || "A").slice(0, 1).toUpperCase();

  return (
    <div className="admin-root">
      <div className="admin-shell">
        {sidebarOpen ? (
          <button
            type="button"
            className="admin-overlay"
            aria-label="Close menu"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}
        <aside className={`admin-sidebar${sidebarOpen ? " open" : ""}${sidebarCollapsed ? " collapsed" : ""}`}>
          <div className="admin-logo">
            <span className="admin-logo-mark">
              <IconBag />
            </span>
            <span className="admin-logo-name">Price Flex</span>
            <button
              type="button"
              className="admin-sidebar-collapse"
              onClick={toggleSidebarCollapsed}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? <IconSidebarExpand /> : <IconSidebarCollapse />}
            </button>
          </div>
          <nav className="admin-nav">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => (isActive ? "active" : "")}
                  title={item.label}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon />
                  <span className="admin-nav-label">{item.label}</span>
                </NavLink>
              );
            })}
            <Form method="post" action="/admin/logout">
              <button type="submit" title="Logout">
                <IconLogout />
                <span className="admin-nav-label">Logout</span>
              </button>
            </Form>
          </nav>
        </aside>

        <div className="admin-main">
          <header className="admin-topbar">
            <div style={{ alignItems: "center", display: "flex" }}>
              <button
                type="button"
                className="admin-icon-btn admin-menu-toggle"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open menu"
              >
                <IconMenu />
              </button>
              <h1>Staging Admin Dashboard</h1>
            </div>
            <div className="admin-topbar-right">
              <span className="admin-icon-btn" aria-label="Notifications">
                <IconBell />
              </span>
              <div className="admin-profile">
                <button
                  type="button"
                  className="admin-menu-btn"
                  onClick={() => setProfileOpen((open) => !open)}
                >
                  <span className="admin-avatar">{initial}</span>
                  <span className="admin-profile-name">{admin.name || "Admin"}</span>
                  <IconChevron />
                </button>
                {profileOpen ? (
                  <div className="admin-profile-menu">
                    <Link to="/admin/settings" onClick={() => setProfileOpen(false)}>
                      Settings
                    </Link>
                    <Form method="post" action="/admin/logout">
                      <button type="submit">Logout</button>
                    </Form>
                  </div>
                ) : null}
              </div>
            </div>
          </header>
          <main className="admin-content" key={location.pathname}>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
