import prisma from "../db.server";
import { calculateVariantPricing, formatPrice } from "../utils/pricing";
import {
  buildProductQuery,
  filterProductsByConditions,
  PRODUCT_CONDITION_FIELDS,
  PRODUCT_CONDITION_VARIANT_FIELDS,
} from "../utils/product-conditions";

export { buildProductQuery, filterProductsByConditions };

const PRODUCTS_PAGE_SIZE = 50;

export const SEARCH_PRODUCT_FIELDS = `
  id
  ${PRODUCT_CONDITION_FIELDS}
  featuredImage {
    url
  }
  variants(first: 100) {
    nodes {
      ${PRODUCT_CONDITION_VARIANT_FIELDS}
      image {
        url
      }
    }
  }
`;

export const TASK_PRODUCT_FIELDS = `
  id
  ${PRODUCT_CONDITION_FIELDS}
  variants(first: 100) {
    nodes {
      ${PRODUCT_CONDITION_VARIANT_FIELDS}
    }
  }
`;

export async function fetchProductsByQuery(
  shopifyQuery,
  queryStr,
  fieldsFragment,
  { maxProducts } = {}
) {
  const products = [];
  let cursor = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const pageSize =
      maxProducts != null
        ? Math.min(PRODUCTS_PAGE_SIZE, maxProducts - products.length)
        : PRODUCTS_PAGE_SIZE;

    if (pageSize <= 0) break;

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
        first: pageSize,
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

export async function executePriceEditTask({ admin, taskId, runPayload }) {
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
    priceFormula,
    comparePriceType,
    comparePercentType,
    comparePercentValue,
    compareFixedType,
    compareFixedValue,
    compareFixedPriceAmount,
    compareRoundCents,
    comparePriceFormula,
    costPriceType,
    costPercentType,
    costPercentValue,
    costFixedType,
    costFixedValue,
    costFixedPriceAmount,
    costRoundCents,
    tagsToAddList = [],
    tagsToRemoveList = [],
  } = runPayload;

  const logsList = [];
  const productIdsList = [];
  let updatedVariantsCount = 0;
  let updatedProductsCount = 0;
  let totalProductsCount = 0;

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
      ...extra,
    });

  const updateTaskStatus = async (status, processed = 0, total = 0, logs = null, extra = {}) => {
    const updateData = { status, processedItems: processed, totalItems: total };
    if (logs) {
      updateData.actionDetails = buildActionDetails(logs, extra);
    }
    await prisma.task.update({
      where: { id: taskId },
      data: updateData,
    });
  };

  await prisma.task.update({
    where: { id: taskId },
    data: { status: "running" },
  });

  const queryStr = buildProductQuery(editType, matchType, conditionsStr, collectionId);

  try {
    const fetchedProducts = await fetchProductsByQuery(
      shopifyQuery,
      queryStr,
      TASK_PRODUCT_FIELDS
    );

    const products = filterProductsByConditions(
      fetchedProducts,
      editType,
      matchType,
      conditionsStr
    );
    totalProductsCount = products.length;

    const buildProgressMeta = (error = null, failureCount = 0) => ({
      processedProductsCount: productIdsList.length,
      updatedProductsCount,
      updatedVariantsCount,
      successCount: updatedVariantsCount,
      failureCount,
      ...(error ? { error } : {}),
    });

    await updateTaskStatus("running", 0, totalProductsCount, [], {
      processedProductsCount: 0,
      updatedProductsCount: 0,
      updatedVariantsCount: 0,
      successCount: 0,
      failureCount: 0,
    });

    for (const prod of products) {
      let productUpdated = false;
      productIdsList.push(prod.id);

      const variants = prod.variants?.nodes || [];
      const variantsToUpdate = [];

      for (const variant of variants) {
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
          priceFormula,
          comparePriceType,
          comparePercentType,
          comparePercentValue,
          compareFixedType,
          compareFixedValue,
          compareFixedPriceAmount,
          compareRoundCents,
          comparePriceFormula,
          costPriceType,
          costPercentType,
          costPercentValue,
          costFixedType,
          costFixedValue,
          costFixedPriceAmount,
          costRoundCents,
          originalPrice: currentPrice,
          originalCompare: currentCompare,
          originalCost: currentCost,
          hasCompare,
          hasCost,
        });

        const newPrice = pricing.newPrice;
        const newCompare = pricing.newCompare;
        const newCost = pricing.newCost;

        const priceUpdate =
          changePrice !== "6" && !pricing.priceSkipped ? { price: formatPrice(newPrice) } : {};
        const compareUpdate =
          comparePriceType !== "6" && !pricing.compareSkipped
            ? { compareAtPrice: newCompare !== null ? formatPrice(newCompare) : null }
            : {};

        if (Object.keys(priceUpdate).length > 0 || Object.keys(compareUpdate).length > 0) {
          variantsToUpdate.push({
            id: variant.id,
            ...priceUpdate,
            ...compareUpdate,
          });
        }

        if (costPriceType !== "6" && !pricing.costSkipped && variant.inventoryItem?.id) {
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
            const error = invErrors[0].message;
            await updateTaskStatus("failed", updatedVariantsCount, totalProductsCount, logsList, buildProgressMeta(error, 1));
            return { success: false, error };
          }
          productUpdated = true;
          updatedVariantsCount++;
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
          });
        }
      }

      if (variantsToUpdate.length > 0) {
        const bulkData = await shopifyQuery(
          `#graphql
          mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
            productVariantsBulkUpdate(productId: $productId, variants: $variants) {
              productVariants { id }
              userErrors { field message }
            }
          }`,
          { productId: prod.id, variants: variantsToUpdate }
        );

        const bulkErrors = bulkData.productVariantsBulkUpdate?.userErrors || [];
        if (bulkErrors.length > 0) {
          const error = bulkErrors[0].message;
          await updateTaskStatus("failed", updatedVariantsCount, totalProductsCount, logsList, buildProgressMeta(error, 1));
          return { success: false, error };
        }
        productUpdated = true;
        updatedVariantsCount += variantsToUpdate.length;
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
          await updateTaskStatus("failed", updatedVariantsCount, totalProductsCount, logsList, buildProgressMeta(error, 1));
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
          await updateTaskStatus("failed", updatedVariantsCount, totalProductsCount, logsList, buildProgressMeta(error, 1));
          return { success: false, error };
        }
        productUpdated = true;
      }

      if (productUpdated) {
        updatedProductsCount++;
      }

      await updateTaskStatus("running", updatedVariantsCount, totalProductsCount, logsList, {
        processedProductsCount: productIdsList.length,
        updatedProductsCount,
        updatedVariantsCount,
        successCount: updatedVariantsCount,
        failureCount: 0,
      });
    }

    await updateTaskStatus("completed", updatedVariantsCount, totalProductsCount, logsList, {
      processedProductsCount: totalProductsCount,
      updatedProductsCount,
      updatedVariantsCount,
      successCount: updatedVariantsCount,
      failureCount: 0,
    });

    return {
      success: true,
      updatedProductsCount,
      updatedVariantsCount,
      logsList,
      productIdsList,
    };
  } catch (err) {
    console.error("Error executing task on Shopify:", err);
    await updateTaskStatus("failed", updatedVariantsCount, totalProductsCount, logsList, {
      processedProductsCount: productIdsList.length,
      updatedProductsCount,
      updatedVariantsCount,
      successCount: updatedVariantsCount,
      failureCount: 1,
      error: err.message,
    });
    return { success: false, error: err.message };
  }
}
