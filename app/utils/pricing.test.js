import assert from "node:assert/strict";
import {
  calculateNewValue,
  calculateVariantPricing,
  calculateExamplePricing,
  evaluateFormula,
  validatePricingConfig,
  roundValue,
  roundToMultiple,
  formatPrice,
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

test("end prices in a certain number uses ending digits", () => {
  assert.equal(roundValue(12.34, "9", "99"), 12.99);
  assert.equal(roundValue(12.87, "9", "95"), 12.95);
  assert.equal(roundValue(12.87, "9", "00"), 12);
});

test("end prices pattern supports direction", () => {
  const pattern = 'p:{"whole":["*","*"],"cents":["5","0"],"direction":"closest"}';
  assert.equal(roundValue(12.34, "9", pattern), 12.5);
  assert.equal(roundValue(12.51, "9", pattern), 12.5);

  const upPattern = 'p:{"whole":["*","*"],"cents":["5","0"],"direction":"up"}';
  assert.equal(roundValue(12.51, "9", upPattern), 13.5);

  const downPattern = 'p:{"whole":["*","*"],"cents":["5","0"],"direction":"down"}';
  assert.equal(roundValue(12.51, "9", downPattern), 12.5);
});

test("end prices in 99 supports round down", () => {
  const downPattern = 'p:{"whole":["*"],"cents":["9","9"],"direction":"down"}';
  assert.equal(roundValue(12.51, "9", downPattern), 11.99);
});

test("round down to nearest cent", () => {
  assert.equal(roundValue(12.349, "11", "2"), 12.34);
});

test("fixed round off uses decimal places", () => {
  assert.equal(roundValue(12.3456, "2", "2"), 12.35);
  assert.equal(roundValue(12.3456, "2", "0"), 12);
});

test("round up to nearest cent", () => {
  assert.equal(roundValue(12.341, "10", "2"), 12.35);
  assert.equal(roundValue(12.001, "10", "2"), 12.01);
});

test("custom multiple rounding", () => {
  assert.equal(roundValue(12.34, "6", "5"), 12.35);
  assert.equal(roundValue(12.31, "7", "5"), 12.35);
  assert.equal(roundValue(12.39, "8", "5"), 12.35);
});

test("pattern multiple rounding", () => {
  const pattern = 'm:{"whole":["*","*"],"cents":["1","0"]}';
  assert.equal(roundValue(12.34, "6", pattern), 12.3);
  assert.equal(roundValue(12.36, "6", pattern), 12.4);
  assert.equal(roundValue(12.31, "7", pattern), 12.4);
  assert.equal(roundValue(12.39, "8", pattern), 12.3);
});

test("multiple 0.40 rounds to divisible increments", () => {
  const pattern = 'm:{"whole":["*","*"],"cents":["4","0"]}';

  assert.equal(roundValue(100.3, "8", pattern), 100);
  assert.equal(roundValue(100.3, "7", pattern), 100.4);
  assert.equal(roundValue(100.3, "6", pattern), 100.4);

  assert.equal(roundValue(100.2, "8", pattern), 100);
  assert.equal(roundValue(100.2, "7", pattern), 100.4);
  assert.equal(roundValue(100.2, "6", pattern), 100);

  assert.equal(roundValue(100.4, "6", pattern), 100.4);
  assert.equal(roundValue(100, "6", pattern), 100);
  assert.equal(formatPrice(roundValue(100.3, "6", pattern)), "100.40");
});

test("multiple 0.25 and whole-number multiple", () => {
  const quarterPattern = 'm:{"whole":["*","*"],"cents":["2","5"]}';
  assert.equal(roundValue(10.12, "6", quarterPattern), 10);
  assert.equal(roundValue(10.13, "6", quarterPattern), 10.25);

  const fivePattern = 'm:{"whole":["5"],"cents":["0","0"]}';
  assert.equal(roundValue(12, "6", fivePattern), 10);
  assert.equal(roundValue(13, "7", fivePattern), 15);
  assert.equal(roundValue(12.5, "8", fivePattern), 10);
});

test("multiple rounding handles zero price", () => {
  const pattern = 'm:{"whole":["*","*"],"cents":["4","0"]}';
  assert.equal(roundValue(0, "6", pattern), 0);
  assert.equal(roundValue(-1, "6", pattern), 0);
});

test("roundToMultiple uses interval not decimal ending", () => {
  assert.equal(roundToMultiple(100.8, 0.4, "closest"), 100.8);
  assert.equal(roundToMultiple(101, 0.4, "closest"), 100.8);
  assert.equal(roundToMultiple(101.1, 0.4, "closest"), 101.2);
  assert.equal(roundToMultiple(101.2, 0.4, "closest"), 101.2);
});

test("fixed whole ending pattern supports direction", () => {
  const pattern = 'p:{"whole":["1","2"],"cents":["5","0"],"direction":"down"}';
  assert.equal(roundValue(13.2, "9", pattern), 12.5);
});

console.log("All pricing tests passed.");
