const VARIANT_ID_HEADERS = ["variant id", "variant_id", "variantid"];
const SKU_HEADERS = ["sku"];
const NEW_PRICE_HEADERS = ["new price", "new_price", "newprice"];
const NEW_COMPARE_HEADERS = [
  "new compare-at price",
  "new compare at price",
  "new compare price",
  "new_compare_at_price",
  "new_compare_price",
  "compare-at price",
  "compare at price",
];
const NEW_COST_HEADERS = ["new cost price", "new cost", "new_cost_price", "new_cost", "cost price"];

export const CSV_BULK_EDIT_MAX_ROWS = 2000;

function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function findHeaderIndex(headers, candidates) {
  const normalized = headers.map(normalizeHeader);
  for (const candidate of candidates) {
    const index = normalized.indexOf(candidate);
    if (index >= 0) return index;
  }
  return -1;
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells.map((cell) => cell.trim());
}

export function parseCsvText(text) {
  const lines = String(text ?? "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? "";
    });
    return row;
  });

  return { headers, rows };
}

export function normalizeVariantId(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("gid://shopify/ProductVariant/")) {
    return trimmed;
  }

  if (/^\d+$/.test(trimmed)) {
    return `gid://shopify/ProductVariant/${trimmed}`;
  }

  return null;
}

function getCell(row, headers, candidates) {
  const index = findHeaderIndex(headers, candidates);
  if (index < 0) return "";
  const header = headers[index];
  return String(row[header] ?? "").trim();
}

function parseNullablePrice(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return { provided: false };
  }

  if (trimmed === "-" || trimmed.toLowerCase() === "null") {
    return { provided: true, value: null };
  }

  const cleaned = trimmed.replace(/[^\d.-]/g, "");
  if (!cleaned) {
    return { provided: true, value: null, invalid: true };
  }

  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) {
    return { provided: true, value: null, invalid: true };
  }

  return { provided: true, value: parsed };
}

export function parseCsvAllRows(text) {
  const { headers, rows } = parseCsvText(text);
  const errors = [];
  const parsedRows = [];

  if (rows.length === 0) {
    errors.push("CSV file must include a header row and at least one data row.");
    return { rows: [], errors };
  }

  const variantIdIndex = findHeaderIndex(headers, VARIANT_ID_HEADERS);
  const skuIndex = findHeaderIndex(headers, SKU_HEADERS);

  if (variantIdIndex < 0 && skuIndex < 0) {
    errors.push('CSV must include a "Variant ID" or "SKU" column.');
    return { rows: [], errors };
  }

  rows.forEach((row, index) => {
    const variantId = variantIdIndex >= 0 ? normalizeVariantId(getCell(row, headers, VARIANT_ID_HEADERS)) : null;
    const sku = skuIndex >= 0 ? getCell(row, headers, SKU_HEADERS) : "";

    if (!variantId && !sku) {
      errors.push(`Row ${index + 2}: provide a Variant ID or SKU.`);
      return;
    }

    parsedRows.push({ variantId, sku });
  });

  if (parsedRows.length > CSV_BULK_EDIT_MAX_ROWS) {
    errors.push(`CSV is limited to ${CSV_BULK_EDIT_MAX_ROWS} rows.`);
  }

  return { rows: parsedRows.slice(0, CSV_BULK_EDIT_MAX_ROWS), errors };
}

export function parseCsvDirectRows(text) {
  const { headers, rows } = parseCsvText(text);
  const errors = [];
  const parsedRows = [];

  if (rows.length === 0) {
    errors.push("CSV file must include a header row and at least one data row.");
    return { rows: [], errors };
  }

  const variantIdIndex = findHeaderIndex(headers, VARIANT_ID_HEADERS);
  const skuIndex = findHeaderIndex(headers, SKU_HEADERS);
  const newPriceIndex = findHeaderIndex(headers, NEW_PRICE_HEADERS);
  const newCompareIndex = findHeaderIndex(headers, NEW_COMPARE_HEADERS);
  const newCostIndex = findHeaderIndex(headers, NEW_COST_HEADERS);

  if (variantIdIndex < 0 && skuIndex < 0) {
    errors.push('CSV must include a "Variant ID" or "SKU" column.');
    return { rows: [], errors };
  }

  if (newPriceIndex < 0 && newCompareIndex < 0 && newCostIndex < 0) {
    errors.push('CSV must include at least one price column such as "New price".');
    return { rows: [], errors };
  }

  rows.forEach((row, index) => {
    const variantId = variantIdIndex >= 0 ? normalizeVariantId(getCell(row, headers, VARIANT_ID_HEADERS)) : null;
    const sku = skuIndex >= 0 ? getCell(row, headers, SKU_HEADERS) : "";
    const newPrice = newPriceIndex >= 0 ? parseNullablePrice(getCell(row, headers, NEW_PRICE_HEADERS)) : { provided: false };
    const newCompare =
      newCompareIndex >= 0 ? parseNullablePrice(getCell(row, headers, NEW_COMPARE_HEADERS)) : { provided: false };
    const newCost = newCostIndex >= 0 ? parseNullablePrice(getCell(row, headers, NEW_COST_HEADERS)) : { provided: false };

    if (!variantId && !sku) {
      errors.push(`Row ${index + 2}: provide a Variant ID or SKU.`);
      return;
    }

    if (newPrice.invalid || newCompare.invalid || newCost.invalid) {
      errors.push(`Row ${index + 2}: contains an invalid price value.`);
      return;
    }

    if (!newPrice.provided && !newCompare.provided && !newCost.provided) {
      errors.push(`Row ${index + 2}: must include at least one new price value.`);
      return;
    }

    parsedRows.push({
      variantId,
      sku,
      newPrice: newPrice.provided ? newPrice.value : undefined,
      newCompare: newCompare.provided ? newCompare.value : undefined,
      newCost: newCost.provided ? newCost.value : undefined,
    });
  });

  if (parsedRows.length > CSV_BULK_EDIT_MAX_ROWS) {
    errors.push(`CSV is limited to ${CSV_BULK_EDIT_MAX_ROWS} rows.`);
  }

  return { rows: parsedRows.slice(0, CSV_BULK_EDIT_MAX_ROWS), errors };
}

export function validateCsvRowsForRun(csvRows, editType) {
  const errors = [];

  if (!Array.isArray(csvRows)) {
    return { valid: false, errors: ["Invalid CSV data submitted."] };
  }

  if (csvRows.length === 0) {
    return { valid: false, errors: ["Please upload a CSV file."] };
  }

  if (csvRows.length > CSV_BULK_EDIT_MAX_ROWS) {
    errors.push(`CSV is limited to ${CSV_BULK_EDIT_MAX_ROWS} rows.`);
  }

  csvRows.forEach((row, index) => {
    if (!row || typeof row !== "object") {
      errors.push(`Row ${index + 1}: invalid row data.`);
      return;
    }

    const variantId = row.variantId ? normalizeVariantId(row.variantId) : null;
    const sku = String(row.sku || "").trim();

    if (!variantId && !sku) {
      errors.push(`Row ${index + 1}: provide a Variant ID or SKU.`);
    }

    if (editType === "csv-direct") {
      const hasPriceUpdate =
        row.newPrice !== undefined ||
        row.newCompare !== undefined ||
        row.newCost !== undefined;

      if (!hasPriceUpdate) {
        errors.push(`Row ${index + 1}: must include at least one new price value.`);
      }
    }
  });

  return { valid: errors.length === 0, errors };
}

export function getCsvTemplate(editType) {
  if (editType === "csv-direct") {
    return [
      "Variant ID,SKU,New price,New compare-at price,New cost price",
      "40123456789012,sample-sku,19.99,24.99,10.00",
    ].join("\n");
  }

  return ["Variant ID,SKU", "40123456789012,sample-sku"].join("\n");
}

export function downloadCsvTemplate(editType) {
  const blob = new Blob([getCsvTemplate(editType)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = editType === "csv-direct" ? "direct-price-edit-template.csv" : "variant-list-template.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
