import prisma from "../db.server";
import { TASK_STATUSES } from "../constants/task-status";

export { TASK_STATUSES };

export async function listAdminTasks({ query = "", status = "", page = 1, pageSize = 10 } = {}) {
  const trimmed = String(query || "").trim();
  const where = {
    ...(status ? { status } : {}),
    ...(trimmed
      ? {
          OR: [
            { id: { contains: trimmed, mode: "insensitive" } },
            { name: { contains: trimmed, mode: "insensitive" } },
            { shop: { contains: trimmed, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.task.count({ where }),
    prisma.task.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        status: true,
        shop: true,
        processedItems: true,
        totalItems: true,
        createdAt: true,
        scheduledAt: true,
        revertAt: true,
        updatedAt: true,
      },
    }),
  ]);

  return { total, rows };
}
