const STORAGE_PREFIX = "price_flex_saved_pricing_rules";

function getStorageKey(shop) {
  return `${STORAGE_PREFIX}:${shop || "default"}`;
}

export function buildPricingRulesSnapshot(values) {
  return {
    changePrice: values.changePrice,
    percentType: values.percentType,
    percentValue: values.percentValue,
    fixedType: values.fixedType,
    fixedValue: values.fixedValue,
    roundCents: values.roundCents,
    roundCentsDigit: values.roundCentsDigit,
    comparePriceType: values.comparePriceType,
    costPriceType: values.costPriceType,
    fixedPriceAmount: values.fixedPriceAmount,
    priceFormula: values.priceFormula,
    comparePriceFormula: values.comparePriceFormula,
    comparePercentType: values.comparePercentType,
    comparePercentValue: values.comparePercentValue,
    compareFixedType: values.compareFixedType,
    compareFixedValue: values.compareFixedValue,
    compareFixedPriceAmount: values.compareFixedPriceAmount,
    compareRoundCents: values.compareRoundCents,
    compareRoundCentsDigit: values.compareRoundCentsDigit,
    costPercentType: values.costPercentType,
    costPercentValue: values.costPercentValue,
    costFixedType: values.costFixedType,
    costFixedValue: values.costFixedValue,
    costFixedPriceAmount: values.costFixedPriceAmount,
    costRoundCents: values.costRoundCents,
    costRoundCentsDigit: values.costRoundCentsDigit,
  };
}

export function savePricingRules(shop, rules) {
  localStorage.setItem(getStorageKey(shop), JSON.stringify(rules));
}

export function clearSavedPricingRules(shop) {
  localStorage.removeItem(getStorageKey(shop));
}

export function loadSavedPricingRules(shop) {
  const raw = localStorage.getItem(getStorageKey(shop));
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
