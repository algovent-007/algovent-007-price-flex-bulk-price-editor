import { Prisma } from "@prisma/client";
import prisma, { withPrismaRetry } from "../db.server";

const TASK_LIST_SELECT = {
  id: true,
  name: true,
  status: true,
  shop: true,
  processedItems: true,
  totalItems: true,
  createdAt: true,
  updatedAt: true,
  scheduledAt: true,
  revertAt: true,
  actionDetails: true,
};

function slimActionDetailsExpr() {
  return Prisma.sql`
    (
      SELECT (
        (details - 'logs' - 'searchResults' - 'csvRows' - 'productIds')
        || jsonb_build_object(
          'logCount',
          CASE
            WHEN jsonb_typeof(details -> 'logs') = 'array'
            THEN jsonb_array_length(details -> 'logs')
            ELSE 0
          END,
          'canRollback',
          COALESCE(details #>> '{logs,0,variantId}', '') <> ''
        )
        || CASE
          WHEN jsonb_typeof(details -> 'runPayload') = 'object'
          THEN jsonb_build_object(
            'runPayload',
            (details -> 'runPayload') - 'searchResults' - 'products'
          )
          ELSE '{}'::jsonb
        END
      )::text
      FROM (
        SELECT CASE
          WHEN t."actionDetails" IS NULL OR btrim(t."actionDetails") = '' THEN '{}'::jsonb
          ELSE t."actionDetails"::jsonb
        END AS details
      ) parsed
    )
  `;
}

function whereSql({ shop, statuses, query, createdAt }) {
  const parts = [Prisma.sql`t.shop = ${shop}`];
  if (Array.isArray(statuses) && statuses.length > 0) {
    parts.push(Prisma.sql`t.status IN (${Prisma.join(statuses)})`);
  }
  if (query) {
    parts.push(Prisma.sql`t.name ILIKE ${`%${query}%`}`);
  }
  if (createdAt?.gte) {
    parts.push(Prisma.sql`t."createdAt" >= ${createdAt.gte}`);
  }
  if (createdAt?.lt) {
    parts.push(Prisma.sql`t."createdAt" < ${createdAt.lt}`);
  }
  return Prisma.join(parts, " AND ");
}

function orderSql(orderBy = { createdAt: "desc" }) {
  if (orderBy.scheduledAt === "asc") {
    return Prisma.sql`t."scheduledAt" ASC NULLS LAST`;
  }
  if (orderBy.updatedAt === "desc") {
    return Prisma.sql`t."updatedAt" DESC`;
  }
  return Prisma.sql`t."createdAt" DESC`;
}

async function querySlimTasks({ shop, statuses, query, createdAt, orderBy, skip = 0, take }) {
  const limitSql =
    take == null ? Prisma.empty : Prisma.sql`LIMIT ${take} OFFSET ${skip || 0}`;

  const rows = await prisma.$queryRaw`
    SELECT
      t.id,
      t.name,
      t.status,
      t.shop,
      t."processedItems",
      t."totalItems",
      t."createdAt",
      t."updatedAt",
      t."scheduledAt",
      t."revertAt",
      ${slimActionDetailsExpr()} AS "actionDetails"
    FROM "Task" t
    WHERE ${whereSql({ shop, statuses, query, createdAt })}
    ORDER BY ${orderSql(orderBy)}
    ${limitSql}
  `;

  return Array.isArray(rows) ? rows : [];
}

async function queryFullTasks({ shop, statuses, query, createdAt, orderBy, skip = 0, take }) {
  const where = { shop };
  if (Array.isArray(statuses) && statuses.length > 0) {
    where.status = { in: statuses };
  }
  if (query) {
    where.name = { contains: query, mode: "insensitive" };
  }
  if (createdAt) {
    where.createdAt = createdAt;
  }

  const order =
    orderBy?.scheduledAt === "asc"
      ? { scheduledAt: "asc" }
      : orderBy?.updatedAt === "desc"
        ? { updatedAt: "desc" }
        : { createdAt: "desc" };

  if (take === 1 && skip === 0) {
    const task = await prisma.task.findFirst({
      where,
      orderBy: order,
      select: TASK_LIST_SELECT,
    });
    return task ? [task] : [];
  }

  return prisma.task.findMany({
    where,
    orderBy: order,
    skip: take == null ? undefined : skip,
    take,
    select: TASK_LIST_SELECT,
  });
}

export async function findSlimTasks(options) {
  return withPrismaRetry(async () => {
    try {
      return await querySlimTasks(options);
    } catch (error) {
      console.error("slim task list query failed, falling back:", error?.message || error);
      return queryFullTasks(options);
    }
  });
}
