import { lazy, Suspense, startTransition, useEffect, useMemo, useRef, useState } from "react";
import { useFetcher, useLoaderData, useNavigate, useRevalidator, useSearchParams } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { startRollbackForTask } from "../services/rollback.server";
import TaskLogsTable from "../components/TaskLogsTable";
import { canCopyTask, storeTaskCopy } from "../utils/copy-task";
import { canViewTaskConfiguration, buildTaskConfigState } from "../utils/task-config";
import { getTaskTagChanges } from "../utils/task-log-display";
import { getShopSettings } from "../models/shop-settings.server";
import { DEFAULT_TIMEZONE, normalizeShopTimezone } from "../utils/shop-timezone.server";
import { fetchCollectionsAndLocations } from "../utils/shop-lookups.server";
import { formatCurrentTimeInTimezone, parseIsoDate, wallClockToDate } from "../utils/schedule";
import { getFieldValue } from "../utils/numeric-input";
import { translateError } from "../i18n/errors";
import { useI18n } from "../i18n/I18nProvider";
import AppPage from "../components/AppPage";
import HistoryDateRangeFilter from "../components/HistoryDateRangeFilter";
import ConfirmModal from "../components/ConfirmModal";
import { writeActiveTaskId } from "../utils/active-task-storage";

const TaskConfigurationForm = lazy(() => import("../components/new-task/TaskConfigurationForm"));

const HISTORY_PAGE_SIZE = 10;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const HISTORY_TASK_SELECT = {
  id: true,
  name: true,
  status: true,
  createdAt: true,
  processedItems: true,
  totalItems: true,
  actionDetails: true,
};

function parseHistoryPage(value) {
  const page = Number.parseInt(String(value || "1"), 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function parseIsoDateParam(value) {
  const trimmed = String(value || "").trim();
  return ISO_DATE_PATTERN.test(trimmed) ? trimmed : "";
}

function startOfNextIsoDay(iso, timeZone) {
  const match = ISO_DATE_PATTERN.exec(iso);
  if (!match) return null;
  const next = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + 1));
  return wallClockToDate({
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
    hours: 0,
    minutes: 0,
    timeZone,
  });
}

function buildCreatedAtFilter(from, to, timeZone) {
  let fromDate = from;
  let toDate = to;
  if (fromDate && toDate && fromDate > toDate) {
    [fromDate, toDate] = [toDate, fromDate];
  }

  const createdAt = {};
  if (fromDate) {
    const start = parseIsoDate(fromDate, timeZone);
    if (start) createdAt.gte = start;
  }
  if (toDate) {
    const end = startOfNextIsoDay(toDate, timeZone);
    if (end) createdAt.lt = end;
  }
  return Object.keys(createdAt).length > 0 ? createdAt : null;
}

function toHistoryListTask(task) {
  let actionData = {};
  try {
    actionData = JSON.parse(task.actionDetails || "{}");
  } catch {
    return task;
  }

  const { logs, ...rest } = actionData;
  const logList = Array.isArray(logs) ? logs : [];
  if (rest.runPayload && Array.isArray(rest.runPayload.searchResults)) {
    rest.runPayload = { ...rest.runPayload, searchResults: undefined };
  }
  return {
    ...task,
    actionDetails: JSON.stringify({
      ...rest,
      logCount: logList.length,
      canRollback: Boolean(logList[0]?.variantId),
    }),
  };
}

function getTaskMeta(task) {
  try {
    return JSON.parse(task?.actionDetails || "{}");
  } catch {
    return {};
  }
}

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const requestedPage = parseHistoryPage(url.searchParams.get("page"));
  const query = String(url.searchParams.get("q") || "").trim();
  const from = parseIsoDateParam(url.searchParams.get("from"));
  const to = parseIsoDateParam(url.searchParams.get("to"));
  const where = { shop: session.shop };
  if (query) {
    where.name = { contains: query, mode: "insensitive" };
  }

  const settingsPromise = getShopSettings(session.shop);
  let timezone = DEFAULT_TIMEZONE;
  if (from || to) {
    const settings = await settingsPromise;
    timezone = normalizeShopTimezone(settings?.timezone) || DEFAULT_TIMEZONE;
    const createdAt = buildCreatedAtFilter(from, to, timezone);
    if (createdAt) {
      where.createdAt = createdAt;
    }
  }

  const skip = (requestedPage - 1) * HISTORY_PAGE_SIZE;
  const [settings, total, tasks] = await Promise.all([
    from || to ? Promise.resolve(null) : settingsPromise,
    prisma.task.count({ where }),
    prisma.task.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: HISTORY_PAGE_SIZE,
      select: HISTORY_TASK_SELECT,
    }),
  ]);
  if (settings) {
    timezone = normalizeShopTimezone(settings.timezone) || DEFAULT_TIMEZONE;
  }

  const totalPages = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const pageTasks =
    page === requestedPage || total === 0
      ? tasks
      : await prisma.task.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * HISTORY_PAGE_SIZE,
          take: HISTORY_PAGE_SIZE,
          select: HISTORY_TASK_SELECT,
        });

  const rolledBackSourceIds = [];
  if (pageTasks.length > 0) {
    const rollbackTasks = await prisma.task.findMany({
      where: {
        shop: session.shop,
        status: "completed",
        id: { in: pageTasks.map((task) => `rollback-${task.id}`) },
      },
      select: { id: true },
    });
    for (const row of rollbackTasks) {
      rolledBackSourceIds.push(row.id.replace(/^rollback-/, ""));
    }
  }

  return Response.json({
    tasks: pageTasks.map(toHistoryListTask),
    query,
    page,
    pageSize: HISTORY_PAGE_SIZE,
    total,
    totalPages,
    rolledBackSourceIds,
    shopDomain: session.shop,
    timezone,
    from,
    to,
  });
};

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "task_lookups") {
    try {
      const lookups = await fetchCollectionsAndLocations(admin);
      return Response.json({ success: true, skipRevalidate: true, ...lookups });
    } catch (error) {
      console.error("Error fetching task lookups:", error);
      return Response.json({ success: true, skipRevalidate: true, collections: [], locations: [] });
    }
  }

  if (intent === "load_task") {
    const taskId = formData.get("taskId");
    if (!taskId) {
      return Response.json({ success: false, error: "Task ID is required" });
    }
    const task = await prisma.task.findFirst({
      where: { id: taskId, shop: session.shop },
    });
    if (!task) {
      return Response.json({ success: false, error: "Task not found" });
    }
    return Response.json({ success: true, skipRevalidate: true, task });
  }

  if (intent !== "rollback") {
    return Response.json({ success: false, error: "Unknown intent" });
  }

  const taskId = formData.get("taskId");
  if (!taskId) {
    return Response.json({ success: false, error: "Task ID is required" });
  }

  const task = await prisma.task.findFirst({
    where: { id: taskId, shop: session.shop },
  });
  if (!task) {
    return Response.json({ success: false, error: "Task not found" });
  }

  if (task.status !== "completed") {
    return Response.json({ success: false, error: "Only completed tasks can be rolled back" });
  }

  let actionData = {};
  try {
    actionData = JSON.parse(task.actionDetails || "{}");
  } catch (e) {
    return Response.json({ success: false, error: "Invalid task data" });
  }

  if (actionData.rolledBackByTaskId) {
    return Response.json({ success: false, error: "This task has already been rolled back" });
  }

  try {
    const result = await startRollbackForTask({ admin, task });
    return Response.json(result);
  } catch (err) {
    console.error("Error rolling back task:", err);
    return Response.json({ success: false, error: err.message });
  }
};

export default function TasksHistory() {
  const {
    tasks,
    query,
    page,
    total,
    totalPages,
    rolledBackSourceIds,
    shopDomain,
    timezone,
    from,
    to,
  } = useLoaderData();
  const { t, formatDateTime } = useI18n();
  const fetcher = useFetcher();
  const lookupsFetcher = useFetcher();
  const taskFetcher = useFetcher();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const [searchParams, setSearchParams] = useSearchParams();
  const rolledBackSourceIdSet = useMemo(
    () => new Set(rolledBackSourceIds || []),
    [rolledBackSourceIds],
  );
  const logsModalRef = useRef(null);
  const detailsModalRef = useRef(null);
  const rollbackModalRef = useRef(null);
  const [logsModalTask, setLogsModalTask] = useState(null);
  const [detailsModalTask, setDetailsModalTask] = useState(null);
  const [rollbackTask, setRollbackTask] = useState(null);
  const [logsSearchQuery, setLogsSearchQuery] = useState("");
  const [nameQuery, setNameQuery] = useState(query || "");
  const [rollbackError, setRollbackError] = useState("");
  const [rollbackSuccess, setRollbackSuccess] = useState("");

  const rollingBackTaskId =
    fetcher.state !== "idle" && fetcher.formData?.get("intent") === "rollback"
      ? fetcher.formData.get("taskId")
      : null;

  useEffect(() => {
    setNameQuery(query || "");
  }, [query]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const nextQuery = nameQuery.trim();
      const currentQuery = searchParams.get("q") || "";
      if (nextQuery === currentQuery) return;

      const next = new URLSearchParams(searchParams);
      if (nextQuery) {
        next.set("q", nextQuery);
      } else {
        next.delete("q");
      }
      next.delete("page");
      setSearchParams(next, { replace: true });
    }, 300);

    return () => clearTimeout(timeout);
  }, [nameQuery, searchParams, setSearchParams]);

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;

    if (fetcher.data.success) {
      if (
        fetcher.data.rollbackTaskId &&
        (fetcher.data.taskStarted || fetcher.data.alreadyRunning)
      ) {
        writeActiveTaskId(fetcher.data.rollbackTaskId);
        navigate(`/app/current?taskId=${encodeURIComponent(fetcher.data.rollbackTaskId)}`);
        return;
      }

      setRollbackSuccess(
        fetcher.data.alreadyRolledBack
          ? t("history.rollbackAlreadyExists")
          : t("history.rollbackSuccess")
      );
      setRollbackError("");
      revalidator.revalidate();
    } else if (fetcher.data.error) {
      setRollbackError(translateError(t, fetcher.data.error));
      setRollbackSuccess("");
    }
  }, [fetcher.state, fetcher.data, navigate, revalidator, t]);

  useEffect(() => {
    if (taskFetcher.state !== "idle" || !taskFetcher.data?.task) return;
    const loadedTask = taskFetcher.data.task;
    setLogsModalTask((current) => (current?.id === loadedTask.id ? loadedTask : current));
    setDetailsModalTask((current) => (current?.id === loadedTask.id ? loadedTask : current));
  }, [taskFetcher.state, taskFetcher.data]);

  const openLogsModal = (task) => {
    setLogsSearchQuery("");
    setLogsModalTask(task);
    logsModalRef.current?.showOverlay?.();
    if (!Array.isArray(getTaskMeta(task).logs)) {
      taskFetcher.submit({ intent: "load_task", taskId: task.id }, { method: "POST" });
    }
  };

  const closeLogsModal = () => {
    logsModalRef.current?.hideOverlay?.();
    setLogsModalTask(null);
    setLogsSearchQuery("");
  };

  const openDetailsModal = (task) => {
    setDetailsModalTask(task);
    detailsModalRef.current?.showOverlay?.();
    if (lookupsFetcher.state === "idle" && !lookupsFetcher.data) {
      lookupsFetcher.submit({ intent: "task_lookups" }, { method: "POST" });
    }
  };

  const handleCopy = (task, actionData) => {
    if (!canCopyTask(actionData)) return;
    storeTaskCopy({ task, actionData });
    navigate("/app/new");
  };

  const goToPage = (nextPage) => {
    const next = new URLSearchParams(searchParams);
    if (nextPage <= 1) {
      next.delete("page");
    } else {
      next.set("page", String(nextPage));
    }
    setSearchParams(next);
  };

  const applyDateRange = ({ from: nextFrom, to: nextTo }) => {
    const next = new URLSearchParams(searchParams);
    if (nextFrom) next.set("from", nextFrom);
    else next.delete("from");
    if (nextTo) next.set("to", nextTo);
    else next.delete("to");
    next.delete("page");
    startTransition(() => {
      setSearchParams(next, { replace: true });
    });
  };

  const clearAppliedDateRange = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("from");
    next.delete("to");
    next.delete("page");
    startTransition(() => {
      setSearchParams(next, { replace: true });
    });
  };

  const handleRollback = (task) => {
    setRollbackTask(task);
    rollbackModalRef.current?.showOverlay?.();
  };

  const confirmRollback = () => {
    if (!rollbackTask) return;
    setRollbackError("");
    setRollbackSuccess("");
    fetcher.submit({ intent: "rollback", taskId: rollbackTask.id }, { method: "POST" });
  };

  const formatDate = (dateStr) => formatDateTime(dateStr);

  const getStatusTone = (status) => {
    if (status === "completed") return "success";
    if (status === "failed") return "critical";
    if (status === "rolled_back") return "warning";
    if (status === "scheduled") return "info";
    if (status === "paused") return "warning";
    if (status === "cancelled") return "warning";
    return "info";
  };

  const getTaskType = (actionData) =>
    actionData.taskType === "rollback" ? t("history.rollback") : t("history.priceEdit");

  const getTaskTypeTone = (actionData) =>
    actionData.taskType === "rollback" ? "warning" : "info";

  const canRollback = (task, actionData, logs) =>
    actionData.taskType !== "rollback" &&
    task.status === "completed" &&
    !actionData.rolledBackByTaskId &&
    (actionData.canRollback || (logs.length > 0 && !!logs[0]?.variantId));

  const logsModalActionData = logsModalTask ? getTaskMeta(logsModalTask) : {};
  const detailsModalConfig = useMemo(() => {
    if (!detailsModalTask) return null;
    const actionData = getTaskMeta(detailsModalTask);
    return buildTaskConfigState(detailsModalTask, actionData, timezone);
  }, [detailsModalTask, timezone]);
  const detailsModalActionData = detailsModalTask ? getTaskMeta(detailsModalTask) : {};
  const logsModalLogs = logsModalActionData.logs || [];
  const logsModalReady = Array.isArray(logsModalActionData.logs);
  const logsModalLogCount = logsModalActionData.logCount ?? logsModalLogs.length;
  const isLogsModalRollback = logsModalActionData.taskType === "rollback";
  const trimmedLogsSearch = logsSearchQuery.trim().toLowerCase();
  const filteredLogsModalLogs = trimmedLogsSearch
    ? logsModalLogs.filter(
        (log) =>
          log.productTitle?.toLowerCase().includes(trimmedLogsSearch) ||
          log.variantTitle?.toLowerCase().includes(trimmedLogsSearch)
      )
    : logsModalLogs;

  return (
    <AppPage heading={t("history.heading")}>
      <s-section heading={t("history.pastEdits")}>
        {rollbackSuccess && (
          <s-box paddingBlockEnd="base">
            <s-banner tone="success" onDismiss={() => setRollbackSuccess("")}>
              {rollbackSuccess}
            </s-banner>
          </s-box>
        )}
        {rollbackError && (
          <s-box paddingBlockEnd="base">
            <s-banner tone="critical" onDismiss={() => setRollbackError("")}>
              {rollbackError}
            </s-banner>
          </s-box>
        )}

        <s-box paddingBlockEnd="base">
          <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
            <s-search-field
              label={t("history.searchTasks")}
              labelAccessibilityVisibility="exclusive"
              placeholder={t("history.searchTasksPlaceholder")}
              value={nameQuery}
              onInput={(event) => setNameQuery(getFieldValue(event))}
              onChange={(event) => setNameQuery(getFieldValue(event))}
            />
            <HistoryDateRangeFilter
              from={from}
              to={to}
              timezone={timezone}
              onApply={applyDateRange}
              onClearApplied={clearAppliedDateRange}
            />
          </s-grid>
        </s-box>

        {tasks.length === 0 ? (
          <s-paragraph>
            {query || from || to ? t("history.noMatchingFilters") : t("history.empty")}
          </s-paragraph>
        ) : (
          <s-table variant="auto">
            <s-table-header-row>
              <s-table-header listSlot="primary">{t("history.taskName")}</s-table-header>
              <s-table-header>{t("history.type")}</s-table-header>
              <s-table-header>{t("history.dateCreated")}</s-table-header>
              <s-table-header>{t("history.status")}</s-table-header>
              <s-table-header>{t("history.itemsUpdated")}</s-table-header>
              <s-table-header>{t("history.actions")}</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {tasks.map((task) => {
                const actionData = getTaskMeta(task);
                const logs = actionData.logs || [];
                const logCount = actionData.logCount ?? logs.length;
                const isRollbackTask = actionData.taskType === "rollback";
                const isRollingBack = rollingBackTaskId === task.id;
                const hasRollbackTask =
                  rolledBackSourceIdSet.has(task.id) || Boolean(actionData.rolledBackByTaskId);
                const displayedStatus =
                  !isRollbackTask && hasRollbackTask ? "rolled_back" : task.status;

                return (
                  <s-table-row key={task.id}>
                    <s-table-cell>
                      <s-stack direction="block" gap="small-100">
                        <s-text type="strong">{task.name}</s-text>
                        {isRollbackTask && actionData.sourceTaskName && (
                          <s-text color="subdued">
                            {t("history.reverts", { name: actionData.sourceTaskName })}
                          </s-text>
                        )}
                        {!isRollbackTask &&
                          (actionData.rolledBackByTaskId || hasRollbackTask) && (
                          <s-text tone="warning">{t("history.rolledBack")}</s-text>
                        )}
                      </s-stack>
                    </s-table-cell>
                    <s-table-cell>
                      <s-badge tone={getTaskTypeTone(actionData)}>{getTaskType(actionData)}</s-badge>
                    </s-table-cell>
                    <s-table-cell>
                      <s-text color="subdued">{formatDate(task.createdAt)}</s-text>
                    </s-table-cell>
                    <s-table-cell>
                      <s-badge tone={getStatusTone(displayedStatus)}>
                        {t(`status.${displayedStatus}`) || displayedStatus.replace("_", " ")}
                      </s-badge>
                    </s-table-cell>
                    <s-table-cell>
                      <s-button variant="tertiary" onClick={() => openLogsModal(task)}>
                        {isRollbackTask
                          ? t("history.viewRollbackLogs", { count: logCount })
                          : t("history.viewLogs", { count: logCount })}
                      </s-button>
                    </s-table-cell>
                    <s-table-cell>
                      <s-box minInlineSize="220px">
                        <s-stack
                          direction="inline"
                          gap="small-100"
                          alignItems="center"
                          style={{ flexWrap: "nowrap" }}
                        >
                          <s-button
                            variant="secondary"
                            onClick={() => openDetailsModal(task)}
                            disabled={!canViewTaskConfiguration(actionData)}
                          >
                            {t("common.view")}
                          </s-button>
                          <s-button
                            variant="secondary"
                            onClick={() => handleCopy(task, actionData)}
                            disabled={!canCopyTask(actionData)}
                          >
                            {t("common.copy")}
                          </s-button>
                          <s-button
                            tone="critical"
                            variant="secondary"
                            onClick={() => handleRollback(task)}
                            disabled={
                              !canRollback(task, actionData, logs) ||
                              hasRollbackTask ||
                              isRollingBack
                            }
                            loading={isRollingBack}
                          >
                            {t("history.rollback")}
                          </s-button>
                        </s-stack>
                      </s-box>
                    </s-table-cell>
                  </s-table-row>
                );
              })}
            </s-table-body>
          </s-table>
        )}

        {total > HISTORY_PAGE_SIZE && (
          <s-box paddingBlockStart="base">
            <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
              <s-text color="subdued">
                {t("common.pageOf", { current: page, total: totalPages })}
              </s-text>
              <s-stack direction="inline" gap="small-100">
                <s-button
                  variant="secondary"
                  disabled={page <= 1}
                  onClick={() => goToPage(page - 1)}
                >
                  {t("common.previous")}
                </s-button>
                <s-button
                  variant="secondary"
                  disabled={page >= totalPages}
                  onClick={() => goToPage(page + 1)}
                >
                  {t("common.next")}
                </s-button>
              </s-stack>
            </s-stack>
          </s-box>
        )}
      </s-section>

      <s-modal
        id="task-logs-modal"
        ref={logsModalRef}
        heading={isLogsModalRollback ? t("history.rollbackLogs") : t("history.taskLogs")}
        size="large"
        onHide={() => {
          setLogsModalTask(null);
          setLogsSearchQuery("");
        }}
      >
        {logsModalTask && (
          <s-stack direction="block" gap="base">
            <s-stack direction="block" gap="small-100">
              <s-text color="subdued">
                {logsModalTask.name} ·{" "}
                {trimmedLogsSearch
                  ? t("history.variantCountFiltered", {
                      filtered: filteredLogsModalLogs.length,
                      total: logsModalLogCount,
                    })
                  : t("history.variantCount", { count: logsModalLogCount })}
              </s-text>
              {isLogsModalRollback && logsModalActionData.sourceTaskName && (
                <s-text color="subdued">
                  {t("history.reverts", { name: logsModalActionData.sourceTaskName })}
                </s-text>
              )}
              {isLogsModalRollback && (
                <s-text color="subdued">{t("history.rollbackRestored")}</s-text>
              )}
            </s-stack>

            <s-search-field
              label={t("history.searchLogs")}
              labelAccessibilityVisibility="exclusive"
              placeholder={t("history.searchPlaceholder")}
              value={logsSearchQuery}
              onInput={(e) => setLogsSearchQuery(e.target.value)}
            />

            {logsModalReady ? (
              <TaskLogsTable
                logs={filteredLogsModalLogs}
                isRollbackTask={isLogsModalRollback}
                searchQuery={trimmedLogsSearch}
                shopDomain={shopDomain}
                onProductNavigate={closeLogsModal}
                taskTagChanges={getTaskTagChanges(logsModalActionData)}
              />
            ) : (
              <s-paragraph>{t("common.loading")}</s-paragraph>
            )}
          </s-stack>
        )}

        <s-button slot="secondary-actions" commandFor="task-logs-modal" command="--hide">
          {t("common.close")}
        </s-button>
      </s-modal>

      <s-modal
        id="task-details-modal"
        ref={detailsModalRef}
        heading={t("history.taskDetails")}
        size="large"
        onHide={() => setDetailsModalTask(null)}
      >
        {detailsModalTask && detailsModalConfig && (
          <s-stack direction="block" gap="base">
            <s-stack direction="block" gap="small-100">
              <s-text type="strong">{detailsModalTask.name}</s-text>
              <s-text color="subdued">
                {getTaskType(detailsModalActionData)} ·{" "}
                {t(`status.${detailsModalTask.status}`) || detailsModalTask.status.replace("_", " ")}{" "}
                · {formatDate(detailsModalTask.createdAt)}
              </s-text>
            </s-stack>

            <Suspense fallback={<s-paragraph>{t("common.loading")}</s-paragraph>}>
              <TaskConfigurationForm
                readOnly
                collections={lookupsFetcher.data?.collections || []}
                locations={lookupsFetcher.data?.locations || []}
                values={detailsModalConfig}
                timezoneStr={timezone}
                currentTimeStr={formatCurrentTimeInTimezone(timezone)}
              />
            </Suspense>
          </s-stack>
        )}

        {detailsModalTask && !detailsModalConfig && (
          <s-paragraph>{t("history.configUnavailable")}</s-paragraph>
        )}

        <s-button slot="secondary-actions" commandFor="task-details-modal" command="--hide">
          {t("common.close")}
        </s-button>
      </s-modal>

      <ConfirmModal
        id="rollback-confirm-modal"
        heading={t("history.rollback")}
        message={rollbackTask ? t("history.confirmRollback", { name: rollbackTask.name }) : ""}
        confirmLabel={t("history.rollback")}
        confirmTone="critical"
        modalRef={rollbackModalRef}
        onConfirm={confirmRollback}
        onHide={() => setRollbackTask(null)}
      />
    </AppPage>
  );
}

export function shouldRevalidate({ actionResult, defaultShouldRevalidate }) {
  if (actionResult?.skipRevalidate || actionResult?.task || Array.isArray(actionResult?.collections)) {
    return false;
  }
  return defaultShouldRevalidate;
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
