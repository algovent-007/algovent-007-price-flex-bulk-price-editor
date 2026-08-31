/* eslint-disable react/prop-types -- this codebase does not use PropTypes */
import { useCallback, useEffect, useId, useState } from "react";
import ProductLogLink from "./ProductLogLink";
import {
  getLogTagChanges,
  getPriceChangeDisplay,
} from "../utils/task-log-display";
import { useI18n } from "../i18n/I18nProvider";

const LOGS_PAGE_SIZE = 25;

function formatVariantId(variantId) {
  return String(variantId || "-").split("/").pop();
}

function PriceValue({ display, changeTone, noChangeLabel }) {
  if (display.type === "blank") {
    return <s-text color="subdued">-</s-text>;
  }

  if (display.type === "unchanged") {
    return (
      <s-stack direction="inline" gap="small-100" alignItems="center">
        <s-text type="strong">{display.value}</s-text>
        <s-text color="subdued">{noChangeLabel}</s-text>
      </s-stack>
    );
  }

  return (
    <s-stack direction="inline" gap="small-100" alignItems="center">
      <s-text color="subdued">{display.oldValue}</s-text>
      <s-text color="subdued">→</s-text>
      <s-text type="strong" tone={changeTone}>{display.newValue}</s-text>
    </s-stack>
  );
}

function TagChanges({ log, taskTagChanges, t }) {
  const changes = getLogTagChanges(log, taskTagChanges);
  const lines = [];
  if (changes.added.length > 0) {
    lines.push(t("history.tagAdded", { tags: changes.added.join(", ") }));
  }
  if (changes.removed.length > 0) {
    lines.push(t("history.tagRemoved", { tags: changes.removed.join(", ") }));
  }

  if (lines.length === 0) {
    return <s-text color="subdued">-</s-text>;
  }

  return (
    <s-stack direction="block" gap="small-100">
      {lines.map((line) => (
        <s-text key={line}>{line}</s-text>
      ))}
    </s-stack>
  );
}

export default function TaskLogsTable({
  logs,
  isRollbackTask,
  searchQuery,
  shopDomain,
  onProductNavigate,
  taskTagChanges = {},
}) {
  const { t } = useI18n();
  const [page, setPage] = useState(0);
  const rawId = useId();
  const tableId = `task-logs-table-${rawId.replace(/:/g, "")}`;
  const changeTone = isRollbackTask ? undefined : "success";
  const noChangeLabel = t("history.noChange");

  useEffect(() => {
    setPage(0);
  }, [logs, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(logs.length / LOGS_PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageStart = safePage * LOGS_PAGE_SIZE;
  const pageLogs = logs.slice(pageStart, pageStart + LOGS_PAGE_SIZE);
  const showPagination = logs.length > LOGS_PAGE_SIZE;

  const handlePreviousPage = useCallback(() => {
    setPage((currentPage) => Math.max(0, currentPage - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setPage((currentPage) => Math.min(totalPages - 1, currentPage + 1));
  }, [totalPages]);

  useEffect(() => {
    if (!showPagination) return undefined;

    const table = document.getElementById(tableId);
    if (!table) return undefined;

    table.addEventListener("previouspage", handlePreviousPage);
    table.addEventListener("nextpage", handleNextPage);

    return () => {
      table.removeEventListener("previouspage", handlePreviousPage);
      table.removeEventListener("nextpage", handleNextPage);
    };
  }, [handleNextPage, handlePreviousPage, showPagination, tableId]);

  if (logs.length === 0) {
    return (
      <s-box padding="large">
        <s-paragraph color="subdued">
          {searchQuery
            ? t("history.noMatchingProducts", { query: searchQuery })
            : isRollbackTask
              ? t("history.noRollbackLogs")
              : t("history.noPriceLogs")}
        </s-paragraph>
      </s-box>
    );
  }

  return (
    <s-stack direction="block" gap="base">
      <s-table
        id={tableId}
        variant="auto"
        paginate={showPagination}
        hasPreviousPage={safePage > 0}
        hasNextPage={safePage < totalPages - 1}
        onPreviousPage={handlePreviousPage}
        onNextPage={handleNextPage}
      >
        <s-table-header-row>
          <s-table-header listSlot="primary">{t("history.product")}</s-table-header>
          <s-table-header>{t("history.variantId")}</s-table-header>
          <s-table-header>{t("history.price")}</s-table-header>
          <s-table-header>{t("history.compareAtPrice")}</s-table-header>
          <s-table-header>{t("history.unitCost")}</s-table-header>
          <s-table-header>{t("history.tag")}</s-table-header>
        </s-table-header-row>
        <s-table-body>
          {pageLogs.map((log, idx) => (
            <s-table-row key={`${pageStart + idx}-${log.variantId || log.variantTitle || log.productTitle}`}>
              <s-table-cell>
                <s-stack direction="block" gap="small-100">
                  <ProductLogLink
                    productId={log.productId}
                    shopDomain={shopDomain}
                    onNavigate={onProductNavigate}
                  >
                    {log.productTitle}
                  </ProductLogLink>
                  {log.error ? (
                    <s-text tone="critical">{log.error}</s-text>
                  ) : null}
                  {!log.error && Array.isArray(log.warnings) && log.warnings.length > 0 ? (
                    <s-text tone="caution">{log.warnings.join(" ")}</s-text>
                  ) : null}
                </s-stack>
              </s-table-cell>
              <s-table-cell>
                <s-text color="subdued">{formatVariantId(log.variantId)}</s-text>
              </s-table-cell>
              <s-table-cell>
                <PriceValue
                  display={getPriceChangeDisplay(log.oldPrice, log.newPrice)}
                  changeTone={changeTone}
                  noChangeLabel={noChangeLabel}
                />
              </s-table-cell>
              <s-table-cell>
                <PriceValue
                  display={getPriceChangeDisplay(log.oldCompare, log.newCompare)}
                  changeTone={changeTone}
                  noChangeLabel={noChangeLabel}
                />
              </s-table-cell>
              <s-table-cell>
                <PriceValue
                  display={getPriceChangeDisplay(log.oldCost, log.newCost)}
                  changeTone={changeTone}
                  noChangeLabel={noChangeLabel}
                />
              </s-table-cell>
              <s-table-cell>
                <TagChanges log={log} taskTagChanges={taskTagChanges} t={t} />
              </s-table-cell>
            </s-table-row>
          ))}
        </s-table-body>
      </s-table>

      {showPagination && (
        <s-text color="subdued">
          {t("common.pageOf", { current: safePage + 1, total: totalPages })}
        </s-text>
      )}
    </s-stack>
  );
}
