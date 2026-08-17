import { useCallback, useEffect, useId, useState } from "react";
import { formatPrice } from "../../utils/pricing";
import { PREVIEW_PAGE_SIZE } from "./constants";
import { useI18n } from "../../i18n/I18nProvider";

function formatFallbackCurrency(value) {
  return `$${formatPrice(parseFloat(value) || 0)}`;
}

function escapeCsvCell(value) {
  const stringValue = String(value ?? "");
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function formatVariantId(id) {
  return String(id || "").split("/").pop();
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

export default function PriceChangePreview({ previewVariants, visible = false, onClose }) {
  const { t, formatCurrency } = useI18n();
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const rawId = useId();
  const tooltipId = `price-preview-help-${rawId.replace(/:/g, "")}`;
  const tableId = `price-preview-table-${rawId.replace(/:/g, "")}`;
  const trimmedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredVariants = trimmedSearchQuery
    ? previewVariants.filter((variant) =>
        variant.title?.toLowerCase().includes(trimmedSearchQuery)
      )
    : previewVariants;

  const formatMoney = (value) => {
    const number = parseFloat(value);
    if (!Number.isFinite(number)) return formatFallbackCurrency(value);
    return formatCurrency(number, "USD");
  };

  const formatOptionalMoney = (value, hasValue = true) => {
    if (!hasValue || value == null) return t("common.emDash");
    return formatMoney(value);
  };

  const buildPreviewCsv = (variants) => {
    const rows = [
      [
        t("preview.product"),
        t("preview.currentPrice"),
        t("preview.newPrice"),
        t("preview.currentCompare"),
        t("preview.newCompare"),
        t("preview.currentCost"),
        t("preview.newCost"),
        t("preview.variantId"),
      ],
      ...variants.map((variant) => [
        variant.title,
        formatMoney(variant.currentPrice),
        formatMoney(variant.newPrice),
        formatOptionalMoney(variant.currentCompare, variant.hasCompare),
        formatOptionalMoney(variant.newCompare, variant.newCompare !== null),
        formatOptionalMoney(variant.currentCost, variant.hasCost),
        formatOptionalMoney(variant.newCost, variant.hasCost),
        formatVariantId(variant.id),
      ]),
    ];

    return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
  };

  useEffect(() => {
    setPage(0);
    setSearchQuery("");
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
    if (!showPagination || !visible) return undefined;

    const table = document.getElementById(tableId);
    if (!table) return undefined;

    table.addEventListener("previouspage", handlePreviousPage);
    table.addEventListener("nextpage", handleNextPage);

    return () => {
      table.removeEventListener("previouspage", handlePreviousPage);
      table.removeEventListener("nextpage", handleNextPage);
    };
  }, [handleNextPage, handlePreviousPage, showPagination, tableId, visible]);

  if (!visible) {
    return null;
  }

  const hasSearchFilter = trimmedSearchQuery.length > 0;
  const summaryText =
    previewVariants.length === 0
      ? t("preview.noneFound")
      : hasSearchFilter && filteredVariants.length === 0
        ? t("preview.noSearchMatch", { count: previewVariants.length })
        : hasSearchFilter
          ? t("preview.searchMatch", {
              filtered: filteredVariants.length,
              total: previewVariants.length,
              count: filteredVariants.length,
            })
          : t("preview.affected", { count: previewVariants.length });

  return (
    <s-box padding="base" borderWidth="base" borderRadius="base" background="base">
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" gap="small-100" alignItems="center" justifyContent="space-between">
          <s-stack direction="inline" gap="small-100" alignItems="center">
            <s-text type="strong">{t("preview.title")}</s-text>
            <s-icon type="info" interestFor={tooltipId} />
            <s-tooltip id={tooltipId}>
              {t("preview.tooltip")}
            </s-tooltip>
          </s-stack>
          {onClose && (
            <s-button variant="tertiary" onClick={onClose}>
              {t("common.close")}
            </s-button>
          )}
        </s-stack>

        <s-paragraph>{summaryText}</s-paragraph>

        {previewVariants.length > 0 && (
          <>
            <s-search-field
              label={t("preview.search")}
              labelAccessibilityVisibility="exclusive"
              placeholder={t("preview.searchPlaceholder")}
              value={searchQuery}
              onInput={(e) => setSearchQuery(e.target.value)}
            />

            <s-stack direction="inline" justifyContent="start">
              <s-button
                variant="secondary"
                onClick={handleExportCsv}
                disabled={filteredVariants.length === 0}
              >
                {t("preview.exportCsv")}
              </s-button>
            </s-stack>
          </>
        )}

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
              <s-table-header listSlot="primary">{t("preview.product")}</s-table-header>
              <s-table-header listSlot="labeled" format="currency">
                {t("preview.currentPrice")}
              </s-table-header>
              <s-table-header listSlot="labeled" format="currency">
                {t("preview.newPrice")}
              </s-table-header>
            </s-table-header-row>
            <s-table-body>
              {pageVariants.map((variant) => (
                <s-table-row key={variant.id}>
                  <s-table-cell>
                    <s-stack direction="inline" gap="small" alignItems="center">
                      <s-thumbnail src={variant.imageUrl} alt={variant.title} size="small" />
                      <s-text>{variant.title}</s-text>
                    </s-stack>
                  </s-table-cell>
                  <s-table-cell>{formatMoney(variant.currentPrice)}</s-table-cell>
                  <s-table-cell>{formatMoney(variant.newPrice)}</s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-stack>
    </s-box>
  );
}
