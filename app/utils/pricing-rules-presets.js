export const PRESET_PERCENT_VALUE = "10";
export const PRESET_FIXED_VALUE = "20.00";

/** Predefined values for pricing fields (not applied to round off cents). */
export function generatePricingPresets() {
  return {
    percentValue: PRESET_PERCENT_VALUE,
    fixedValue: PRESET_FIXED_VALUE,
    fixedPriceAmount: PRESET_FIXED_VALUE,
    comparePercentValue: PRESET_PERCENT_VALUE,
    compareFixedValue: PRESET_FIXED_VALUE,
    compareFixedPriceAmount: PRESET_FIXED_VALUE,
    comparePriceFormula: "price * 1.2",
    costPercentValue: PRESET_PERCENT_VALUE,
    costFixedValue: PRESET_FIXED_VALUE,
    costFixedPriceAmount: PRESET_FIXED_VALUE,
  };
}

/** @deprecated Use generatePricingPresets */
export function generatePricingPlaceholders() {
  return generatePricingPresets();
}
