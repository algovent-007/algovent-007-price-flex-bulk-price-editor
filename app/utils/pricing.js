/**
 * Shared pricing calculation logic for preview and bulk task execution.
 */

export function roundValue(p, roundCentsVal) {
  let val = p;
  if (roundCentsVal === "2") {
    val = Math.round(val * 100) / 100;
  } else if (roundCentsVal === "3") {
    val = Math.round(val);
  } else if (roundCentsVal === "4") {
    val = Math.ceil(val);
  } else if (roundCentsVal === "5") {
    val = Math.floor(val);
  } else if (roundCentsVal === "6") {
    val = Math.round(val * 20) / 20;
  } else if (roundCentsVal === "7") {
    val = Math.ceil(val * 20) / 20;
  } else if (roundCentsVal === "8") {
    val = Math.floor(val * 20) / 20;
  } else if (roundCentsVal === "9") {
    val = Math.floor(val) + 0.99;
  }
  return val;
}

export function clampPrice(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

export function formatPrice(value) {
  return clampPrice(value).toFixed(2);
}

/**
 * Safely evaluate a price formula using price, compare, and cost variables.
 * Example: "price * 1.1 + cost * 0.2"
 */
export function evaluateFormula(formula, { price = 0, compare = 0, cost = 0 }) {
  if (!formula || !String(formula).trim()) {
    return { value: null, error: "Formula is required" };
  }

  let expr = String(formula).trim();
  expr = expr.replace(/\bprice\b/gi, String(Number(price) || 0));
  expr = expr.replace(/\bcompare\b/gi, String(Number(compare) || 0));
  expr = expr.replace(/\bcost\b/gi, String(Number(cost) || 0));

  if (!/^[\d\s+\-*/().]+$/.test(expr)) {
    return { value: null, error: "Formula contains invalid characters" };
  }

  try {
    const result = Function(`"use strict"; return (${expr})`)();
    if (typeof result !== "number" || !Number.isFinite(result)) {
      return { value: null, error: "Formula did not produce a valid number" };
    }
    return { value: result, error: null };
  } catch {
    return { value: null, error: "Formula could not be evaluated" };
  }
}

function applyPercentAdjustment(p, percentType, percentVal) {
  const pct = parseFloat(percentVal) || 0;
  if (percentType === "1") {
    return p + (p * pct) / 100;
  }
  if (percentType === "2") {
    return p - (p * pct) / 100;
  }
  if (percentType === "4") {
    return p + pct;
  }
  return p;
}

function applyFixedAdjustment(p, fixedType, fixedVal) {
  const fix = parseFloat(fixedVal) || 0;
  if (fixedType === "1") {
    return p + fix;
  }
  if (fixedType === "2") {
    return p - fix;
  }
  if (fixedType === "4") {
    return p * fix;
  }
  return p;
}

function resolveBaseValue(baseType, fieldKind, ctx) {
  const { originalPrice, newPrice, currentCompare, currentCost, hasCompare, hasCost } = ctx;

  if (fieldKind === "price") {
    if (baseType === "1") return { value: originalPrice, skipped: false, error: null };
    if (baseType === "2") {
      if (!hasCompare) {
        return { value: originalPrice, skipped: true, error: "Missing compare-at price" };
      }
      return { value: currentCompare, skipped: false, error: null };
    }
    if (baseType === "3") {
      if (!hasCost) {
        return { value: originalPrice, skipped: true, error: "Missing cost per item" };
      }
      return { value: currentCost, skipped: false, error: null };
    }
  }

  if (fieldKind === "compare") {
    if (baseType === "1") {
      if (!hasCompare) {
        return { value: ctx.currentCompareValue ?? 0, skipped: true, error: "Missing compare-at price" };
      }
      return { value: currentCompare, skipped: false, error: null };
    }
    if (baseType === "2") return { value: newPrice, skipped: false, error: null };
    if (baseType === "3") return { value: originalPrice, skipped: false, error: null };
    if (baseType === "4") {
      if (!hasCost) {
        return { value: ctx.currentCompareValue ?? 0, skipped: true, error: "Missing cost per item" };
      }
      return { value: currentCost, skipped: false, error: null };
    }
  }

  if (fieldKind === "cost") {
    if (baseType === "1") return { value: originalPrice, skipped: false, error: null };
    if (baseType === "2") {
      if (!hasCompare) {
        return { value: ctx.currentCostValue ?? 0, skipped: true, error: "Missing compare-at price" };
      }
      return { value: currentCompare, skipped: false, error: null };
    }
    if (baseType === "3") {
      if (!hasCost) {
        return { value: ctx.currentCostValue ?? 0, skipped: true, error: "Missing cost per item" };
      }
      return { value: currentCost, skipped: false, error: null };
    }
    if (baseType === "4") return { value: newPrice, skipped: false, error: null };
  }

  return { value: originalPrice, skipped: false, error: null };
}

export function calculateNewValue({
  currentVal,
  baseType,
  fieldKind = "price",
  originalPrice,
  newPrice,
  currentCompare,
  currentCost,
  hasCompare = true,
  hasCost = true,
  percentType,
  percentVal,
  fixedType,
  fixedVal,
  fixedPriceAmt,
  roundCentsVal,
  formula = "",
}) {
  const ctx = {
    originalPrice: Number(originalPrice) || 0,
    newPrice: Number(newPrice) || 0,
    currentCompare: Number(currentCompare) || 0,
    currentCost: Number(currentCost) || 0,
    currentCompareValue: Number(currentVal) || 0,
    currentCostValue: Number(currentVal) || 0,
    hasCompare,
    hasCost,
  };

  if (baseType === "6") {
    return { value: Number(currentVal) || 0, skipped: false, error: null };
  }

  if (baseType === "7") {
    return { value: null, skipped: false, error: null };
  }

  if (baseType === "9") {
    return { value: 0, skipped: false, error: null };
  }

  if (baseType === "5") {
    const fixed = parseFloat(fixedPriceAmt);
    if (fixedPriceAmt === "" || fixedPriceAmt == null || Number.isNaN(fixed)) {
      return { value: Number(currentVal) || 0, skipped: true, error: "Fixed amount is required" };
    }
    return { value: roundValue(clampPrice(fixed), roundCentsVal), skipped: false, error: null };
  }

  if (baseType === "8") {
    const { value, error } = evaluateFormula(formula, {
      price: ctx.originalPrice,
      compare: ctx.hasCompare ? ctx.currentCompare : 0,
      cost: ctx.hasCost ? ctx.currentCost : 0,
    });
    if (error || value === null) {
      return { value: Number(currentVal) || 0, skipped: true, error: error || "Invalid formula" };
    }
    return { value: roundValue(clampPrice(value), roundCentsVal), skipped: false, error: null };
  }

  const baseResult = resolveBaseValue(baseType, fieldKind, ctx);
  if (baseResult.skipped) {
    return { value: Number(currentVal) || 0, skipped: true, error: baseResult.error };
  }

  let p = baseResult.value;
  p = applyPercentAdjustment(p, percentType, percentVal);
  p = applyFixedAdjustment(p, fixedType, fixedVal);
  p = roundValue(clampPrice(p), roundCentsVal);

  return { value: p, skipped: false, error: null };
}

export function calculateVariantPricing({
  changePrice,
  percentType,
  percentValue,
  fixedType,
  fixedValue,
  fixedPriceAmount,
  roundCents,
  priceFormula,
  comparePriceType,
  comparePercentType,
  comparePercentValue,
  compareFixedType,
  compareFixedValue,
  compareFixedPriceAmount,
  compareRoundCents,
  comparePriceFormula,
  costPriceType,
  costPercentType,
  costPercentValue,
  costFixedType,
  costFixedValue,
  costFixedPriceAmount,
  costRoundCents,
  originalPrice,
  originalCompare,
  originalCost,
  hasCompare,
  hasCost,
}) {
  const warnings = [];

  const priceResult =
    changePrice === "6"
      ? { value: originalPrice, skipped: false, error: null }
      : calculateNewValue({
          currentVal: originalPrice,
          baseType: changePrice,
          fieldKind: "price",
          originalPrice,
          newPrice: originalPrice,
          currentCompare: originalCompare,
          currentCost: originalCost,
          hasCompare,
          hasCost,
          percentType,
          percentVal: percentValue,
          fixedType,
          fixedVal: fixedValue,
          fixedPriceAmt: fixedPriceAmount,
          roundCentsVal: roundCents,
          formula: priceFormula,
        });

  if (priceResult.error) warnings.push(`Price: ${priceResult.error}`);

  let newPrice = priceResult.skipped ? originalPrice : priceResult.value;
  if (Number.isNaN(newPrice)) newPrice = originalPrice;

  let newCompare = originalCompare;
  let compareSkipped = false;
  if (comparePriceType === "6") {
    newCompare = originalCompare;
  } else if (comparePriceType === "7" || comparePriceType === "9") {
    newCompare = null;
  } else {
    const compareResult = calculateNewValue({
      currentVal: originalCompare,
      baseType: comparePriceType,
      fieldKind: "compare",
      originalPrice,
      newPrice,
      currentCompare: originalCompare,
      currentCost: originalCost,
      hasCompare,
      hasCost,
      percentType: comparePercentType,
      percentVal: comparePercentValue,
      fixedType: compareFixedType,
      fixedVal: compareFixedValue,
      fixedPriceAmt: compareFixedPriceAmount,
      roundCentsVal: compareRoundCents,
      formula: comparePriceFormula,
    });
    if (compareResult.error) warnings.push(`Compare-at: ${compareResult.error}`);
    compareSkipped = compareResult.skipped;
    newCompare = compareResult.skipped ? originalCompare : compareResult.value;
    if (Number.isNaN(newCompare)) newCompare = originalCompare;
  }

  let newCost = originalCost;
  let costSkipped = false;
  if (costPriceType !== "6") {
    const costResult = calculateNewValue({
      currentVal: originalCost,
      baseType: costPriceType,
      fieldKind: "cost",
      originalPrice,
      newPrice,
      currentCompare: originalCompare,
      currentCost: originalCost,
      hasCompare,
      hasCost,
      percentType: costPercentType,
      percentVal: costPercentValue,
      fixedType: costFixedType,
      fixedVal: costFixedValue,
      fixedPriceAmt: costFixedPriceAmount,
      roundCentsVal: costRoundCents,
      formula: "",
    });
    if (costResult.error) warnings.push(`Cost: ${costResult.error}`);
    costSkipped = costResult.skipped;
    newCost = costResult.skipped ? originalCost : costResult.value;
    if (Number.isNaN(newCost)) newCost = originalCost;
  }

  return {
    newPrice,
    newCompare,
    newCost,
    warnings,
    priceSkipped: priceResult.skipped,
    compareSkipped,
    costSkipped,
  };
}

export function calculateExamplePricing(params) {
  const originalPrice = parseFloat(params.examplePrice) || 0;
  const originalCompare = parseFloat(params.exampleCompare) || 0;
  const originalCost = parseFloat(params.exampleCost) || 0;

  const result = calculateVariantPricing({
    ...params,
    originalPrice,
    originalCompare,
    originalCost,
    hasCompare: params.exampleCompare !== "" && params.exampleCompare != null,
    hasCost: params.exampleCost !== "" && params.exampleCost != null,
  });

  return {
    calcPrice: params.changePrice === "6" ? formatPrice(originalPrice) : formatPrice(result.newPrice),
    calcCompare:
      params.comparePriceType === "6"
        ? formatPrice(originalCompare)
        : params.comparePriceType === "7" || params.comparePriceType === "9"
          ? "0.00"
          : formatPrice(result.newCompare ?? 0),
    calcCost: params.costPriceType === "6" ? formatPrice(originalCost) : formatPrice(result.newCost),
    warnings: result.warnings,
  };
}

export function validatePricingConfig(config) {
  const errors = [];
  const fieldErrors = {};

  const addError = (field, message) => {
    errors.push(message);
    if (field && !fieldErrors[field]) {
      fieldErrors[field] = message;
    }
  };

  const requireNumericValue = (value, label, field) => {
    if (String(value ?? "").trim() === "") {
      addError(field, `${label} is required.`);
      return;
    }
    const parsed = parseFloat(value);
    if (Number.isNaN(parsed)) {
      addError(field, `${label} must be a valid number.`);
    }
  };

  const validateAdjustmentValues = (
    percentType,
    percentValue,
    fixedType,
    fixedValue,
    percentField,
    fixedField
  ) => {
    if (["1", "2", "4"].includes(String(percentType))) {
      requireNumericValue(percentValue, "Percent value", percentField);
    }

    if (["1", "2", "4"].includes(String(fixedType))) {
      requireNumericValue(fixedValue, "Fixed amount value", fixedField);
    }
  };

  if (["1", "2", "3"].includes(String(config.changePrice))) {
    validateAdjustmentValues(
      config.percentType,
      config.percentValue,
      config.fixedType,
      config.fixedValue,
      "percentValue",
      "fixedValue"
    );
  }

  if (config.changePrice === "5") {
    const fixed = parseFloat(config.fixedPriceAmount);
    if (config.fixedPriceAmount === "" || Number.isNaN(fixed)) {
      addError("fixedPriceAmount", "Enter a fixed price amount.");
    } else if (fixed < 0) {
      addError("fixedPriceAmount", "Fixed price amount cannot be negative.");
    }
  }

  if (config.changePrice === "8" && !String(config.priceFormula || "").trim()) {
    addError("priceFormula", "Enter a price formula.");
  }

  if (["1", "2", "3", "4"].includes(String(config.comparePriceType))) {
    validateAdjustmentValues(
      config.comparePercentType,
      config.comparePercentValue,
      config.compareFixedType,
      config.compareFixedValue,
      "comparePercentValue",
      "compareFixedValue"
    );
  }

  if (config.comparePriceType === "5") {
    const fixed = parseFloat(config.compareFixedPriceAmount);
    if (config.compareFixedPriceAmount === "" || Number.isNaN(fixed)) {
      addError("compareFixedPriceAmount", "Enter a fixed compare-at price amount.");
    } else if (fixed < 0) {
      addError("compareFixedPriceAmount", "Fixed compare-at price amount cannot be negative.");
    }
  }

  if (config.comparePriceType === "8" && !String(config.comparePriceFormula || "").trim()) {
    addError("comparePriceFormula", "Enter a compare-at price formula.");
  }

  if (["1", "2", "3", "4"].includes(String(config.costPriceType))) {
    validateAdjustmentValues(
      config.costPercentType,
      config.costPercentValue,
      config.costFixedType,
      config.costFixedValue,
      "costPercentValue",
      "costFixedValue"
    );
  }

  if (config.costPriceType === "5") {
    const fixed = parseFloat(config.costFixedPriceAmount);
    if (config.costFixedPriceAmount === "" || Number.isNaN(fixed)) {
      addError("costFixedPriceAmount", "Enter a fixed cost amount.");
    } else if (fixed < 0) {
      addError("costFixedPriceAmount", "Fixed cost amount cannot be negative.");
    }
  }

  return { errors, fieldErrors };
}
