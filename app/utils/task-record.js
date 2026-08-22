import { randomUUID } from "node:crypto";

export const STALE_RUNNING_MS = 30 * 60 * 1000;
export const TASK_INTERRUPTED_ERROR = "Task stopped because it was interrupted.";
export const TASK_NOT_FOUND_FOR_SHOP_ERROR = "Task was not found for this shop.";
export const TASK_CREATE_FAILED_ERROR = "Failed to create task.";

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

export async function findTaskForShop(db, { id, shop }) {
  if (!id || !shop) return null;
  return db.task.findFirst({ where: { id, shop } });
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
