import { useCallback, useEffect, useId, useState } from "react";
import { formatPrice } from "../../utils/pricing";
import { PREVIEW_PAGE_SIZE } from "./constants";

function formatCurrency(value) {
  return `$${formatPrice(parseFloat(value) || 0)}`;
}

function formatOptionalCurrency(value, hasValue = true) {
  if (!hasValue || value == null) return "-";
  return formatCurrency(value);
}

function escapeCsvCell(value) {
  const stringValue = String(value ?? "");
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function formatVariantId(id) {
  return String(id || "").split("/").pop();
}

function buildPreviewCsv(variants) {
  const rows = [
    [
      "Product",
      "Current price",
      "New price",
      "Current compare-at price",
      "New compare-at price",
      "Current cost price",
      "New cost price",
      "Variant ID",
    ],
    ...variants.map((variant) => [
      variant.title,
      formatCurrency(variant.currentPrice),
      formatCurrency(variant.newPrice),
      formatOptionalCurrency(variant.currentCompare, variant.hasCompare),
      formatOptionalCurrency(variant.newCompare, variant.newCompare !== null),
      formatOptionalCurrency(variant.currentCost, variant.hasCost),
      formatOptionalCurrency(variant.newCost, variant.hasCost),
      formatVariantId(variant.id),
    ]),
  ];

  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

function downloadCsv(filename, csvContent) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function PriceChangePreview({ previewVariants, visible }) {
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const tableId = useId().replace(/:/g, "");
  const trimmedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredVariants = trimmedSearchQuery
    ? previewVariants.filter((variant) =>
        variant.title?.toLowerCase().includes(trimmedSearchQuery)
      )
    : previewVariants;

  useEffect(() => {
    setPage(0);
  }, [previewVariants]);

  useEffect(() => {
    setPage(0);
  }, [searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredVariants.length / PREVIEW_PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageStart = safePage * PREVIEW_PAGE_SIZE;
  const pageVariants = filteredVariants.slice(pageStart, pageStart + PREVIEW_PAGE_SIZE);
  const showPagination = filteredVariants.length > PREVIEW_PAGE_SIZE;

  const handlePreviousPage = useCallback(() => {
    setPage((currentPage) => Math.max(0, currentPage - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setPage((currentPage) => Math.min(totalPages - 1, currentPage + 1));
  }, [totalPages]);

  const handleExportCsv = () => {
    const csv = buildPreviewCsv(filteredVariants);
    downloadCsv("price-change-preview.csv", csv);
  };

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
  }, [handleNextPage, handlePreviousPage, showPagination, tableId, visible]);

  if (!visible) return null;

  return (
    <s-box paddingBlockStart="base" borderBlockStartWidth="base" borderColor="base">
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" gap="small" alignItems="center">
          <s-heading>Price change preview</s-heading>
          <s-icon type="info" interestFor="price-preview-help" />
        </s-stack>
        <s-tooltip id="price-preview-help">
          Preview of price changes based on your current pricing rules
        </s-tooltip>

        <s-paragraph>
          {filteredVariants.length > 0
            ? `${filteredVariants.length} product variant${filteredVariants.length === 1 ? "" : "s"} would be affected by this price change:`
            : "No product variants found matching your criteria."}
        </s-paragraph>

        {previewVariants.length > 0 && (
          <>
            <s-stack direction="inline" gap="base" alignItems="end">
              <s-box inlineSize="100%">
                <s-search-field
                  label="Search preview"
                  labelAccessibilityVisibility="exclusive"
                  placeholder="Search products or variants..."
                  value={searchQuery}
                  onInput={(e) => setSearchQuery(e.target.value)}
                />
              </s-box>
              <s-button
                variant="secondary"
                onClick={handleExportCsv}
                disabled={filteredVariants.length === 0}
              >
                Export CSV
              </s-button>
            </s-stack>

            {filteredVariants.length > 0 && (
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
                  <s-table-header listSlot="labeled">Current price</s-table-header>
                  <s-table-header listSlot="labeled">New price</s-table-header>
                </s-table-header-row>
                <s-table-body>
                  {pageVariants.map((variant) => {
                    const priceChanged =
                      formatPrice(variant.newPrice) !== formatPrice(variant.currentPrice);

                    return (
                      <s-table-row key={variant.id}>
                        <s-table-cell>
                          <s-stack direction="inline" gap="small" alignItems="center">
                            <s-thumbnail
                              src={variant.imageUrl}
                              alt={variant.title}
                              size="small"
                            />
                            <s-text>{variant.title}</s-text>
                          </s-stack>
                        </s-table-cell>
                        <s-table-cell>{formatCurrency(variant.currentPrice)}</s-table-cell>
                        <s-table-cell>
                          <s-stack direction="inline" gap="small-100">
                            {priceChanged && (
                              <>
                                <s-text color="subdued" type="redundant">
                                  {formatCurrency(variant.currentPrice)}
                                </s-text>
                                <s-text color="subdued">→</s-text>
                              </>
                            )}
                            <s-text type="strong">{formatCurrency(variant.newPrice)}</s-text>
                          </s-stack>
                        </s-table-cell>
                      </s-table-row>
                    );
                  })}
                </s-table-body>
              </s-table>
            )}
          </>
        )}
      </s-stack>
    </s-box>
  );
}
