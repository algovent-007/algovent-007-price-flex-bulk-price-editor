import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { toTaskProgressSnapshot } from "../utils/task-progress";

const EXECUTING_TASK_STATUSES = ["running"];

function orderRunningTasks(runningTasks, taskId) {
  if (!taskId) return runningTasks;
  return [
    ...runningTasks.filter((task) => task.id === taskId),
    ...runningTasks.filter((task) => task.id !== taskId),
  ];
}

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const taskId = url.searchParams.get("taskId");

  const [runningTasks, lastCompletedTask] = await Promise.all([
    prisma.task.findMany({
      where: {
        shop: session.shop,
        status: { in: EXECUTING_TASK_STATUSES },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.task.findFirst({
      where: {
        shop: session.shop,
        status: "completed",
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return Response.json(
    {
      runningTasks: orderRunningTasks(runningTasks, taskId).map(toTaskProgressSnapshot),
      lastCompletedTask: toTaskProgressSnapshot(lastCompletedTask),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
};
