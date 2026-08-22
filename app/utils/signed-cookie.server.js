import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "admin_sid";
export const ADMIN_SUPPORT_COOKIE = "admin_support";

function getSigningSecret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.SHOPIFY_API_SECRET || "";
}

export function signCookieValue(value) {
  const secret = getSigningSecret();
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET or SHOPIFY_API_SECRET is required for admin sessions");
  }

  const payload = String(value);
  const hmac = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${hmac}`;
}

export function unsignCookieValue(signed) {
  const raw = String(signed || "");
  const lastDot = raw.lastIndexOf(".");
  if (lastDot <= 0) {
    return null;
  }

  const payload = raw.slice(0, lastDot);
  const hmac = raw.slice(lastDot + 1);
  const secret = getSigningSecret();
  if (!secret || !payload || !hmac) {
    return null;
  }

  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const provided = Buffer.from(hmac);
  const wanted = Buffer.from(expected);

  if (provided.length !== wanted.length || !timingSafeEqual(provided, wanted)) {
    return null;
  }

  return payload;
}

export function parseCookies(cookieHeader) {
  const cookies = {};
  for (const part of String(cookieHeader || "").split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = decodeURIComponent(trimmed.slice(eq + 1).trim());
    cookies[key] = value;
  }
  return cookies;
}

export function readSignedCookie(request, name) {
  const cookies = parseCookies(request.headers.get("Cookie"));
  return unsignCookieValue(cookies[name] || "");
}

export function shouldUseSecureCookies(request) {
  if (!request) {
    return process.env.NODE_ENV === "production";
  }

  try {
    return new URL(request.url).protocol === "https:" || process.env.NODE_ENV === "production";
  } catch {
    return process.env.NODE_ENV === "production";
  }
}

function cookieSecureFlag(secure) {
  return secure ? "; Secure" : "";
}

export function serializeSignedCookie(name, value, { maxAgeSeconds, path = "/", secure = false } = {}) {
  const signed = signCookieValue(value);
  const maxAge = Number.isFinite(maxAgeSeconds) ? `; Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}` : "";
  return `${name}=${encodeURIComponent(signed)}; Path=${path}; HttpOnly; SameSite=Lax${cookieSecureFlag(secure)}${maxAge}`;
}

export function serializeClearedCookie(name, path = "/", secure = false) {
  return `${name}=; Path=${path}; HttpOnly; SameSite=Lax${cookieSecureFlag(secure)}; Max-Age=0`;
}

export function appendSetCookie(headers, cookie) {
  headers.append("Set-Cookie", cookie);
}
