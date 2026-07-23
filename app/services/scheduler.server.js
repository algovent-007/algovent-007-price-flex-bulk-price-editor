import prisma from "../db.server";
import { executePriceEditTask } from "./task-runner.server";
import { executeRollbackForTask } from "./rollback.server";
import {
  computeScheduledAt,
  formatTime12Hour,
  isOneTimeScheduleRecurrence,
} from "../utils/schedule";

export async function createScheduledRevertTask({ shop, sourceTaskId, sourceTaskName, revertAt }) {
  const revertTaskId = `scheduled-rollback-${sourceTaskId}`;

  const existing = await prisma.task.findUnique({ where: { id: revertTaskId } });
  if (existing) {
    if (existing.status === "cancelled" || existing.status === "failed") {
      return prisma.task.update({
        where: { id: revertTaskId },
        data: {
          status: "scheduled",
          shop,
          scheduledAt: revertAt,
          name: `Scheduled rollback: ${sourceTaskName}`,
          actionDetails: JSON.stringify({
            taskType: "scheduled_rollback",
            sourceTaskId,
            sourceTaskName,
          }),
        },
      });
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
      actionDetails: JSON.stringify({
        taskType: "scheduled_rollback",
        sourceTaskId,
        sourceTaskName,
      }),
    },
  });
}

async function processScheduledEditTask({ admin, shop, task, actionData }) {
  const scheduleMeta = {
    scheduleRecurrenceType: actionData.scheduleRecurrenceType || "one_time",
    scheduleRecurrenceDayOfWeek: actionData.scheduleRecurrenceDayOfWeek || "1",
    scheduleRecurrenceDayOfMonth: actionData.scheduleRecurrenceDayOfMonth || "1",
    changePricesAtTime:
      actionData.changePricesAtTime || formatTime12Hour(new Date(task.scheduledAt)),
    revertEnabled: actionData.revertEnabled,
  };

  const result = await executePriceEditTask({
    admin,
    taskId: task.id,
    runPayload: actionData.runPayload,
  });

  if (!result.success) {
    return result;
  }

  const isRecurring = !isOneTimeScheduleRecurrence(scheduleMeta.scheduleRecurrenceType);

  if (isRecurring) {
    const nextScheduledAt = computeScheduledAt({
      recurrenceType: scheduleMeta.scheduleRecurrenceType,
      changePricesAtTime: scheduleMeta.changePricesAtTime,
      scheduleRecurrenceDayOfWeek: scheduleMeta.scheduleRecurrenceDayOfWeek,
      scheduleRecurrenceDayOfMonth: scheduleMeta.scheduleRecurrenceDayOfMonth,
      now: new Date(),
    });

    if (nextScheduledAt) {
      await prisma.task.update({
        where: { id: task.id },
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
    });
  }

  return result;
}

async function completeScheduledRollbackTask(taskId, status, extra = {}) {
  await prisma.task.update({
    where: { id: taskId },
    data: { status },
  });
  return { success: true, ...extra };
}

async function processScheduledRollbackTask({ admin, task, actionData }) {
  const sourceTask = await prisma.task.findUnique({
    where: { id: actionData.sourceTaskId },
  });

  if (!sourceTask) {
    await prisma.task.update({
      where: { id: task.id },
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
    return completeScheduledRollbackTask(task.id, "cancelled", {
      skipped: true,
      reason: "Source task was already rolled back",
    });
  }

  if (sourceTask.status === "scheduled") {
    return { success: false, skipped: true, reason: "Source price edit has not run yet" };
  }

  if (sourceTask.status !== "completed") {
    await prisma.task.update({
      where: { id: task.id },
      data: { status: "failed" },
    });
    return {
      success: false,
      error: `Source task is ${sourceTask.status}, cannot roll back`,
    };
  }

  await prisma.task.update({
    where: { id: task.id },
    data: { status: "running" },
  });

  const result = await executeRollbackForTask({
    admin,
    task: sourceTask,
    createRollbackRecord: true,
  });

  if (!result.success) {
    if (result.error === "This task has already been rolled back") {
      return completeScheduledRollbackTask(task.id, "cancelled", {
        skipped: true,
        reason: result.error,
      });
    }

    await prisma.task.update({
      where: { id: task.id },
      data: { status: "failed" },
    });
    return result;
  }

  await prisma.task.update({
    where: { id: task.id },
    data: { status: "completed" },
  });

  return result;
}

export async function processDueTasksForShop({ admin, shop }) {
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
      await prisma.task.update({
        where: { id: task.id },
        data: { status: "failed" },
      });
      processed.push({ taskId: task.id, success: false, error: "Invalid task data" });
      continue;
    }

    try {
      if (actionData.taskType === "scheduled_rollback") {
        const result = await processScheduledRollbackTask({ admin, task, actionData });
        if (!result.skipped) {
          processed.push({ taskId: task.id, ...result });
        }
      } else {
        const result = await processScheduledEditTask({ admin, shop, task, actionData });
        processed.push({ taskId: task.id, ...result });
      }
    } catch (err) {
      console.error(`Failed to process scheduled task ${task.id}:`, err);
      await prisma.task.update({
        where: { id: task.id },
        data: { status: "failed" },
      });
      processed.push({ taskId: task.id, success: false, error: err.message });
    }
  }

  return processed;
}
