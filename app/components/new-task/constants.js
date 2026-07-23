import { isValidWeightConditionValue } from "../../utils/weight-conditions";
import { isValidInventoryLocationConditionValue } from "../../utils/inventory-location-conditions";

export const CONDITION_FIELDS = [
  { value: "title", label: "Product Title" },
  { value: "type", label: "Product Type" },
  { value: "vendor", label: "Product Vendor" },
  { value: "tag", label: "Product Tag" },
  { value: "created_at", label: "Date Created" },
  { value: "published_at", label: "Date Published" },
  { value: "status", label: "Product Status" },
  { value: "description", label: "Product Description" },
  { value: "handle", label: "Product Handle" },
  { value: "option_name1", label: "Option One Name" },
  { value: "option_name2", label: "Option Two Name" },
  { value: "option_name3", label: "Option Three Name" },
  { value: "collection", label: "Collection" },
  { value: "published_status", label: "Published Status" },
  { value: "product_metafield", label: "Product Metafield" },
  { value: "variant_price", label: "Variant Price" },
  { value: "variant_compare_at_price", label: "Variant Compare At Price" },
  { value: "variant_weight", label: "Variant Weight" },
  { value: "variant_inventory", label: "Variant Inventory Level" },
  { value: "variant_title", label: "Variant Title" },
  { value: "variant_option", label: "Variant Option" },
  { value: "sku", label: "SKU" },
  { value: "taxable", label: "Variant is Taxable" },
  { value: "barcode", label: "Barcode" },
  { value: "sale_percentage", label: "Sale Percentage" },
  { value: "variant_cost_price", label: "Variant Cost Price" },
  { value: "variant_inventory_at_location", label: "Inventory Stock At Location" },
  { value: "inventory_out_of_stock_policy", label: "Inventory Out Of Stock Policy" },
  { value: "inventory_policy", label: "Inventory Policy" },
  { value: "physical_product", label: "Physical Product" },
  { value: "price", label: "Variant Price" },
  { value: "variant_metafield", label: "Variant Metafield" },
];

export const CONDITION_OPERATORS = [
  { value: "equals", label: "is equal to" },
  { value: "not_equals", label: "is not equal to" },
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "does not contain" },
  { value: "contains_word", label: "contains word" },
  { value: "starts_with", label: "starts with" },
  { value: "ends_with", label: "ends with" },
];

const EXTENDED_TEXT_OPERATOR_VALUES = new Set(["not_contains", "contains_word"]);

const FIELDS_WITH_EXTENDED_TEXT_OPERATORS = new Set([
  "title",
  "type",
  "description",
  "handle",
  "option_name1",
  "option_name2",
  "option_name3",
  "variant_title",
  "sku",
  "barcode",
]);

const TAG_OPERATORS = [
  { value: "equals", label: "is equal to" },
  { value: "excludes", label: "excludes" },
];

const COLLECTION_OPERATORS = [
  { value: "includes", label: "includes" },
  { value: "excludes", label: "excludes" },
];

const DATE_OPERATORS = [
  { value: "greater_than", label: "is greater than" },
  { value: "less_than", label: "is less than" },
];

const VARIANT_PRICE_OPERATORS = [
  { value: "equals", label: "is equal to" },
  { value: "not_equals", label: "is not equal to" },
  { value: "greater_than", label: "is greater than" },
  { value: "less_than", label: "is less than" },
];

const NUMERIC_THRESHOLD_OPERATORS = [
  { value: "equals", label: "is equal to" },
  { value: "less_than", label: "is less than" },
  { value: "greater_than", label: "is greater than" },
];

const FIELDS_WITH_NUMERIC_THRESHOLD_OPERATORS = new Set([
  "variant_weight",
  "variant_inventory",
  "variant_inventory_at_location",
]);

const FIELDS_WITH_DATE_OPERATORS = new Set(["created_at", "published_at"]);

const FIELDS_WITH_VARIANT_PRICE_OPERATORS = new Set([
  "variant_price",
  "price",
  "variant_compare_at_price",
  "sale_percentage",
  "variant_cost_price",
]);

const STATUS_OPERATORS = [{ value: "equals", label: "is equal to" }];

const TAXABLE_OPERATORS = [{ value: "equals", label: "is equal to" }];

const INVENTORY_POLICY_OPERATORS = [{ value: "equals", label: "is equal to" }];

const PUBLISHED_STATUS_OPERATORS = [{ value: "on_web", label: "On Web" }];

const PRODUCT_METAFIELD_OPERATORS = [
  { value: "equals", label: "is equal to" },
  { value: "is_found", label: "is found" },
  { value: "is_not_found", label: "is not found" },
];

export const PRODUCT_STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "DRAFT", label: "Draft" },
];

export const PUBLISHED_STATUS_OPTIONS = [
  { value: "published", label: "Yes, it is publish" },
  { value: "unpublished", label: "No, it is not published" },
];

export const TAXABLE_OPTIONS = [
  { value: "true", label: "Yes, It Is Taxable" },
  { value: "false", label: "No, It Is Not Taxable" },
];

export const INVENTORY_OUT_OF_STOCK_POLICY_OPTIONS = [
  { value: "CONTINUE", label: "Continue Selling when out of stock" },
  { value: "DENY", label: "Stop Selling when out of stock" },
];

export const INVENTORY_TRACKING_OPTIONS = [
  { value: "true", label: "Shopify tracks the product's inventory" },
  { value: "false", label: "Don't track inventory" },
];

export const PHYSICAL_PRODUCT_OPTIONS = [
  { value: "true", label: "Yes, This is a physical product" },
  { value: "false", label: "No, This is not a physical product" },
];

export function getConditionOperators(field) {
  if (field === "tag") {
    return TAG_OPERATORS;
  }

  if (field === "collection") {
    return COLLECTION_OPERATORS;
  }

  if (field === "status") {
    return STATUS_OPERATORS;
  }

  if (field === "taxable") {
    return TAXABLE_OPERATORS;
  }

  if (field === "inventory_out_of_stock_policy") {
    return INVENTORY_POLICY_OPERATORS;
  }

  if (field === "inventory_policy") {
    return INVENTORY_POLICY_OPERATORS;
  }

  if (field === "physical_product") {
    return TAXABLE_OPERATORS;
  }

  if (field === "published_status") {
    return PUBLISHED_STATUS_OPERATORS;
  }

  if (field === "product_metafield" || field === "variant_metafield") {
    return PRODUCT_METAFIELD_OPERATORS;
  }

  if (FIELDS_WITH_VARIANT_PRICE_OPERATORS.has(field)) {
    return VARIANT_PRICE_OPERATORS;
  }

  if (FIELDS_WITH_NUMERIC_THRESHOLD_OPERATORS.has(field)) {
    return NUMERIC_THRESHOLD_OPERATORS;
  }

  if (FIELDS_WITH_DATE_OPERATORS.has(field)) {
    return DATE_OPERATORS;
  }

  if (FIELDS_WITH_EXTENDED_TEXT_OPERATORS.has(field)) {
    return CONDITION_OPERATORS;
  }

  return CONDITION_OPERATORS.filter((op) => !EXTENDED_TEXT_OPERATOR_VALUES.has(op.value));
}

export function isOperatorAllowedForField(field, operator) {
  return getConditionOperators(field).some((op) => op.value === operator);
}

export function getDefaultOperatorForField(field) {
  return getConditionOperators(field)[0]?.value ?? "equals";
}

export function isDateConditionField(field) {
  return FIELDS_WITH_DATE_OPERATORS.has(field);
}

export function isStatusConditionField(field) {
  return field === "status";
}

export function isTaxableConditionField(field) {
  return field === "taxable";
}

export function isInventoryOutOfStockPolicyConditionField(field) {
  return field === "inventory_out_of_stock_policy";
}

export function isInventoryPolicyConditionField(field) {
  return field === "inventory_policy";
}

export function isPhysicalProductConditionField(field) {
  return field === "physical_product";
}

export function isPublishedStatusConditionField(field) {
  return field === "published_status";
}

export function isProductMetafieldConditionField(field) {
  return field === "product_metafield";
}

export function isVariantMetafieldConditionField(field) {
  return field === "variant_metafield";
}

export function isMetafieldConditionField(field) {
  return isProductMetafieldConditionField(field) || isVariantMetafieldConditionField(field);
}

export function isVariantWeightConditionField(field) {
  return field === "variant_weight";
}

export function isInventoryLocationConditionField(field) {
  return field === "variant_inventory_at_location";
}

export function isCollectionConditionField(field) {
  return field === "collection";
}

export function normalizeCollectionValue(value, collections = []) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return collections[0]?.id ?? "";
  }

  const match = collections.find((collection) => {
    if (collection.id === trimmed) return true;
    const numericId = String(collection.id ?? "").split("/").pop();
    if (numericId === trimmed) return true;
    if (collection.title === trimmed) return true;
    return false;
  });

  return match?.id ?? trimmed;
}

export function parseMetafieldConditionValue(value) {
  const trimmed = String(value ?? "").trim();
  const equalsIndex = trimmed.indexOf("=");

  if (equalsIndex > 0) {
    return {
      name: trimmed.slice(0, equalsIndex).trim(),
      metafieldValue: trimmed.slice(equalsIndex + 1).trim(),
    };
  }

  return { name: trimmed, metafieldValue: "" };
}

export function getMetafieldDraftFromValue(value) {
  const parsed = parseMetafieldConditionValue(value);
  if (!parsed.name.includes(".")) {
    return { name: "", metafieldValue: "" };
  }

  return parsed;
}

export function isValidMetafieldConditionValue(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return false;

  const { name } = parseMetafieldConditionValue(trimmed);
  return name.includes(".");
}

export function formatMetafieldConditionValue(name, metafieldValue, operator) {
  const trimmedName = String(name ?? "").trim();
  if (!trimmedName) return "";

  if (operator === "equals") {
    return `${trimmedName}=${String(metafieldValue ?? "").trim()}`;
  }

  return trimmedName;
}

export function getMetafieldConditionSummary(value, operator) {
  const { name, metafieldValue } = getMetafieldDraftFromValue(value);
  if (!name) return "";

  if (operator === "equals" && metafieldValue) {
    return `${name} = ${metafieldValue}`;
  }

  return name;
}

export function metafieldConditionNeedsValue(operator) {
  return operator === "equals";
}

export function normalizeProductStatusValue(value) {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "ACTIVE" || normalized === "DRAFT") return normalized;
  return "ACTIVE";
}

export function normalizePublishedStatusValue(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "published" || normalized === "unpublished") return normalized;
  return "published";
}

export function normalizeTaxableValue(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["true", "yes", "1"].includes(normalized)) return "true";
  if (["false", "no", "0"].includes(normalized)) return "false";
  return "true";
}

export function normalizeInventoryOutOfStockPolicyValue(value) {
  const normalized = String(value ?? "").trim().toUpperCase().replace(/\s+/g, "_");
  if (normalized === "CONTINUE" || normalized.includes("CONTINUE")) return "CONTINUE";
  if (normalized === "DENY" || normalized.includes("DENY") || normalized.includes("STOP")) {
    return "DENY";
  }
  return "CONTINUE";
}

export function normalizeInventoryTrackingValue(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["true", "yes", "1"].includes(normalized) || normalized.includes("shopify tracks")) {
    return "true";
  }
  if (
    ["false", "no", "0"].includes(normalized) ||
    normalized.includes("don't track") ||
    normalized.includes("dont track")
  ) {
    return "false";
  }
  return "true";
}

export function normalizePhysicalProductValue(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["true", "yes", "1"].includes(normalized)) return "true";
  if (["false", "no", "0"].includes(normalized)) return "false";
  if (normalized.includes("not a physical") || normalized.includes("not physical")) {
    return "false";
  }
  if (normalized.includes("physical product") || normalized.startsWith("yes")) {
    return "true";
  }
  return "true";
}

export function isValueAllowedForField(field, value, collections = []) {
  if (field === "collection") {
    const trimmed = String(value ?? "").trim();
    if (!trimmed) return collections.length === 0;
    if (collections.length === 0) return true;
    return collections.some(
      (collection) => normalizeCollectionValue(value, collections) === collection.id
    );
  }

  if (field === "status") {
    const normalized = String(value ?? "").trim().toUpperCase();
    return PRODUCT_STATUS_OPTIONS.some((option) => option.value === normalized);
  }

  if (field === "published_status") {
    const normalized = String(value ?? "").trim().toLowerCase();
    return PUBLISHED_STATUS_OPTIONS.some((option) => option.value === normalized);
  }

  if (field === "taxable") {
    return TAXABLE_OPTIONS.some((option) => option.value === normalizeTaxableValue(value));
  }

  if (field === "inventory_out_of_stock_policy") {
    return INVENTORY_OUT_OF_STOCK_POLICY_OPTIONS.some(
      (option) => option.value === normalizeInventoryOutOfStockPolicyValue(value)
    );
  }

  if (field === "inventory_policy") {
    return INVENTORY_TRACKING_OPTIONS.some(
      (option) => option.value === normalizeInventoryTrackingValue(value)
    );
  }

  if (field === "physical_product") {
    return PHYSICAL_PRODUCT_OPTIONS.some(
      (option) => option.value === normalizePhysicalProductValue(value)
    );
  }

  if (field === "product_metafield" || field === "variant_metafield") {
    const trimmed = String(value ?? "").trim();
    if (!trimmed) return true;
    return isValidMetafieldConditionValue(trimmed);
  }

  if (field === "variant_weight") {
    const trimmed = String(value ?? "").trim();
    if (!trimmed) return true;
    return isValidWeightConditionValue(trimmed);
  }

  if (field === "variant_inventory_at_location") {
    const trimmed = String(value ?? "").trim();
    if (!trimmed) return true;
    return isValidInventoryLocationConditionValue(trimmed);
  }

  return true;
}

export function getDefaultValueForField(field, collections = []) {
  if (field === "collection") return collections[0]?.id ?? "";
  if (field === "status") return "ACTIVE";
  if (field === "published_status") return "published";
  if (field === "taxable") return "true";
  if (field === "inventory_out_of_stock_policy") return "CONTINUE";
  if (field === "inventory_policy") return "true";
  if (field === "physical_product") return "true";
  return "";
}

export const PLACEHOLDER_IMAGE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'><rect width='40' height='40' fill='%23f1f2f3'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='10' fill='%236d7175'>No Image</text></svg>";

export function buildVariantDisplayTitle(productTitle, variantTitle) {
  if (!variantTitle || variantTitle === "Default Title") {
    return productTitle;
  }
  return `${productTitle} (${variantTitle})`;
}

export const PREVIEW_PAGE_SIZE = 5;