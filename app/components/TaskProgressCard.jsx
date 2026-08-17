import styles from "./TaskProgressCard.module.css";
import { translateError } from "../i18n/errors";
import { useI18n } from "../i18n/I18nProvider";

function getStatusTone(status, failureCount = 0) {
  if (status === "completed" && failureCount > 0) return "warning";
  if (status === "completed") return "success";
  if (status === "failed") return "critical";
  if (status === "scheduled") return "info";
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

function getProgressFillClass(status) {
  if (status === "failed") return styles.fillCritical;
  if (status === "cancelled") return styles.fillCaution;
  return "";
}

export default function TaskProgressCard({ task }) {
  const { t } = useI18n();
  if (!task) return null;

  const actionData = parseActionDetails(task);
  const isCsvTask =
    actionData.editType === "csv-all" || actionData.editType === "csv-direct";
  const processedCount = isCsvTask
    ? Number(task.processedItems ?? 0)
    : Number(actionData.processedProductsCount ?? 0);
  const totalCount = Number(task.totalItems || 0);
  const updatedProducts = Number(actionData.updatedProductsCount ?? 0);
  const successCount = Number(actionData.successCount ?? actionData.updatedVariantsCount ?? task.processedItems ?? 0);
  const failureCount = Number(actionData.failureCount ?? (task.status === "failed" ? 1 : 0));
  const evaluatedCount = Number(actionData.evaluatedVariantsCount ?? 0);
  const noChangeCount = Number(actionData.noChangeCount ?? 0);
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
          <s-badge tone={getStatusTone(task.status, failureCount)}>{statusLabel}</s-badge>
        </s-stack>

        <div className={styles.progressBlock}>
          <s-text color="subdued">
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
          </s-text>
          <div
            className={`${styles.track} ${isIndeterminate ? styles.indeterminate : ""}`}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={isIndeterminate ? undefined : progressValue}
            aria-label={t("progress.ariaLabel", { name: task.name })}
          >
            <div
              className={`${styles.fill} ${getProgressFillClass(task.status)}`}
              style={isIndeterminate ? undefined : { width: `${progressValue}%` }}
            />
          </div>
        </div>

        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(140px, 1fr))" gap="base">
          <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
            <s-stack direction="block" gap="small-100">
              <s-text color="subdued">
                {t(isCsvTask ? "progress.variantsProcessed" : "progress.productsProcessed")}
              </s-text>
              <s-text type="strong">
                {processedCount} / {totalCount}
              </s-text>
            </s-stack>
          </s-box>
          <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
            <s-stack direction="block" gap="small-100">
              <s-text color="subdued">{t("progress.productsUpdated")}</s-text>
              <s-text type="strong">{updatedProducts}</s-text>
            </s-stack>
          </s-box>
          <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
            <s-stack direction="block" gap="small-100">
              <s-text color="subdued">{t("progress.successfulVariants")}</s-text>
              <s-text type="strong" tone="success">{successCount}</s-text>
            </s-stack>
          </s-box>
          <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
            <s-stack direction="block" gap="small-100">
              <s-text color="subdued">{t("progress.failures")}</s-text>
              <s-text type="strong" tone={failureCount > 0 ? "critical" : undefined}>
                {failureCount}
              </s-text>
            </s-stack>
          </s-box>
          {hasVariantSummary ? (
            <>
              <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
                <s-stack direction="block" gap="small-100">
                  <s-text color="subdued">{t("progress.variantsEvaluated")}</s-text>
                  <s-text type="strong">{evaluatedCount}</s-text>
                </s-stack>
              </s-box>
              <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
                <s-stack direction="block" gap="small-100">
                  <s-text color="subdued">{t("progress.noChangeVariants")}</s-text>
                  <s-text type="strong">{noChangeCount}</s-text>
                </s-stack>
              </s-box>
              <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
                <s-stack direction="block" gap="small-100">
                  <s-text color="subdued">{t("progress.skippedVariants")}</s-text>
                  <s-text type="strong">{skippedCount}</s-text>
                </s-stack>
              </s-box>
            </>
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
