import { useCallback, useEffect, useId, useState } from "react";

const LOGS_PAGE_SIZE = 10;

export default function TaskLogsTable({ logs, isRollbackTask, searchQuery }) {
  const [page, setPage] = useState(0);
  const tableId = useId().replace(/:/g, "");

  useEffect(() => {
    setPage(0);
  }, [logs, searchQuery]);

  if (logs.length === 0) {
    return (
      <s-box padding="large">
        <s-paragraph color="subdued">
          {searchQuery
            ? `No products matching "${searchQuery}".`
            : isRollbackTask
              ? "No rollback logs recorded for this task."
              : "No product variant price update logs recorded for this task."}
        </s-paragraph>
      </s-box>
    );
  }

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

  return (
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
        <s-table-header listSlot="primary">Product</s-table-header>
        <s-table-header>Variant</s-table-header>
        <s-table-header>Price</s-table-header>
        <s-table-header>Compare-at Price</s-table-header>
        <s-table-header>Unit Cost</s-table-header>
      </s-table-header-row>
      <s-table-body>
        {pageLogs.map((log, idx) => (
          <s-table-row key={`${pageStart + idx}-${log.variantId || log.variantTitle || log.productTitle}`}>
            <s-table-cell>{log.productTitle}</s-table-cell>
            <s-table-cell>
              <s-text color="subdued">{log.variantTitle}</s-text>
            </s-table-cell>
            <s-table-cell>
              <s-stack direction="inline" gap="small-100">
                <s-text color="subdued" type="redundant">
                  {log.oldPrice}
                </s-text>
                <s-text color="subdued">→</s-text>
                <s-text type="strong" tone={isRollbackTask ? "info" : "success"}>
                  {log.newPrice}
                </s-text>
              </s-stack>
            </s-table-cell>
            <s-table-cell>
              <s-stack direction="inline" gap="small-100">
                <s-text color="subdued" type={log.oldCompare !== "-" ? "redundant" : undefined}>
                  {log.oldCompare}
                </s-text>
                <s-text color="subdued">→</s-text>
                <s-text type="strong">{log.newCompare}</s-text>
              </s-stack>
            </s-table-cell>
            <s-table-cell>
              <s-stack direction="inline" gap="small-100">
                <s-text color="subdued" type="redundant">
                  {log.oldCost}
                </s-text>
                <s-text color="subdued">→</s-text>
                <s-text type="strong">{log.newCost}</s-text>
              </s-stack>
            </s-table-cell>
          </s-table-row>
        ))}
      </s-table-body>
    </s-table>
  );
}
