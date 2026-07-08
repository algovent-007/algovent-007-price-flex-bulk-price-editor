import prisma from "../db.server";
import { calculateVariantPricing, formatPrice } from "../utils/pricing";

function parseConditions(conditionsStr) {
  if (!conditionsStr) return [];

  try {
    const parsed = JSON.parse(conditionsStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Error parsing conditions:", e);
    return [];
  }
}

function normalizeConditionValue(value) {
  return String(value ?? "").trim().toLowerCase();
}

function matchesTitleCondition(title, condition) {
  const normalizedTitle = normalizeConditionValue(title);
  const value = normalizeConditionValue(condition.value);

  if (!value) return true;

  if (condition.operator === "not_equals") return normalizedTitle !== value;
  if (condition.operator === "contains") return normalizedTitle.includes(value);
  if (condition.operator === "starts_with") return normalizedTitle.startsWith(value);
  if (condition.operator === "ends_with") return normalizedTitle.endsWith(value);

  return normalizedTitle === value;
}

export function filterProductsByConditions(products, editType, matchType, conditionsStr) {
  if (editType !== "conditions") return products;

  const conditions = parseConditions(conditionsStr).filter((condition) =>
    String(condition.value ?? "").trim()
  );
  const titleConditions = conditions.filter((condition) => condition.field === "title");

  if (titleConditions.length === 0) return products;

  // For mixed "any" groups, Shopify handles the OR query. Local filtering would incorrectly
  // remove products that matched a non-title condition.
  if (matchType === "any" && titleConditions.length !== conditions.length) {
    return products;
  }

  return products.filter((product) => {
    const matches = titleConditions.map((condition) =>
      matchesTitleCondition(product.title, condition)
    );

    return matchType === "any" ? matches.some(Boolean) : matches.every(Boolean);
  });
}

export function buildProductQuery(editType, matchType, conditionsStr, collectionId) {
  if (editType === "collection" && collectionId) {
    const numericId = String(collectionId).split("/").pop();
    return `collection_id:${numericId}`;
  }

  if (editType !== "conditions" || !conditionsStr) {
    return "";
  }

  try {
    const conditions = parseConditions(conditionsStr);
    const parts = [];

    for (const cond of conditions) {
      const field = cond.field;
      const operator = cond.operator;
      const value = (cond.value || "").trim();
      if (!value) continue;

      let shopifyField = field;
      if (field === "title") shopifyField = "title";
      else if (field === "type") shopifyField = "product_type";
      else if (field === "vendor") shopifyField = "vendor";
      else if (field === "tag") shopifyField = "tag";
      else if (field === "status") shopifyField = "status";

      if (field === "title" && operator === "not_equals") {
        continue;
      }

      let part = "";
      if (operator === "equals") part = `${shopifyField}:${value}`;
      else if (operator === "not_equals") part = `NOT ${shopifyField}:${value}`;
      else if (operator === "contains") part = `${shopifyField}:${value}`;
      else if (operator === "starts_with") part = `${shopifyField}:${value}*`;
      else if (operator === "ends_with") part = `${shopifyField}:${value}`;
      else part = `${shopifyField}:${value}`;

      parts.push(part);
    }

    if (parts.length > 0) {
      const joiner = matchType === "any" ? " OR " : " AND ";
      return parts.join(joiner);
    }
  } catch (e) {
    console.error("Error parsing conditions:", e);
  }

  return "";
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
    const data = await shopifyQuery(
      `#graphql
      query getProducts($query: String) {
        products(first: 50, query: $query) {
          nodes {
            id
            title
            tags
            variants(first: 100) {
              nodes {
                id
                title
                price
                compareAtPrice
                inventoryItem {
                  id
                  unitCost {
                    amount
                  }
                }
              }
            }
          }
        }
      }`,
      { query: queryStr || null }
    );

    const products = filterProductsByConditions(
      data.products?.nodes || [],
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
