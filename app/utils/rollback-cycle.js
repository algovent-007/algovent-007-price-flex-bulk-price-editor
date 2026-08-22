import { isOneTimeScheduleRecurrence } from "./schedule.js";

export function parseActionTimestamp(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function canRollbackRecurringCycle(actionData) {
  if (isOneTimeScheduleRecurrence(actionData?.scheduleRecurrenceType)) {
    return false;
  }

  const lastCompletedAt = parseActionTimestamp(actionData?.lastCompletedAt);
  if (!lastCompletedAt) return false;

  const lastRolledBackAt = parseActionTimestamp(actionData?.lastRolledBackAt);
  return !lastRolledBackAt || lastCompletedAt > lastRolledBackAt;
}

export function getRecurringCycleRollbackId(taskId, lastCompletedAt) {
  const completedAt = parseActionTimestamp(lastCompletedAt);
  if (!taskId || !completedAt) return null;
  return `rollback-${taskId}-${completedAt.getTime()}`;
}

export function isCurrentCycleRolledBack(taskId, actionData) {
  if (canRollbackRecurringCycle(actionData)) {
    const cycleId = getRecurringCycleRollbackId(taskId, actionData.lastCompletedAt);
    return Boolean(cycleId && actionData?.rolledBackByTaskId === cycleId);
  }

  return Boolean(actionData?.rolledBackByTaskId || actionData?.lastRolledBackAt);
}

export function hasFutureScheduledOccurrence(scheduledAt, now = new Date()) {
  const nextAt = parseActionTimestamp(scheduledAt);
  return Boolean(nextAt && nextAt > now);
}
