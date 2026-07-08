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
    costPercentType: values.costPercentType,
    costPercentValue: values.costPercentValue,
    costFixedType: values.costFixedType,
    costFixedValue: values.costFixedValue,
    costFixedPriceAmount: values.costFixedPriceAmount,
    costRoundCents: values.costRoundCents,
  };
}

export function savePricingRules(shop, rules) {
  localStorage.setItem(getStorageKey(shop), JSON.stringify(rules));
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

export function applySavedPricingRules(rules, setters) {
  if (!rules) return false;

  const {
    setChangePrice,
    setPercentType,
    setPercentValue,
    setFixedType,
    setFixedValue,
    setRoundCents,
    setComparePriceType,
    setCostPriceType,
    setFixedPriceAmount,
    setPriceFormula,
    setComparePriceFormula,
    setComparePercentType,
    setComparePercentValue,
    setCompareFixedType,
    setCompareFixedValue,
    setCompareFixedPriceAmount,
    setCompareRoundCents,
    setCostPercentType,
    setCostPercentValue,
    setCostFixedType,
    setCostFixedValue,
    setCostFixedPriceAmount,
    setCostRoundCents,
  } = setters;

  if (rules.changePrice != null) setChangePrice(String(rules.changePrice));
  if (rules.percentType != null) setPercentType(String(rules.percentType));
  if (rules.percentValue != null) setPercentValue(String(rules.percentValue));
  if (rules.fixedType != null) setFixedType(String(rules.fixedType));
  if (rules.fixedValue != null) setFixedValue(String(rules.fixedValue));
  if (rules.roundCents != null) setRoundCents(String(rules.roundCents));
  if (rules.comparePriceType != null) setComparePriceType(String(rules.comparePriceType));
  if (rules.costPriceType != null) setCostPriceType(String(rules.costPriceType));
  if (rules.fixedPriceAmount != null) setFixedPriceAmount(String(rules.fixedPriceAmount));
  if (rules.priceFormula != null) setPriceFormula(rules.priceFormula);
  if (rules.comparePriceFormula != null) setComparePriceFormula(rules.comparePriceFormula);
  if (rules.comparePercentType != null) setComparePercentType(String(rules.comparePercentType));
  if (rules.comparePercentValue != null) setComparePercentValue(String(rules.comparePercentValue));
  if (rules.compareFixedType != null) setCompareFixedType(String(rules.compareFixedType));
  if (rules.compareFixedValue != null) setCompareFixedValue(String(rules.compareFixedValue));
  if (rules.compareFixedPriceAmount != null) {
    setCompareFixedPriceAmount(String(rules.compareFixedPriceAmount));
  }
  if (rules.compareRoundCents != null) setCompareRoundCents(String(rules.compareRoundCents));
  if (rules.costPercentType != null) setCostPercentType(String(rules.costPercentType));
  if (rules.costPercentValue != null) setCostPercentValue(String(rules.costPercentValue));
  if (rules.costFixedType != null) setCostFixedType(String(rules.costFixedType));
  if (rules.costFixedValue != null) setCostFixedValue(String(rules.costFixedValue));
  if (rules.costFixedPriceAmount != null) setCostFixedPriceAmount(String(rules.costFixedPriceAmount));
  if (rules.costRoundCents != null) setCostRoundCents(String(rules.costRoundCents));

  return true;
}
