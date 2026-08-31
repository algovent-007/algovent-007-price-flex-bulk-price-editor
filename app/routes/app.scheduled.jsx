import { useEffect, useRef, useState } from "react";
import { useFetcher, useLoaderData, useNavigate, useRevalidator } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  activateScheduledTaskForShop,
  cancelScheduledRevertTask,
  pauseScheduledTaskForShop,
  processDueTasksForShop,
} from "../services/scheduler.server";
import {
  findTaskForShop,
  SCHEDULED_LIST_STATUSES,
  TASK_NOT_PAUSED_ACTIVATE_ERROR,
  TASK_NOT_SCHEDULED_PAUSE_ERROR,
  updateTaskForShop,
} from "../utils/task-record";
import { serializeScheduledTasks } from "../utils/schedule";
import { getShopTimezone } from "../utils/shop-timezone.server";
import { canCopyTask, canEditScheduledTask, storeTaskCopy, storeTaskEdit } from "../utils/copy-task";
import { translateError } from "../i18n/errors";
import { useI18n } from "../i18n/I18nProvider";
import AppPage from "../components/AppPage";
import ConfirmModal from "../components/ConfirmModal";
import styles from "../components/ScheduledTasks.module.css";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  await processDueTasksForShop({ admin, shop: session.shop });

  const tasks = await prisma.task.findMany({
    where: {
      shop: session.shop,
      status: { in: SCHEDULED_LIST_STATUSES },
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

  if (intent !== "delete" && intent !== "cancel" && intent !== "pause" && intent !== "activate") {
    return Response.json({ success: false, error: "Unknown intent" });
  }

  if (!taskId) {
    return Response.json({ success: false, error: "Task ID is required" });
  }

  const task = await findTaskForShop(prisma, { id: taskId, shop: session.shop });
  if (!task) {
    return Response.json({ success: false, error: "Task not found" });
  }

  if (intent === "pause") {
    const paused = await pauseScheduledTaskForShop({ id: taskId, shop: session.shop });
    if (!paused) {
      return Response.json({ success: false, error: TASK_NOT_SCHEDULED_PAUSE_ERROR });
    }
    return Response.json({ success: true, paused: true, taskId });
  }

  if (intent === "activate") {
    const activated = await activateScheduledTaskForShop({ id: taskId, shop: session.shop });
    if (!activated) {
      return Response.json({ success: false, error: TASK_NOT_PAUSED_ACTIVATE_ERROR });
    }
    return Response.json({ success: true, activated: true, taskId });
  }

  if (task.status !== "scheduled" && task.status !== "paused") {
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
  const appBridge = useAppBridge();
  const confirmModalRef = useRef(null);
  const [pendingConfirm, setPendingConfirm] = useState(null);

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.success) {
      revalidator.revalidate();
      return;
    }
    if (fetcher.data.error) {
      appBridge.toast.show(translateError(t, fetcher.data.error), { isError: true });
    }
  }, [appBridge, fetcher.data, fetcher.state, revalidator, t]);

  const pendingTaskId =
    fetcher.state !== "idle" && fetcher.formData?.get("taskId")
      ? fetcher.formData.get("taskId")
      : "";
  const pendingIntent =
    fetcher.state !== "idle" ? String(fetcher.formData?.get("intent") || "") : "";

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

  const requestConfirm = (type, task) => {
    setPendingConfirm({ type, task });
    confirmModalRef.current?.showOverlay?.();
  };

  const handlePause = (task) => requestConfirm("pause", task);
  const handleActivate = (task) => requestConfirm("activate", task);
  const handleDelete = (task) => requestConfirm("delete", task);

  const confirmPendingAction = () => {
    if (!pendingConfirm) return;
    fetcher.submit(
      { intent: pendingConfirm.type, taskId: pendingConfirm.task.id },
      { method: "POST" },
    );
  };

  const confirmDetails = (() => {
    if (!pendingConfirm) {
      return { heading: "", message: "", confirmLabel: t("common.yes"), confirmTone: undefined };
    }
    const name = pendingConfirm.task.name;
    if (pendingConfirm.type === "pause") {
      return {
        heading: t("scheduled.pause"),
        message: t("scheduled.confirmPause", { name }),
        confirmLabel: t("scheduled.pause"),
        confirmTone: undefined,
      };
    }
    if (pendingConfirm.type === "activate") {
      return {
        heading: t("scheduled.activate"),
        message: t("scheduled.confirmActivate", { name }),
        confirmLabel: t("scheduled.activate"),
        confirmTone: undefined,
      };
    }
    return {
      heading: t("common.delete"),
      message: t("scheduled.confirmDelete", { name }),
      confirmLabel: t("common.delete"),
      confirmTone: "critical",
    };
  })();

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
                  const isPaused = task.status === "paused";
                  const isBusy = pendingTaskId === task.id;

                  return (
                    <s-table-row key={task.id}>
                      <s-table-cell>
                        <s-text type="strong">{task.name}</s-text>
                      </s-table-cell>
                      <s-table-cell>
                        <s-stack direction="inline" gap="small-100" alignItems="center">
                          <s-badge tone="info">{getTaskTypeLabel(actionData, t)}</s-badge>
                          {isPaused ? (
                            <s-badge tone="warning">{t("status.paused")}</s-badge>
                          ) : null}
                        </s-stack>
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
                          {isPaused ? (
                            <s-button
                              variant="secondary"
                              onClick={() => handleActivate(task)}
                              disabled={fetcher.state !== "idle"}
                              loading={isBusy && pendingIntent === "activate"}
                            >
                              {t("scheduled.activate")}
                            </s-button>
                          ) : (
                            <s-button
                              variant="secondary"
                              onClick={() => handlePause(task)}
                              disabled={fetcher.state !== "idle"}
                              loading={isBusy && pendingIntent === "pause"}
                            >
                              {t("scheduled.pause")}
                            </s-button>
                          )}
                          <s-button
                            tone="critical"
                            variant="secondary"
                            onClick={() => handleDelete(task)}
                            disabled={fetcher.state !== "idle"}
                            loading={isBusy && pendingIntent === "delete"}
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

      <ConfirmModal
        id="scheduled-confirm-modal"
        heading={confirmDetails.heading}
        message={confirmDetails.message}
        confirmLabel={confirmDetails.confirmLabel}
        confirmTone={confirmDetails.confirmTone}
        modalRef={confirmModalRef}
        onConfirm={confirmPendingAction}
        onHide={() => setPendingConfirm(null)}
      />
    </AppPage>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
