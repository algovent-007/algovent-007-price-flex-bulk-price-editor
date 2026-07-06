import { useEffect } from "react";
import { useFetcher, useLoaderData, useRevalidator } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { processDueTasksForShop } from "../services/scheduler.server";
import { formatScheduleDateTime } from "../utils/schedule";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  await processDueTasksForShop({ admin, shop: session.shop });

  const tasks = await prisma.task.findMany({
    where: {
      shop: session.shop,
      status: "scheduled",
    },
    orderBy: { scheduledAt: "asc" },
  });

  return Response.json({ tasks });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const taskId = formData.get("taskId");

  if (intent !== "cancel") {
    return Response.json({ success: false, error: "Unknown intent" });
  }

  if (!taskId) {
    return Response.json({ success: false, error: "Task ID is required" });
  }

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || task.shop !== session.shop) {
    return Response.json({ success: false, error: "Task not found" });
  }

  if (task.status !== "scheduled") {
    return Response.json({ success: false, error: "Only scheduled tasks can be cancelled" });
  }

  await prisma.task.update({
    where: { id: taskId },
    data: { status: "cancelled" },
  });

  if (task.actionDetails) {
    try {
      const actionData = JSON.parse(task.actionDetails);
      if (actionData.taskType === "scheduled_edit") {
        const revertTaskId = `scheduled-rollback-${taskId}`;
        const revertTask = await prisma.task.findUnique({ where: { id: revertTaskId } });
        if (revertTask?.status === "scheduled") {
          await prisma.task.update({
            where: { id: revertTaskId },
            data: { status: "cancelled" },
          });
        }
      }
    } catch (e) {
      console.error("Failed to cancel linked revert task:", e);
    }
  }

  return Response.json({ success: true });
};

function getTaskTypeLabel(actionData) {
  if (actionData.taskType === "scheduled_rollback") return "Scheduled rollback";
  return "Scheduled price edit";
}

export default function ScheduledTasks() {
  const { tasks } = useLoaderData();
  const fetcher = useFetcher();
  const revalidator = useRevalidator();

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.success) {
      revalidator.revalidate();
    }
  }, [fetcher.state, fetcher.data, revalidator]);

  const handleCancel = (taskId) => {
    if (!window.confirm("Cancel this scheduled task?")) return;
    fetcher.submit({ intent: "cancel", taskId }, { method: "POST" });
  };

  return (
    <s-page heading="Scheduled Tasks">
      <s-section heading="Upcoming scheduled tasks">
        {tasks.length === 0 ? (
          <s-paragraph>
            No scheduled tasks. Create a task on the New Task page and choose &quot;Change prices
            later&quot;.
          </s-paragraph>
        ) : (
          <s-table variant="auto">
            <s-table-header-row>
              <s-table-header listSlot="primary">Task Name</s-table-header>
              <s-table-header>Type</s-table-header>
              <s-table-header>Runs At</s-table-header>
              <s-table-header>Revert At</s-table-header>
              <s-table-header>Actions</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {tasks.map((task) => {
                let actionData = {};
                try {
                  actionData = JSON.parse(task.actionDetails || "{}");
                } catch (e) {}

                return (
                  <s-table-row key={task.id}>
                    <s-table-cell>
                      <s-text type="strong">{task.name}</s-text>
                    </s-table-cell>
                    <s-table-cell>
                      <s-badge tone="info">{getTaskTypeLabel(actionData)}</s-badge>
                    </s-table-cell>
                    <s-table-cell>
                      <s-text color="subdued">{formatScheduleDateTime(task.scheduledAt)}</s-text>
                    </s-table-cell>
                    <s-table-cell>
                      <s-text color="subdued">
                        {task.revertAt ? formatScheduleDateTime(task.revertAt) : "—"}
                      </s-text>
                    </s-table-cell>
                    <s-table-cell>
                      <s-button
                        tone="critical"
                        onClick={() => handleCancel(task.id)}
                        disabled={fetcher.state !== "idle"}
                        loading={fetcher.state !== "idle"}
                      >
                        Cancel
                      </s-button>
                    </s-table-cell>
                  </s-table-row>
                );
              })}
            </s-table-body>
          </s-table>
        )}
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
