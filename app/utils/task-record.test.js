import assert from "node:assert/strict";
import {
  createTaskId,
  getStaleRunningRecovery,
  hasFreshRelatedRollback,
  STALE_RUNNING_MS,
  TASK_INTERRUPTED_ERROR,
} from "./task-record.js";

function test(name, fn) {
  fn();
  console.log(`✓ ${name}`);
}

test("createTaskId returns unique ids that are not the task name", () => {
  const ids = new Set(Array.from({ length: 20 }, () => createTaskId()));
  assert.equal(ids.size, 20);
  for (const id of ids) {
    assert.equal(id.includes("sale-"), false);
    assert.match(id, /^[0-9a-f-]{36}$/i);
  }
});

test("fresh running tasks are not recovered", () => {
  const recovery = getStaleRunningRecovery({
    status: "running",
    updatedAt: new Date(),
    actionDetails: JSON.stringify({ taskType: "price_edit" }),
  });
  assert.equal(recovery, null);
});

test("stale scheduled workers are reset to scheduled", () => {
  const recovery = getStaleRunningRecovery({
    status: "running",
    updatedAt: new Date(Date.now() - STALE_RUNNING_MS - 1000),
    actionDetails: JSON.stringify({ taskType: "scheduled_edit" }),
  });
  assert.deepEqual(recovery, { status: "scheduled" });
});

test("stale immediate price edits are marked failed", () => {
  const recovery = getStaleRunningRecovery({
    status: "running",
    createdAt: new Date(Date.now() - STALE_RUNNING_MS - 1000),
    actionDetails: JSON.stringify({ taskType: "price_edit" }),
  });
  assert.deepEqual(recovery, { status: "failed", error: TASK_INTERRUPTED_ERROR });
});

test("stale rollback and csv tasks are marked failed", () => {
  const stale = new Date(Date.now() - STALE_RUNNING_MS - 1000);
  assert.deepEqual(
    getStaleRunningRecovery({
      status: "running",
      updatedAt: stale,
      actionDetails: JSON.stringify({ taskType: "rollback" }),
    }),
    { status: "failed", error: TASK_INTERRUPTED_ERROR },
  );
  assert.deepEqual(
    getStaleRunningRecovery({
      status: "running",
      updatedAt: stale,
      actionDetails: JSON.stringify({ taskType: "scheduled_rollback" }),
    }),
    { status: "scheduled" },
  );
});

test("completed tasks are left alone", () => {
  assert.equal(
    getStaleRunningRecovery({
      status: "completed",
      updatedAt: new Date(0),
      actionDetails: "{}",
    }),
    null,
  );
});

test("stale scheduled rollback waits while its rollback job is still live", () => {
  const sourceTaskId = "source-1";
  const staleWorker = {
    id: `scheduled-rollback-${sourceTaskId}`,
    status: "running",
    updatedAt: new Date(Date.now() - STALE_RUNNING_MS - 1000),
    actionDetails: JSON.stringify({
      taskType: "scheduled_rollback",
      sourceTaskId,
    }),
  };
  const liveRollback = {
    id: `rollback-${sourceTaskId}`,
    status: "running",
    updatedAt: new Date(),
    actionDetails: JSON.stringify({ taskType: "rollback" }),
  };

  assert.equal(hasFreshRelatedRollback(staleWorker, [staleWorker, liveRollback]), true);
  assert.equal(hasFreshRelatedRollback(staleWorker, [staleWorker]), false);
});

console.log("All task-record tests passed.");
