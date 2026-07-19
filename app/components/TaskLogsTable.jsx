import { useEffect, useState } from "react";
import ProductLogLink from "./ProductLogLink";

const LOGS_PAGE_SIZE = 10;

function formatVariantId(variantId) {
  return String(variantId || "-").split("/").pop();
}

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "13px",
};

const headerCellStyle = {
  textAlign: "left",
  padding: "10px 12px",
  borderBottom: "1px solid var(--p-color-border, #dfe3e8)",
  color: "var(--p-color-text-secondary, #616161)",
  fontWeight: 500,
  whiteSpace: "nowrap",
};

const bodyCellStyle = {
  padding: "10px 12px",
  borderBottom: "1px solid var(--p-color-border-secondary, #ececec)",
  verticalAlign: "top",
};

export default function TaskLogsTable({
  logs,
  isRollbackTask,
  searchQuery,
  shopDomain,
  onProductNavigate,
}) {
  const [page, setPage] = useState(0);

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

  return (
    <s-stack direction="block" gap="base">
      <s-box borderWidth="base" borderRadius="base" overflow="hidden">
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={headerCellStyle}>Product</th>
              <th style={headerCellStyle}>Variant ID</th>
              <th style={headerCellStyle}>Price</th>
              <th style={headerCellStyle}>Compare-at Price</th>
              <th style={headerCellStyle}>Unit Cost</th>
            </tr>
          </thead>
          <tbody>
            {pageLogs.map((log, idx) => (
              <tr key={`${pageStart + idx}-${log.variantId || log.variantTitle || log.productTitle}`}>
                <td style={bodyCellStyle}>
                  <ProductLogLink
                    productId={log.productId}
                    shopDomain={shopDomain}
                    onNavigate={onProductNavigate}
                  >
                    {log.productTitle}
                  </ProductLogLink>
                </td>
                <td style={bodyCellStyle}>
                  <span style={{ color: "var(--p-color-text-secondary, #616161)" }}>
                    {formatVariantId(log.variantId)}
                  </span>
                </td>
                <td style={bodyCellStyle}>
                  <span style={{ color: "var(--p-color-text-secondary, #616161)", textDecoration: "line-through" }}>
                    {log.oldPrice}
                  </span>
                  <span style={{ color: "var(--p-color-text-secondary, #616161)", margin: "0 6px" }}>→</span>
                  <strong style={{ color: isRollbackTask ? "#005bd3" : "#008060" }}>{log.newPrice}</strong>
                </td>
                <td style={bodyCellStyle}>
                  <span
                    style={{
                      color: "var(--p-color-text-secondary, #616161)",
                      textDecoration: log.oldCompare !== "-" ? "line-through" : "none",
                    }}
                  >
                    {log.oldCompare}
                  </span>
                  <span style={{ color: "var(--p-color-text-secondary, #616161)", margin: "0 6px" }}>→</span>
                  <strong>{log.newCompare}</strong>
                </td>
                <td style={bodyCellStyle}>
                  <span style={{ color: "var(--p-color-text-secondary, #616161)", textDecoration: "line-through" }}>
                    {log.oldCost}
                  </span>
                  <span style={{ color: "var(--p-color-text-secondary, #616161)", margin: "0 6px" }}>→</span>
                  <strong>{log.newCost}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </s-box>

      {showPagination && (
        <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
          <s-text color="subdued">
            Page {safePage + 1} of {totalPages}
          </s-text>
          <s-stack direction="inline" gap="small-100">
            <s-button
              variant="secondary"
              disabled={safePage === 0}
              onClick={() => setPage((currentPage) => Math.max(0, currentPage - 1))}
            >
              Previous
            </s-button>
            <s-button
              variant="secondary"
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage((currentPage) => Math.min(totalPages - 1, currentPage + 1))}
            >
              Next
            </s-button>
          </s-stack>
        </s-stack>
      )}
    </s-stack>
  );
}
