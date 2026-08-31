import assert from "node:assert/strict";
import {
  CONCURRENT_TASK_LIMIT_ERROR,
  countRunningTasksForShop,
  createTaskId,
  getConcurrentTaskLimitError,
  getStaleRunningRecovery,
  hasFreshRelatedRollback,
  MAX_CONCURRENT_RUNNING_TASKS,
  persistCancelledTaskProgress,
  STALE_RUNNING_MS,
  stopRunningTaskForShop,
  TASK_INTERRUPTED_ERROR,
  updateRunningTaskForShop,
  withShopRunningSlotLock,
  writeRunningTaskProgress,
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

test("stale scheduled rollback waits for cycle-specific rollback jobs", () => {
  const sourceTaskId = "source-2";
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
    id: `rollback-${sourceTaskId}-123`,
    status: "running",
    updatedAt: new Date(),
    actionDetails: JSON.stringify({
      taskType: "rollback",
      sourceTaskId,
    }),
  };

  assert.equal(hasFreshRelatedRollback(staleWorker, [staleWorker, liveRollback]), true);
});

test("countRunningTasksForShop counts running tasks for a shop", async () => {
  let where = null;
  const db = {
    task: {
      count: async (args) => {
        where = args.where;
        return 2;
      },
    },
  };

  assert.equal(await countRunningTasksForShop(db, "shop.myshopify.com"), 2);
  assert.deepEqual(where, {
    shop: "shop.myshopify.com",
    status: "running",
  });
});

test("getConcurrentTaskLimitError blocks a fourth running task", async () => {
  const db = {
    task: {
      count: async () => MAX_CONCURRENT_RUNNING_TASKS,
    },
  };

  assert.equal(
    await getConcurrentTaskLimitError(db, "shop.myshopify.com"),
    CONCURRENT_TASK_LIMIT_ERROR,
  );
});

test("getConcurrentTaskLimitError allows a slot and can exclude a task", async () => {
  let where = null;
  const db = {
    task: {
      count: async (args) => {
        where = args.where;
        return MAX_CONCURRENT_RUNNING_TASKS - 1;
      },
    },
  };

  assert.equal(
    await getConcurrentTaskLimitError(db, "shop.myshopify.com", { excludeTaskId: "task-1" }),
    null,
  );
  assert.deepEqual(where.id, { not: "task-1" });
});

test("withShopRunningSlotLock uses a transaction lock when available", async () => {
  const calls = [];
  const db = {
    $transaction: async (fn) => {
      const tx = {
        $executeRaw: async () => {
          calls.push("lock");
        },
      };
      calls.push("tx");
      return fn(tx);
    },
  };

  const result = await withShopRunningSlotLock(db, "shop.myshopify.com", async (tx) => {
    calls.push(Boolean(tx.$executeRaw));
    return "ok";
  });

  assert.equal(result, "ok");
  assert.deepEqual(calls, ["tx", "lock", true]);
});

test("withShopRunningSlotLock runs work directly when transactions are unavailable", async () => {
  const db = { task: {} };
  const result = await withShopRunningSlotLock(db, "shop.myshopify.com", async (client) => {
    assert.equal(client, db);
    return 1;
  });
  assert.equal(result, 1);
});

function createTaskDb(handler) {
  return {
    task: {
      updateMany: async (args) => handler(args),
    },
  };
}

test("updateRunningTaskForShop only updates running tasks", async () => {
  const calls = [];
  const db = createTaskDb((args) => {
    calls.push(args);
    return { count: 1 };
  });

  const updated = await updateRunningTaskForShop(db, {
    id: "task-1",
    shop: "shop.myshopify.com",
    data: { status: "cancelled" },
  });

  assert.equal(updated, true);
  assert.deepEqual(calls[0].where, {
    id: "task-1",
    shop: "shop.myshopify.com",
    status: "running",
  });
});

test("stopRunningTaskForShop marks a running task cancelled", async () => {
  const db = createTaskDb((args) => {
    assert.equal(args.data.status, "cancelled");
    return { count: 1 };
  });

  assert.equal(
    await stopRunningTaskForShop(db, { id: "task-1", shop: "shop.myshopify.com" }),
    true,
  );
});

test("writeRunningTaskProgress persists logs after a task is cancelled", async () => {
  const calls = [];
  const db = createTaskDb((args) => {
    calls.push(args);
    return { count: args.where.status === "cancelled" ? 1 : 0 };
  });

  const stopped = await writeRunningTaskProgress(db, {
    id: "task-1",
    shop: "shop.myshopify.com",
    data: {
      status: "running",
      processedItems: 4,
      actionDetails: "{\"logs\":[]}",
    },
  });

  assert.equal(stopped, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].where.status, "cancelled");
  assert.equal(calls[1].data.status, undefined);
  assert.equal(calls[1].data.processedItems, 4);
});

test("persistCancelledTaskProgress ignores non-cancelled tasks", async () => {
  const db = createTaskDb((args) => {
    assert.equal(args.where.status, "cancelled");
    return { count: 0 };
  });

  assert.equal(
    await persistCancelledTaskProgress(db, {
      id: "task-1",
      shop: "shop.myshopify.com",
      data: { processedItems: 2 },
    }),
    false,
  );
});

console.log("All task-record tests passed.");
