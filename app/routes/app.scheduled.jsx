import { useEffect } from "react";
import { useFetcher, useLoaderData, useNavigate, useRevalidator } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { cancelScheduledRevertTask, processDueTasksForShop } from "../services/scheduler.server";
import { findTaskForShop, updateTaskForShop } from "../utils/task-record";
import { serializeScheduledTasks } from "../utils/schedule";
import { getShopTimezone } from "../utils/shop-timezone.server";
import { canCopyTask, canEditScheduledTask, storeTaskCopy, storeTaskEdit } from "../utils/copy-task";
import { useI18n } from "../i18n/I18nProvider";
import AppPage from "../components/AppPage";
import styles from "../components/ScheduledTasks.module.css";

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

  const timezone = await getShopTimezone({ shop: session.shop, admin });

  return Response.json({
    tasks: serializeScheduledTasks(tasks, timezone),
    timezone,
  });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const taskId = formData.get("taskId");

  if (intent !== "delete" && intent !== "cancel") {
    return Response.json({ success: false, error: "Unknown intent" });
  }

  if (!taskId) {
    return Response.json({ success: false, error: "Task ID is required" });
  }

  const task = await findTaskForShop(prisma, { id: taskId, shop: session.shop });
  if (!task) {
    return Response.json({ success: false, error: "Task not found" });
  }

  if (task.status !== "scheduled") {
    return Response.json({ success: false, error: "Only scheduled tasks can be cancelled" });
  }

  const cancelled = await updateTaskForShop(prisma, {
    id: taskId,
    shop: session.shop,
    data: { status: "cancelled" },
  });
  if (!cancelled) {
    return Response.json({ success: false, error: "Task not found" });
  }

  if (task.actionDetails) {
    try {
      const actionData = JSON.parse(task.actionDetails);
      if (actionData.taskType === "scheduled_edit") {
        await cancelScheduledRevertTask(taskId, session.shop);
      }
    } catch (e) {
      console.error("Failed to cancel linked revert task:", e);
    }
  }

  return Response.json({ success: true });
};

function getTaskTypeLabel(actionData, t) {
  if (actionData.taskType === "scheduled_rollback") return t("scheduled.rollback");
  return t("scheduled.priceEdit");
}

function getTaskMeta(task) {
  try {
    return JSON.parse(task.actionDetails || "{}");
  } catch {
    return {};
  }
}

export default function ScheduledTasks() {
  const { tasks, timezone } = useLoaderData();
  const { t } = useI18n();
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const revalidator = useRevalidator();

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.success) {
      revalidator.revalidate();
    }
  }, [fetcher.state, fetcher.data, revalidator]);

  const deletingTaskId =
    fetcher.state !== "idle" && fetcher.formData?.get("taskId")
      ? fetcher.formData.get("taskId")
      : "";

  const handleEdit = (task, actionData) => {
    if (!canEditScheduledTask(actionData)) return;
    storeTaskEdit({ task, actionData });
    navigate("/app/new");
  };

  const handleCopy = (task, actionData) => {
    if (!canCopyTask(actionData)) return;
    storeTaskCopy({
      task,
      actionData,
      taskName: t("scheduled.copyName", { name: task.name }),
      includeSchedule: true,
    });
    navigate("/app/new");
  };

  const handleDelete = (task) => {
    if (!window.confirm(t("scheduled.confirmDelete", { name: task.name }))) return;
    fetcher.submit({ intent: "delete", taskId: task.id }, { method: "POST" });
  };

  return (
    <AppPage heading={t("scheduled.heading")}>
      <s-section heading={t("scheduled.upcoming")}>
        <s-box paddingBlockEnd="base">
          <s-banner tone="info">
            {t("scheduled.timezoneBanner", { timezone })}
          </s-banner>
        </s-box>
        {tasks.length === 0 ? (
          <s-paragraph>
            {t("scheduled.empty")}
          </s-paragraph>
        ) : (
          <div className={styles.tableWrap}>
            <s-table variant="auto">
              <s-table-header-row>
                <s-table-header listSlot="primary">{t("scheduled.taskName")}</s-table-header>
                <s-table-header>{t("scheduled.type")}</s-table-header>
                <s-table-header>{t("scheduled.runsAt")}</s-table-header>
                <s-table-header>{t("scheduled.revertAt")}</s-table-header>
                <s-table-header>{t("scheduled.actions")}</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {tasks.map((task) => {
                  const actionData = getTaskMeta(task);
                  const isDeleting = deletingTaskId === task.id;

                  return (
                    <s-table-row key={task.id}>
                      <s-table-cell>
                        <s-text type="strong">{task.name}</s-text>
                      </s-table-cell>
                      <s-table-cell>
                        <s-badge tone="info">{getTaskTypeLabel(actionData, t)}</s-badge>
                      </s-table-cell>
                      <s-table-cell>
                        <s-text color="subdued">
                          {task.runsAtLabel || t("common.emDash")}
                        </s-text>
                      </s-table-cell>
                      <s-table-cell>
                        <s-text color="subdued">
                          {task.revertAtLabel || t("common.emDash")}
                        </s-text>
                      </s-table-cell>
                      <s-table-cell>
                        <div className={styles.actions}>
                          <s-button
                            variant="secondary"
                            onClick={() => handleEdit(task, actionData)}
                            disabled={!canEditScheduledTask(actionData) || fetcher.state !== "idle"}
                          >
                            {t("common.edit")}
                          </s-button>
                          <s-button
                            variant="secondary"
                            onClick={() => handleCopy(task, actionData)}
                            disabled={!canCopyTask(actionData) || fetcher.state !== "idle"}
                          >
                            {t("common.copy")}
                          </s-button>
                          <s-button
                            tone="critical"
                            variant="secondary"
                            onClick={() => handleDelete(task)}
                            disabled={fetcher.state !== "idle"}
                            loading={isDeleting}
                          >
                            {t("common.delete")}
                          </s-button>
                        </div>
                      </s-table-cell>
                    </s-table-row>
                  );
                })}
              </s-table-body>
            </s-table>
          </div>
        )}
      </s-section>
    </AppPage>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
