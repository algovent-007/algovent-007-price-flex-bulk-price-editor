import assert from "node:assert/strict";
import { createDefaultTaskName, nextTaskSequenceNumber } from "./task-name.js";

function test(name, fn) {
  fn();
  console.log(`✓ ${name}`);
}

test("first task uses number 1", () => {
  assert.equal(nextTaskSequenceNumber([]), 1);
  assert.equal(nextTaskSequenceNumber(["Rollback: Task 1 - 8/17/2026", "Copy of Task 2 - 8/17/2026"]), 1);
});

test("uses the next number after existing Task names", () => {
  assert.equal(
    nextTaskSequenceNumber(["Task 1 - 8/16/2026", "Task 3 - 8/17/2026", "sale-123"]),
    4,
  );
});

test("formats as Task number - date", () => {
  assert.equal(
    createDefaultTaskName({
      number: 2,
      date: new Date("2026-08-17T12:00:00Z"),
      timeZone: "UTC",
    }),
    "Task 2 - 8/17/2026",
  );
});

test("falls back to Task 1 when number is missing", () => {
  assert.match(createDefaultTaskName({ date: new Date("2026-01-05T12:00:00Z"), timeZone: "UTC" }), /^Task 1 - 1\/5\/2026$/);
});

console.log("All task-name tests passed.");
