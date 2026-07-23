import assert from "node:assert/strict";
import {
  calculateNewValue,
  calculateVariantPricing,
  calculateExamplePricing,
  evaluateFormula,
  validatePricingConfig,
} from "./pricing.js";

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

test("based on current price increases by percent", () => {
  const result = calculateNewValue({
    currentVal: 100,
    baseType: "1",
    fieldKind: "price",
    originalPrice: 100,
    newPrice: 100,
    currentCompare: 120,
    currentCost: 50,
    hasCompare: true,
    hasCost: true,
    percentType: "1",
    percentVal: "10",
    fixedType: "3",
    fixedVal: "0",
    fixedPriceAmt: "0",
    roundCentsVal: "1",
  });
  assert.equal(result.value, 110);
});

test("based on compare price skips when compare is missing", () => {
  const result = calculateNewValue({
    currentVal: 100,
    baseType: "2",
    fieldKind: "price",
    originalPrice: 100,
    newPrice: 100,
    currentCompare: 0,
    currentCost: 50,
    hasCompare: false,
    hasCost: true,
    percentType: "1",
    percentVal: "10",
    fixedType: "3",
    fixedVal: "0",
    fixedPriceAmt: "0",
    roundCentsVal: "1",
  });
  assert.equal(result.skipped, true);
  assert.equal(result.value, 100);
});

test("fixed amount sets exact price", () => {
  const result = calculateNewValue({
    currentVal: 100,
    baseType: "5",
    fieldKind: "price",
    originalPrice: 100,
    newPrice: 100,
    currentCompare: 0,
    currentCost: 0,
    hasCompare: false,
    hasCost: false,
    percentType: "3",
    percentVal: "0",
    fixedType: "3",
    fixedVal: "0",
    fixedPriceAmt: "35",
    roundCentsVal: "1",
  });
  assert.equal(result.value, 35);
});

test("formula evaluates price expression", () => {
  const result = calculateNewValue({
    currentVal: 100,
    baseType: "8",
    fieldKind: "price",
    originalPrice: 100,
    newPrice: 100,
    currentCompare: 120,
    currentCost: 40,
    hasCompare: true,
    hasCost: true,
    percentType: "3",
    percentVal: "0",
    fixedType: "3",
    fixedVal: "0",
    fixedPriceAmt: "0",
    roundCentsVal: "1",
    formula: "price * 1.1 + cost * 0.25",
  });
  assert.equal(result.value.toFixed(2), "120.00");
});

test("reset fixed price returns zero", () => {
  const result = calculateNewValue({
    currentVal: 100,
    baseType: "9",
    fieldKind: "price",
    originalPrice: 100,
    newPrice: 100,
    currentCompare: 0,
    currentCost: 0,
    hasCompare: false,
    hasCost: false,
    percentType: "3",
    percentVal: "0",
    fixedType: "3",
    fixedVal: "0",
    fixedPriceAmt: "0",
    roundCentsVal: "1",
  });
  assert.equal(result.value, 0);
});

test("compare price based on new product price uses calculated price", () => {
  const result = calculateVariantPricing({
    changePrice: "1",
    percentType: "1",
    percentValue: "10",
    fixedType: "3",
    fixedValue: "0",
    fixedPriceAmount: "0",
    roundCents: "1",
    priceFormula: "",
    comparePriceType: "2",
    comparePercentType: "3",
    comparePercentValue: "0",
    compareFixedType: "3",
    compareFixedValue: "0",
    compareFixedPriceAmount: "0",
    compareRoundCents: "1",
    comparePriceFormula: "",
    costPriceType: "6",
    costPercentType: "3",
    costPercentValue: "0",
    costFixedType: "3",
    costFixedValue: "0",
    costFixedPriceAmount: "0",
    costRoundCents: "1",
    originalPrice: 100,
    originalCompare: 80,
    originalCost: 40,
    hasCompare: true,
    hasCost: true,
  });
  assert.equal(result.newPrice, 110);
  assert.equal(result.newCompare, 110);
});

test("percent fixed change adds raw amount", () => {
  const result = calculateNewValue({
    currentVal: 100,
    baseType: "1",
    fieldKind: "price",
    originalPrice: 100,
    newPrice: 100,
    currentCompare: 0,
    currentCost: 0,
    hasCompare: false,
    hasCost: false,
    percentType: "4",
    percentVal: "5",
    fixedType: "3",
    fixedVal: "0",
    fixedPriceAmt: "0",
    roundCentsVal: "1",
  });
  assert.equal(result.value, 105);
});

test("cost price based on new product price uses calculated price", () => {
  const result = calculateVariantPricing({
    changePrice: "1",
    percentType: "1",
    percentValue: "10",
    fixedType: "3",
    fixedValue: "0",
    fixedPriceAmount: "0",
    roundCents: "1",
    priceFormula: "",
    comparePriceType: "6",
    comparePercentType: "3",
    comparePercentValue: "0",
    compareFixedType: "3",
    compareFixedValue: "0",
    compareFixedPriceAmount: "0",
    compareRoundCents: "1",
    comparePriceFormula: "",
    costPriceType: "4",
    costPercentType: "3",
    costPercentValue: "0",
    costFixedType: "3",
    costFixedValue: "0",
    costFixedPriceAmount: "0",
    costRoundCents: "1",
    originalPrice: 100,
    originalCompare: 80,
    originalCost: 40,
    hasCompare: true,
    hasCost: true,
  });

  assert.equal(result.newPrice, 110);
  assert.equal(result.newCost, 110);
});

test("validation requires formula when formula mode selected", () => {
  const result = validatePricingConfig({
    changePrice: "8",
    fixedPriceAmount: "10",
    priceFormula: "",
    comparePriceType: "6",
    compareFixedPriceAmount: "0",
    comparePriceFormula: "",
    costPriceType: "6",
    costFixedPriceAmount: "0",
  });
  assert.ok(result.errors.length > 0);
  assert.equal(result.fieldErrors.priceFormula, "Enter a price formula.");
});

test("preview matches bulk calculation", () => {
  const preview = calculateExamplePricing({
    changePrice: "5",
    percentType: "3",
    percentValue: "0",
    fixedType: "3",
    fixedValue: "0",
    fixedPriceAmount: "35",
    roundCents: "1",
    priceFormula: "",
    comparePriceType: "6",
    comparePercentType: "3",
    comparePercentValue: "0",
    compareFixedType: "3",
    compareFixedValue: "0",
    compareFixedPriceAmount: "0",
    compareRoundCents: "1",
    comparePriceFormula: "",
    costPriceType: "6",
    costPercentType: "3",
    costPercentValue: "0",
    costFixedType: "3",
    costFixedValue: "0",
    costFixedPriceAmount: "0",
    costRoundCents: "1",
    examplePrice: "22.99",
    exampleCompare: "24.99",
    exampleCost: "12.50",
  });

  const bulk = calculateVariantPricing({
    changePrice: "5",
    percentType: "3",
    percentValue: "0",
    fixedType: "3",
    fixedValue: "0",
    fixedPriceAmount: "35",
    roundCents: "1",
    priceFormula: "",
    comparePriceType: "6",
    comparePercentType: "3",
    comparePercentValue: "0",
    compareFixedType: "3",
    compareFixedValue: "0",
    compareFixedPriceAmount: "0",
    compareRoundCents: "1",
    comparePriceFormula: "",
    costPriceType: "6",
    costPercentType: "3",
    costPercentValue: "0",
    costFixedType: "3",
    costFixedValue: "0",
    costFixedPriceAmount: "0",
    costRoundCents: "1",
    originalPrice: 22.99,
    originalCompare: 24.99,
    originalCost: 12.5,
    hasCompare: true,
    hasCost: true,
  });

  assert.equal(preview.calcPrice, bulk.newPrice.toFixed(2));
});

console.log("All pricing tests passed.");
