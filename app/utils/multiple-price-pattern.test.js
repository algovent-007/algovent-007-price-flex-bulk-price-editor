import assert from "node:assert/strict";
import {
  multiplePatternToValue,
  parseMultipleValue,
} from "./multiple-price-pattern.js";

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

test("pattern * * .40 resolves to 0.40 multiple", () => {
  const pattern = { whole: ["*", "*"], cents: ["4", "0"] };
  assert.equal(multiplePatternToValue(pattern), 0.4);
});

test("pattern 5 .00 resolves to 5 multiple", () => {
  const pattern = { whole: ["5"], cents: ["0", "0"] };
  assert.equal(multiplePatternToValue(pattern), 5);
});

test("legacy digit 5 resolves to 0.05 multiple", () => {
  assert.equal(parseMultipleValue("5"), 0.05);
});

test("serialized pattern resolves to multiple value", () => {
  const serialized = 'm:{"whole":["*","*"],"cents":["4","0"]}';
  assert.equal(parseMultipleValue(serialized), 0.4);
});

console.log("All multiple-price-pattern tests passed.");
