import { CONDITION_FIELDS } from "../components/new-task/constants.js";
import { parseWeightConditionValue, weightToGrams } from "./weight-conditions.js";
import {
  locationMatchesSelection,
  parseInventoryLocationConditionValue,
} from "./inventory-location-conditions.js";

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

function stripHtml(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function escapeShopifyQueryValue(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function getVariants(product) {
  return product.variants?.nodes || product.variants || [];
}

function getCollections(product) {
  return product.collections?.nodes || product.collections || [];
}

function parseBoolean(value) {
  const normalized = normalizeText(value);
  if (["true", "yes", "1"].includes(normalized)) return true;
  if (["false", "no", "0"].includes(normalized)) return false;
  return null;
}

function parseNumber(value) {
  const cleaned = String(value ?? "").replace(/[^\d.-]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDate(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;

  const direct = new Date(trimmed);
  if (!Number.isNaN(direct.getTime())) return direct;

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

function formatDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function normalizeStatus(value) {
  return String(value ?? "").trim().toUpperCase();
}

function normalizeInventoryPolicy(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
}

function computeSalePercentage(variant) {
  const price = parseNumber(variant.price);
  const compareAtPrice = parseNumber(variant.compareAtPrice);
  if (price == null || compareAtPrice == null || compareAtPrice <= 0) return null;
  return Math.round(((compareAtPrice - price) / compareAtPrice) * 10000) / 100;
}

function getVariantWeight(variant) {
  const weight = variant.inventoryItem?.measurement?.weight;
  if (!weight) return null;
  const value = parseNumber(weight.value);
  if (value == null) return null;
  return `${value}${weight.unit ? ` ${weight.unit}` : ""}`.trim();
}

function getInventoryLevels(variant) {
  return variant.inventoryItem?.inventoryLevels?.nodes || [];
}

function getMetafields(entity) {
  return entity?.metafields?.nodes || entity?.metafields || [];
}

function formatMetafield(metafield) {
  return `${metafield.namespace}.${metafield.key}=${metafield.value ?? ""}`;
}

function parseMetafieldQuery(value) {
  const match = String(value ?? "").trim().match(/^([^=]+)=([\s\S]+)$/);
  if (!match) return null;
  const [, key, metafieldValue] = match;
  const lastDot = key.lastIndexOf(".");
  if (lastDot <= 0) return null;
  return {
    namespace: key.slice(0, lastDot),
    key: key.slice(lastDot + 1),
    value: metafieldValue.trim(),
  };
}

function getProductPublishedStatus(product) {
  if (product.publishedAt) return "published";
  if (normalizeStatus(product.status) === "ACTIVE") return "published";
  return "unpublished";
}

function getFieldDefinition(field) {
  return CONDITION_FIELD_DEFS[field] || null;
}

const CONDITION_FIELD_DEFS = {
  title: {
    shopifyField: "title",
    kind: "text",
    values: (product) => [product.title ?? ""],
  },
  type: {
    shopifyField: "product_type",
    kind: "text",
    values: (product) => [product.productType ?? ""],
  },
  vendor: {
    shopifyField: "vendor",
    kind: "text",
    values: (product) => [product.vendor ?? ""],
  },
  tag: {
    shopifyField: "tag",
    kind: "text",
    values: (product) => (Array.isArray(product.tags) ? product.tags : []),
  },
  created_at: {
    shopifyField: "created_at",
    kind: "date",
    values: (product) => [product.createdAt ?? ""],
  },
  published_at: {
    shopifyField: "published_at",
    kind: "date",
    values: (product) => [product.publishedAt ?? ""],
  },
  status: {
    shopifyField: "status",
    kind: "text",
    values: (product) => [normalizeStatus(product.status)],
    normalizeExpected: normalizeStatus,
  },
  description: {
    kind: "text",
    values: (product) => [stripHtml(product.description)],
  },
  handle: {
    shopifyField: "handle",
    kind: "text",
    values: (product) => [product.handle ?? ""],
  },
  option_name1: {
    kind: "text",
    values: (product) => [product.options?.[0]?.name ?? ""],
  },
  option_name2: {
    kind: "text",
    values: (product) => [product.options?.[1]?.name ?? ""],
  },
  option_name3: {
    kind: "text",
    values: (product) => [product.options?.[2]?.name ?? ""],
  },
  collection: {
    shopifyField: "collection_id",
    kind: "text",
    values: (product) => {
      const collections = getCollections(product);
      return collections.flatMap((collection) => [
        collection.title ?? "",
        collection.handle ?? "",
        String(collection.id ?? "").split("/").pop() ?? "",
      ]);
    },
  },
  published_status: {
    shopifyField: "published_status",
    kind: "text",
    values: (product) => [getProductPublishedStatus(product)],
  },
  product_metafield: {
    kind: "metafield",
    values: (product) => getMetafields(product).map(formatMetafield),
    metafields: (product) => getMetafields(product),
  },
  variant_price: {
    shopifyField: "price",
    kind: "number",
    values: (product) => getVariants(product).map((variant) => variant.price ?? ""),
  },
  price: {
    shopifyField: "price",
    kind: "number",
    values: (product) => getVariants(product).map((variant) => variant.price ?? ""),
  },
  variant_compare_at_price: {
    kind: "number",
    values: (product) =>
      getVariants(product).map((variant) => variant.compareAtPrice ?? ""),
  },
  variant_weight: {
    kind: "weight",
    values: (product) =>
      getVariants(product)
        .map((variant) => getVariantWeight(variant))
        .filter((value) => value != null),
  },
  variant_inventory: {
    shopifyField: "inventory_total",
    kind: "number",
    values: (product) => [
      product.totalInventory ?? "",
      ...getVariants(product).map((variant) => variant.inventoryQuantity ?? ""),
    ],
  },
  variant_title: {
    shopifyField: "variant_title",
    kind: "text",
    values: (product) => getVariants(product).map((variant) => variant.title ?? ""),
  },
  variant_option: {
    kind: "text",
    values: (product) =>
      getVariants(product).flatMap((variant) =>
        (variant.selectedOptions || []).flatMap((option) => [
          option.value ?? "",
          `${option.name ?? ""}:${option.value ?? ""}`,
        ])
      ),
  },
  sku: {
    shopifyField: "sku",
    kind: "text",
    values: (product) => getVariants(product).map((variant) => variant.sku ?? ""),
  },
  taxable: {
    kind: "boolean",
    values: (product) => getVariants(product).map((variant) => variant.taxable),
  },
  barcode: {
    shopifyField: "barcode",
    kind: "text",
    values: (product) => getVariants(product).map((variant) => variant.barcode ?? ""),
  },
  sale_percentage: {
    kind: "number",
    values: (product) =>
      getVariants(product)
        .map((variant) => computeSalePercentage(variant))
        .filter((value) => value != null),
  },
  variant_cost_price: {
    kind: "number",
    values: (product) =>
      getVariants(product).map(
        (variant) => variant.inventoryItem?.unitCost?.amount ?? ""
      ),
  },
  variant_inventory_at_location: {
    kind: "inventory_location",
    inventoryLevels: (product) =>
      getVariants(product).flatMap((variant) =>
        getInventoryLevels(variant).map((level) => ({
          locationName: level.location?.name ?? "",
          locationId: String(level.location?.id ?? "").split("/").pop() ?? "",
          quantity: level.quantities?.[0]?.quantity ?? level.available ?? 0,
        }))
      ),
  },
  inventory_out_of_stock_policy: {
    kind: "text",
    values: (product) =>
      getVariants(product).map((variant) =>
        normalizeInventoryPolicy(variant.inventoryPolicy)
      ),
  },
  inventory_policy: {
    kind: "boolean",
    values: (product) =>
      getVariants(product).map((variant) => variant.inventoryItem?.tracked ?? null),
  },
  physical_product: {
    kind: "boolean",
    values: (product) =>
      getVariants(product).map((variant) => {
        if (typeof variant.inventoryItem?.requiresShipping === "boolean") {
          return variant.inventoryItem.requiresShipping;
        }
        return null;
      }),
  },
  variant_metafield: {
    kind: "metafield",
    values: (product) =>
      getVariants(product).flatMap((variant) =>
        getMetafields(variant).map(formatMetafield)
      ),
    metafields: (product) =>
      getVariants(product).flatMap((variant) => getMetafields(variant)),
  },
};

export const SUPPORTED_CONDITION_FIELDS = CONDITION_FIELDS.map((field) => field.value);

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsWholeWord(text, word) {
  const normalizedWord = normalizeText(word);
  if (!normalizedWord) return true;

  const pattern = new RegExp(`\\b${escapeRegex(normalizedWord)}\\b`, "i");
  return pattern.test(normalizeText(text));
}

function buildTextQueryPart(shopifyField, operator, value) {
  const escaped = escapeShopifyQueryValue(value);

  if (operator === "equals") return `${shopifyField}:"${escaped}"`;
  if (operator === "not_equals" || operator === "excludes") {
    return `-${shopifyField}:"${escaped}"`;
  }
  if (operator === "contains") return `${shopifyField}:*${escaped}*`;
  if (operator === "contains_word") return `${shopifyField}:*${escaped}*`;
  if (operator === "not_contains") return null;
  if (operator === "starts_with") return `${shopifyField}:${escaped}*`;
  if (operator === "ends_with") return `${shopifyField}:*${escaped}*`;

  return `${shopifyField}:${escaped}`;
}

function buildDateQueryPart(shopifyField, operator, value) {
  const parsed = parseDate(value);
  if (!parsed) {
    return buildTextQueryPart(shopifyField, operator, value);
  }

  const day = formatDateOnly(parsed);

  if (operator === "equals") {
    return `${shopifyField}:>='${day}' ${shopifyField}:<'${day}T23:59:59Z'`;
  }
  if (operator === "not_equals") {
    return `-${shopifyField}:>='${day}' -${shopifyField}:<'${day}T23:59:59Z'`;
  }
  if (operator === "greater_than") {
    return `${shopifyField}:>'${day}'`;
  }
  if (operator === "less_than") {
    return `${shopifyField}:<'${day}'`;
  }
  if (operator === "starts_with" || operator === "contains") {
    return `${shopifyField}:>=${day.slice(0, Math.min(day.length, value.trim().length))}`;
  }
  if (operator === "ends_with") {
    return `${shopifyField}:<='${day}T23:59:59Z'`;
  }

  return `${shopifyField}:>='${day}'`;
}

function buildNumberQueryPart(shopifyField, operator, value) {
  const parsed = parseNumber(value);
  if (parsed == null) {
    return buildTextQueryPart(shopifyField, operator, value);
  }

  if (operator === "equals") return `${shopifyField}:${parsed}`;
  if (operator === "not_equals") return `-${shopifyField}:${parsed}`;
  if (operator === "greater_than") return `${shopifyField}:>${parsed}`;
  if (operator === "less_than") return `${shopifyField}:<${parsed}`;
  if (operator === "contains") return `${shopifyField}:${parsed}`;
  if (operator === "starts_with") return `${shopifyField}:>=${parsed}`;
  if (operator === "ends_with") return `${shopifyField}:<=${parsed}`;

  return `${shopifyField}:${parsed}`;
}

function extractCollectionNumericId(value) {
  const trimmed = String(value ?? "").trim();
  if (/^\d+$/.test(trimmed)) return trimmed;

  const gidMatch = trimmed.match(/Collection\/(\d+)/i);
  return gidMatch ? gidMatch[1] : null;
}

function normalizePublishedStatusExpected(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "published" || normalized === "unpublished") return normalized;
  return null;
}

function buildPublishedStatusQueryPart(value) {
  const normalized = normalizePublishedStatusExpected(value);
  if (!normalized) return null;
  return `published_status:${normalized}`;
}

function buildCollectionQueryPart(operator, value) {
  const numericId = extractCollectionNumericId(value);
  if (!numericId) return null;
  if (operator === "excludes" || operator === "not_equals") return `-collection_id:${numericId}`;
  return `collection_id:${numericId}`;
}

function parseMetafieldKey(value) {
  const trimmed = String(value ?? "").trim();
  const parsed = parseMetafieldQuery(trimmed);
  if (parsed) {
    return { namespace: parsed.namespace, key: parsed.key };
  }

  const lastDot = trimmed.lastIndexOf(".");
  if (lastDot <= 0) return null;

  return {
    namespace: trimmed.slice(0, lastDot),
    key: trimmed.slice(lastDot + 1),
  };
}

function metafieldExists(metafields, namespace, key) {
  return metafields.some(
    (metafield) => metafield.namespace === namespace && metafield.key === key
  );
}

function buildMetafieldShopifyQueryPart(operator, value) {
  if (operator === "is_found" || operator === "is_not_found") {
    const parsed = parseMetafieldKey(value);
    if (!parsed) return null;
    const shopifyField = `metafields.${parsed.namespace}.${parsed.key}`;
    if (operator === "is_not_found") return `-${shopifyField}:*`;
    return `${shopifyField}:*`;
  }

  const parsed = parseMetafieldQuery(value);
  if (!parsed) return null;
  const shopifyField = `metafields.${parsed.namespace}.${parsed.key}`;
  return buildTextQueryPart(shopifyField, operator, parsed.value);
}

function buildConditionQueryPart(field, operator, value) {
  const fieldDef = getFieldDefinition(field);
  if (!fieldDef) return null;

  if (field === "collection") {
    return buildCollectionQueryPart(operator, value);
  }

  if (field === "published_status") {
    return buildPublishedStatusQueryPart(value);
  }

  if (field === "product_metafield" || field === "variant_metafield") {
    return buildMetafieldShopifyQueryPart(operator, value);
  }

  if (!fieldDef.shopifyField) return null;

  if (fieldDef.kind === "date") {
    return buildDateQueryPart(fieldDef.shopifyField, operator, value);
  }

  if (fieldDef.kind === "number") {
    return buildNumberQueryPart(fieldDef.shopifyField, operator, value);
  }

  if (fieldDef.kind === "boolean") {
    const bool = parseBoolean(value);
    if (bool == null) return null;
    const shopifyValue = bool ? "true" : "false";
    if (operator === "not_equals") return `-${fieldDef.shopifyField}:${shopifyValue}`;
    return `${fieldDef.shopifyField}:${shopifyValue}`;
  }

  return buildTextQueryPart(fieldDef.shopifyField, operator, value);
}

function matchesTextOperator(actual, operator, expected, normalize = normalizeText) {
  const normalizedActual = normalize(actual);
  const normalizedExpected = normalize(expected);

  if (!normalizedExpected) return true;

  if (operator === "not_equals") return normalizedActual !== normalizedExpected;
  if (operator === "contains") return normalizedActual.includes(normalizedExpected);
  if (operator === "not_contains") return !normalizedActual.includes(normalizedExpected);
  if (operator === "contains_word") return containsWholeWord(actual, expected);
  if (operator === "starts_with") return normalizedActual.startsWith(normalizedExpected);
  if (operator === "ends_with") return normalizedActual.endsWith(normalizedExpected);

  return normalizedActual === normalizedExpected;
}

function matchesNumberOperator(actual, operator, expected) {
  const actualNumber = parseNumber(actual);
  const expectedNumber = parseNumber(expected);

  if (expectedNumber == null) {
    return matchesTextOperator(String(actual ?? ""), operator, expected);
  }

  if (actualNumber == null) {
    return operator === "not_equals";
  }

  if (operator === "equals") return Math.abs(actualNumber - expectedNumber) < 0.0001;
  if (operator === "not_equals") return Math.abs(actualNumber - expectedNumber) >= 0.0001;
  if (operator === "greater_than") return actualNumber > expectedNumber;
  if (operator === "less_than") return actualNumber < expectedNumber;
  if (operator === "contains") {
    return String(actualNumber).includes(String(expectedNumber));
  }
  if (operator === "starts_with") return actualNumber >= expectedNumber;
  if (operator === "ends_with") return actualNumber <= expectedNumber;

  return actualNumber === expectedNumber;
}

function matchesDateOperator(actual, operator, expected) {
  const actualDate = parseDate(actual);
  const expectedDate = parseDate(expected);

  if (!expectedDate) {
    return matchesTextOperator(String(actual ?? ""), operator, expected);
  }

  if (!actualDate) {
    return operator === "not_equals";
  }

  const actualDay = formatDateOnly(actualDate);
  const expectedDay = formatDateOnly(expectedDate);

  if (operator === "greater_than") return actualDay > expectedDay;
  if (operator === "less_than") return actualDay < expectedDay;
  if (operator === "equals") return actualDay === expectedDay;
  if (operator === "not_equals") return actualDay !== expectedDay;
  if (operator === "contains") {
    return actualDay.includes(expectedDay) || String(actual).includes(String(expected));
  }
  if (operator === "starts_with") {
    return actualDay >= expectedDay || String(actual).startsWith(String(expected));
  }
  if (operator === "ends_with") {
    return actualDay <= expectedDay || String(actual).endsWith(String(expected));
  }

  return actualDay === expectedDay;
}

function matchesBooleanOperator(actual, operator, expected) {
  const actualBool =
    typeof actual === "boolean" ? actual : parseBoolean(String(actual ?? ""));
  const expectedBool = parseBoolean(expected);

  if (expectedBool == null) {
    return matchesTextOperator(String(actual ?? ""), operator, expected);
  }

  if (actualBool == null) return false;
  if (operator === "not_equals") return actualBool !== expectedBool;
  return actualBool === expectedBool;
}

function matchesInventoryLocationOperator(levels, operator, expected) {
  const { quantity, locationId } = parseInventoryLocationConditionValue(expected);
  if (!locationId && !quantity) return true;

  return levels.some((level) => {
    if (locationId && !locationMatchesSelection(level, locationId)) {
      return false;
    }

    if (!quantity) return true;
    return matchesNumberOperator(level.quantity, operator, quantity);
  });
}

function getVariantWeightMeasurement(variant) {
  const weight = variant.inventoryItem?.measurement?.weight;
  if (!weight) return null;

  const value = parseNumber(weight.value);
  if (value == null) return null;

  return { value, unit: weight.unit };
}

function matchesWeightComparison(actualGrams, operator, expectedGrams) {
  if (operator === "equals") return Math.abs(actualGrams - expectedGrams) < 0.01;
  if (operator === "greater_than") return actualGrams > expectedGrams;
  if (operator === "less_than") return actualGrams < expectedGrams;
  return false;
}

function matchesVariantWeightOperator(product, operator, expected) {
  const { amount, unit } = parseWeightConditionValue(expected);
  const expectedGrams = weightToGrams(amount, unit);
  if (expectedGrams == null) return true;

  const actualGramsList = getVariants(product)
    .map((variant) => getVariantWeightMeasurement(variant))
    .filter(Boolean)
    .map((measurement) => weightToGrams(measurement.value, measurement.unit))
    .filter((grams) => grams != null);

  if (actualGramsList.length === 0) return false;

  return actualGramsList.some((actualGrams) =>
    matchesWeightComparison(actualGrams, operator, expectedGrams)
  );
}

function matchesMetafieldOperator(metafields, operator, expected) {
  if (operator === "is_found" || operator === "is_not_found") {
    const parsed = parseMetafieldKey(expected);
    if (!parsed) return operator === "is_not_found";

    const exists = metafieldExists(metafields, parsed.namespace, parsed.key);
    return operator === "is_found" ? exists : !exists;
  }

  const parsed = parseMetafieldQuery(expected);

  if (parsed) {
    return metafields.some((metafield) => {
      if (metafield.namespace !== parsed.namespace || metafield.key !== parsed.key) {
        return false;
      }
      return matchesTextOperator(metafield.value ?? "", operator, parsed.value);
    });
  }

  return metafields.some(
    (metafield) =>
      matchesTextOperator(formatMetafield(metafield), operator, expected) ||
      matchesTextOperator(metafield.value ?? "", operator, expected) ||
      matchesTextOperator(`${metafield.namespace}.${metafield.key}`, operator, expected)
  );
}

function matchesFieldValues(values, operator, expected, fieldDef) {
  const filteredValues = values.filter(
    (value) => value !== null && value !== undefined && value !== ""
  );

  if (fieldDef.kind === "number") {
    if (filteredValues.length === 0) return operator === "not_equals";
    return filteredValues.some((value) => matchesNumberOperator(value, operator, expected));
  }

  if (fieldDef.kind === "date") {
    if (filteredValues.length === 0) return operator === "not_equals";
    return filteredValues.some((value) => matchesDateOperator(value, operator, expected));
  }

  if (fieldDef.kind === "boolean") {
    return values.some((value) => matchesBooleanOperator(value, operator, expected));
  }

  if (filteredValues.length === 0) {
    return matchesTextOperator("", operator, expected, fieldDef.normalizeExpected || normalizeText);
  }

  const normalize = fieldDef.normalizeExpected || normalizeText;

  return filteredValues.some((value) =>
    matchesTextOperator(value, operator, expected, normalize)
  );
}

function matchesCondition(product, condition) {
  const operator = condition.operator;
  const expected = String(condition.value ?? "").trim();
  if (!expected) return true;

  const fieldDef = getFieldDefinition(condition.field);
  if (!fieldDef) return false;

  if (fieldDef.kind === "inventory_location") {
    return matchesInventoryLocationOperator(
      fieldDef.inventoryLevels(product),
      operator,
      expected
    );
  }

  if (fieldDef.kind === "metafield") {
    return matchesMetafieldOperator(fieldDef.metafields(product), operator, expected);
  }

  if (fieldDef.kind === "weight") {
    return matchesVariantWeightOperator(product, operator, expected);
  }

  if (condition.field === "tag") {
    return matchesTagOperator(fieldDef.values(product), operator, expected);
  }

  if (condition.field === "collection") {
    return matchesCollectionOperator(product, operator, expected);
  }

  if (condition.field === "published_status") {
    const expectedStatus = normalizePublishedStatusExpected(expected);
    if (!expectedStatus) return true;
    return getProductPublishedStatus(product) === expectedStatus;
  }

  return matchesFieldValues(fieldDef.values(product), operator, expected, fieldDef);
}

function matchesCollectionOperator(product, operator, expected) {
  const normalizedExpected = normalizeText(expected);
  if (!normalizedExpected) return true;

  const numericId = extractCollectionNumericId(expected);
  const collections = getCollections(product);

  const isIncluded = collections.some((collection) => {
    const title = normalizeText(collection.title ?? "");
    const handle = normalizeText(collection.handle ?? "");
    const id = String(collection.id ?? "").split("/").pop() ?? "";

    if (numericId && id === numericId) return true;
    if (title === normalizedExpected) return true;
    if (handle === normalizedExpected) return true;
    if (normalizeText(id) === normalizedExpected) return true;

    return false;
  });

  if (operator === "excludes" || operator === "not_equals") {
    return !isIncluded;
  }

  return isIncluded;
}

function matchesTagOperator(tags, operator, expected) {
  const normalizedExpected = normalizeText(expected);
  if (!normalizedExpected) return true;

  const normalizedTags = (Array.isArray(tags) ? tags : [])
    .map((tag) => normalizeText(tag))
    .filter(Boolean);

  const hasTag = normalizedTags.some((tag) => tag === normalizedExpected);

  if (operator === "excludes" || operator === "not_equals") {
    return !hasTag;
  }

  return hasTag;
}

function productMatchesConditions(product, matchType, conditions) {
  const results = conditions.map((condition) => matchesCondition(product, condition));
  return matchType === "any" ? results.some(Boolean) : results.every(Boolean);
}

export function filterProductsByConditions(products, editType, matchType, conditionsStr) {
  if (editType !== "conditions") return products;

  const conditions = parseConditions(conditionsStr).filter((condition) =>
    String(condition.value ?? "").trim()
  );

  if (conditions.length === 0) return products;

  return products.filter((product) => productMatchesConditions(product, matchType, conditions));
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
      const value = (cond.value || "").trim();
      if (!value) continue;

      const part = buildConditionQueryPart(cond.field, cond.operator, value);
      if (part) parts.push(part);
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

export const PRODUCT_CONDITION_FIELDS = `
  title
  handle
  description
  vendor
  productType
  status
  tags
  createdAt
  publishedAt
  totalInventory
  collections(first: 25) {
    nodes {
      id
      title
      handle
    }
  }
  options {
    name
    values
  }
  metafields(first: 25) {
    nodes {
      namespace
      key
      value
    }
  }
`;

export const PRODUCT_CONDITION_VARIANT_FIELDS = `
  id
  title
  sku
  barcode
  price
  compareAtPrice
  taxable
  inventoryQuantity
  inventoryPolicy
  selectedOptions {
    name
    value
  }
  metafields(first: 10) {
    nodes {
      namespace
      key
      value
    }
  }
  inventoryItem {
    tracked
    requiresShipping
    unitCost {
      amount
    }
    measurement {
      weight {
        value
        unit
      }
    }
    inventoryLevels(first: 10) {
      nodes {
        location {
          id
          name
        }
        quantities(names: ["available"]) {
          quantity
        }
      }
    }
  }
`;
