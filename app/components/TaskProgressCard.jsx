function getStatusTone(status) {
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

function getProgressFillColor(status) {
  if (status === "failed") return "var(--p-color-bg-fill-critical)";
  if (status === "cancelled") return "var(--p-color-bg-fill-caution)";
  return "var(--p-color-bg-fill-success)";
}

export default function TaskProgressCard({ task }) {
  if (!task) return null;

  const actionData = parseActionDetails(task);
  const processedProducts = Number(actionData.processedProductsCount ?? 0);
  const totalProducts = Number(task.totalItems || 0);
  const updatedProducts = Number(actionData.updatedProductsCount ?? 0);
  const successCount = Number(actionData.successCount ?? actionData.updatedVariantsCount ?? task.processedItems ?? 0);
  const failureCount = Number(actionData.failureCount ?? (task.status === "failed" ? 1 : 0));
  const progressValue =
    totalProducts > 0
      ? Math.min(100, Math.round((processedProducts / totalProducts) * 100))
      : isTaskTerminal(task.status)
        ? 100
        : 0;

  return (
    <s-box padding="base" borderWidth="base" borderRadius="base" background="base">
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
          <s-stack direction="block" gap="small-100">
            <s-heading>Progress Card</s-heading>
            <s-text color="subdued">{task.name}</s-text>
          </s-stack>
          <s-badge tone={getStatusTone(task.status)}>
            {task.status.replace("_", " ")}
          </s-badge>
        </s-stack>

        <s-stack direction="block" gap="small-100">
          <s-text color="subdued">
            {progressValue}% complete
          </s-text>
          <s-box
            background="subdued"
            borderRadius="base"
            overflow="hidden"
            role="progressbar"
            aria-valuenow={progressValue}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-label={`Task progress for ${task.name}`}
            style={{
              width: "100%",
              height: "8px",
            }}
          >
            <div
              style={{
                width: `${progressValue}%`,
                height: "100%",
                background: getProgressFillColor(task.status),
                transition: "width 200ms ease",
              }}
            />
          </s-box>
        </s-stack>

        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(140px, 1fr))" gap="base">
          <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
            <s-stack direction="block" gap="small-100">
              <s-text color="subdued">Products processed</s-text>
              <s-text type="strong">
                {processedProducts} / {totalProducts}
              </s-text>
            </s-stack>
          </s-box>
          <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
            <s-stack direction="block" gap="small-100">
              <s-text color="subdued">Products updated</s-text>
              <s-text type="strong">{updatedProducts}</s-text>
            </s-stack>
          </s-box>
          <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
            <s-stack direction="block" gap="small-100">
              <s-text color="subdued">Successful variants</s-text>
              <s-text type="strong" tone="success">{successCount}</s-text>
            </s-stack>
          </s-box>
          <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
            <s-stack direction="block" gap="small-100">
              <s-text color="subdued">Failures</s-text>
              <s-text type="strong" tone={failureCount > 0 ? "critical" : undefined}>
                {failureCount}
              </s-text>
            </s-stack>
          </s-box>
        </s-grid>

        {actionData.error && (
          <s-banner tone="critical">{actionData.error}</s-banner>
        )}

        {isTaskTerminal(task.status) && (
          <s-stack direction="inline" gap="small">
            <s-button href="/app/history" variant="primary">View History</s-button>
            <s-button href="/app/new" variant="secondary">Create another task</s-button>
          </s-stack>
        )}
      </s-stack>
    </s-box>
  );
}
