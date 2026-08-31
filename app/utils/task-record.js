import { randomUUID } from "node:crypto";

export const STALE_RUNNING_MS = 30 * 60 * 1000;
export const TASK_INTERRUPTED_ERROR = "Task stopped because it was interrupted.";
export const TASK_NOT_FOUND_FOR_SHOP_ERROR = "Task was not found for this shop.";
export const TASK_CREATE_FAILED_ERROR = "Failed to create task.";
export const TASK_NOT_RUNNING_ERROR = "Only running tasks can be stopped.";
export const MAX_CONCURRENT_RUNNING_TASKS = 3;
export const CONCURRENT_TASK_LIMIT_ERROR =
  "You can run up to 3 tasks at the same time. Wait for one to finish before starting another.";
export const SCHEDULED_LIST_STATUSES = ["scheduled", "paused"];
export const TASK_NOT_SCHEDULED_PAUSE_ERROR = "Only scheduled tasks can be paused.";
export const TASK_NOT_PAUSED_ACTIVATE_ERROR = "Only paused tasks can be activated.";

export function createTaskId() {
  return randomUUID();
}

export function parseTaskActionDetails(task) {
  try {
    return JSON.parse(task?.actionDetails || "{}");
  } catch {
    return {};
  }
}

export function getStaleRunningRecovery(task, now = new Date()) {
  if (task?.status !== "running") return null;

  const timestamp = new Date(task.updatedAt || task.createdAt || 0).getTime();
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
  if (now.getTime() - timestamp < STALE_RUNNING_MS) return null;

  const actionData = parseTaskActionDetails(task);
  if (actionData.taskType === "scheduled_edit" || actionData.taskType === "scheduled_rollback") {
    return { status: "scheduled" };
  }

  return {
    status: "failed",
    error: TASK_INTERRUPTED_ERROR,
  };
}

export function hasFreshRelatedRollback(task, runningTasks = [], now = new Date()) {
  const actionData = parseTaskActionDetails(task);
  if (actionData.taskType !== "scheduled_rollback" || !actionData.sourceTaskId) {
    return false;
  }

  const rollbackTask = runningTasks.find((candidate) => {
    if (candidate.id === `rollback-${actionData.sourceTaskId}`) return true;
    const candidateData = parseTaskActionDetails(candidate);
    return (
      candidateData.taskType === "rollback" &&
      candidateData.sourceTaskId === actionData.sourceTaskId
    );
  });
  return Boolean(rollbackTask && !getStaleRunningRecovery(rollbackTask, now));
}

export async function countRunningTasksForShop(db, shop, { excludeTaskId } = {}) {
  if (!shop) return 0;
  return db.task.count({
    where: {
      shop,
      status: "running",
      ...(excludeTaskId ? { id: { not: excludeTaskId } } : {}),
    },
  });
}

export async function getConcurrentTaskLimitError(db, shop, { excludeTaskId } = {}) {
  const runningCount = await countRunningTasksForShop(db, shop, { excludeTaskId });
  if (runningCount >= MAX_CONCURRENT_RUNNING_TASKS) {
    return CONCURRENT_TASK_LIMIT_ERROR;
  }
  return null;
}

export async function withShopRunningSlotLock(db, shop, work) {
  if (typeof db?.$transaction !== "function") {
    return work(db);
  }

  return db.$transaction(async (tx) => {
    if (shop) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${shop}))`;
    }
    return work(tx);
  });
}

export async function findTaskForShop(db, { id, shop }) {
  if (!id || !shop) return null;
  return db.task.findFirst({ where: { id, shop } });
}

export async function findTaskStatusForShop(db, { id, shop }) {
  if (!id || !shop) return null;
  return db.task.findFirst({
    where: { id, shop },
    select: { status: true },
  });
}

export async function updateTaskForShop(db, { id, shop, data }) {
  if (!id || !shop || !data) return false;
  const result = await db.task.updateMany({
    where: { id, shop },
    data,
  });
  return result.count > 0;
}

export async function requireTaskUpdateForShop(db, { id, shop, data }) {
  const updated = await updateTaskForShop(db, { id, shop, data });
  if (!updated) {
    throw new Error(TASK_NOT_FOUND_FOR_SHOP_ERROR);
  }
}

export async function updateRunningTaskForShop(db, { id, shop, data }) {
  if (!id || !shop || !data) return false;
  const result = await db.task.updateMany({
    where: { id, shop, status: "running" },
    data,
  });
  return result.count > 0;
}

export async function persistCancelledTaskProgress(db, { id, shop, data }) {
  if (!id || !shop || !data) return false;
  const result = await db.task.updateMany({
    where: { id, shop, status: "cancelled" },
    data,
  });
  return result.count > 0;
}

export async function writeRunningTaskProgress(db, { id, shop, data }) {
  const updated = await updateRunningTaskForShop(db, { id, shop, data });
  if (updated) return false;

  const { status: _status, ...progressData } = data || {};
  if (Object.keys(progressData).length > 0) {
    await persistCancelledTaskProgress(db, { id, shop, data: progressData });
  }
  return true;
}

export async function stopRunningTaskForShop(db, { id, shop }) {
  return updateRunningTaskForShop(db, {
    id,
    shop,
    data: { status: "cancelled" },
  });
}
