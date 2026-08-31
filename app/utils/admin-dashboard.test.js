import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "./password.server.js";
import { signCookieValue, unsignCookieValue } from "./signed-cookie.server.js";
import { sanitizeAuditDetails } from "./admin-sanitize.server.js";
import { buildPageItems, getPageRange, parsePage, parsePageSize } from "./admin-pagination.js";
import { SHOP_EXPORT_HEADERS, shopsToExportRows, toCsv } from "./admin-csv.server.js";
import { buildAdminHref } from "./admin-query.js";
import { formatAdminDateTime } from "./admin-datetime.js";
import { isShopifyAccessRevoked } from "./admin-shopify-error.js";

function test(name, fn) {
  return Promise.resolve(fn()).then(() => {
    console.log(`✓ ${name}`);
  });
}

/* eslint-disable no-undef */
process.env.ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "test-admin-session-secret";

await test("hashes and verifies passwords", async () => {
  const hash = await hashPassword("correct-horse");
  assert.equal(await verifyPassword("correct-horse", hash), true);
  assert.equal(await verifyPassword("wrong-pass", hash), false);
  assert.equal(hash.includes("correct-horse"), false);
});

await test("signs and unsigns cookie values", () => {
  const signed = signCookieValue("admin-user-1");
  assert.equal(unsignCookieValue(signed), "admin-user-1");
  assert.equal(unsignCookieValue(`${signed}tampered`), null);
  assert.equal(unsignCookieValue("not-signed"), null);
});

await test("strips secrets from audit details", () => {
  const raw = sanitizeAuditDetails({
    shop: "demo.myshopify.com",
    accessToken: "shpat_secret",
    password: "hunter2",
    reason: "ok",
  });
  const parsed = JSON.parse(raw);
  assert.equal(parsed.shop, "demo.myshopify.com");
  assert.equal(parsed.reason, "ok");
  assert.equal(parsed.accessToken, undefined);
  assert.equal(parsed.password, undefined);
});

await test("builds screenshot-style pagination", () => {
  assert.deepEqual(buildPageItems(1, 197), [1, 2, 3, 4, 5, 6, 7, "ellipsis-end", 196, 197]);
  assert.deepEqual(buildPageItems(1, 4), [1, 2, 3, 4]);
  assert.equal(parsePage("3"), 3);
  assert.equal(parsePage("nope"), 1);
  assert.equal(parsePageSize("25"), 25);
  assert.equal(parsePageSize("7"), 10);
  assert.deepEqual(getPageRange({ page: 1, pageSize: 10, total: 1962 }), {
    from: 1,
    to: 10,
    total: 1962,
  });
});

await test("exports shops without sensitive fields", () => {
  const csv = toCsv(
    SHOP_EXPORT_HEADERS,
    shopsToExportRows([
      {
        displayId: "abc123",
        shop: "demo.myshopify.com",
        shopName: "Demo",
        email: "owner@example.com",
        planName: "Pro",
        installStatus: "Installed",
        subscriptionStatus: "ACTIVE",
        isPaymentOk: true,
        isReview: false,
        installedOn: "2026-08-11T11:40:00.000Z",
        uninstalledOn: "2026-08-16T11:40:00.000Z",
        accessToken: "should-not-appear",
      },
    ]),
  );

  assert.match(csv, /demo\.myshopify\.com/);
  assert.match(csv, /uninstalled_on/);
  assert.doesNotMatch(csv, /last_activity/);
  assert.doesNotMatch(csv, /accessToken|should-not-appear|shpat_/);
});

await test("builds admin query hrefs without empty params", () => {
  assert.equal(
    buildAdminHref("/admin/users", { q: "acme", page: 2, pageSize: 10, status: "" }, { page: 3 }),
    "/admin/users?q=acme&page=3&pageSize=10",
  );
});

await test("detects revoked Shopify access", () => {
  assert.equal(isShopifyAccessRevoked({ response: { code: 401 } }), true);
  assert.equal(isShopifyAccessRevoked(new Error("Unauthorized")), true);
  assert.equal(isShopifyAccessRevoked(new Error("Invalid API key or access token")), true);
  assert.equal(isShopifyAccessRevoked(new Error("GraphQL timeout")), false);
  assert.equal(isShopifyAccessRevoked(new Error("GraphQL Client: Forbidden")), true);
  assert.equal(
    isShopifyAccessRevoked({
      errors: { networkStatusCode: 403, message: "GraphQL Client: Forbidden", response: {} },
    }),
    true,
  );
  assert.equal(isShopifyAccessRevoked(new Response("{}", { status: 403 })), true);
  assert.equal(isShopifyAccessRevoked(new Response(null, { status: 302 })), false);
});

await test("formats admin timestamps", () => {
  const formatted = formatAdminDateTime("2026-08-11T11:40:00.000Z", "UTC");
  assert.equal(formatted.date.includes("2026"), true);
  assert.equal(Boolean(formatted.time), true);
  assert.equal(Boolean(formatted.zone), true);
});

const { deriveInstallStatus, derivePaymentOk, isAdminGrantedSubscription, resolveAdminGrantPlanName, resolveDisplayedPlanName } =
  await import("./admin-shop-status.js");
const { ADMIN_GRANT_CHARGE_ID, SUBSCRIPTION_STATUS } = await import("../constants/billing.js");

await test("derives installed and payment status from admin grants", () => {
  assert.equal(derivePaymentOk(null, true), true);
  assert.equal(derivePaymentOk(SUBSCRIPTION_STATUS.ACTIVE, false), true);
  assert.equal(derivePaymentOk(SUBSCRIPTION_STATUS.CANCELLED, false), false);
  assert.equal(
    deriveInstallStatus({
      hasSession: false,
      subscriptionStatus: SUBSCRIPTION_STATUS.CANCELLED,
      adminGrantedInstall: true,
    }),
    "Installed",
  );
  assert.equal(
    deriveInstallStatus({
      hasSession: false,
      subscriptionStatus: null,
      adminGrantedInstall: false,
    }),
    "Uninstalled",
  );
  assert.equal(resolveAdminGrantPlanName("", "Pro"), "Pro");
  assert.equal(resolveAdminGrantPlanName("nope"), "Super");
  assert.equal(resolveDisplayedPlanName("Basic", "Pro"), "Pro");
  assert.equal(resolveDisplayedPlanName("Basic", ""), "Basic");
  assert.equal(
    isAdminGrantedSubscription(
      { status: SUBSCRIPTION_STATUS.ACTIVE, planName: "Super", chargeId: ADMIN_GRANT_CHARGE_ID },
      false,
    ),
    true,
  );
  assert.equal(
    isAdminGrantedSubscription(
      { status: SUBSCRIPTION_STATUS.ACTIVE, planName: "Basic", chargeId: "gid://shopify/AppSubscription/1" },
      true,
    ),
    true,
  );
});

console.log("All admin dashboard tests passed.");
