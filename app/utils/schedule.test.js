import assert from "node:assert/strict";
import {
  computeScheduledAt,
  parseScheduleDateTime,
  validateScheduleConfig,
} from "./schedule.js";

function test(name, fn) {
  fn();
  console.log(`✓ ${name}`);
}

function at(year, month, day, hours, minutes) {
  return new Date(year, month, day, hours, minutes, 0, 0);
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

test("one-time schedule uses explicit date and time", () => {
  const now = at(2026, 6, 18, 10, 0);
  const scheduledAt = computeScheduledAt({
    recurrenceType: "one_time",
    changePricesAtDate: "7/20/2026",
    changePricesAtTime: "04:30 PM",
    now,
  });

  assert.equal(scheduledAt.getFullYear(), 2026);
  assert.equal(scheduledAt.getMonth(), 6);
  assert.equal(scheduledAt.getDate(), 20);
  assert.equal(scheduledAt.getHours(), 16);
  assert.equal(scheduledAt.getMinutes(), 30);
});

test("daily schedule uses later time today", () => {
  const now = at(2026, 6, 18, 10, 0);
  const scheduledAt = computeScheduledAt({
    recurrenceType: "daily",
    changePricesAtTime: "04:30 PM",
    now,
  });

  assert.equal(scheduledAt.getFullYear(), 2026);
  assert.equal(scheduledAt.getMonth(), 6);
  assert.equal(scheduledAt.getDate(), 18);
  assert.equal(scheduledAt.getHours(), 16);
  assert.equal(scheduledAt.getMinutes(), 30);
});

test("daily schedule rolls to tomorrow when time has passed", () => {
  const now = at(2026, 6, 18, 17, 0);
  const scheduledAt = computeScheduledAt({
    recurrenceType: "daily",
    changePricesAtTime: "04:30 PM",
    now,
  });

  assert.equal(scheduledAt.getDate(), 19);
  assert.equal(scheduledAt.getHours(), 16);
  assert.equal(scheduledAt.getMinutes(), 30);
});

test("weekly schedule uses later time on the selected day", () => {
  const now = at(2026, 6, 18, 10, 0); // Saturday
  const scheduledAt = computeScheduledAt({
    recurrenceType: "weekly",
    changePricesAtTime: "04:30 PM",
    scheduleRecurrenceDayOfWeek: "1", // Monday
    now,
  });

  assert.equal(scheduledAt.getDay(), 1);
  assert.equal(scheduledAt.getDate(), 20);
  assert.equal(scheduledAt.getHours(), 16);
});

test("weekly schedule rolls to next week when selected day time has passed", () => {
  const now = at(2026, 6, 20, 17, 0); // Monday after 4:30 PM
  const scheduledAt = computeScheduledAt({
    recurrenceType: "weekly",
    changePricesAtTime: "04:30 PM",
    scheduleRecurrenceDayOfWeek: "1",
    now,
  });

  assert.equal(scheduledAt.getDay(), 1);
  assert.equal(scheduledAt.getDate(), 27);
});

test("monthly schedule uses selected day this month", () => {
  const now = at(2026, 6, 10, 10, 0);
  const scheduledAt = computeScheduledAt({
    recurrenceType: "monthly",
    changePricesAtTime: "09:00 AM",
    scheduleRecurrenceDayOfMonth: "15",
    now,
  });

  assert.equal(scheduledAt.getMonth(), 6);
  assert.equal(scheduledAt.getDate(), 15);
  assert.equal(scheduledAt.getHours(), 9);
});

test("monthly schedule rolls to next month when day time has passed", () => {
  const now = at(2026, 6, 20, 10, 0);
  const scheduledAt = computeScheduledAt({
    recurrenceType: "monthly",
    changePricesAtTime: "09:00 AM",
    scheduleRecurrenceDayOfMonth: "15",
    now,
  });

  assert.equal(scheduledAt.getMonth(), 7);
  assert.equal(scheduledAt.getDate(), 15);
});

test("monthly schedule clamps day 31 in February", () => {
  const now = at(2026, 0, 10, 10, 0); // January 2026
  const scheduledAt = computeScheduledAt({
    recurrenceType: "monthly",
    changePricesAtTime: "09:00 AM",
    scheduleRecurrenceDayOfMonth: "31",
    now,
  });

  assert.equal(scheduledAt.getMonth(), 0);
  assert.equal(scheduledAt.getDate(), 31);

  const nextAfterRun = computeScheduledAt({
    recurrenceType: "monthly",
    changePricesAtTime: "09:00 AM",
    scheduleRecurrenceDayOfMonth: "31",
    now: at(2026, 0, 31, 10, 0),
  });

  assert.equal(nextAfterRun.getMonth(), 1);
  assert.equal(nextAfterRun.getDate(), 28);
});

test("validateScheduleConfig accepts recurring daily without date", () => {
  const result = validateScheduleConfig({
    changePricesSchedule: "later",
    scheduleRecurrenceType: "daily",
    changePricesAtTime: "04:30 PM",
  });

  assert.equal(result.errors.length, 0);
  assert.ok(result.scheduledAt instanceof Date);
});

test("validateScheduleConfig requires weekday for weekly schedule", () => {
  const result = validateScheduleConfig({
    changePricesSchedule: "later",
    scheduleRecurrenceType: "weekly",
    scheduleRecurrenceDayOfWeek: "",
    changePricesAtTime: "04:30 PM",
  });

  assert.ok(result.fieldErrors.scheduleRecurrenceDay);
});

test("validateScheduleConfig requires day of month for monthly schedule", () => {
  const result = validateScheduleConfig({
    changePricesSchedule: "later",
    scheduleRecurrenceType: "monthly",
    scheduleRecurrenceDayOfMonth: "",
    changePricesAtTime: "04:30 PM",
  });

  assert.ok(result.fieldErrors.scheduleRecurrenceDate);
});

test("validateScheduleConfig skips schedule fields when running now", () => {
  const result = validateScheduleConfig({
    changePricesSchedule: "now",
    changePricesAtDate: "",
    changePricesAtTime: "",
  });

  assert.equal(result.errors.length, 0);
});

console.log("All schedule tests passed.");
