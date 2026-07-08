import { useCallback, useEffect, useId, useState } from "react";
import { formatPrice } from "../../utils/pricing";
import { PREVIEW_PAGE_SIZE } from "./constants";

function formatCurrency(value) {
  return `$${formatPrice(parseFloat(value) || 0)}`;
}

export default function PriceChangePreview({ previewVariants, visible, framed = true }) {
  const [page, setPage] = useState(0);
  const tableId = useId().replace(/:/g, "");

  useEffect(() => {
    setPage(0);
  }, [previewVariants]);

  const totalPages = Math.max(1, Math.ceil(previewVariants.length / PREVIEW_PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageStart = safePage * PREVIEW_PAGE_SIZE;
  const pageVariants = previewVariants.slice(pageStart, pageStart + PREVIEW_PAGE_SIZE);
  const showPagination = previewVariants.length > PREVIEW_PAGE_SIZE;

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
  }, [handleNextPage, handlePreviousPage, showPagination, tableId, visible]);

  if (!visible) return null;

  return (
    <s-box
      paddingBlockStart={framed ? "base" : undefined}
      borderBlockStartWidth={framed ? "base" : undefined}
      borderColor={framed ? "base" : undefined}
    >
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" gap="small" alignItems="center">
          <s-heading>Price change preview</s-heading>
          <s-icon type="info" interestFor="price-preview-help" />
        </s-stack>
        <s-tooltip id="price-preview-help">
          Preview of price changes based on your current pricing rules
        </s-tooltip>

        <s-paragraph>
          {previewVariants.length > 0
            ? `${previewVariants.length} product variant${previewVariants.length === 1 ? "" : "s"} would be affected by this price change:`
            : "No product variants found matching your criteria."}
        </s-paragraph>

        {previewVariants.length > 0 && (
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
      </s-stack>
    </s-box>
  );
}
