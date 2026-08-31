import { findSlimTasks } from "./task-list.server";
import { orderRunningTasks, toTaskProgressSnapshot } from "./task-progress";

export async function loadTaskProgressForShop(shop, taskId) {
  const [runningTasks, completedTasks] = await Promise.all([
    findSlimTasks({
      shop,
      statuses: ["running"],
      orderBy: { createdAt: "desc" },
    }),
    findSlimTasks({
      shop,
      statuses: ["completed"],
      orderBy: { updatedAt: "desc" },
      take: 1,
    }),
  ]);

  return {
    runningTasks: orderRunningTasks(runningTasks, taskId).map(toTaskProgressSnapshot),
    lastCompletedTask: toTaskProgressSnapshot(completedTasks[0] || null),
  };
}
