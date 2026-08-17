import { formatPrice } from "./pricing.js";
import { getPriceChangeDisplay } from "./task-log-display.js";

export const VARIANT_PAGE_SIZE = 250;
export const PRODUCT_VARIANTS_BULK_LIMIT = 250;
export const MAX_VARIANT_PAGES = 20;

const PRODUCT_VARIANTS_QUERY = `#graphql
  query ProductVariants($id: ID!, $first: Int!, $after: String) {
    product(id: $id) {
      variants(first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          __VARIANT_FIELDS__
        }
      }
    }
  }
`;

const PRODUCT_VARIANTS_BULK_UPDATE_MUTATION = `#graphql
  mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      productVariants { id }
      userErrors { field message }
    }
  }
`;

export function chunkItems(items, size) {
  const chunks = [];
  const list = Array.isArray(items) ? items : [];
  const chunkSize = Math.max(1, Number(size) || 1);
  for (let i = 0; i < list.length; i += chunkSize) {
    chunks.push(list.slice(i, i + chunkSize));
  }
  return chunks;
}

function uniqueVariants(variants) {
  const seen = new Set();
  const unique = [];
  for (const variant of variants) {
    if (!variant?.id || seen.has(variant.id)) continue;
    seen.add(variant.id);
    unique.push(variant);
  }
  return unique;
}

function buildProductVariantsQuery(variantFields) {
  return PRODUCT_VARIANTS_QUERY.replace("__VARIANT_FIELDS__", variantFields.trim());
}

/**
 * Fetch every variant for a product using cursor pagination.
 * Deduplicates by variant id and stops when hasNextPage is false.
 */
export async function fetchAllProductVariants(
  shopifyQuery,
  productId,
  variantFields,
  {
    existingNodes = [],
    cursor = null,
    hasNextPage = null,
    pageSize = VARIANT_PAGE_SIZE,
  } = {},
) {
  const startingNodes = uniqueVariants(existingNodes);

  if (!productId || typeof shopifyQuery !== "function" || !variantFields) {
    return startingNodes;
  }

  if (startingNodes.length > 0 && hasNextPage === false) {
    return startingNodes;
  }

  const seen = new Set(startingNodes.map((variant) => variant.id));
  const nodes = [...startingNodes];
  let after = startingNodes.length > 0 && hasNextPage && cursor ? cursor : null;
  if (startingNodes.length > 0 && hasNextPage && !cursor) {
    nodes.length = 0;
    seen.clear();
    after = null;
  }

  let more = startingNodes.length === 0 || hasNextPage === true || hasNextPage == null;
  let pages = 0;
  const query = buildProductVariantsQuery(variantFields);
  const first = Math.min(VARIANT_PAGE_SIZE, Math.max(1, Number(pageSize) || VARIANT_PAGE_SIZE));

  while (more && pages < MAX_VARIANT_PAGES) {
    const data = await shopifyQuery(query, {
      id: productId,
      first,
      after,
    });

    pages += 1;
    const connection = data?.product?.variants;
    if (!connection) break;

    for (const variant of connection.nodes || []) {
      if (!variant?.id || seen.has(variant.id)) continue;
      seen.add(variant.id);
      nodes.push(variant);
    }

    more = connection.pageInfo?.hasNextPage === true;
    after = connection.pageInfo?.endCursor ?? null;
    if (more && !after) break;
  }

  return nodes;
}

export async function hydrateProductsWithAllVariants(
  shopifyQuery,
  products,
  variantFields,
  { pageSize = VARIANT_PAGE_SIZE } = {},
) {
  const list = Array.isArray(products) ? products : [];
  const hydrated = [];

  for (const product of list) {
    const connection = product?.variants || {};
    const existingNodes = connection.nodes || [];
    const hasNextPage = connection.pageInfo?.hasNextPage === true;
    const cursor = connection.pageInfo?.endCursor ?? null;

    const nodes = hasNextPage
      ? await fetchAllProductVariants(shopifyQuery, product.id, variantFields, {
          existingNodes,
          cursor,
          hasNextPage: true,
          pageSize,
        })
      : uniqueVariants(existingNodes);

    hydrated.push({
      ...product,
      variants: {
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes,
      },
    });
  }

  return hydrated;
}

export async function bulkUpdateProductVariants(shopifyQuery, productId, variants) {
  const updatedIds = [];
  const failed = [];
  const list = Array.isArray(variants) ? variants : [];

  if (!productId || list.length === 0) {
    return { updatedIds, failed };
  }

  for (const batch of chunkItems(list, PRODUCT_VARIANTS_BULK_LIMIT)) {
    try {
      const data = await shopifyQuery(PRODUCT_VARIANTS_BULK_UPDATE_MUTATION, {
        productId,
        variants: batch,
      });
      const userErrors = data?.productVariantsBulkUpdate?.userErrors || [];
      if (userErrors.length > 0) {
        failed.push({
          variantIds: batch.map((variant) => variant.id),
          message: userErrors.map((error) => error.message).filter(Boolean).join("; ") || "Update failed",
        });
        continue;
      }
      updatedIds.push(...batch.map((variant) => variant.id));
    } catch (error) {
      failed.push({
        variantIds: batch.map((variant) => variant.id),
        message: error?.message || String(error),
      });
    }
  }

  return { updatedIds, failed };
}

export function overallVariantResult(priceResult, costResult) {
  const price = priceResult === "pending" ? "no_change" : priceResult || "no_change";
  const cost = costResult === "pending" ? "no_change" : costResult || "no_change";
  if (price === "updated" || cost === "updated") return "updated";
  if (price === "failed" || cost === "failed") return "failed";
  if (price === "skipped" || cost === "skipped") return "skipped";
  return "no_change";
}

function appendLogError(log, message) {
  if (!message) return;
  if (!log.error) {
    log.error = message;
    return;
  }
  if (log.error.includes(message)) return;
  log.error = `${log.error}; ${message}`;
}

export function applyBulkResultsToLogs(logs, bulkResult) {
  if (!Array.isArray(logs) || !bulkResult) return 0;

  const updatedIds = new Set(bulkResult.updatedIds || []);
  const failedIds = new Map();
  for (const batch of bulkResult.failed || []) {
    for (const id of batch.variantIds || []) {
      failedIds.set(id, batch.message);
    }
  }

  if (updatedIds.size === 0 && failedIds.size === 0) return 0;

  let failedCount = 0;
  for (const log of logs) {
    if (updatedIds.has(log.variantId)) {
      log.priceResult = "updated";
    } else if (failedIds.has(log.variantId)) {
      log.priceResult = "failed";
      appendLogError(log, failedIds.get(log.variantId));
      failedCount += 1;
    } else {
      continue;
    }
    log.result = overallVariantResult(log.priceResult, log.costResult);
  }
  return failedCount;
}

export function applyBulkFailuresToLogs(logs, failedBatches) {
  return applyBulkResultsToLogs(logs, { updatedIds: [], failed: failedBatches || [] });
}

function formattedPricesEqual(left, right) {
  if (left == null && right == null) return true;
  if (left == null || right == null) return false;
  return formatPrice(left) === formatPrice(right);
}

/**
 * Build a productVariantsBulkUpdate input only when price or compare-at actually changed.
 */
export function buildVariantPriceUpdate({
  variantId,
  changePrice,
  comparePriceType,
  pricing,
  currentPrice,
  currentCompare,
  hasCompare,
}) {
  if (!variantId || !pricing) return null;

  const update = { id: variantId };

  if (changePrice !== "6" && !pricing.priceSkipped) {
    const nextPrice = formatPrice(pricing.newPrice);
    if (nextPrice !== formatPrice(currentPrice)) {
      update.price = nextPrice;
    }
  }

  if (comparePriceType !== "6" && !pricing.compareSkipped) {
    const nextCompare = pricing.newCompare !== null ? formatPrice(pricing.newCompare) : null;
    const current = hasCompare ? formatPrice(currentCompare) : null;
    if (nextCompare !== current) {
      update.compareAtPrice = nextCompare;
    }
  }

  return Object.keys(update).length > 1 ? update : null;
}

export function costNeedsUpdate(costPriceType, pricing, currentCost, hasCost) {
  if (!pricing || costPriceType === "6" || pricing.costSkipped) return false;
  if (!hasCost) return true;
  return !formattedPricesEqual(pricing.newCost, currentCost);
}

export function classifyVariantResult({
  error,
  pricing,
  didUpdate,
  priceResult,
  costResult,
} = {}) {
  if (priceResult != null || costResult != null) {
    return overallVariantResult(priceResult, costResult);
  }
  if (didUpdate) return "updated";
  if (error) return "failed";
  if (pricing?.priceSkipped || pricing?.compareSkipped || pricing?.costSkipped) {
    return "skipped";
  }
  return "no_change";
}

export function summarizeVariantLogs(logs) {
  const summary = {
    evaluatedVariantsCount: 0,
    updatedVariantsCount: 0,
    noChangeCount: 0,
    skippedCount: 0,
    failureCount: 0,
  };

  if (!Array.isArray(logs)) return summary;

  summary.evaluatedVariantsCount = logs.length;

  for (const log of logs) {
    if (log.result === "updated") {
      summary.updatedVariantsCount += 1;
      if (log.error) summary.failureCount += 1;
      continue;
    }
    if (log.result === "skipped") {
      summary.skippedCount += 1;
      continue;
    }
    if (log.result === "failed" || log.error) {
      summary.failureCount += 1;
      continue;
    }
    summary.noChangeCount += 1;
  }

  return summary;
}

export function resolveTaskCompletionStatus(summary = {}) {
  const updated = Number(summary.updatedVariantsCount || 0);
  const failed = Number(summary.failureCount || 0);
  if (failed > 0 && updated === 0) return "failed";
  return "completed";
}

export function variantProgressFields(logs, extra = {}) {
  const summary = summarizeVariantLogs(logs);
  return {
    ...extra,
    ...summary,
    successCount: summary.updatedVariantsCount,
  };
}

export function buildRollbackVariantUpdate(log) {
  if (!log?.variantId) return null;

  const update = { id: log.variantId };
  const priceDisplay = getPriceChangeDisplay(log.oldPrice, log.newPrice);
  if (priceDisplay.type === "changed") {
    update.price = log.oldPrice;
  }

  const compareDisplay = getPriceChangeDisplay(log.oldCompare, log.newCompare);
  if (compareDisplay.type === "changed") {
    update.compareAtPrice = log.oldCompare === "-" || log.oldCompare == null ? null : log.oldCompare;
  }

  return Object.keys(update).length > 1 ? update : null;
}

export function shouldRollbackCost(log) {
  if (!log?.inventoryItemId) return false;
  if (log.oldCost === "-" || log.oldCost == null || log.oldCost === "") return false;
  return getPriceChangeDisplay(log.oldCost, log.newCost).type === "changed";
}
