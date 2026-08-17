import prisma from "../db.server";
import { calculateVariantPricing, formatPrice } from "../utils/pricing";
import { attachProductTagChanges } from "../utils/task-log-display";
import {
  buildProductQuery,
  filterProductsByConditions,
  PRODUCT_CONDITION_FIELDS,
  PRODUCT_CONDITION_VARIANT_FIELDS,
} from "../utils/product-conditions";
import {
  applyBulkResultsToLogs,
  buildVariantPriceUpdate,
  bulkUpdateProductVariants,
  classifyVariantResult,
  costNeedsUpdate,
  hydrateProductsWithAllVariants,
  resolveTaskCompletionStatus,
  variantProgressFields,
} from "../utils/shopify-variants";
import { notifyTaskFinishedIfEnabled } from "./task-finished-email.server";
import {
  requireTaskUpdateForShop,
  TASK_NOT_FOUND_FOR_SHOP_ERROR,
} from "../utils/task-record";

export { buildProductQuery, filterProductsByConditions };

const PRODUCTS_PAGE_SIZE = 50;
const HEAVY_PRODUCTS_PAGE_SIZE = 10;
const LIGHT_PRODUCTS_PAGE_SIZE = 25;
// Nested product.variants page size. Remaining pages are fetched with cursor pagination up to 250.
export const PRODUCT_VARIANTS_PAGE_SIZE = 100;

const PRICING_VARIANT_FIELDS = `
  id
  title
  sku
  price
  compareAtPrice
  image {
    url
  }
  inventoryItem {
    id
    unitCost {
      amount
    }
  }
`;

const SEARCH_CONDITION_VARIANT_FIELDS = `
  ${PRODUCT_CONDITION_VARIANT_FIELDS}
  image {
    url
  }
`;

function variantsConnection(fields) {
  return `
  variants(first: ${PRODUCT_VARIANTS_PAGE_SIZE}) {
    pageInfo {
      hasNextPage
      endCursor
    }
    nodes {
      ${fields}
    }
  }`;
}

export function getVariantFieldsFragment(editType, purpose = "task") {
  if (editType === "conditions") {
    return purpose === "search" ? SEARCH_CONDITION_VARIANT_FIELDS : PRODUCT_CONDITION_VARIANT_FIELDS;
  }
  return PRICING_VARIANT_FIELDS;
}

export const SEARCH_PREVIEW_FIELDS = `
  id
  title
  featuredImage {
    url
  }
  variantsCount {
    count
  }
  ${variantsConnection(PRICING_VARIANT_FIELDS)}
`;

export const TASK_EXECUTION_FIELDS = `
  id
  title
  variantsCount {
    count
  }
  ${variantsConnection(PRICING_VARIANT_FIELDS)}
`;

export const SEARCH_PRODUCT_FIELDS = `
  id
  ${PRODUCT_CONDITION_FIELDS}
  featuredImage {
    url
  }
  variantsCount {
    count
  }
  ${variantsConnection(SEARCH_CONDITION_VARIANT_FIELDS)}
`;

export const TASK_PRODUCT_FIELDS = `
  id
  ${PRODUCT_CONDITION_FIELDS}
  variantsCount {
    count
  }
  ${variantsConnection(PRODUCT_CONDITION_VARIANT_FIELDS)}
`;

export function getProductSearchQueryConfig(editType) {
  if (editType === "conditions") {
    return {
      fields: SEARCH_PRODUCT_FIELDS,
      pageSize: HEAVY_PRODUCTS_PAGE_SIZE,
    };
  }

  return {
    fields: SEARCH_PREVIEW_FIELDS,
    pageSize: LIGHT_PRODUCTS_PAGE_SIZE,
  };
}

export function getTaskProductQueryConfig(editType) {
  if (editType === "conditions") {
    return {
      fields: TASK_PRODUCT_FIELDS,
      pageSize: HEAVY_PRODUCTS_PAGE_SIZE,
    };
  }

  return {
    fields: TASK_EXECUTION_FIELDS,
    pageSize: LIGHT_PRODUCTS_PAGE_SIZE,
  };
}

export async function fetchProductsByQuery(
  shopifyQuery,
  queryStr,
  fieldsFragment,
  { maxProducts, pageSize = PRODUCTS_PAGE_SIZE } = {}
) {
  const products = [];
  let cursor = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const currentPageSize =
      maxProducts != null
        ? Math.min(pageSize, maxProducts - products.length)
        : pageSize;

    if (currentPageSize <= 0) break;

    const data = await shopifyQuery(
      `#graphql
      query getProducts($query: String, $first: Int!, $after: String) {
        products(first: $first, after: $after, query: $query) {
          nodes {
            ${fieldsFragment}
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }`,
      {
        query: queryStr || null,
        first: currentPageSize,
        after: cursor,
      }
    );

    products.push(...(data.products?.nodes || []));
    hasNextPage = data.products?.pageInfo?.hasNextPage ?? false;
    cursor = data.products?.pageInfo?.endCursor ?? null;

    if (maxProducts != null && products.length >= maxProducts) {
      break;
    }
  }

  return products;
}

export async function executePriceEditTask({ admin, taskId, shop, runPayload }) {
  if (!shop) {
    return { success: false, error: TASK_NOT_FOUND_FOR_SHOP_ERROR };
  }

  if (runPayload.editType === "csv-all" || runPayload.editType === "csv-direct") {
    const { executeCsvPriceEditTask } = await import("./csv-bulk-edit.server");
    return executeCsvPriceEditTask({ admin, taskId, shop, runPayload });
  }

  const shopifyQuery = async (query, variables = {}) => {
    const response = await admin.graphql(query, { variables });
    const json = await response.json();
    if (json.errors) {
      throw new Error(json.errors[0].message);
    }
    return json.data;
  };

  const {
    editType,
    matchType,
    conditionsStr,
    collectionId,
    changePrice,
    percentType,
    percentValue,
    fixedType,
    fixedValue,
    fixedPriceAmount,
    roundCents,
    roundCentsDigit,
    priceFormula,
    comparePriceType,
    comparePercentType,
    comparePercentValue,
    compareFixedType,
    compareFixedValue,
    compareFixedPriceAmount,
    compareRoundCents,
    compareRoundCentsDigit,
    comparePriceFormula,
    costPriceType,
    costPercentType,
    costPercentValue,
    costFixedType,
    costFixedValue,
    costFixedPriceAmount,
    costRoundCents,
    costRoundCentsDigit,
    tagsToAddList = [],
    tagsToRemoveList = [],
  } = runPayload;

  const logsList = [];
  const warningsList = [];
  const productIdsList = [];
  let updatedVariantsCount = 0;
  let updatedProductsCount = 0;
  let totalProductsCount = 0;
  let failureCount = 0;

  const buildActionDetails = (logs, extra = {}) =>
    JSON.stringify({
      taskType: "price_edit",
      editType,
      changePrice,
      priceFormula,
      comparePriceFormula,
      runPayload,
      tagsToAdd: tagsToAddList,
      tagsToRemove: tagsToRemoveList,
      productIds: productIdsList,
      logs,
      warnings: warningsList,
      ...extra,
    });

  const updateTaskStatus = async (status, processed = 0, total = 0, logs = null, extra = {}) => {
    const updateData = { status, processedItems: processed, totalItems: total };
    if (logs) {
      updateData.actionDetails = buildActionDetails(logs, extra);
    }
    await requireTaskUpdateForShop(prisma, { id: taskId, shop, data: updateData });

    if (status === "completed" || status === "failed") {
      void notifyTaskFinishedIfEnabled(taskId, shop).catch((error) => {
        console.error(`Failed to send task finished email for ${taskId}:`, error);
      });
    }
  };

  try {
    await requireTaskUpdateForShop(prisma, {
      id: taskId,
      shop,
      data: { status: "running" },
    });
  } catch (error) {
    return { success: false, error: error.message };
  }

  const queryStr = buildProductQuery(editType, matchType, conditionsStr, collectionId);
  const { fields, pageSize } = getTaskProductQueryConfig(editType);

  try {
    const fetchedProducts = await fetchProductsByQuery(
      shopifyQuery,
      queryStr,
      fields,
      { pageSize }
    );

    const productsWithVariants = await hydrateProductsWithAllVariants(
      shopifyQuery,
      fetchedProducts,
      getVariantFieldsFragment(editType, "task"),
      { pageSize: PRODUCT_VARIANTS_PAGE_SIZE },
    );

    const products = filterProductsByConditions(
      productsWithVariants,
      editType,
      matchType,
      conditionsStr
    );
    totalProductsCount = products.length;

    for (const product of productsWithVariants) {
      const expected = product.variantsCount?.count;
      const actual = product.variants?.nodes?.length || 0;
      if (typeof expected === "number" && actual < expected) {
        warningsList.push(
          `${product.title || product.id}: fetched ${actual} of ${expected} variants.`
        );
      }
    }

    const buildProgressMeta = (error = null) =>
      variantProgressFields(logsList, {
        processedProductsCount: productIdsList.length,
        updatedProductsCount,
        ...(error ? { error } : {}),
      });

    await updateTaskStatus(
      "running",
      0,
      totalProductsCount,
      [],
      variantProgressFields([], {
        processedProductsCount: 0,
        updatedProductsCount: 0,
      }),
    );

    for (const prod of products) {
      let productUpdated = false;
      productIdsList.push(prod.id);

      const variants = prod.variants?.nodes || [];
      const variantsToUpdate = [];

      for (const variant of variants) {
        let variantError = null;
        let priceResult = "no_change";
        let costResult = "no_change";
        const hasCompare = variant.compareAtPrice != null && variant.compareAtPrice !== "";
        const hasCost =
          variant.inventoryItem?.unitCost?.amount != null &&
          variant.inventoryItem.unitCost.amount !== "";
        const currentPrice = parseFloat(variant.price) || 0;
        const currentCompare = hasCompare ? parseFloat(variant.compareAtPrice) || 0 : 0;
        const currentCost = hasCost ? parseFloat(variant.inventoryItem.unitCost.amount) || 0 : 0;

        const pricing = calculateVariantPricing({
          changePrice,
          percentType,
          percentValue,
          fixedType,
          fixedValue,
          fixedPriceAmount,
          roundCents,
          roundCentsDigit,
          priceFormula,
          comparePriceType,
          comparePercentType,
          comparePercentValue,
          compareFixedType,
          compareFixedValue,
          compareFixedPriceAmount,
          compareRoundCents,
          compareRoundCentsDigit,
          comparePriceFormula,
          costPriceType,
          costPercentType,
          costPercentValue,
          costFixedType,
          costFixedValue,
          costFixedPriceAmount,
          costRoundCents,
          costRoundCentsDigit,
          originalPrice: currentPrice,
          originalCompare: currentCompare,
          originalCost: currentCost,
          hasCompare,
          hasCost,
        });

        const newPrice = pricing.newPrice;
        const newCompare = pricing.newCompare;
        const newCost = pricing.newCost;

        const variantUpdate = buildVariantPriceUpdate({
          variantId: variant.id,
          changePrice,
          comparePriceType,
          pricing,
          currentPrice,
          currentCompare,
          hasCompare,
        });
        if (variantUpdate) {
          variantsToUpdate.push(variantUpdate);
          priceResult = "pending";
        } else if (
          (changePrice !== "6" && pricing.priceSkipped) ||
          (comparePriceType !== "6" && pricing.compareSkipped)
        ) {
          priceResult = "skipped";
        }

        if (costNeedsUpdate(costPriceType, pricing, currentCost, hasCost) && variant.inventoryItem?.id) {
          try {
            const invData = await shopifyQuery(
              `#graphql
              mutation inventoryItemUpdate($id: ID!, $input: InventoryItemInput!) {
                inventoryItemUpdate(id: $id, input: $input) {
                  inventoryItem { id }
                  userErrors { field message }
                }
              }`,
              {
                id: variant.inventoryItem.id,
                input: { cost: formatPrice(newCost) },
              }
            );

            const invErrors = invData.inventoryItemUpdate?.userErrors || [];
            if (invErrors.length > 0) {
              variantError = invErrors[0].message;
              costResult = "failed";
            } else {
              productUpdated = true;
              costResult = "updated";
            }
          } catch (error) {
            variantError = error?.message || String(error);
            costResult = "failed";
          }
        } else if (costPriceType !== "6" && pricing.costSkipped) {
          costResult = "skipped";
        }

        if (changePrice !== "6" || comparePriceType !== "6" || (costPriceType !== "6" && variant.inventoryItem?.id)) {
          logsList.push({
            productId: prod.id,
            variantId: variant.id,
            inventoryItemId: variant.inventoryItem?.id || null,
            productTitle: prod.title,
            variantTitle: variant.title || "Default Title",
            oldPrice: formatPrice(currentPrice),
            newPrice: formatPrice(newPrice),
            oldCompare: hasCompare ? formatPrice(currentCompare) : "-",
            newCompare: newCompare !== null ? formatPrice(newCompare) : "-",
            oldCost: hasCost ? formatPrice(currentCost) : "-",
            newCost: hasCost ? formatPrice(newCost) : "-",
            warnings: pricing.warnings,
            priceResult,
            costResult,
            result: classifyVariantResult({
              error: variantError,
              pricing,
              priceResult,
              costResult,
            }),
            ...(variantError ? { error: variantError } : {}),
          });
        }
      }

      if (variantsToUpdate.length > 0) {
        const bulkResult = await bulkUpdateProductVariants(
          shopifyQuery,
          prod.id,
          variantsToUpdate,
        );
        if (bulkResult.updatedIds.length > 0) {
          productUpdated = true;
        }
        applyBulkResultsToLogs(logsList, bulkResult);
      }

      if (tagsToAddList.length > 0) {
        const tagData = await shopifyQuery(
          `#graphql
          mutation tagsAdd($id: ID!, $tags: [String!]!) {
            tagsAdd(id: $id, tags: $tags) {
              userErrors { field message }
            }
          }`,
          { id: prod.id, tags: tagsToAddList }
        );

        const tagErrors = tagData.tagsAdd?.userErrors || [];
        if (tagErrors.length > 0) {
          const error = tagErrors[0].message;
          await updateTaskStatus("failed", updatedVariantsCount, totalProductsCount, logsList, buildProgressMeta(error));
          return { success: false, error };
        }
        productUpdated = true;
      }

      if (tagsToRemoveList.length > 0) {
        const tagData = await shopifyQuery(
          `#graphql
          mutation tagsRemove($id: ID!, $tags: [String!]!) {
            tagsRemove(id: $id, tags: $tags) {
              userErrors { field message }
            }
          }`,
          { id: prod.id, tags: tagsToRemoveList }
        );

        const tagErrors = tagData.tagsRemove?.userErrors || [];
        if (tagErrors.length > 0) {
          const error = tagErrors[0].message;
          await updateTaskStatus("failed", updatedVariantsCount, totalProductsCount, logsList, buildProgressMeta(error));
          return { success: false, error };
        }
        productUpdated = true;
      }

      if (tagsToAddList.length > 0 || tagsToRemoveList.length > 0) {
        attachProductTagChanges(logsList, prod.id, tagsToAddList, tagsToRemoveList);
      }

      if (productUpdated) {
        updatedProductsCount++;
      }

      const progress = variantProgressFields(logsList, {
        processedProductsCount: productIdsList.length,
        updatedProductsCount,
      });
      updatedVariantsCount = progress.updatedVariantsCount;
      failureCount = progress.failureCount;

      await updateTaskStatus("running", updatedVariantsCount, totalProductsCount, logsList, progress);
    }

    const completedProgress = variantProgressFields(logsList, {
      processedProductsCount: totalProductsCount,
      updatedProductsCount,
    });
    updatedVariantsCount = completedProgress.updatedVariantsCount;
    failureCount = completedProgress.failureCount;
    const completionStatus = resolveTaskCompletionStatus(completedProgress);

    await updateTaskStatus(completionStatus, updatedVariantsCount, totalProductsCount, logsList, completedProgress);

    return {
      success: completionStatus === "completed",
      updatedProductsCount,
      updatedVariantsCount,
      logsList,
      productIdsList,
    };
  } catch (err) {
    console.error("Error executing task on Shopify:", err);
    const failedProgress = variantProgressFields(logsList, {
      processedProductsCount: productIdsList.length,
      updatedProductsCount,
      error: err.message,
    });
    updatedVariantsCount = failedProgress.updatedVariantsCount;
    failureCount = failedProgress.failureCount || 1;
    await updateTaskStatus("failed", updatedVariantsCount, totalProductsCount, logsList, {
      ...failedProgress,
      failureCount,
    }).catch((updateErr) => {
      console.error(`Failed to mark task ${taskId} as failed:`, updateErr);
    });
    return { success: false, error: err.message };
  }
}
