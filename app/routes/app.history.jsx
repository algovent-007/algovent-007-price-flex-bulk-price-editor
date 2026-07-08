import { useEffect, useMemo, useRef, useState } from "react";
import { useFetcher, useLoaderData, useNavigate, useRevalidator } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { executeRollbackForTask } from "../services/rollback.server";
import TaskLogsTable from "../components/TaskLogsTable";
import TaskConfigurationForm from "../components/new-task/TaskConfigurationForm";
import { canCopyTask, storeTaskCopy } from "../utils/copy-task";
import { buildTaskConfigState, canViewTaskConfiguration } from "../utils/task-config";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const tasks = await prisma.task.findMany({
    orderBy: { createdAt: "desc" },
  });

  let collections = [];
  try {
    const response = await admin.graphql(
      `#graphql
      query getCollections {
        collections(first: 250, sortKey: TITLE) {
          nodes {
            id
            title
          }
        }
      }`
    );
    const json = await response.json();
    collections = json.data?.collections?.nodes || [];
  } catch (err) {
    console.error("Error fetching collections for task history:", err);
  }

  return Response.json({ tasks, collections });
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent !== "rollback") {
    return Response.json({ success: false, error: "Unknown intent" });
  }

  const taskId = formData.get("taskId");
  if (!taskId) {
    return Response.json({ success: false, error: "Task ID is required" });
  }

  const task = await prisma.task.findUnique({ where: { id: taskId } });
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
    const result = await executeRollbackForTask({ admin, task, createRollbackRecord: true });
    return Response.json(result);
  } catch (err) {
    console.error("Error rolling back task:", err);
    return Response.json({ success: false, error: err.message });
  }
};

export default function TasksHistory() {
  const { tasks, collections } = useLoaderData();
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const logsModalRef = useRef(null);
  const detailsModalRef = useRef(null);
  const [logsModalTask, setLogsModalTask] = useState(null);
  const [detailsModalTask, setDetailsModalTask] = useState(null);
  const [logsSearchQuery, setLogsSearchQuery] = useState("");
  const [rollbackError, setRollbackError] = useState("");
  const [rollbackSuccess, setRollbackSuccess] = useState("");

  const rollingBackTaskId =
    fetcher.state !== "idle" && fetcher.formData?.get("taskId")
      ? fetcher.formData.get("taskId")
      : null;

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;

    if (fetcher.data.success) {
      setRollbackSuccess("Rollback task created and changes reverted successfully.");
      setRollbackError("");
      revalidator.revalidate();
    } else if (fetcher.data.error) {
      setRollbackError(fetcher.data.error);
      setRollbackSuccess("");
    }
  }, [fetcher.state, fetcher.data, revalidator]);

  const openLogsModal = (task) => {
    setLogsSearchQuery("");
    setLogsModalTask(task);
    logsModalRef.current?.showOverlay?.();
  };

  const closeLogsModal = () => {
    logsModalRef.current?.hideOverlay?.();
    setLogsModalTask(null);
    setLogsSearchQuery("");
  };

  const openDetailsModal = (task) => {
    setDetailsModalTask(task);
    detailsModalRef.current?.showOverlay?.();
  };

  const handleCopy = (task, actionData) => {
    if (!canCopyTask(actionData)) return;
    storeTaskCopy({ task, actionData });
    navigate("/app/new");
  };

  const handleRollback = (task) => {
    const confirmed = window.confirm(
      `Roll back "${task.name}"? This will restore original prices, compare-at prices, unit costs, and tags for all affected products.`
    );
    if (!confirmed) return;

    setRollbackError("");
    setRollbackSuccess("");
    fetcher.submit({ intent: "rollback", taskId: task.id }, { method: "POST" });
  };

  const formatDate = (dateStr) => {
    try {
      return new Date(dateStr).toLocaleString();
    } catch (e) {
      return dateStr;
    }
  };

  const getStatusTone = (status) => {
    if (status === "completed") return "success";
    if (status === "failed") return "critical";
    if (status === "rolled_back") return "warning";
    if (status === "scheduled") return "info";
    if (status === "cancelled") return "warning";
    return "info";
  };

  const getTaskMeta = (task) => {
    try {
      return JSON.parse(task.actionDetails || "{}");
    } catch (e) {
      return {};
    }
  };

  const getTaskType = (actionData) =>
    actionData.taskType === "rollback" ? "Rollback" : "Price Edit";

  const getTaskTypeTone = (actionData) =>
    actionData.taskType === "rollback" ? "warning" : "info";

  const canRollback = (task, actionData, logs) =>
    actionData.taskType !== "rollback" &&
    task.status === "completed" &&
    !actionData.rolledBackByTaskId &&
    logs.length > 0 &&
    !!logs[0]?.variantId;

  const logsModalActionData = logsModalTask ? getTaskMeta(logsModalTask) : {};
  const detailsModalConfig = useMemo(() => {
    if (!detailsModalTask) return null;
    const actionData = getTaskMeta(detailsModalTask);
    return buildTaskConfigState(detailsModalTask, actionData);
  }, [detailsModalTask]);
  const detailsModalActionData = detailsModalTask ? getTaskMeta(detailsModalTask) : {};
  const logsModalLogs = logsModalActionData.logs || [];
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
    <s-page heading="Tasks History">
      <s-section heading="Past bulk price edits">
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

        {tasks.length === 0 ? (
          <s-paragraph>No price edit tasks found in the history.</s-paragraph>
        ) : (
          <s-table variant="auto">
            <s-table-header-row>
              <s-table-header listSlot="primary">Task Name</s-table-header>
              <s-table-header>Type</s-table-header>
              <s-table-header>Date Created</s-table-header>
              <s-table-header>Status</s-table-header>
              <s-table-header>Items Updated</s-table-header>
              <s-table-header>Actions</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {tasks.map((task) => {
                const actionData = getTaskMeta(task);
                const logs = actionData.logs || [];
                const isRollbackTask = actionData.taskType === "rollback";
                const isRollingBack = rollingBackTaskId === task.id;

                return (
                  <s-table-row key={task.id}>
                    <s-table-cell>
                      <s-stack direction="block" gap="small-100">
                        <s-text type="strong">{task.name}</s-text>
                        {isRollbackTask && actionData.sourceTaskName && (
                          <s-text color="subdued">
                            Reverts: {actionData.sourceTaskName}
                          </s-text>
                        )}
                        {!isRollbackTask && actionData.rolledBackByTaskId && (
                          <s-text tone="warning">Rolled back</s-text>
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
                      <s-badge tone={getStatusTone(task.status)}>
                        {task.status.replace("_", " ")}
                      </s-badge>
                    </s-table-cell>
                    <s-table-cell>
                      <s-button variant="tertiary" onClick={() => openLogsModal(task)}>
                        {isRollbackTask
                          ? `View rollback logs (${logs.length})`
                          : `View logs (${logs.length})`}
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
                            View
                          </s-button>
                          <s-button
                            variant="secondary"
                            onClick={() => handleCopy(task, actionData)}
                            disabled={!canCopyTask(actionData)}
                          >
                            Copy
                          </s-button>
                          <s-button
                            tone="critical"
                            variant="secondary"
                            onClick={() => handleRollback(task)}
                            disabled={!canRollback(task, actionData, logs) || isRollingBack}
                            loading={isRollingBack}
                          >
                            Rollback
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
      </s-section>

      <s-modal
        id="task-logs-modal"
        ref={logsModalRef}
        heading={isLogsModalRollback ? "Rollback logs" : "Task logs"}
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
                  ? `${filteredLogsModalLogs.length} of ${logsModalLogs.length} variant(s)`
                  : `${logsModalLogs.length} variant(s)`}
              </s-text>
              {isLogsModalRollback && logsModalActionData.sourceTaskName && (
                <s-text color="subdued">Reverts: {logsModalActionData.sourceTaskName}</s-text>
              )}
              {isLogsModalRollback && (
                <s-text color="subdued">
                  Prices restored to their original values before the price edit task ran.
                </s-text>
              )}
            </s-stack>

            <s-search-field
              label="Search logs"
              labelAccessibilityVisibility="exclusive"
              placeholder="Search products or variants..."
              value={logsSearchQuery}
              onInput={(e) => setLogsSearchQuery(e.target.value)}
            />

            <TaskLogsTable
              logs={filteredLogsModalLogs}
              isRollbackTask={isLogsModalRollback}
              searchQuery={trimmedLogsSearch}
            />
          </s-stack>
        )}

        <s-button slot="secondary-actions" commandFor="task-logs-modal" command="--hide">
          Close
        </s-button>
      </s-modal>

      <s-modal
        id="task-details-modal"
        ref={detailsModalRef}
        heading="Task Details"
        size="large"
        onHide={() => setDetailsModalTask(null)}
      >
        {detailsModalTask && detailsModalConfig && (
          <s-stack direction="block" gap="base">
            <s-stack direction="block" gap="small-100">
              <s-text type="strong">{detailsModalTask.name}</s-text>
              <s-text color="subdued">
                {getTaskType(detailsModalActionData)} · {detailsModalTask.status.replace("_", " ")} ·{" "}
                {formatDate(detailsModalTask.createdAt)}
              </s-text>
            </s-stack>

            <TaskConfigurationForm
              readOnly
              collections={collections}
              values={detailsModalConfig}
              timezoneStr={Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"}
              currentTimeStr={new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            />
          </s-stack>
        )}

        {detailsModalTask && !detailsModalConfig && (
          <s-paragraph>
            Task configuration is not available for this task. It may have been created before
            configuration storage was added.
          </s-paragraph>
        )}

        <s-button slot="secondary-actions" commandFor="task-details-modal" command="--hide">
          Close
        </s-button>
      </s-modal>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
