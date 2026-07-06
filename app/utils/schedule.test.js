import assert from "node:assert/strict";
import {
  parseScheduleDateTime,
  validateScheduleConfig,
} from "./schedule.js";

function test(name, fn) {
  fn();
  console.log(`✓ ${name}`);
}

test("parses schedule date and time", () => {
  const date = parseScheduleDateTime("7/11/2026", "04:34 PM");
  assert.ok(date);
  assert.equal(date.getFullYear(), 2026);
  assert.equal(date.getMonth(), 6);
  assert.equal(date.getDate(), 11);
  assert.equal(date.getHours(), 16);
  assert.equal(date.getMinutes(), 34);
});

test("rejects revert before start", () => {
  const result = validateScheduleConfig({
    changePricesSchedule: "later",
    changePricesAtDate: "7/11/2026",
    changePricesAtTime: "04:34 PM",
    revertPrices: true,
    revertPricesAtDate: "7/11/2026",
    revertPricesAtTime: "04:30 PM",
  });
  assert.ok(result.errors.length > 0);
});

console.log("All schedule tests passed.");
