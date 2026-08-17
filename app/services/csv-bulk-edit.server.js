import prisma from "../db.server";
import { calculateVariantPricing, formatPrice } from "../utils/pricing";
import { attachProductTagChanges } from "../utils/task-log-display";
import { normalizeVariantId } from "../utils/csv-bulk-edit";
import { notifyTaskFinishedIfEnabled } from "./task-finished-email.server";

const VARIANTS_BY_IDS_QUERY = `#graphql
  query VariantsByIds($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on ProductVariant {
        id
        title
        sku
        price
        compareAtPrice
        image {
          url
        }
        product {
          id
          title
          featuredImage {
            url
          }
        }
        inventoryItem {
          id
          unitCost {
            amount
          }
        }
      }
    }
  }
`;

const VARIANTS_BY_SKU_QUERY = `#graphql
  query VariantsBySkus($query: String!, $first: Int!) {
    productVariants(first: $first, query: $query) {
      nodes {
        id
        title
        sku
        price
        compareAtPrice
        image {
          url
        }
        product {
          id
          title
          featuredImage {
            url
          }
        }
        inventoryItem {
          id
          unitCost {
            amount
          }
        }
      }
    }
  }
`;

const SKU_LOOKUP_BATCH_SIZE = 40;

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function escapeSearchValue(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function groupVariantsByProduct(variants) {
  const products = new Map();

  for (const variant of variants) {
    if (!variant?.product?.id) continue;

    if (!products.has(variant.product.id)) {
      products.set(variant.product.id, {
        id: variant.product.id,
        title: variant.product.title,
        featuredImage: variant.product.featuredImage,
        variants: {
          pageInfo: { hasNextPage: false },
          nodes: [],
        },
      });
    }

    products.get(variant.product.id).variants.nodes.push({
      id: variant.id,
      title: variant.title,
      sku: variant.sku,
      price: variant.price,
      compareAtPrice: variant.compareAtPrice,
      image: variant.image,
      inventoryItem: variant.inventoryItem,
    });
  }

  return [...products.values()];
}

async function fetchVariantsByIds(shopifyQuery, ids) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  const variants = [];

  for (const chunk of chunkArray(uniqueIds, 250)) {
    const data = await shopifyQuery(VARIANTS_BY_IDS_QUERY, { ids: chunk });
    for (const node of data.nodes || []) {
      if (node?.id) variants.push(node);
    }
  }

  return variants;
}

async function fetchVariantsBySkus(shopifyQuery, skus) {
  const uniqueSkus = [...new Set(skus.map((sku) => String(sku || "").trim()).filter(Boolean))];
  const variantsBySku = new Map();
  const warnings = [];

  for (const chunk of chunkArray(uniqueSkus, SKU_LOOKUP_BATCH_SIZE)) {
    const query = chunk.map((sku) => `sku:"${escapeSearchValue(sku)}"`).join(" OR ");
    const data = await shopifyQuery(VARIANTS_BY_SKU_QUERY, {
      query,
      first: Math.min(250, chunk.length * 2),
    });

    const matchesBySku = new Map();
    for (const node of data.productVariants?.nodes || []) {
      if (!node?.id) continue;

      const nodeSku = String(node.sku || "").trim().toLowerCase();
      if (!nodeSku) continue;

      const requestedSku = chunk.find((sku) => String(sku).trim().toLowerCase() === nodeSku);
      if (!requestedSku) continue;

      const skuKey = String(requestedSku).trim().toLowerCase();
      const existing = matchesBySku.get(skuKey);
      if (existing && existing.id !== node.id) {
        warnings.push(`SKU "${requestedSku}" matched multiple variants; using the first match.`);
        continue;
      }

      matchesBySku.set(skuKey, node);
    }

    for (const [skuKey, variant] of matchesBySku) {
      variantsBySku.set(skuKey, variant);
    }
  }

  return {
    variants: [...variantsBySku.values()],
    warnings,
  };
}

export async function resolveCsvRowsToProducts(shopifyQuery, csvRows = []) {
  const ids = csvRows.map((row) => row.variantId || normalizeVariantId(row.variantId)).filter(Boolean);
  const skus = csvRows.filter((row) => !row.variantId).map((row) => row.sku).filter(Boolean);

  const variantsById = await fetchVariantsByIds(shopifyQuery, ids);
  const foundIds = new Set(variantsById.map((variant) => variant.id));
  const missingSkuRows = csvRows.filter((row) => {
    if (row.variantId && foundIds.has(row.variantId)) return false;
    return !!row.sku;
  });
  const variantsBySku = await fetchVariantsBySkus(
    shopifyQuery,
    missingSkuRows.map((row) => row.sku),
  );

  const variants = new Map();
  for (const variant of [...variantsById, ...variantsBySku.variants]) {
    variants.set(variant.id, variant);
  }

  const orderedVariants = [];
  const warnings = [...variantsBySku.warnings];
  const seenVariantIds = new Set();

  for (const row of csvRows) {
    let variant = row.variantId ? variants.get(row.variantId) : null;
    if (!variant && row.sku) {
      variant = [...variants.values()].find(
        (entry) => String(entry.sku || "").toLowerCase() === String(row.sku).toLowerCase(),
      );
    }

    if (!variant) {
      warnings.push(
        `Could not find variant ${row.variantId || row.sku || "from CSV"}.`,
      );
      continue;
    }

    if (seenVariantIds.has(variant.id)) {
      warnings.push(
        `Duplicate row for variant ${row.variantId || row.sku || variant.id}; using first occurrence.`,
      );
      continue;
    }

    seenVariantIds.add(variant.id);
    orderedVariants.push(variant);
  }

  return {
    products: groupVariantsByProduct(orderedVariants),
    warnings,
    resolvedVariantCount: orderedVariants.length,
  };
}

function buildDirectVariantUpdate(variant, row) {
  const update = { id: variant.id };
  let hasUpdate = false;

  if (typeof row.newPrice === "number") {
    update.price = formatPrice(row.newPrice);
    hasUpdate = true;
  }

  if (row.newCompare !== undefined) {
    update.compareAtPrice = row.newCompare === null ? null : formatPrice(row.newCompare);
    hasUpdate = true;
  }

  return { update, hasUpdate, costUpdate: row.newCost };
}

export async function executeCsvPriceEditTask({ admin, taskId, runPayload }) {
  const shopifyQuery = async (query, variables = {}) => {
    const response = await admin.graphql(query, { variables });
    const json = await response.json();
    if (json.errors) {
      throw new Error(json.errors[0].message);
    }
    return json.data;
  };

  const csvRows = Array.isArray(runPayload.csvRows) ? runPayload.csvRows : [];
  const isDirect = runPayload.editType === "csv-direct";

  const logsList = [];
  const warningsList = [];
  const productIdsList = [];
  let updatedVariantsCount = 0;
  let updatedProductsCount = 0;

  const buildActionDetails = (logs, extra = {}, { includeRunPayload = false } = {}) =>
    JSON.stringify({
      taskType: "price_edit",
      editType: runPayload.editType,
      csvFileName: runPayload.csvFileName || null,
      csvRowCount: csvRows.length,
      changePrice: runPayload.changePrice,
      priceFormula: runPayload.priceFormula,
      comparePriceFormula: runPayload.comparePriceFormula,
      ...(includeRunPayload ? { runPayload } : {}),
      tagsToAdd: runPayload.tagsToAddList || [],
      tagsToRemove: runPayload.tagsToRemoveList || [],
      productIds: productIdsList,
      logs,
      warnings: warningsList,
      ...extra,
    });

  const updateTaskStatus = async (
    status,
    processed = 0,
    total = 0,
    logs = null,
    extra = {},
    options = {},
  ) => {
    const updateData = { status, processedItems: processed, totalItems: total };
    if (logs !== null) {
      updateData.actionDetails = buildActionDetails(logs, extra, options);
    }
    await prisma.task.update({
      where: { id: taskId },
      data: updateData,
    });

    if (status === "completed" || status === "failed") {
      void notifyTaskFinishedIfEnabled(taskId).catch((error) => {
        console.error(`Failed to send task finished email for ${taskId}:`, error);
      });
    }
  };

  await prisma.task.update({
    where: { id: taskId },
    data: { status: "running" },
  });

  if (csvRows.length === 0) {
    await updateTaskStatus("failed", 0, 0, [], { error: "No CSV rows were provided." });
    return { success: false, error: "No CSV rows were provided." };
  }

  try {
    const { products, warnings, resolvedVariantCount } = await resolveCsvRowsToProducts(
      shopifyQuery,
      csvRows,
    );
    warningsList.push(...warnings);

    if (resolvedVariantCount === 0) {
      await updateTaskStatus("failed", 0, csvRows.length, logsList, {
        error: "No matching variants were found in Shopify for the uploaded CSV.",
      });
      return { success: false, error: "No matching variants were found in Shopify for the uploaded CSV." };
    }

    const rowByVariantId = new Map();
    for (const row of csvRows) {
      if (row.variantId) rowByVariantId.set(row.variantId, row);
    }

    await updateTaskStatus("running", 0, resolvedVariantCount, [], {
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
      const updatedVariantIds = new Set();

      for (const variant of variants) {
        const row = rowByVariantId.get(variant.id) || csvRows.find((entry) => {
          if (entry.variantId && entry.variantId === variant.id) return true;
          return entry.sku && String(entry.sku).toLowerCase() === String(variant.sku || "").toLowerCase();
        });

        if (!row) continue;

        const hasCompare = variant.compareAtPrice != null && variant.compareAtPrice !== "";
        const hasCost =
          variant.inventoryItem?.unitCost?.amount != null &&
          variant.inventoryItem.unitCost.amount !== "";
        const currentPrice = parseFloat(variant.price) || 0;
        const currentCompare = hasCompare ? parseFloat(variant.compareAtPrice) || 0 : 0;
        const currentCost = hasCost ? parseFloat(variant.inventoryItem.unitCost.amount) || 0 : 0;

        let newPrice = currentPrice;
        let newCompare = hasCompare ? currentCompare : null;
        let newCost = currentCost;

        if (isDirect) {
          const directUpdate = buildDirectVariantUpdate(variant, row);
          if (directUpdate.hasUpdate) {
            variantsToUpdate.push(directUpdate.update);
          }
          if (directUpdate.costUpdate !== undefined && variant.inventoryItem?.id) {
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
                input: {
                  cost: directUpdate.costUpdate === null ? null : formatPrice(directUpdate.costUpdate ?? 0),
                },
              },
            );

            const invErrors = invData.inventoryItemUpdate?.userErrors || [];
            if (invErrors.length > 0) {
              throw new Error(invErrors[0].message);
            }
            productUpdated = true;
            updatedVariantIds.add(variant.id);
            newCost = directUpdate.costUpdate ?? 0;
          }

          if (row.newPrice !== undefined) newPrice = row.newPrice;
          if (row.newCompare !== undefined) newCompare = row.newCompare;
          if (row.newCost !== undefined) newCost = row.newCost ?? 0;
        } else {
          const pricing = calculateVariantPricing({
            changePrice: runPayload.changePrice,
            percentType: runPayload.percentType,
            percentValue: runPayload.percentValue,
            fixedType: runPayload.fixedType,
            fixedValue: runPayload.fixedValue,
            fixedPriceAmount: runPayload.fixedPriceAmount,
            roundCents: runPayload.roundCents,
            roundCentsDigit: runPayload.roundCentsDigit,
            priceFormula: runPayload.priceFormula,
            comparePriceType: runPayload.comparePriceType,
            comparePercentType: runPayload.comparePercentType,
            comparePercentValue: runPayload.comparePercentValue,
            compareFixedType: runPayload.compareFixedType,
            compareFixedValue: runPayload.compareFixedValue,
            compareFixedPriceAmount: runPayload.compareFixedPriceAmount,
            compareRoundCents: runPayload.compareRoundCents,
            compareRoundCentsDigit: runPayload.compareRoundCentsDigit,
            comparePriceFormula: runPayload.comparePriceFormula,
            costPriceType: runPayload.costPriceType,
            costPercentType: runPayload.costPercentType,
            costPercentValue: runPayload.costPercentValue,
            costFixedType: runPayload.costFixedType,
            costFixedValue: runPayload.costFixedValue,
            costFixedPriceAmount: runPayload.costFixedPriceAmount,
            costRoundCents: runPayload.costRoundCents,
            costRoundCentsDigit: runPayload.costRoundCentsDigit,
            originalPrice: currentPrice,
            originalCompare: currentCompare,
            originalCost: currentCost,
            hasCompare,
            hasCost,
          });

          newPrice = pricing.newPrice;
          newCompare = pricing.newCompare;
          newCost = pricing.newCost;

          const priceUpdate =
            runPayload.changePrice !== "6" && !pricing.priceSkipped
              ? { price: formatPrice(newPrice) }
              : {};
          const compareUpdate =
            runPayload.comparePriceType !== "6" && !pricing.compareSkipped
              ? { compareAtPrice: newCompare !== null ? formatPrice(newCompare) : null }
              : {};

          if (Object.keys(priceUpdate).length > 0 || Object.keys(compareUpdate).length > 0) {
            variantsToUpdate.push({
              id: variant.id,
              ...priceUpdate,
              ...compareUpdate,
            });
          }

          if (runPayload.costPriceType !== "6" && !pricing.costSkipped && variant.inventoryItem?.id) {
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
              },
            );

            const invErrors = invData.inventoryItemUpdate?.userErrors || [];
            if (invErrors.length > 0) {
              throw new Error(invErrors[0].message);
            }
            productUpdated = true;
            updatedVariantIds.add(variant.id);
          }
        }

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
          newCost: hasCost || row.newCost !== undefined ? formatPrice(newCost) : "-",
        });
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
          { productId: prod.id, variants: variantsToUpdate },
        );

        const bulkErrors = bulkData.productVariantsBulkUpdate?.userErrors || [];
        if (bulkErrors.length > 0) {
          throw new Error(bulkErrors[0].message);
        }
        productUpdated = true;
        for (const variantUpdate of variantsToUpdate) {
          updatedVariantIds.add(variantUpdate.id);
        }
      }

      updatedVariantsCount += updatedVariantIds.size;

      const tagsToAddList = runPayload.tagsToAddList || [];
      const tagsToRemoveList = runPayload.tagsToRemoveList || [];

      if (tagsToAddList.length > 0) {
        const tagData = await shopifyQuery(
          `#graphql
          mutation tagsAdd($id: ID!, $tags: [String!]!) {
            tagsAdd(id: $id, tags: $tags) {
              userErrors { field message }
            }
          }`,
          { id: prod.id, tags: tagsToAddList },
        );

        const tagErrors = tagData.tagsAdd?.userErrors || [];
        if (tagErrors.length > 0) {
          throw new Error(tagErrors[0].message);
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
          { id: prod.id, tags: tagsToRemoveList },
        );

        const tagErrors = tagData.tagsRemove?.userErrors || [];
        if (tagErrors.length > 0) {
          throw new Error(tagErrors[0].message);
        }
        productUpdated = true;
      }

      if (tagsToAddList.length > 0 || tagsToRemoveList.length > 0) {
        attachProductTagChanges(logsList, prod.id, tagsToAddList, tagsToRemoveList);
      }

      if (productUpdated) {
        updatedProductsCount += 1;
      }

      await updateTaskStatus("running", updatedVariantsCount, resolvedVariantCount, logsList, {
        processedProductsCount: productIdsList.length,
        updatedProductsCount,
        updatedVariantsCount,
        successCount: updatedVariantsCount,
        failureCount: 0,
      });
    }

    await updateTaskStatus(
      "completed",
      updatedVariantsCount,
      resolvedVariantCount,
      logsList,
      {
        processedProductsCount: productIdsList.length,
        updatedProductsCount,
        updatedVariantsCount,
        successCount: updatedVariantsCount,
        failureCount: 0,
      },
      { includeRunPayload: true },
    );

    return {
      success: true,
      updatedProductsCount,
      updatedVariantsCount,
      logsList,
      productIdsList,
      warningsList,
    };
  } catch (err) {
    console.error("Error executing CSV task on Shopify:", err);
    await updateTaskStatus(
      "failed",
      updatedVariantsCount,
      csvRows.length,
      logsList,
      {
        processedProductsCount: productIdsList.length,
        updatedProductsCount,
        updatedVariantsCount,
        successCount: updatedVariantsCount,
        failureCount: 1,
        error: err.message,
      },
      { includeRunPayload: true },
    );
    return { success: false, error: err.message };
  }
}
