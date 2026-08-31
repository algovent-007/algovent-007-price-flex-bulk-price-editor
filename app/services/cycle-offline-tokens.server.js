import prisma from "../db.server";
import { needsOfflineTokenCycle } from "../utils/offline-token-cycle";

export { needsOfflineTokenCycle };

const cyclingByShop = new Map();

function expiryDate(seconds) {
  const parsed = Number(seconds);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return new Date(Date.now() + parsed * 1000);
}

async function exchangeOfflineToken(session) {
  const clientId = process.env.SHOPIFY_API_KEY || "";
  const clientSecret = process.env.SHOPIFY_API_SECRET || "";
  if (!clientId || !clientSecret) {
    throw new Error("Shopify API credentials are not configured");
  }

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
    client_id: clientId,
    client_secret: clientSecret,
    subject_token: session.accessToken,
    subject_token_type: "urn:shopify:params:oauth:token-type:offline-access-token",
    requested_token_type: "urn:shopify:params:oauth:token-type:offline-access-token",
    expiring: "1",
  });

  const response = await fetch(`https://${session.shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `Token exchange failed (${response.status})`);
    error.status = response.status;
    error.code = payload.error;
    throw error;
  }

  if (!payload.access_token || !payload.refresh_token) {
    throw new Error("Token exchange did not return an expiring offline token pair");
  }

  return payload;
}

async function persistExpiringToken(session, payload) {
  await prisma.session.update({
    where: { id: session.id },
    data: {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expires: expiryDate(payload.expires_in),
      refreshTokenExpires: expiryDate(payload.refresh_token_expires_in),
      scope: payload.scope || session.scope,
    },
  });
}

async function cycleShopOfflineTokenUncached(shop) {
  const session = await prisma.session.findFirst({
    where: {
      shop,
      isOnline: false,
      OR: [{ refreshToken: null }, { refreshToken: "" }],
    },
    select: {
      id: true,
      shop: true,
      accessToken: true,
      refreshToken: true,
      isOnline: true,
      scope: true,
    },
  });

  if (!needsOfflineTokenCycle(session)) {
    return { shop, cycled: false };
  }

  try {
    const payload = await exchangeOfflineToken(session);
    await persistExpiringToken(session, payload);
    console.log(`[auth:offline_token_cycle] cycled shop=${shop}`);
    return { shop, cycled: true };
  } catch (error) {
    console.error(
      `[auth:offline_token_cycle] failed shop=${shop} status=${error?.status || ""} code=${error?.code || error?.message || "error"}`,
    );
    return { shop, cycled: false, error: error?.code || error?.message || "error" };
  }
}

export async function cycleShopOfflineTokenIfNeeded(shop) {
  if (!shop) return { shop, cycled: false };

  const pending = cyclingByShop.get(shop);
  if (pending) return pending;

  const promise = cycleShopOfflineTokenUncached(shop).finally(() => {
    cyclingByShop.delete(shop);
  });
  cyclingByShop.set(shop, promise);
  return promise;
}

export async function cycleAllNonExpiringOfflineTokens() {
  const sessions = await prisma.session.findMany({
    where: {
      isOnline: false,
      OR: [{ refreshToken: null }, { refreshToken: "" }],
    },
    select: { shop: true },
    distinct: ["shop"],
  });

  const results = [];
  for (const { shop } of sessions) {
    results.push(await cycleShopOfflineTokenIfNeeded(shop));
  }
  return results;
}
