import prisma from "../db.server";
import {
  ADMIN_SUPPORT_COOKIE,
  appendSetCookie,
  readSignedCookie,
  serializeClearedCookie,
  serializeSignedCookie,
  shouldUseSecureCookies,
} from "../utils/signed-cookie.server";
import { getAdminFromRequest } from "./admin-auth.server";
import { getAdminShopByDomain } from "../models/admin-shops.server";
import { recordAdminAudit } from "./admin-audit.server";

const SUPPORT_SESSION_TTL_MS = 2 * 60 * 60 * 1000;

export function isSupportEligiblePath(pathname) {
  return (
    pathname === "/app" ||
    pathname.startsWith("/app/") ||
    pathname === "/billing" ||
    pathname.startsWith("/billing/")
  );
}

export async function getValidSupportContext(request) {
  const supportId = readSignedCookie(request, ADMIN_SUPPORT_COOKIE);
  if (!supportId) {
    return null;
  }

  const admin = await getAdminFromRequest(request);
  if (!admin) {
    return null;
  }

  const session = await prisma.adminSupportSession.findUnique({
    where: { id: supportId },
  });

  if (!session || session.revokedAt || session.adminUserId !== admin.id) {
    return null;
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  return {
    id: session.id,
    shop: session.shop,
    admin,
    expiresAt: session.expiresAt,
  };
}

export async function getSupportAuthDecision(request) {
  const support = await getValidSupportContext(request);
  if (support) {
    return { type: "active", support };
  }

  const supportCookie = readSignedCookie(request, ADMIN_SUPPORT_COOKIE);
  if (supportCookie && (await getAdminFromRequest(request))) {
    return { type: "stale" };
  }

  return { type: "none" };
}

export async function startSupportSession({ request, shop }) {
  const admin = await getAdminFromRequest(request);
  if (!admin) {
    return { ok: false, error: "Admin authentication required." };
  }

  const shopRow = await getAdminShopByDomain(shop);
  if (!shopRow) {
    await recordAdminAudit({
      adminUser: admin,
      shop,
      action: "admin.access_account",
      success: false,
      details: { reason: "shop_not_found" },
    });
    return { ok: false, error: "Store was not found." };
  }

  if (!shopRow.hasOfflineSession) {
    await recordAdminAudit({
      adminUser: admin,
      shop,
      merchantUserId: shopRow.merchantUserId,
      action: "admin.access_account",
      success: false,
      details: { reason: "no_offline_session" },
    });
    return { ok: false, error: "This store does not have an active app session." };
  }

  await prisma.adminSupportSession.updateMany({
    where: {
      adminUserId: admin.id,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });

  const supportSession = await prisma.adminSupportSession.create({
    data: {
      adminUserId: admin.id,
      shop: shopRow.shop,
      expiresAt: new Date(Date.now() + SUPPORT_SESSION_TTL_MS),
    },
  });

  await recordAdminAudit({
    adminUser: admin,
    shop: shopRow.shop,
    merchantUserId: shopRow.merchantUserId,
    action: "admin.access_account",
    success: true,
    details: { supportSessionId: supportSession.id },
  });

  return {
    ok: true,
    shop: shopRow.shop,
    supportSessionId: supportSession.id,
    maxAgeSeconds: SUPPORT_SESSION_TTL_MS / 1000,
  };
}

export function applySupportSessionCookie(headers, supportSessionId, maxAgeSeconds, request) {
  appendSetCookie(
    headers,
    serializeSignedCookie(ADMIN_SUPPORT_COOKIE, supportSessionId, {
      maxAgeSeconds,
      secure: shouldUseSecureCookies(request),
    }),
  );
}

export async function endSupportSession(request) {
  const supportId = readSignedCookie(request, ADMIN_SUPPORT_COOKIE);
  const admin = await getAdminFromRequest(request);
  let shop = null;

  if (supportId) {
    const session = await prisma.adminSupportSession.findUnique({
      where: { id: supportId },
    });
    shop = session?.shop || null;
    if (session && !session.revokedAt) {
      await prisma.adminSupportSession.update({
        where: { id: supportId },
        data: { revokedAt: new Date() },
      });
    }
  }

  if (admin) {
    await recordAdminAudit({
      adminUser: admin,
      shop,
      action: "admin.exit_support_session",
      success: true,
    });
  }

  return { shop };
}

export function clearSupportSessionCookie(headers, request) {
  appendSetCookie(
    headers,
    serializeClearedCookie(ADMIN_SUPPORT_COOKIE, "/", shouldUseSecureCookies(request)),
  );
}

export async function revokeSupportSessionsForShop(shop) {
  if (!shop) return;
  await prisma.adminSupportSession.updateMany({
    where: { shop, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
