import {
  BILLING_FEATURES,
  SUBSCRIPTION_STATUS,
  planIncludesFeature,
} from "../constants/billing";
import prisma from "../db.server";
import { getSubscriptionByShop } from "../models/subscription.server";
import { executePriceEditTask } from "./task-runner.server";
import { executeRollbackForTask } from "./rollback.server";
import {
  computeScheduledAt,
  formatTime12Hour,
  isOneTimeScheduleRecurrence,
} from "../utils/schedule";
import {
  findTaskForShop,
  getStaleRunningRecovery,
  hasFreshRelatedRollback,
  parseTaskActionDetails,
  TASK_NOT_FOUND_FOR_SHOP_ERROR,
  updateTaskForShop,
} from "../utils/task-record";

export async function createScheduledRevertTask({
  shop,
  sourceTaskId,
  sourceTaskName,
  revertAt,
  revertPricesAtDate,
  revertPricesAtTime,
  scheduleTimezone,
}) {
  const revertTaskId = `scheduled-rollback-${sourceTaskId}`;
  const actionDetails = JSON.stringify({
    taskType: "scheduled_rollback",
    sourceTaskId,
    sourceTaskName,
    revertPricesAtDate,
    revertPricesAtTime,
    scheduleTimezone,
  });

  const existing = await prisma.task.findUnique({ where: { id: revertTaskId } });
  if (existing) {
    if (existing.shop && existing.shop !== shop) {
      throw new Error(TASK_NOT_FOUND_FOR_SHOP_ERROR);
    }
    if (
      existing.status === "cancelled" ||
      existing.status === "failed" ||
      existing.status === "scheduled"
    ) {
      await prisma.task.updateMany({
        where: {
          id: revertTaskId,
          OR: [{ shop }, { shop: null }],
        },
        data: {
          status: "scheduled",
          shop,
          scheduledAt: revertAt,
          name: `Scheduled rollback: ${sourceTaskName}`,
          actionDetails,
        },
      });
      return prisma.task.findFirst({ where: { id: revertTaskId, shop } });
    }
    return existing;
  }

  return prisma.task.create({
    data: {
      id: revertTaskId,
      name: `Scheduled rollback: ${sourceTaskName}`,
      status: "scheduled",
      shop,
      scheduledAt: revertAt,
      actionDetails,
    },
  });
}

export async function cancelScheduledRevertTask(sourceTaskId, shop) {
  if (!sourceTaskId || !shop) return;
  await prisma.task.updateMany({
    where: {
      id: `scheduled-rollback-${sourceTaskId}`,
      shop,
      status: "scheduled",
    },
    data: { status: "cancelled" },
  });
}

async function recoverStaleRunningTasks(shop) {
  const runningTasks = await prisma.task.findMany({
    where: { shop, status: "running" },
  });

  for (const task of runningTasks) {
    const recovery = getStaleRunningRecovery(task);
    if (!recovery) continue;
    if (hasFreshRelatedRollback(task, runningTasks)) continue;

    const actionData = parseTaskActionDetails(task);
    await updateTaskForShop(prisma, {
      id: task.id,
      shop,
      data: {
        status: recovery.status,
        ...(recovery.error
          ? {
              actionDetails: JSON.stringify({
                ...actionData,
                error: recovery.error,
              }),
            }
          : {}),
      },
    });
  }
}

async function processScheduledEditTask({ admin, shop, task, actionData }) {
  const scheduleTimezone = actionData.scheduleTimezone || null;
  const scheduleMeta = {
    scheduleRecurrenceType: actionData.scheduleRecurrenceType || "one_time",
    scheduleRecurrenceDayOfWeek: actionData.scheduleRecurrenceDayOfWeek || "1",
    scheduleRecurrenceDayOfMonth: actionData.scheduleRecurrenceDayOfMonth || "1",
    changePricesAtTime:
      actionData.changePricesAtTime ||
      formatTime12Hour(new Date(task.scheduledAt), scheduleTimezone),
    revertEnabled: actionData.revertEnabled,
    scheduleTimezone,
  };

  const isRecurring = !isOneTimeScheduleRecurrence(scheduleMeta.scheduleRecurrenceType);

  if (isRecurring) {
    const subscription = await getSubscriptionByShop(shop);
    const canUseRecurring =
      subscription?.status === SUBSCRIPTION_STATUS.ACTIVE &&
      planIncludesFeature(subscription.planName, BILLING_FEATURES.RECURRING_TASKS);

    if (!canUseRecurring) {
      await updateTaskForShop(prisma, {
        id: task.id,
        shop,
        data: { status: "completed" },
      });
      return {
        success: false,
        error: "Recurring tasks require a Pro or Super plan.",
      };
    }
  }

  const result = await executePriceEditTask({
    admin,
    taskId: task.id,
    shop,
    runPayload: actionData.runPayload,
  });

  if (!result.success) {
    return result;
  }

  if (isRecurring) {
    const nextScheduledAt = computeScheduledAt({
      recurrenceType: scheduleMeta.scheduleRecurrenceType,
      changePricesAtTime: scheduleMeta.changePricesAtTime,
      scheduleRecurrenceDayOfWeek: scheduleMeta.scheduleRecurrenceDayOfWeek,
      scheduleRecurrenceDayOfMonth: scheduleMeta.scheduleRecurrenceDayOfMonth,
      now: new Date(),
      timeZone: scheduleMeta.scheduleTimezone,
    });

    if (nextScheduledAt) {
      await updateTaskForShop(prisma, {
        id: task.id,
        shop,
        data: {
          status: "scheduled",
          scheduledAt: nextScheduledAt,
          actionDetails: JSON.stringify({
            taskType: "scheduled_edit",
            ...scheduleMeta,
            runPayload: actionData.runPayload,
            scheduledAt: nextScheduledAt.toISOString(),
            revertAt: task.revertAt?.toISOString() || null,
          }),
        },
      });
    }

    return result;
  }

  if (actionData.revertEnabled && task.revertAt) {
    await createScheduledRevertTask({
      shop,
      sourceTaskId: task.id,
      sourceTaskName: task.name,
      revertAt: task.revertAt,
      revertPricesAtDate: actionData.revertPricesAtDate,
      revertPricesAtTime: actionData.revertPricesAtTime,
      scheduleTimezone: actionData.scheduleTimezone,
    });
  }

  return result;
}

async function markScheduledTaskFailed(taskId, shop, err) {
  console.error(`Failed to process scheduled task ${taskId}:`, err);
  try {
    await updateTaskForShop(prisma, {
      id: taskId,
      shop,
      data: { status: "failed" },
    });
  } catch (updateErr) {
    console.error(`Failed to mark scheduled task ${taskId} as failed:`, updateErr);
  }
}

async function claimScheduledTask(taskId, shop) {
  const claim = await prisma.task.updateMany({
    where: {
      id: taskId,
      shop,
      status: "scheduled",
    },
    data: { status: "running" },
  });

  return claim.count > 0;
}

async function completeScheduledRollbackTask(taskId, shop, status, extra = {}) {
  await updateTaskForShop(prisma, {
    id: taskId,
    shop,
    data: { status },
  });
  return { success: true, ...extra };
}

async function processScheduledRollbackTask({ admin, task, actionData }) {
  const shop = task.shop;
  if (!shop) {
    return { success: false, error: TASK_NOT_FOUND_FOR_SHOP_ERROR };
  }
  const sourceTask = await findTaskForShop(prisma, {
    id: actionData.sourceTaskId,
    shop,
  });

  if (!sourceTask) {
    await updateTaskForShop(prisma, {
      id: task.id,
      shop,
      data: { status: "failed" },
    });
    return { success: false, error: "Source task not found for scheduled rollback" };
  }

  let sourceActionData = {};
  try {
    sourceActionData = JSON.parse(sourceTask.actionDetails || "{}");
  } catch (e) {
    sourceActionData = {};
  }

  if (sourceTask.status === "rolled_back" || sourceActionData.rolledBackByTaskId) {
    return completeScheduledRollbackTask(task.id, shop, "cancelled", {
      skipped: true,
      reason: "Source task was already rolled back",
    });
  }

  if (sourceTask.status === "scheduled") {
    await updateTaskForShop(prisma, {
      id: task.id,
      shop,
      data: { status: "scheduled" },
    });
    return { success: false, skipped: true, reason: "Source price edit has not run yet" };
  }

  if (sourceTask.status !== "completed") {
    await updateTaskForShop(prisma, {
      id: task.id,
      shop,
      data: { status: "failed" },
    });
    return {
      success: false,
      error: `Source task is ${sourceTask.status}, cannot roll back`,
    };
  }

  await updateTaskForShop(prisma, {
    id: task.id,
    shop,
    data: { status: "running" },
  });

  const result = await executeRollbackForTask({
    admin,
    task: sourceTask,
    createRollbackRecord: true,
  });

  if (!result.success) {
    if (result.error === "This task has already been rolled back") {
      return completeScheduledRollbackTask(task.id, shop, "cancelled", {
        skipped: true,
        reason: result.error,
      });
    }

    await updateTaskForShop(prisma, {
      id: task.id,
      shop,
      data: { status: "failed" },
    });
    return result;
  }

  await updateTaskForShop(prisma, {
    id: task.id,
    shop,
    data: { status: "completed" },
  });

  return result;
}

export async function processDueTasksForShop({ admin, shop }) {
  await recoverStaleRunningTasks(shop);

  const now = new Date();
  const dueTasks = await prisma.task.findMany({
    where: {
      shop,
      status: "scheduled",
      scheduledAt: { lte: now },
    },
    orderBy: { scheduledAt: "asc" },
  });

  const processed = [];

  for (const task of dueTasks) {
    let actionData = {};
    try {
      actionData = JSON.parse(task.actionDetails || "{}");
    } catch (e) {
      await updateTaskForShop(prisma, {
        id: task.id,
        shop,
        data: { status: "failed" },
      });
      processed.push({ taskId: task.id, success: false, error: "Invalid task data" });
      continue;
    }

    try {
      if (actionData.taskType === "scheduled_rollback") {
        const claimed = await claimScheduledTask(task.id, shop);
        if (!claimed) {
          continue;
        }

        const result = await processScheduledRollbackTask({ admin, task, actionData });
        processed.push({ taskId: task.id, ...result });
        continue;
      }

      const claimed = await claimScheduledTask(task.id, shop);
      if (!claimed) {
        continue;
      }

      const result = await processScheduledEditTask({ admin, shop, task, actionData });
      processed.push({ taskId: task.id, ...result });
    } catch (err) {
      await markScheduledTaskFailed(task.id, shop, err);
      processed.push({ taskId: task.id, success: false, error: err.message });
    }
  }

  return processed;
}

export async function findShopsWithDueTasks() {
  const now = new Date();
  const groups = await prisma.task.groupBy({
    by: ["shop"],
    where: {
      shop: { not: null },
      status: "scheduled",
      scheduledAt: { lte: now },
    },
  });

  return groups.map((group) => group.shop).filter(Boolean);
}
