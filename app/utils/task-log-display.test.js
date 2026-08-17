import assert from "node:assert/strict";
import {
  attachProductTagChanges,
  formatTagChangeLines,
  getLogTagChanges,
  getPriceChangeDisplay,
  getTaskTagChanges,
  normalizeTagList,
} from "./task-log-display.js";

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

test("normalizeTagList handles empty and duplicate values", () => {
  assert.deepEqual(normalizeTagList(null), []);
  assert.deepEqual(normalizeTagList(undefined), []);
  assert.deepEqual(normalizeTagList(""), []);
  assert.deepEqual(normalizeTagList([" Tag A ", "", "Tag A", "Tag B"]), ["Tag A", "Tag B"]);
});

test("getTaskTagChanges reads stored task tags", () => {
  assert.deepEqual(
    getTaskTagChanges({ tagsToAdd: ["Sale"], tagsToRemove: ["Old"] }),
    { added: ["Sale"], removed: ["Old"] }
  );
  assert.deepEqual(
    getTaskTagChanges({ runPayload: { tagsToAddList: ["New"], tagsToRemoveList: [] } }),
    { added: ["New"], removed: [] }
  );
  assert.deepEqual(getTaskTagChanges({}), { added: [], removed: [] });
});

test("getLogTagChanges prefers per-log tags then falls back to task tags", () => {
  assert.deepEqual(
    getLogTagChanges({ tagsAdded: ["A"], tagsRemoved: ["B"] }, { added: ["X"], removed: ["Y"] }),
    { added: ["A"], removed: ["B"] }
  );
  assert.deepEqual(
    getLogTagChanges({ tagsAdded: [], tagsRemoved: [] }, { added: ["X"], removed: ["Y"] }),
    { added: [], removed: [] }
  );
  assert.deepEqual(
    getLogTagChanges({ productTitle: "Shirt" }, { added: ["Sale"], removed: ["Old"] }),
    { added: ["Sale"], removed: ["Old"] }
  );
});

test("formatTagChangeLines covers added, removed, both, and none", () => {
  assert.deepEqual(formatTagChangeLines({ added: ["Tag A", "Tag B"] }), ["Added: Tag A, Tag B"]);
  assert.deepEqual(formatTagChangeLines({ removed: ["Tag C"] }), ["Removed: Tag C"]);
  assert.deepEqual(formatTagChangeLines({ added: ["Tag A"], removed: ["Tag C"] }), [
    "Added: Tag A",
    "Removed: Tag C",
  ]);
  assert.deepEqual(formatTagChangeLines({ added: [], removed: [] }), []);
  assert.deepEqual(formatTagChangeLines({}), []);
});

test("attachProductTagChanges stamps matching logs only", () => {
  const logs = [
    { productId: "prod-1", variantId: "v1" },
    { productId: "prod-2", variantId: "v2" },
    { productId: "prod-1", variantId: "v3" },
  ];
  attachProductTagChanges(logs, "prod-1", ["Sale"], ["Old"]);
  assert.deepEqual(logs[0].tagsAdded, ["Sale"]);
  assert.deepEqual(logs[0].tagsRemoved, ["Old"]);
  assert.equal(logs[1].tagsAdded, undefined);
  assert.deepEqual(logs[2].tagsAdded, ["Sale"]);
});

test("getPriceChangeDisplay shows a single value when prices are unchanged", () => {
  assert.deepEqual(getPriceChangeDisplay("20.00", "20.00"), { type: "unchanged", value: "20.00" });
  assert.deepEqual(getPriceChangeDisplay("20", "20.00"), { type: "unchanged", value: "20.00" });
  assert.deepEqual(getPriceChangeDisplay("-", "-"), { type: "blank", value: "-" });
});

test("getPriceChangeDisplay keeps old to new when prices differ", () => {
  assert.deepEqual(getPriceChangeDisplay("20.00", "22.00"), {
    type: "changed",
    oldValue: "20.00",
    newValue: "22.00",
  });
  assert.deepEqual(getPriceChangeDisplay("-", "10.00"), {
    type: "changed",
    oldValue: "-",
    newValue: "10.00",
  });
});

console.log("All task-log-display tests passed.");
