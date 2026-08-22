import { redirect } from "react-router";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SUPPORT_COOKIE,
  appendSetCookie,
  readSignedCookie,
  serializeClearedCookie,
  serializeSignedCookie,
  shouldUseSecureCookies,
} from "../utils/signed-cookie.server";
import { verifyPassword } from "../utils/password.server";
import {
  ensureBootstrapAdmin,
  getAdminUserByEmail,
  getAdminUserById,
} from "../models/admin-user.server";
import { recordAdminAudit } from "./admin-audit.server";

const ADMIN_SESSION_TTL_SECONDS = 12 * 60 * 60;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 8;
const loginAttempts = new Map();

function publicAdminUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

function isLoginRateLimited(email) {
  const entry = loginAttempts.get(email);
  if (!entry) return false;
  if (Date.now() - entry.startedAt > LOGIN_WINDOW_MS) {
    loginAttempts.delete(email);
    return false;
  }
  return entry.count >= LOGIN_MAX_ATTEMPTS;
}

function recordFailedLogin(email) {
  const existing = loginAttempts.get(email);
  if (!existing || Date.now() - existing.startedAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(email, { count: 1, startedAt: Date.now() });
    return;
  }
  existing.count += 1;
}

function clearFailedLogins(email) {
  loginAttempts.delete(email);
}

export function applyAdminSessionCookie(headers, adminUserId, request) {
  appendSetCookie(
    headers,
    serializeSignedCookie(ADMIN_SESSION_COOKIE, `${adminUserId}:${Date.now()}`, {
      maxAgeSeconds: ADMIN_SESSION_TTL_SECONDS,
      secure: shouldUseSecureCookies(request),
    }),
  );
}

export function clearAdminCookies(headers, request) {
  const secure = shouldUseSecureCookies(request);
  appendSetCookie(headers, serializeClearedCookie(ADMIN_SESSION_COOKIE, "/", secure));
  appendSetCookie(headers, serializeClearedCookie(ADMIN_SUPPORT_COOKIE, "/", secure));
}

export async function getAdminFromRequest(request) {
  const signed = readSignedCookie(request, ADMIN_SESSION_COOKIE);
  if (!signed) {
    return null;
  }

  const [adminUserId] = String(signed).split(":");
  const user = await getAdminUserById(adminUserId);
  return publicAdminUser(user);
}

export async function requireAdmin(request, { redirectTo = "/admin/login" } = {}) {
  const admin = await getAdminFromRequest(request);
  if (admin) {
    return admin;
  }

  const url = new URL(request.url);
  const next = `${url.pathname}${url.search}`;
  const dest = next && next !== "/admin/login" ? `${redirectTo}?next=${encodeURIComponent(next)}` : redirectTo;
  throw redirect(dest);
}

export async function loginAdmin({ email, password, request }) {
  await ensureBootstrapAdmin();
  const normalized = String(email || "").trim().toLowerCase();

  if (!normalized || !password) {
    return { ok: false, error: "Email and password are required." };
  }

  if (isLoginRateLimited(normalized)) {
    await recordAdminAudit({
      adminUser: { email: normalized },
      action: "admin.login",
      success: false,
      details: { reason: "rate_limited" },
    });
    return { ok: false, error: "Too many login attempts. Try again later." };
  }

  const user = await getAdminUserByEmail(normalized);
  const valid = user ? await verifyPassword(password, user.passwordHash) : false;

  if (!user || !valid) {
    recordFailedLogin(normalized);
    await recordAdminAudit({
      adminUser: { id: user?.id, email: normalized },
      action: "admin.login",
      success: false,
      details: { reason: "invalid_credentials" },
    });
    return { ok: false, error: "Invalid email or password." };
  }

  clearFailedLogins(normalized);
  await recordAdminAudit({
    adminUser: user,
    action: "admin.login",
    success: true,
    details: { userAgent: request?.headers?.get?.("user-agent") || null },
  });

  return { ok: true, admin: publicAdminUser(user) };
}

export async function logoutAdmin(request) {
  const admin = await getAdminFromRequest(request);
  if (admin) {
    await recordAdminAudit({
      adminUser: admin,
      action: "admin.logout",
      success: true,
    });
  }
}
