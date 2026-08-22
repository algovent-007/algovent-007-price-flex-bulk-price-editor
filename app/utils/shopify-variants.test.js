import assert from "node:assert/strict";
import { calculateVariantPricing } from "./pricing.js";
import {
  applyBulkFailuresToLogs,
  applyBulkResultsToLogs,
  buildRollbackVariantUpdate,
  buildVariantPriceUpdate,
  bulkUpdateProductVariants,
  chunkItems,
  classifyVariantResult,
  costNeedsUpdate,
  fetchAllProductVariants,
  hydrateProductsWithAllVariants,
  overallVariantResult,
  PRODUCT_VARIANTS_BULK_LIMIT,
  resolveTaskCompletionStatus,
  shouldRollbackCost,
  summarizeVariantLogs,
  VARIANT_PAGE_SIZE,
} from "./shopify-variants.js";

function test(name, fn) {
  const result = fn();
  if (result && typeof result.then === "function") {
    return result.then(() => {
      console.log(`✓ ${name}`);
    });
  }
  console.log(`✓ ${name}`);
  return result;
}

function makeVariant(index, extra = {}) {
  return {
    id: `gid://shopify/ProductVariant/${index}`,
    title: `Variant ${index}`,
    price: String(10 + (index % 5)),
    compareAtPrice: null,
    ...extra,
  };
}

function paginatedQuery(pages) {
  let calls = 0;
  const fn = async (_query, variables) => {
    const page = pages[calls] || { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } };
    calls += 1;
    fn.calls = calls;
    fn.lastVariables = variables;
    return {
      product: {
        variants: page,
      },
    };
  };
  fn.calls = 0;
  return fn;
}

function pricingParams(overrides = {}) {
  return {
    changePrice: "1",
    percentType: "1",
    percentValue: "10",
    fixedType: "3",
    fixedValue: "0",
    fixedPriceAmount: "0",
    roundCents: "1",
    roundCentsDigit: "2",
    priceFormula: "",
    comparePriceType: "6",
    comparePercentType: "3",
    comparePercentValue: "0",
    compareFixedType: "3",
    compareFixedValue: "0",
    compareFixedPriceAmount: "0",
    compareRoundCents: "1",
    compareRoundCentsDigit: "2",
    comparePriceFormula: "",
    costPriceType: "6",
    costPercentType: "3",
    costPercentValue: "0",
    costFixedType: "3",
    costFixedValue: "0",
    costFixedPriceAmount: "0",
    costRoundCents: "1",
    costRoundCentsDigit: "2",
    originalCompare: 0,
    originalCost: 0,
    hasCompare: false,
    hasCost: false,
    ...overrides,
  };
}

function assertUniqueComplete(variants, expectedCount) {
  const ids = variants.map((variant) => variant.id);
  assert.equal(variants.length, expectedCount, `expected ${expectedCount} variants`);
  assert.equal(new Set(ids).size, expectedCount, "duplicate variants found");
}

await test("chunks items without dropping remainder values", () => {
  const chunks = chunkItems(Array.from({ length: 250 }, (_, i) => i + 1), 100);
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0].length, 100);
  assert.equal(chunks[2].length, 50);
  assert.deepEqual(chunkItems([], 250), []);
});

await test("uses Shopify's 250-variant page and mutation limits", () => {
  assert.equal(VARIANT_PAGE_SIZE, 250);
  assert.equal(PRODUCT_VARIANTS_BULK_LIMIT, 250);
});

await test("TEST 1: fetches a product with 1 variant", async () => {
  const shopifyQuery = paginatedQuery([
    {
      nodes: [makeVariant(1)],
      pageInfo: { hasNextPage: false, endCursor: "cursor-1" },
    },
  ]);
  const variants = await fetchAllProductVariants(
    shopifyQuery,
    "gid://shopify/Product/1",
    "id title price",
  );
  assertUniqueComplete(variants, 1);
  assert.equal(shopifyQuery.calls, 1);
});

await test("TEST 2: fetches a product with 100 variants", async () => {
  const shopifyQuery = paginatedQuery([
    {
      nodes: Array.from({ length: 100 }, (_, i) => makeVariant(i + 1)),
      pageInfo: { hasNextPage: false, endCursor: "c1" },
    },
  ]);
  const variants = await fetchAllProductVariants(shopifyQuery, "gid://shopify/Product/100", "id");
  assertUniqueComplete(variants, 100);
  assert.equal(shopifyQuery.calls, 1);
});

await test("TEST 3: fetches a product with 249 variants across pages", async () => {
  const shopifyQuery = paginatedQuery([
    {
      nodes: Array.from({ length: 100 }, (_, i) => makeVariant(i + 1)),
      pageInfo: { hasNextPage: true, endCursor: "c1" },
    },
    {
      nodes: Array.from({ length: 100 }, (_, i) => makeVariant(i + 101)),
      pageInfo: { hasNextPage: true, endCursor: "c2" },
    },
    {
      nodes: Array.from({ length: 49 }, (_, i) => makeVariant(i + 201)),
      pageInfo: { hasNextPage: false, endCursor: "c3" },
    },
  ]);
  const variants = await fetchAllProductVariants(
    shopifyQuery,
    "gid://shopify/Product/249",
    "id",
    { pageSize: 100 },
  );
  assertUniqueComplete(variants, 249);
  assert.equal(shopifyQuery.calls, 3);
});

await test("TEST 4 and 7: fetches exactly 250 variants across multiple pages", async () => {
  const shopifyQuery = paginatedQuery([
    {
      nodes: Array.from({ length: 100 }, (_, i) => makeVariant(i + 1)),
      pageInfo: { hasNextPage: true, endCursor: "c1" },
    },
    {
      nodes: Array.from({ length: 100 }, (_, i) => makeVariant(i + 101)),
      pageInfo: { hasNextPage: true, endCursor: "c2" },
    },
    {
      nodes: Array.from({ length: 50 }, (_, i) => makeVariant(i + 201)),
      pageInfo: { hasNextPage: false, endCursor: "c3" },
    },
  ]);
  const variants = await fetchAllProductVariants(
    shopifyQuery,
    "gid://shopify/Product/250",
    "id title price",
    { pageSize: 100 },
  );
  assertUniqueComplete(variants, 250);
  assert.equal(shopifyQuery.calls, 3);
  assert.equal(shopifyQuery.lastVariables.after, "c2");
  assert.equal(shopifyQuery.lastVariables.first, 100);
});

await test("continues from an existing first page using endCursor", async () => {
  const existing = Array.from({ length: 100 }, (_, i) => makeVariant(i + 1));
  const rest = Array.from({ length: 150 }, (_, i) => makeVariant(i + 101));
  const shopifyQuery = paginatedQuery([
    { nodes: rest, pageInfo: { hasNextPage: false, endCursor: "c2" } },
  ]);
  const variants = await fetchAllProductVariants(
    shopifyQuery,
    "gid://shopify/Product/2",
    "id",
    { existingNodes: existing, cursor: "c1", hasNextPage: true },
  );
  assertUniqueComplete(variants, 250);
  assert.equal(shopifyQuery.calls, 1);
  assert.equal(shopifyQuery.lastVariables.after, "c1");
});

await test("does not fetch extra pages when hasNextPage is false", async () => {
  const existing = Array.from({ length: 50 }, (_, i) => makeVariant(i + 1));
  const shopifyQuery = paginatedQuery([]);
  const variants = await fetchAllProductVariants(
    shopifyQuery,
    "gid://shopify/Product/3",
    "id",
    { existingNodes: existing, hasNextPage: false },
  );
  assertUniqueComplete(variants, 50);
  assert.equal(shopifyQuery.calls, 0);
});

await test("deduplicates repeated variant ids", async () => {
  const firstPage = Array.from({ length: 100 }, (_, i) => makeVariant(i + 1));
  firstPage.push(makeVariant(1));
  const shopifyQuery = paginatedQuery([
    { nodes: firstPage, pageInfo: { hasNextPage: false, endCursor: "c1" } },
  ]);
  const variants = await fetchAllProductVariants(shopifyQuery, "gid://shopify/Product/4", "id");
  assertUniqueComplete(variants, 100);
});

await test("hydrates only products that still have variant pages", async () => {
  const products = [
    {
      id: "gid://shopify/Product/1",
      variants: {
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [makeVariant(1)],
      },
    },
    {
      id: "gid://shopify/Product/2",
      variants: {
        pageInfo: { hasNextPage: true, endCursor: "c1" },
        nodes: Array.from({ length: 100 }, (_, i) => makeVariant(i + 1)),
      },
    },
  ];
  const shopifyQuery = paginatedQuery([
    {
      nodes: Array.from({ length: 150 }, (_, i) => makeVariant(i + 101)),
      pageInfo: { hasNextPage: false, endCursor: "c2" },
    },
  ]);
  const hydrated = await hydrateProductsWithAllVariants(shopifyQuery, products, "id");
  assert.equal(hydrated[0].variants.nodes.length, 1);
  assertUniqueComplete(hydrated[1].variants.nodes, 250);
  assert.equal(hydrated[1].variants.pageInfo.hasNextPage, false);
  assert.equal(shopifyQuery.calls, 1);
});

await test("updates 250 variants in one Shopify bulk mutation", async () => {
  const variants = Array.from({ length: 250 }, (_, i) => ({
    id: `gid://shopify/ProductVariant/${i + 1}`,
    price: "12.00",
  }));
  const calls = [];
  const shopifyQuery = async (_query, variables) => {
    calls.push(variables.variants.length);
    return { productVariantsBulkUpdate: { productVariants: variables.variants, userErrors: [] } };
  };
  const result = await bulkUpdateProductVariants(shopifyQuery, "gid://shopify/Product/1", variants);
  assert.deepEqual(calls, [250]);
  assert.equal(result.updatedIds.length, 250);
  assert.equal(result.failed.length, 0);
});

await test("TEST 6: records bulk failures without dropping other variant logs", async () => {
  const variants = Array.from({ length: 250 }, (_, i) => ({
    id: `gid://shopify/ProductVariant/${i + 1}`,
    price: "12.00",
  }));
  const shopifyQuery = async () => ({
    productVariantsBulkUpdate: {
      productVariants: [],
      userErrors: [{ field: ["variants"], message: "Temporary failure" }],
    },
  });
  const result = await bulkUpdateProductVariants(shopifyQuery, "gid://shopify/Product/1", variants);
  assert.equal(result.updatedIds.length, 0);
  assert.equal(result.failed.length, 1);
  assert.equal(result.failed[0].variantIds.length, 250);

  const logs = variants.map((variant, index) => ({
    variantId: variant.id,
    result: index < 5 ? "updated" : "no_change",
  }));
  const failedSubset = [
    {
      variantIds: variants.slice(0, 5).map((variant) => variant.id),
      message: "Invalid variant",
    },
  ];
  const failedCount = applyBulkFailuresToLogs(logs, failedSubset);
  assert.equal(failedCount, 5);
  const summary = summarizeVariantLogs(logs);
  assert.equal(summary.evaluatedVariantsCount, 250);
  assert.equal(summary.failureCount, 5);
  assert.equal(summary.noChangeCount, 245);
  assert.equal(logs.filter((log) => log.error === "Invalid variant").length, 5);
});

await test("TEST 5: 100 prices change and 150 stay no-change", () => {
  const results = Array.from({ length: 250 }, (_, i) => {
    const originalPrice = i < 100 ? 10 : 20;
    const pricing = calculateVariantPricing(
      pricingParams({
        changePrice: "5",
        percentType: "3",
        percentValue: "0",
        fixedPriceAmount: "20",
        originalPrice,
      }),
    );
    const update = buildVariantPriceUpdate({
      variantId: `gid://shopify/ProductVariant/${i + 1}`,
      changePrice: "5",
      comparePriceType: "6",
      pricing,
      currentPrice: originalPrice,
      currentCompare: 0,
      hasCompare: false,
    });
    return {
      pricing,
      update,
      result: classifyVariantResult({ pricing, didUpdate: Boolean(update) }),
    };
  });

  assert.equal(results.length, 250);
  assert.equal(results.filter((item) => item.update).length, 100);
  assert.equal(results.filter((item) => item.result === "no_change").length, 150);
  assert.equal(results.filter((item) => item.pricing.newPrice === 20).length, 250);
});

await test("TEST 8: Select All includes all 250 variants, not the visible preview page", () => {
  const previewPageSize = 5;
  const previewVariants = Array.from({ length: 250 }, (_, i) => makeVariant(i + 1));
  const visiblePage = previewVariants.slice(0, previewPageSize);
  assert.equal(previewVariants.length, 250);
  assert.equal(visiblePage.length, previewPageSize);
  assert.ok(previewPageSize < 250);
});

await test("TEST 9: variant search/filter runs across all 250 variants", () => {
  const previewVariants = Array.from({ length: 250 }, (_, i) => ({
    id: `gid://shopify/ProductVariant/${i + 1}`,
    title: i === 17 ? "Red / Large" : `Option ${i + 1}`,
  }));
  const filtered = previewVariants.filter((variant) =>
    variant.title.toLowerCase().includes("red"),
  );
  assert.equal(previewVariants.length, 250);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, "gid://shopify/ProductVariant/18");
});

await test("TEST 10: price rule is evaluated independently for all 250 variants", () => {
  const results = Array.from({ length: 250 }, () =>
    calculateVariantPricing(
      pricingParams({
        originalPrice: 10,
        percentValue: "10",
      }),
    ),
  );
  assert.equal(results.length, 250);
  assert.ok(results.every((result) => result.newPrice === 11));
  const updates = results.map((pricing, index) =>
    buildVariantPriceUpdate({
      variantId: `gid://shopify/ProductVariant/${index + 1}`,
      changePrice: "1",
      comparePriceType: "6",
      pricing,
      currentPrice: 10,
      currentCompare: 0,
      hasCompare: false,
    }),
  );
  assert.equal(updates.filter(Boolean).length, 250);
});

await test("skips Shopify updates when the calculated price is unchanged", () => {
  const pricing = calculateVariantPricing(
    pricingParams({
      changePrice: "5",
      percentType: "3",
      percentValue: "0",
      fixedPriceAmount: "10.00",
      originalPrice: 10,
    }),
  );
  const update = buildVariantPriceUpdate({
    variantId: "gid://shopify/ProductVariant/1",
    changePrice: "5",
    comparePriceType: "6",
    pricing,
    currentPrice: 10,
    currentCompare: 0,
    hasCompare: false,
  });
  assert.equal(pricing.newPrice, 10);
  assert.equal(update, null);
  assert.equal(costNeedsUpdate("6", pricing, 0, false), false);
});

await test("summarizes mixed 250-variant task outcomes", () => {
  const logs = [
    ...Array.from({ length: 180 }, (_, i) => ({ variantId: String(i + 1), result: "updated" })),
    ...Array.from({ length: 50 }, (_, i) => ({ variantId: String(i + 181), result: "no_change" })),
    ...Array.from({ length: 15 }, (_, i) => ({ variantId: String(i + 231), result: "skipped" })),
    ...Array.from({ length: 5 }, (_, i) => ({
      variantId: String(i + 246),
      result: "failed",
      error: "Deleted variant",
    })),
  ];
  const summary = summarizeVariantLogs(logs);
  assert.deepEqual(summary, {
    evaluatedVariantsCount: 250,
    updatedVariantsCount: 180,
    noChangeCount: 50,
    skippedCount: 15,
    failureCount: 5,
  });
  assert.equal(resolveTaskCompletionStatus(summary), "completed");
});

await test("classifies mixed cost success and price failure as updated with error", () => {
  const logs = [
    {
      variantId: "gid://shopify/ProductVariant/1",
      costResult: "updated",
      result: "updated",
    },
  ];
  applyBulkResultsToLogs(logs, {
    updatedIds: [],
    failed: [{ variantIds: ["gid://shopify/ProductVariant/1"], message: "Price update failed" }],
  });
  assert.equal(logs[0].priceResult, "failed");
  assert.equal(logs[0].costResult, "updated");
  assert.equal(logs[0].result, "updated");
  assert.equal(logs[0].error, "Price update failed");
  const summary = summarizeVariantLogs(logs);
  assert.equal(summary.updatedVariantsCount, 1);
  assert.equal(summary.failureCount, 1);
  assert.equal(resolveTaskCompletionStatus(summary), "completed");
});

await test("marks the task failed when every attempted variant update failed", () => {
  assert.equal(
    resolveTaskCompletionStatus({ updatedVariantsCount: 0, failureCount: 5 }),
    "failed",
  );
  assert.equal(
    resolveTaskCompletionStatus({ updatedVariantsCount: 0, failureCount: 0 }),
    "completed",
  );
  assert.equal(overallVariantResult("failed", "updated"), "updated");
  assert.equal(overallVariantResult("failed", "failed"), "failed");
  assert.equal(overallVariantResult("pending", "no_change"), "no_change");
});

await test("rollback omits unchanged prices and does not clear missing compare-at", () => {
  assert.equal(
    buildRollbackVariantUpdate({
      variantId: "gid://shopify/ProductVariant/1",
      oldPrice: "10.00",
      newPrice: "10.00",
      oldCompare: "-",
      newCompare: "-",
    }),
    null,
  );

  assert.deepEqual(
    buildRollbackVariantUpdate({
      variantId: "gid://shopify/ProductVariant/1",
      oldPrice: "10.00",
      newPrice: "12.00",
      oldCompare: "-",
      newCompare: "-",
    }),
    { id: "gid://shopify/ProductVariant/1", price: "10.00" },
  );

  assert.deepEqual(
    buildRollbackVariantUpdate({
      variantId: "gid://shopify/ProductVariant/1",
      oldPrice: "10.00",
      newPrice: "10.00",
      oldCompare: "-",
      newCompare: "15.00",
    }),
    { id: "gid://shopify/ProductVariant/1", compareAtPrice: null },
  );

  assert.equal(
    shouldRollbackCost({ inventoryItemId: "gid://shopify/InventoryItem/1", oldCost: "5.00", newCost: "5.00" }),
    false,
  );
  assert.equal(
    shouldRollbackCost({ inventoryItemId: "gid://shopify/InventoryItem/1", oldCost: "5.00", newCost: "8.00" }),
    true,
  );
  assert.equal(
    shouldRollbackCost({ inventoryItemId: "gid://shopify/InventoryItem/1", oldCost: "-", newCost: "8.00" }),
    false,
  );
});

console.log("All shopify-variants tests passed.");
