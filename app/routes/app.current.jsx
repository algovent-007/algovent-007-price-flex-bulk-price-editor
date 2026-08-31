import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFetcher, useLoaderData, useLocation, useSearchParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import TaskProgressCard, { isTaskTerminal } from "../components/TaskProgressCard";
import HomeEmptyState from "../components/HomeEmptyState";
import { canViewTaskConfiguration, buildTaskConfigState } from "../utils/task-config";
import {
  MAX_CONCURRENT_RUNNING_TASKS,
  stopRunningTaskForShop,
  TASK_NOT_RUNNING_ERROR,
} from "../utils/task-record";
import { formatCurrentTimeInTimezone } from "../utils/schedule";
import { DEFAULT_TIMEZONE, normalizeShopTimezone } from "../utils/shop-timezone.server";
import { fetchCollectionsAndLocations } from "../utils/shop-lookups.server";
import { getShopSettings, setTaskFinishedEmailEnabled } from "../models/shop-settings.server";
import { translateError } from "../i18n/errors";
import { useI18n } from "../i18n/I18nProvider";
import AppPage from "../components/AppPage";
import HomeSidebar from "../components/HomeSidebar";
import ConfirmModal from "../components/ConfirmModal";
import { clearActiveTaskId, readActiveTaskId } from "../utils/active-task-storage";
import { toTaskProgressSnapshot, unwrapTaskProgressPayload } from "../utils/task-progress";

const EXECUTING_TASK_STATUSES = ["running"];

const TaskConfigurationForm = lazy(() => import("../components/new-task/TaskConfigurationForm"));

function parseActionDetails(task) {
  try {
    return JSON.parse(task?.actionDetails || "{}");
  } catch {
    return {};
  }
}

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function orderRunningTasks(runningTasks, taskId) {
  if (!taskId) return runningTasks;
  return [
    ...runningTasks.filter((task) => task.id === taskId),
    ...runningTasks.filter((task) => task.id !== taskId),
  ];
}

async function loadRunningTaskProgress(shop, taskId) {
  const [runningTasks, lastCompletedTask] = await Promise.all([
    prisma.task.findMany({
      where: {
        shop,
        status: { in: EXECUTING_TASK_STATUSES },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.task.findFirst({
      where: {
        shop,
        status: "completed",
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return {
    runningTasks: orderRunningTasks(runningTasks, taskId).map(toTaskProgressSnapshot),
    lastCompletedTask: toTaskProgressSnapshot(lastCompletedTask),
  };
}

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const taskId = url.searchParams.get("taskId");

  const [settings, progress] = await Promise.all([
    getShopSettings(session.shop),
    loadRunningTaskProgress(session.shop, taskId),
  ]);

  const savedTimezone = normalizeShopTimezone(settings?.timezone);

  return Response.json(
    {
      ...progress,
      maxConcurrentTasks: MAX_CONCURRENT_RUNNING_TASKS,
      timezone: savedTimezone || DEFAULT_TIMEZONE,
      taskFinishedEmailEnabled: Boolean(settings?.taskFinishedEmailEnabled),
    },
    { headers: NO_STORE_HEADERS },
  );
};

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "update_task_finished_email") {
    const enabled = formData.get("enabled") === "true";
    await setTaskFinishedEmailEnabled(session.shop, enabled);
    return Response.json({
      success: true,
      skipRevalidate: true,
      taskFinishedEmailEnabled: enabled,
    });
  }

  if (intent === "task_lookups") {
    try {
      const lookups = await fetchCollectionsAndLocations(admin);
      return Response.json({ success: true, skipRevalidate: true, ...lookups });
    } catch (error) {
      console.error("Error fetching task lookups:", error);
      return Response.json({ success: true, skipRevalidate: true, collections: [], locations: [] });
    }
  }

  if (intent === "stop_task") {
    const taskId = formData.get("taskId");
    if (!taskId) {
      return Response.json({ success: false, error: "Task ID is required" });
    }

    const stopped = await stopRunningTaskForShop(prisma, {
      id: taskId,
      shop: session.shop,
    });
    if (!stopped) {
      return Response.json({ success: false, error: TASK_NOT_RUNNING_ERROR });
    }

    return Response.json({ success: true, stopped: true, taskId });
  }

  return Response.json({ success: false, error: "Unknown action." }, { status: 400 });
};

export default function CurrentTasks() {
  const loaderData = useLoaderData();
  const {
    maxConcurrentTasks,
    timezone,
    taskFinishedEmailEnabled,
  } = loaderData;
  const { t, formatDateTime } = useI18n();
  const location = useLocation();
  const appBridge = useAppBridge();
  const stopFetcher = useFetcher();
  const lookupsFetcher = useFetcher();
  const settingsFetcher = useFetcher();
  const locationRef = useRef(location);
  const detailsModalRef = useRef(null);
  const stopModalRef = useRef(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [detailsTask, setDetailsTask] = useState(null);
  const [taskPendingStop, setTaskPendingStop] = useState(null);
  const [emailEnabled, setEmailEnabled] = useState(taskFinishedEmailEnabled);
  const [liveProgress, setLiveProgress] = useState(null);
  const taskId = searchParams.get("taskId");
  locationRef.current = location;
  const runningTasks = liveProgress?.runningTasks || loaderData.runningTasks || [];
  const lastCompletedTask =
    liveProgress && "lastCompletedTask" in liveProgress
      ? liveProgress.lastCompletedTask
      : loaderData.lastCompletedTask;
  const shouldPoll = runningTasks.some((task) => !isTaskTerminal(task.status));
  const stoppingTaskId =
    stopFetcher.state !== "idle" && stopFetcher.formData?.get("intent") === "stop_task"
      ? stopFetcher.formData.get("taskId")
      : null;
  const detailsActionData = detailsTask ? parseActionDetails(detailsTask) : {};
  const detailsConfig = useMemo(() => {
    if (!detailsTask) return null;
    return buildTaskConfigState(detailsTask, parseActionDetails(detailsTask), timezone);
  }, [detailsTask, timezone]);

  useEffect(() => {
    setEmailEnabled(taskFinishedEmailEnabled);
  }, [taskFinishedEmailEnabled]);

  useEffect(() => {
    const storedTaskId = readActiveTaskId();
    const runningIds = new Set(runningTasks.map((task) => task.id));

    if (storedTaskId && !runningIds.has(storedTaskId)) {
      clearActiveTaskId(storedTaskId);
    }

    if (taskId && liveProgress && !runningIds.has(taskId)) {
      const next = new URLSearchParams(searchParams);
      next.delete("taskId");
      setSearchParams(next, { replace: true });
    }
  }, [liveProgress, runningTasks, searchParams, setSearchParams, taskId]);

  useEffect(() => {
    if (!shouldPoll) return undefined;

    let cancelled = false;

    const loadProgress = async () => {
      try {
        const params = new URLSearchParams(locationRef.current.search);
        params.set("t", String(Date.now()));
        const response = await fetch(`/api/task-progress?${params.toString()}`, {
          credentials: "same-origin",
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (!response.ok || cancelled) return;
        const payload = unwrapTaskProgressPayload(await response.json());
        if (!payload || cancelled) return;
        setLiveProgress({
          runningTasks: payload.runningTasks,
          lastCompletedTask: payload.lastCompletedTask,
        });
      } catch {
        // Keep the last known snapshot until the next poll.
      }
    };

    loadProgress();
    const interval = setInterval(loadProgress, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [shouldPoll]);

  useEffect(() => {
    if (stopFetcher.state !== "idle" || !stopFetcher.data) return;

    if (stopFetcher.data.success && stopFetcher.data.stopped) {
      appBridge.toast.show(t("progress.stopped"));
      void (async () => {
        try {
          const params = new URLSearchParams(locationRef.current.search);
          params.set("t", String(Date.now()));
          const response = await fetch(`/api/task-progress?${params.toString()}`, {
            credentials: "same-origin",
            cache: "no-store",
            headers: { Accept: "application/json" },
          });
          if (!response.ok) return;
          const payload = unwrapTaskProgressPayload(await response.json());
          if (!payload) return;
          setLiveProgress({
            runningTasks: payload.runningTasks,
            lastCompletedTask: payload.lastCompletedTask,
          });
        } catch {
          // The next poll interval will refresh if this request fails.
        }
      })();
      return;
    }

    if (stopFetcher.data.error) {
      appBridge.toast.show(translateError(t, stopFetcher.data.error), { isError: true });
    }
  }, [appBridge, stopFetcher.data, stopFetcher.state, t]);

  useEffect(() => {
    if (settingsFetcher.state !== "idle" || !settingsFetcher.data) return;

    if (settingsFetcher.data.success && "taskFinishedEmailEnabled" in settingsFetcher.data) {
      setEmailEnabled(settingsFetcher.data.taskFinishedEmailEnabled);
      appBridge.toast.show(
        settingsFetcher.data.taskFinishedEmailEnabled
          ? t("home.taskFinishedEmailsEnabled")
          : t("home.taskFinishedEmailsDisabled"),
      );
      return;
    }

    if (settingsFetcher.data.error) {
      appBridge.toast.show(translateError(t, settingsFetcher.data.error), { isError: true });
    }
  }, [appBridge, settingsFetcher.data, settingsFetcher.state, t]);

  const handleViewDetails = (task) => {
    if (!task) return;
    setDetailsTask(task);
    if (lookupsFetcher.state === "idle" && !lookupsFetcher.data) {
      lookupsFetcher.submit({ intent: "task_lookups" }, { method: "POST" });
    }
    detailsModalRef.current?.showOverlay?.();
  };

  const handleStopTask = (task) => {
    if (!task) return;
    setTaskPendingStop(task);
    stopModalRef.current?.showOverlay?.();
  };

  const confirmStopTask = () => {
    if (!taskPendingStop) return;
    stopFetcher.submit({ intent: "stop_task", taskId: taskPendingStop.id }, { method: "POST" });
  };

  const handleTaskFinishedEmailChange = (event) => {
    const nextEnabled = Boolean(event.currentTarget?.checked ?? event.target?.checked);
    setEmailEnabled(nextEnabled);
    settingsFetcher.submit(
      {
        intent: "update_task_finished_email",
        enabled: String(nextEnabled),
      },
      { method: "POST" },
    );
  };

  return (
    <AppPage heading={t("nav.currentTasks")}>
      <s-section>
        {runningTasks.length > 0 ? (
          <s-stack direction="block" gap="base">
            <s-text color="subdued">
              {t("progress.runningSlots", {
                count: runningTasks.length,
                max: maxConcurrentTasks,
              })}
            </s-text>
            {runningTasks.map((task) => (
              <TaskProgressCard
                key={`${task.id}-${task.status}-${task.processedItems}-${task.totalItems}-${task.updatedAt}`}
                task={task}
                onViewDetails={() => handleViewDetails(task)}
                onStop={() => handleStopTask(task)}
                canViewDetails={canViewTaskConfiguration(parseActionDetails(task))}
                isStopping={stoppingTaskId === task.id}
              />
            ))}
          </s-stack>
        ) : (
          <HomeEmptyState />
        )}
      </s-section>

      {lastCompletedTask ? (
        <s-section heading={t("home.lastCompletedTask")}>
          <TaskProgressCard
            task={lastCompletedTask}
            onViewDetails={() => handleViewDetails(lastCompletedTask)}
            canViewDetails={canViewTaskConfiguration(parseActionDetails(lastCompletedTask))}
          />
        </s-section>
      ) : null}

      <HomeSidebar
        taskFinishedEmailEnabled={emailEnabled}
        onTaskFinishedEmailChange={handleTaskFinishedEmailChange}
        isSaving={settingsFetcher.state !== "idle"}
      />

      <s-modal
        id="running-task-details-modal"
        ref={detailsModalRef}
        heading={t("history.taskDetails")}
        size="large"
        onHide={() => setDetailsTask(null)}
      >
        {detailsTask && detailsConfig && (
          <s-stack direction="block" gap="base">
            <s-stack direction="block" gap="small-100">
              <s-text type="strong">{detailsTask.name}</s-text>
              <s-text color="subdued">
                {detailsActionData.taskType === "rollback" ? t("history.rollback") : t("history.priceEdit")}{" "}
                · {t(`status.${detailsTask.status}`) || detailsTask.status.replace("_", " ")}{" "}
                · {formatDateTime(detailsTask.createdAt)}
              </s-text>
            </s-stack>

            <Suspense fallback={<s-paragraph>{t("common.loading")}</s-paragraph>}>
              <TaskConfigurationForm
                readOnly
                collections={lookupsFetcher.data?.collections || []}
                locations={lookupsFetcher.data?.locations || []}
                values={detailsConfig}
                timezoneStr={timezone}
                currentTimeStr={formatCurrentTimeInTimezone(timezone)}
              />
            </Suspense>
          </s-stack>
        )}

        {detailsTask && !detailsConfig && (
          <s-paragraph>{t("history.configUnavailable")}</s-paragraph>
        )}

        <s-button slot="secondary-actions" commandFor="running-task-details-modal" command="--hide">
          {t("common.close")}
        </s-button>
      </s-modal>

      <ConfirmModal
        id="stop-task-modal"
        heading={t("progress.stop")}
        message={taskPendingStop ? t("progress.confirmStop", { name: taskPendingStop.name }) : ""}
        confirmLabel={t("progress.stop")}
        confirmTone="critical"
        modalRef={stopModalRef}
        onConfirm={confirmStopTask}
        onHide={() => setTaskPendingStop(null)}
      />
    </AppPage>
  );
}

export function shouldRevalidate({ actionResult }) {
  if (actionResult?.skipRevalidate) {
    return false;
  }
  return true;
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
