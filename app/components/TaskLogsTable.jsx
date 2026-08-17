/* eslint-disable react/prop-types -- this codebase does not use PropTypes */
import { useEffect, useState } from "react";
import ProductLogLink from "./ProductLogLink";
import {
  formatTagChangeLines,
  getLogTagChanges,
  getPriceChangeDisplay,
} from "../utils/task-log-display";

const LOGS_PAGE_SIZE = 10;
const mutedText = "var(--p-color-text-secondary, #616161)";

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
  color: mutedText,
  fontWeight: 500,
  whiteSpace: "nowrap",
};

const bodyCellStyle = {
  padding: "10px 12px",
  borderBottom: "1px solid var(--p-color-border-secondary, #ececec)",
  verticalAlign: "top",
};

function PriceValue({ display, changedColor }) {
  if (display.type === "blank") {
    return <span style={{ color: mutedText }}>-</span>;
  }

  if (display.type === "unchanged") {
    return (
      <span>
        <strong>{display.value}</strong>
        <span style={{ color: mutedText }}> (No Change)</span>
      </span>
    );
  }

  return (
    <>
      <span style={{ color: mutedText, textDecoration: "line-through" }}>{display.oldValue}</span>
      <span style={{ color: mutedText, margin: "0 6px" }}>→</span>
      <strong style={{ color: changedColor }}>{display.newValue}</strong>
    </>
  );
}

function TagChanges({ log, taskTagChanges }) {
  const lines = formatTagChangeLines(getLogTagChanges(log, taskTagChanges));

  if (lines.length === 0) {
    return <span style={{ color: mutedText }}>-</span>;
  }

  return (
    <span style={{ display: "flex", flexDirection: "column", gap: "2px", whiteSpace: "normal" }}>
      {lines.map((line) => (
        <span key={line}>{line}</span>
      ))}
    </span>
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
  const [page, setPage] = useState(0);
  const changedColor = isRollbackTask ? "#005bd3" : "#008060";

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
              <th style={headerCellStyle}>TAG</th>
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
                  <span style={{ color: mutedText }}>{formatVariantId(log.variantId)}</span>
                </td>
                <td style={bodyCellStyle}>
                  <PriceValue
                    display={getPriceChangeDisplay(log.oldPrice, log.newPrice)}
                    changedColor={changedColor}
                  />
                </td>
                <td style={bodyCellStyle}>
                  <PriceValue
                    display={getPriceChangeDisplay(log.oldCompare, log.newCompare)}
                    changedColor={changedColor}
                  />
                </td>
                <td style={bodyCellStyle}>
                  <PriceValue
                    display={getPriceChangeDisplay(log.oldCost, log.newCost)}
                    changedColor={changedColor}
                  />
                </td>
                <td style={bodyCellStyle}>
                  <TagChanges log={log} taskTagChanges={taskTagChanges} />
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
