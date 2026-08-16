import assert from "node:assert/strict";
import { decodeRoundCents, encodeRoundCents, ROUNDING_MODES } from "./round-cents-ui.js";

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

test("legacy no rounding decodes to none mode", () => {
  const decoded = decodeRoundCents("1", "");
  assert.equal(decoded.mode, ROUNDING_MODES.NONE);
  assert.equal(encodeRoundCents(ROUNDING_MODES.NONE).roundCents, "1");
});

test("nearest cent encode preserves decimal places", () => {
  const encoded = encodeRoundCents(ROUNDING_MODES.NEAREST_CENT, "up", "0");
  assert.equal(encoded.roundCents, "10");
  assert.equal(encoded.roundCentsDigit, "0");
});

test("end 99 direction change preserves whole pattern", () => {
  const pattern = 'p:{"whole":["1","*"],"cents":["9","9"],"direction":"up"}';
  const encoded = encodeRoundCents(ROUNDING_MODES.END_99, "down", pattern);
  assert.match(encoded.roundCentsDigit, /^p:/);
  assert.match(encoded.roundCentsDigit, /"whole":\["1","\*"\]/);
  assert.match(encoded.roundCentsDigit, /"direction":"down"/);
});

console.log("All round-cents-ui tests passed.");
