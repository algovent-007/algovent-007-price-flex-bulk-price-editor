import { translateError } from "../i18n/errors";
import { useI18n } from "../i18n/I18nProvider";

function getStatusTone(status, failureCount = 0) {
  if (status === "completed" && failureCount > 0) return "warning";
  if (status === "completed") return "success";
  if (status === "failed") return "critical";
  if (status === "scheduled") return "info";
  if (status === "paused") return "warning";
  if (status === "cancelled") return "warning";
  return "info";
}

function parseActionDetails(task) {
  try {
    return JSON.parse(task?.actionDetails || "{}");
  } catch {
    return {};
  }
}

export function isTaskTerminal(status) {
  return ["completed", "failed", "cancelled", "rolled_back"].includes(status);
}

export default function TaskProgressCard({
  task,
  onViewDetails,
  onStop,
  canViewDetails = false,
  isStopping = false,
}) {
  const { t } = useI18n();
  if (!task) return null;

  const actionData = parseActionDetails(task);
  const isCsvTask =
    actionData.editType === "csv-all" || actionData.editType === "csv-direct";
  const processedCount = isCsvTask
    ? Number(task.processedItems ?? 0)
    : Number(actionData.processedProductsCount ?? task.processedItems ?? 0);
  const totalCount = Number(task.totalItems || 0);
  const updatedProducts = Number(actionData.updatedProductsCount ?? 0);
  const successCount = Number(actionData.successCount ?? actionData.updatedVariantsCount ?? task.processedItems ?? 0);
  const failureCount = Number(actionData.failureCount ?? (task.status === "failed" ? 1 : 0));
  const skippedCount = Number(actionData.skippedCount ?? 0);
  const hasVariantSummary = actionData.evaluatedVariantsCount != null;
  const warnings = Array.isArray(actionData.warnings) ? actionData.warnings : [];
  const progressValue =
    totalCount > 0
      ? Math.min(100, Math.round((processedCount / totalCount) * 100))
      : isTaskTerminal(task.status)
        ? 100
        : 0;

  const isRunning = task.status === "running";
  const isIndeterminate = isRunning && totalCount <= 0;
  const unitLabel = t(isCsvTask ? "progress.unit.variants" : "progress.unit.products", {
    count: totalCount || processedCount || 0,
  });
  const statusKey = `status.${String(task.status || "").replaceAll(" ", "_")}`;
  const statusLabel = t(statusKey) || String(task.status || "").replace("_", " ");

  return (
    <s-box padding="base" borderWidth="base" borderRadius="base" background="base">
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
          <s-stack direction="block" gap="small-100">
            <s-heading>{t("progress.title")}</s-heading>
            <s-text color="subdued">{task.name}</s-text>
          </s-stack>
          <s-stack direction="inline" gap="small" alignItems="center">
            {onViewDetails && canViewDetails ? (
              <s-button variant="secondary" onClick={onViewDetails}>
                {t("progress.details")}
              </s-button>
            ) : null}
            {isRunning && onStop ? (
              <s-button
                tone="critical"
                variant="secondary"
                onClick={onStop}
                loading={isStopping}
                disabled={isStopping}
              >
                {t("progress.stop")}
              </s-button>
            ) : null}
            <s-badge tone={getStatusTone(task.status, failureCount)}>{statusLabel}</s-badge>
          </s-stack>
        </s-stack>

        <s-stack direction="block" gap="small">
          <s-stack direction="inline" gap="small" alignItems="center">
            {isIndeterminate ? (
              <s-spinner accessibilityLabel={t("progress.ariaLabel", { name: task.name })} />
            ) : null}
            <span style={{ color: "var(--p-color-text-secondary, #616161)" }}>
              {isRunning
                ? totalCount > 0
                  ? t("progress.runningWithCounts", {
                      processed: processedCount,
                      total: totalCount,
                      unit: unitLabel,
                      percent: progressValue,
                    })
                  : t("progress.running")
                : t("progress.percentComplete", { percent: progressValue })}
            </span>
          </s-stack>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={isIndeterminate ? undefined : progressValue}
            aria-label={t("progress.ariaLabel", { name: task.name })}
            style={{
              background: "var(--p-color-bg-fill-tertiary, #e3e3e3)",
              borderRadius: 999,
              height: 10,
              overflow: "hidden",
              width: "100%",
            }}
          >
            <div
              style={{
                background: "var(--p-color-bg-fill-success, #008060)",
                borderRadius: 999,
                height: "100%",
                transition: "width 200ms ease",
                width: `${isIndeterminate ? 0 : progressValue}%`,
              }}
            />
          </div>
        </s-stack>

        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(140px, 1fr))" gap="base">
          <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
            <s-stack direction="block" gap="small-100">
              <s-text color="subdued">
                {t(isCsvTask ? "progress.variantsProcessed" : "progress.productsProcessed")}
              </s-text>
              <strong>{processedCount} / {totalCount}</strong>
            </s-stack>
          </s-box>
          <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
            <s-stack direction="block" gap="small-100">
              <s-text color="subdued">{t("progress.productsUpdated")}</s-text>
              <strong>{updatedProducts}</strong>
            </s-stack>
          </s-box>
          <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
            <s-stack direction="block" gap="small-100">
              <s-text color="subdued">{t("progress.successfulVariants")}</s-text>
              <strong style={{ color: "var(--p-color-text-success, #008060)" }}>{successCount}</strong>
            </s-stack>
          </s-box>
          {hasVariantSummary ? (
            <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
              <s-stack direction="block" gap="small-100">
                <s-text color="subdued">{t("progress.skippedVariants")}</s-text>
                <strong>{skippedCount}</strong>
              </s-stack>
            </s-box>
          ) : null}
        </s-grid>

        {actionData.error && (
          <s-banner tone="critical">{translateError(t, actionData.error)}</s-banner>
        )}

        {task.status === "completed" && failureCount > 0 && !actionData.error && (
          <s-banner tone="warning">
            {t("progress.partialFailures", { count: failureCount })}
          </s-banner>
        )}

        {warnings.length > 0 && (
          <s-banner tone="warning">
            {warnings.slice(0, 3).join(" ")}
            {warnings.length > 3 ? ` ${t("progress.moreWarnings", { count: warnings.length - 3 })}` : ""}
          </s-banner>
        )}

        {isTaskTerminal(task.status) && (
          <s-stack direction="inline" gap="small">
            <s-button href="/app/history" variant="primary">{t("progress.viewHistory")}</s-button>
            <s-button href="/app/new" variant="secondary">{t("progress.createAnotherTask")}</s-button>
          </s-stack>
        )}
      </s-stack>
    </s-box>
  );
}
