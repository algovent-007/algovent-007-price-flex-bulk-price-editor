import { slimTaskActionDetails } from "./schedule";

export function orderRunningTasks(runningTasks, taskId) {
  if (!taskId) return runningTasks;
  return [
    ...runningTasks.filter((task) => task.id === taskId),
    ...runningTasks.filter((task) => task.id !== taskId),
  ];
}

export function toTaskProgressSnapshot(task) {
  if (!task) return null;

  let actionData = {};
  try {
    actionData = JSON.parse(task.actionDetails || "{}");
  } catch {
    actionData = {};
  }

  const logs = actionData.logs;
  return {
    id: task.id,
    name: task.name,
    status: task.status,
    processedItems: task.processedItems,
    totalItems: task.totalItems,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    actionDetails: slimTaskActionDetails(task.actionDetails, {
      logCount: Array.isArray(logs) ? logs.length : 0,
    }),
  };
}

export function unwrapTaskProgressPayload(data) {
  if (!data || typeof data !== "object") return null;
  if (Array.isArray(data.runningTasks)) return data;
  if (Array.isArray(data.data?.runningTasks)) return data.data;
  for (const value of Object.values(data)) {
    if (value && Array.isArray(value.runningTasks)) return value;
    if (value && Array.isArray(value.data?.runningTasks)) return value.data;
  }
  return null;
}
