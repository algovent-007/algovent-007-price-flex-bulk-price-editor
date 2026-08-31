export const ACTIVE_TASK_STORAGE_KEY = "price_flex_active_task_id";

export function readActiveTaskId() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACTIVE_TASK_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeActiveTaskId(taskId) {
  if (typeof window === "undefined" || !taskId) return;
  try {
    window.localStorage.setItem(ACTIVE_TASK_STORAGE_KEY, taskId);
  } catch {
    // Ignore storage failures in private browsing.
  }
}

export function clearActiveTaskId(taskId) {
  if (typeof window === "undefined") return;
  try {
    if (taskId && window.localStorage.getItem(ACTIVE_TASK_STORAGE_KEY) !== taskId) {
      return;
    }
    window.localStorage.removeItem(ACTIVE_TASK_STORAGE_KEY);
  } catch {
    // Ignore storage failures in private browsing.
  }
}
