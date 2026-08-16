function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Random whole number ending in 0 (10, 20, … 40). Same for all percent sub-options. */
export function getPresetPercentValue() {
  return String(randomInt(1, 4) * 10);
}

/** Random USD amount ending in .00 (10.00, 20.00, …). Same for all fixed-amount sub-options. */
export function getPresetFixedValue() {
  return (randomInt(1, 12) * 10).toFixed(2);
}

export function getPresetFixedPriceAmount() {
  return (randomInt(1, 15) * 10).toFixed(2);
}

export function getPresetComparePriceFormula() {
  const multiplier = (randomInt(12, 17) / 10).toFixed(1);
  return `price * ${multiplier}`;
}

/** Random predefined values for pricing fields (not applied to round off cents). */
export function generatePricingPresets() {
  return {
    percentValue: getPresetPercentValue(),
    fixedValue: getPresetFixedValue(),
    fixedPriceAmount: getPresetFixedPriceAmount(),
    comparePercentValue: getPresetPercentValue(),
    compareFixedValue: getPresetFixedValue(),
    compareFixedPriceAmount: getPresetFixedPriceAmount(),
    comparePriceFormula: getPresetComparePriceFormula(),
    costPercentValue: getPresetPercentValue(),
    costFixedValue: getPresetFixedValue(),
    costFixedPriceAmount: getPresetFixedPriceAmount(),
  };
}

/** @deprecated Use generatePricingPresets */
export function generatePricingPlaceholders() {
  return generatePricingPresets();
}
