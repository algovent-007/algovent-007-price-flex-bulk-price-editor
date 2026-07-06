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
  { value: "variant_cost_item", label: "Variant Cost Per Item" },
];

export const CONDITION_OPERATORS = [
  { value: "equals", label: "is equal to" },
  { value: "not_equals", label: "is not equal to" },
  { value: "contains", label: "contains" },
  { value: "starts_with", label: "starts with" },
  { value: "ends_with", label: "ends with" },
];

export const PLACEHOLDER_IMAGE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'><rect width='40' height='40' fill='%23f1f2f3'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='10' fill='%236d7175'>No Image</text></svg>";

export function buildVariantDisplayTitle(productTitle, variantTitle) {
  if (!variantTitle || variantTitle === "Default Title") {
    return productTitle;
  }
  return `${productTitle} (${variantTitle})`;
}

export const PREVIEW_PAGE_SIZE = 5;
