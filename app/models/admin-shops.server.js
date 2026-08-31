import { Prisma } from "@prisma/client";
import prisma from "../db.server";
import { SUBSCRIPTION_STATUS } from "../constants/billing";
import { deriveInstallStatus, derivePaymentOk, resolveDisplayedPlanName } from "../utils/admin-shop-status";

export const INSTALL_STATUSES = ["Installed", "Uninstalled", "Inactive"];

function mapShopRow(row) {
  const shop = row.shop;
  const subscriptionStatus = row.subscription_status || null;
  const hasSession = Boolean(row.has_session);
  const displayId = Number(row.display_id);
  const adminGrantedInstall = Boolean(row.admin_granted_install);
  const adminGrantedPayment = Boolean(row.admin_granted_payment);

  return {
    shop,
    displayId: Number.isFinite(displayId) && displayId > 0 ? String(Math.trunc(displayId)) : "1",
    email: row.email || "",
    shopName: row.shop_name || "",
    timezone: row.timezone || "UTC",
    planName: resolveDisplayedPlanName(row.plan_name, row.admin_plan_name),
    subscriptionStatus,
    isReview: Boolean(row.is_review),
    isTrial: false,
    adminGrantedInstall,
    adminGrantedPayment,
    isPaymentOk: derivePaymentOk(subscriptionStatus, adminGrantedPayment),
    installStatus: deriveInstallStatus({
      hasSession,
      subscriptionStatus,
      adminGrantedInstall,
    }),
    hasOfflineSession: Boolean(row.has_offline_session),
    merchantUserId: row.user_id ? String(row.user_id) : null,
    installedOn: row.installed_on,
    uninstalledOn: hasSession || adminGrantedInstall ? null : row.uninstalled_on,
    canAccessAccount: Boolean(row.has_offline_session),
  };
}

function buildFilterSql({ query, status, plan, payment, review }) {
  const conditions = [Prisma.sql`TRUE`];
  const trimmed = String(query || "").trim();

  if (trimmed) {
    const like = `%${trimmed}%`;
    conditions.push(Prisma.sql`(
      shop_rows.shop ILIKE ${like}
      OR COALESCE(shop_rows.email, '') ILIKE ${like}
      OR COALESCE(shop_rows.shop_name, '') ILIKE ${like}
      OR COALESCE(shop_rows.subscription_id, '') ILIKE ${like}
      OR COALESCE(shop_rows.session_ids, '') ILIKE ${like}
      OR COALESCE(shop_rows.user_ids, '') ILIKE ${like}
      OR shop_rows.display_id::text = ${trimmed}
    )`);
  }

  if (status && INSTALL_STATUSES.includes(status)) {
    if (status === "Uninstalled") {
      conditions.push(Prisma.sql`shop_rows.has_session = false`);
      conditions.push(Prisma.sql`shop_rows.admin_granted_install = false`);
    } else if (status === "Installed") {
      conditions.push(Prisma.sql`(
        shop_rows.admin_granted_install = true
        OR (
          shop_rows.has_session = true
          AND COALESCE(shop_rows.subscription_status, '') NOT IN ('FROZEN', 'EXPIRED', 'CANCELLED')
        )
      )`);
    } else if (status === "Inactive") {
      conditions.push(Prisma.sql`shop_rows.has_session = true`);
      conditions.push(Prisma.sql`shop_rows.admin_granted_install = false`);
      conditions.push(Prisma.sql`shop_rows.subscription_status IN ('FROZEN', 'EXPIRED', 'CANCELLED')`);
    }
  }

  if (plan) {
    conditions.push(
      Prisma.sql`(
        CASE
          WHEN shop_rows.admin_plan_name IN ('Basic', 'Pro', 'Super') THEN shop_rows.admin_plan_name
          ELSE shop_rows.plan_name
        END
      ) = ${plan}`,
    );
  }

  if (payment === "ok") {
    conditions.push(
      Prisma.sql`(shop_rows.subscription_status = ${SUBSCRIPTION_STATUS.ACTIVE} OR shop_rows.admin_granted_payment = true)`,
    );
  } else if (payment === "not_ok") {
    conditions.push(
      Prisma.sql`shop_rows.admin_granted_payment = false AND (shop_rows.subscription_status IS NULL OR shop_rows.subscription_status <> ${SUBSCRIPTION_STATUS.ACTIVE})`,
    );
  }

  if (review === "yes") {
    conditions.push(Prisma.sql`shop_rows.is_review = true`);
  } else if (review === "no") {
    conditions.push(Prisma.sql`shop_rows.is_review = false`);
  }

  return Prisma.join(conditions, " AND ");
}

const SHOP_ROWS_SQL = Prisma.sql`
  shop_rows AS (
    SELECT
      shops.shop,
      COALESCE(session_agg.email, ss.email) AS email,
      ss.name AS shop_name,
      ss.timezone AS timezone,
      COALESCE(ss."isReview", true) AS is_review,
      COALESCE(ss."adminGrantedInstall", false) AS admin_granted_install,
      COALESCE(ss."adminGrantedPayment", false) AS admin_granted_payment,
      ss."adminPlanName" AS admin_plan_name,
      sub.id AS subscription_id,
      sub."planName" AS plan_name,
      sub.status AS subscription_status,
      COALESCE(sub."createdAt", ss."updatedAt") AS installed_on,
      ss."uninstalledAt" AS uninstalled_on,
      session_agg.shop IS NOT NULL AS has_session,
      COALESCE(session_agg.has_offline_session, false) AS has_offline_session,
      session_agg.user_id AS user_id,
      session_agg.session_ids AS session_ids,
      session_agg.user_ids AS user_ids,
      ROW_NUMBER() OVER (
        ORDER BY COALESCE(sub."createdAt", ss."updatedAt") ASC NULLS LAST, shops.shop ASC
      ) AS display_id
    FROM (
      SELECT DISTINCT shop FROM "Session"
      UNION
      SELECT shop FROM "ShopSettings"
      UNION
      SELECT shop FROM "Subscription"
    ) shops
    LEFT JOIN (
      SELECT
        shop,
        MAX(email) FILTER (WHERE email IS NOT NULL AND email <> '') AS email,
        BOOL_OR(NOT "isOnline") AS has_offline_session,
        STRING_AGG(id, ' ') AS session_ids,
        STRING_AGG("userId"::text, ' ') AS user_ids,
        MAX("userId") AS user_id
      FROM "Session"
      GROUP BY shop
    ) session_agg ON session_agg.shop = shops.shop
    LEFT JOIN "ShopSettings" ss ON ss.shop = shops.shop
    LEFT JOIN "Subscription" sub ON sub.shop = shops.shop
  )
`;

export async function listAdminShops({
  query = "",
  status = "",
  plan = "",
  payment = "",
  review = "",
  page = 1,
  pageSize = 10,
} = {}) {
  const whereSql = buildFilterSql({ query, status, plan, payment, review });
  const offset = (page - 1) * pageSize;

  const [countRows, rows] = await Promise.all([
    prisma.$queryRaw`
      WITH ${SHOP_ROWS_SQL}
      SELECT COUNT(*)::int AS total
      FROM shop_rows
      WHERE ${whereSql}
    `,
    prisma.$queryRaw`
      WITH ${SHOP_ROWS_SQL}
      SELECT *
      FROM shop_rows
      WHERE ${whereSql}
      ORDER BY shop_rows.display_id ASC
      LIMIT ${pageSize} OFFSET ${offset}
    `,
  ]);

  return {
    total: countRows[0]?.total || 0,
    rows: rows.map(mapShopRow),
  };
}

export async function listAdminShopsForExport({
  query = "",
  status = "",
  plan = "",
  payment = "",
  review = "",
} = {}) {
  const whereSql = buildFilterSql({ query, status, plan, payment, review });
  const rows = await prisma.$queryRaw`
    WITH ${SHOP_ROWS_SQL}
    SELECT *
    FROM shop_rows
    WHERE ${whereSql}
    ORDER BY shop_rows.display_id ASC
  `;
  return rows.map(mapShopRow);
}

export async function getAdminShopByDomain(shop) {
  if (!shop) return null;
  const rows = await prisma.$queryRaw`
    WITH ${SHOP_ROWS_SQL}
    SELECT *
    FROM shop_rows
    WHERE shop_rows.shop = ${shop}
    LIMIT 1
  `;
  return rows[0] ? mapShopRow(rows[0]) : null;
}

export async function setShopReviewFlag(shop, isReview) {
  return prisma.shopSettings.upsert({
    where: { shop },
    create: {
      shop,
      isReview: Boolean(isReview),
    },
    update: {
      isReview: Boolean(isReview),
    },
  });
}
