import assert from "node:assert/strict";
import {
  canRollbackRecurringCycle,
  getRecurringCycleRollbackId,
  hasFutureScheduledOccurrence,
  isCurrentCycleRolledBack,
} from "./rollback-cycle.js";

function test(name, fn) {
  fn();
  console.log(`✓ ${name}`);
}

const lastCompletedAt = "2026-08-22T10:00:00.000Z";
const lastCompletedMs = new Date(lastCompletedAt).getTime();

test("one-time tasks cannot use recurring cycle rollback", () => {
  assert.equal(
    canRollbackRecurringCycle({
      scheduleRecurrenceType: "one_time",
      lastCompletedAt,
    }),
    false,
  );
});

test("recurring cycle is roll-backable after a new run", () => {
  assert.equal(
    canRollbackRecurringCycle({
      scheduleRecurrenceType: "daily",
      lastCompletedAt,
    }),
    true,
  );
  assert.equal(
    canRollbackRecurringCycle({
      scheduleRecurrenceType: "weekly",
      lastCompletedAt,
      lastRolledBackAt: "2026-08-21T13:00:00.000Z",
    }),
    true,
  );
});

test("recurring cycle is not roll-backable after it was already reverted", () => {
  assert.equal(
    canRollbackRecurringCycle({
      scheduleRecurrenceType: "daily",
      lastCompletedAt,
      lastRolledBackAt: "2026-08-22T13:00:00.000Z",
    }),
    false,
  );
});

test("leftover rolledBackByTaskId from a previous cycle does not block the next", () => {
  const taskId = "task-1";
  const previousCycleId = `rollback-${taskId}-${lastCompletedMs - 86_400_000}`;
  const actionData = {
    scheduleRecurrenceType: "daily",
    lastCompletedAt,
    rolledBackByTaskId: previousCycleId,
  };

  assert.equal(isCurrentCycleRolledBack(taskId, actionData), false);
});

test("matching cycle rollback id still blocks the same cycle after a failed restore", () => {
  const taskId = "task-1";
  const actionData = {
    scheduleRecurrenceType: "daily",
    lastCompletedAt,
    rolledBackByTaskId: getRecurringCycleRollbackId(taskId, lastCompletedAt),
  };

  assert.equal(isCurrentCycleRolledBack(taskId, actionData), true);
});

test("restored recurring source with lastRolledBackAt blocks the same cycle", () => {
  const actionData = {
    scheduleRecurrenceType: "daily",
    lastCompletedAt,
    lastRolledBackAt: "2026-08-22T13:00:00.000Z",
  };

  assert.equal(isCurrentCycleRolledBack("task-1", actionData), true);
});

test("one-time rolledBackByTaskId still blocks rollback", () => {
  assert.equal(
    isCurrentCycleRolledBack("task-1", {
      scheduleRecurrenceType: "one_time",
      rolledBackByTaskId: "rollback-task-1",
    }),
    true,
  );
});

test("future scheduled occurrence is required before restoring recurrence", () => {
  assert.equal(hasFutureScheduledOccurrence(new Date(Date.now() + 60_000)), true);
  assert.equal(hasFutureScheduledOccurrence(new Date(Date.now() - 60_000)), false);
  assert.equal(hasFutureScheduledOccurrence(null), false);
});
