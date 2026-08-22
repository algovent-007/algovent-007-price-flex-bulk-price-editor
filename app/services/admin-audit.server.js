import prisma from "../db.server";
import { sanitizeAuditDetails } from "../utils/admin-sanitize.server";

export async function recordAdminAudit({
  adminUser,
  shop = null,
  merchantUserId = null,
  action,
  success,
  taskId = null,
  details = null,
}) {
  try {
    return await prisma.adminAuditLog.create({
      data: {
        adminUserId: adminUser?.id || null,
        adminEmail: adminUser?.email || "unknown",
        shop,
        merchantUserId: merchantUserId == null ? null : String(merchantUserId),
        action,
        success: Boolean(success),
        taskId,
        details: sanitizeAuditDetails(details),
      },
    });
  } catch (error) {
    console.error("Failed to write admin audit log", error);
    return null;
  }
}

export async function listAdminAuditLogs({ query = "", page = 1, pageSize = 10 }) {
  const trimmed = String(query || "").trim();
  const where = trimmed
    ? {
        OR: [
          { adminEmail: { contains: trimmed, mode: "insensitive" } },
          { shop: { contains: trimmed, mode: "insensitive" } },
          { action: { contains: trimmed, mode: "insensitive" } },
          { taskId: { contains: trimmed, mode: "insensitive" } },
          { merchantUserId: { contains: trimmed, mode: "insensitive" } },
        ],
      }
    : {};

  const [total, rows] = await Promise.all([
    prisma.adminAuditLog.count({ where }),
    prisma.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { total, rows };
}
