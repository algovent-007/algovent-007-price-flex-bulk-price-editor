import assert from "node:assert/strict";
import {
  CSV_BULK_EDIT_MAX_ROWS,
  normalizeVariantId,
  parseCsvAllRows,
  parseCsvDirectRows,
  parseCsvText,
  validateCsvRowsForRun,
} from "./csv-bulk-edit.js";

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

test("parseCsvText strips BOM and parses quoted cells", () => {
  const { headers, rows } = parseCsvText('\uFEFFVariant ID,SKU\n123,"sample, sku"');
  assert.deepEqual(headers, ["Variant ID", "SKU"]);
  assert.equal(rows[0]["Variant ID"], "123");
  assert.equal(rows[0].SKU, "sample, sku");
});

test("normalizeVariantId accepts numeric IDs and GIDs", () => {
  assert.equal(normalizeVariantId("40123456789012"), "gid://shopify/ProductVariant/40123456789012");
  assert.equal(
    normalizeVariantId("gid://shopify/ProductVariant/99"),
    "gid://shopify/ProductVariant/99",
  );
  assert.equal(normalizeVariantId("not-an-id"), null);
});

test("parseCsvAllRows requires variant id or sku", () => {
  const result = parseCsvAllRows("Variant ID,SKU\n,\n");
  assert.equal(result.rows.length, 0);
  assert.match(result.errors[0], /Row 2/);
});

test("parseCsvDirectRows rejects rows with no price updates", () => {
  const result = parseCsvDirectRows("Variant ID,SKU,New price\n123,sample,\n");
  assert.equal(result.rows.length, 0);
  assert.match(result.errors[0], /must include at least one new price value/);
});

test("parseCsvDirectRows accepts partial price updates", () => {
  const result = parseCsvDirectRows("Variant ID,SKU,New price,New compare-at price\n123,sample,19.99,\n");
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].newPrice, 19.99);
  assert.equal(result.rows[0].newCompare, undefined);
});

test("parseCsvDirectRows treats dash as explicit compare-at clear", () => {
  const result = parseCsvDirectRows("Variant ID,New compare-at price\n123,-\n");
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].newCompare, null);
});

test("parseCsvAllRows enforces row limit", () => {
  const lines = ["Variant ID", ...Array(CSV_BULK_EDIT_MAX_ROWS + 1).fill("123")];
  const result = parseCsvAllRows(lines.join("\n"));
  assert.equal(result.rows.length, CSV_BULK_EDIT_MAX_ROWS);
  assert.match(result.errors[0], /limited to/);
});

test("validateCsvRowsForRun rejects tampered payloads", () => {
  const tooManyRows = Array(CSV_BULK_EDIT_MAX_ROWS + 1).fill({ variantId: "gid://shopify/ProductVariant/1" });
  const tooMany = validateCsvRowsForRun(tooManyRows, "csv-all");
  assert.equal(tooMany.valid, false);

  const missingPrices = validateCsvRowsForRun([{ variantId: "gid://shopify/ProductVariant/1" }], "csv-direct");
  assert.equal(missingPrices.valid, false);
});

console.log("All csv-bulk-edit tests passed.");
