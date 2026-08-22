import assert from "node:assert/strict";
import {
  computeScheduledAt,
  parseScheduleDateTime,
  validateScheduleConfig,
  formatDateMDY,
  formatTime12Hour,
  formatScheduleDateTime,
  parseStoredDate,
  formatScheduledTaskLabel,
  resolveRevertRecurrenceType,
  getRevertRecurrenceAllowedValues,
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

test("one-time primary forces revert to one-time", () => {
  assert.equal(
    resolveRevertRecurrenceType("later", "one_time", "daily"),
    "one_time"
  );
  assert.deepEqual(getRevertRecurrenceAllowedValues("later", "one_time"), ["one_time"]);
});

test("revert schedule type always matches the primary schedule type", () => {
  assert.equal(resolveRevertRecurrenceType("later", "daily", "one_time"), "daily");
  assert.equal(resolveRevertRecurrenceType("later", "weekly", "daily"), "weekly");
  assert.equal(resolveRevertRecurrenceType("later", "monthly", "weekly"), "monthly");
  assert.equal(resolveRevertRecurrenceType("now", "daily", "weekly"), "one_time");
  assert.deepEqual(getRevertRecurrenceAllowedValues("later", "weekly"), ["weekly"]);
});

test("validateScheduleConfig accepts recurring daily revert without date", () => {
  const result = validateScheduleConfig({
    changePricesSchedule: "later",
    scheduleRecurrenceType: "daily",
    changePricesAtTime: "09:00 AM",
    revertPrices: true,
    revertRecurrenceType: "daily",
    revertPricesAtTime: "06:00 PM",
    now: at(2026, 6, 18, 7, 0),
  });

  assert.equal(result.errors.length, 0);
  assert.ok(result.revertAt > result.scheduledAt);
  assert.equal(result.scheduledAt.getHours(), 9);
  assert.equal(result.revertAt.getHours(), 18);
  assert.equal(result.revertAt.getDate(), result.scheduledAt.getDate());
});

test("recurring daily revert requires a 3 hour gap", () => {
  const tooSoon = validateScheduleConfig({
    changePricesSchedule: "later",
    scheduleRecurrenceType: "daily",
    changePricesAtTime: "09:00 AM",
    revertPrices: true,
    revertRecurrenceType: "daily",
    revertPricesAtTime: "11:00 AM",
    now: at(2026, 6, 18, 7, 0),
  });
  assert.ok(tooSoon.fieldErrors.revertTimeStr);

  const exactGap = validateScheduleConfig({
    changePricesSchedule: "later",
    scheduleRecurrenceType: "daily",
    changePricesAtTime: "09:00 AM",
    revertPrices: true,
    revertRecurrenceType: "daily",
    revertPricesAtTime: "12:00 PM",
    now: at(2026, 6, 18, 7, 0),
  });
  assert.equal(exactGap.errors.length, 0);
  assert.equal(exactGap.revertAt.getHours(), 12);
});

test("recurring revert at the same time as the next price change is rejected", () => {
  const result = validateScheduleConfig({
    changePricesSchedule: "later",
    scheduleRecurrenceType: "daily",
    changePricesAtTime: "09:00 AM",
    revertPrices: true,
    revertRecurrenceType: "daily",
    revertPricesAtTime: "09:00 AM",
    now: at(2026, 6, 18, 7, 0),
  });
  assert.ok(result.fieldErrors.revertTimeStr);
});

test("weekly revert on a later day does not need a same-day 3 hour clock gap", () => {
  const result = validateScheduleConfig({
    changePricesSchedule: "later",
    scheduleRecurrenceType: "weekly",
    scheduleRecurrenceDayOfWeek: "1",
    changePricesAtTime: "09:00 AM",
    revertPrices: true,
    revertRecurrenceType: "weekly",
    revertRecurrenceDayOfWeek: "5",
    revertPricesAtTime: "09:00 AM",
    now: at(2026, 6, 18, 7, 0), // Saturday
  });
  assert.equal(result.errors.length, 0);
});

test("daily revert rolls to the next day when it is before the price change time", () => {
  const result = validateScheduleConfig({
    changePricesSchedule: "later",
    scheduleRecurrenceType: "daily",
    changePricesAtTime: "06:00 PM",
    revertPrices: true,
    revertRecurrenceType: "daily",
    revertPricesAtTime: "09:00 AM",
    now: at(2026, 6, 18, 10, 0),
  });

  assert.equal(result.errors.length, 0);
  assert.ok(result.revertAt > result.scheduledAt);
  assert.equal(result.scheduledAt.getDate(), 18);
  assert.equal(result.revertAt.getDate(), 19);
});

test("validateScheduleConfig requires weekday for weekly revert", () => {
  const result = validateScheduleConfig({
    changePricesSchedule: "now",
    revertPrices: true,
    revertRecurrenceType: "weekly",
    revertRecurrenceDayOfWeek: "",
    revertPricesAtTime: "04:30 PM",
  });

  assert.ok(result.fieldErrors.revertRecurrenceDay);
});

test("validateScheduleConfig requires after days for monthly revert", () => {
  const result = validateScheduleConfig({
    changePricesSchedule: "now",
    revertPrices: true,
    revertRecurrenceType: "monthly",
    revertRecurrenceDayOfMonth: "",
    revertPricesAtTime: "04:30 PM",
  });

  assert.ok(result.fieldErrors.revertRecurrenceDate);
});

test("monthly revert uses after days instead of a calendar date", () => {
  const result = validateScheduleConfig({
    changePricesSchedule: "later",
    scheduleRecurrenceType: "monthly",
    scheduleRecurrenceDayOfMonth: "15",
    changePricesAtTime: "09:00 AM",
    revertPrices: true,
    revertRecurrenceType: "monthly",
    revertRecurrenceDayOfMonth: "5",
    revertPricesAtTime: "09:00 AM",
    now: at(2026, 6, 10, 7, 0),
  });

  assert.equal(result.errors.length, 0);
  assert.equal(result.scheduledAt.getDate(), 15);
  assert.equal(result.scheduledAt.getMonth(), 6);
  assert.equal(result.revertAt.getDate(), 20);
  assert.equal(result.revertAt.getMonth(), 6);
});

test("monthly revert rejects after days outside 1-28", () => {
  const result = validateScheduleConfig({
    changePricesSchedule: "later",
    scheduleRecurrenceType: "monthly",
    scheduleRecurrenceDayOfMonth: "15",
    changePricesAtTime: "09:00 AM",
    revertPrices: true,
    revertRecurrenceType: "monthly",
    revertRecurrenceDayOfMonth: "31",
    revertPricesAtTime: "09:00 AM",
    now: at(2026, 6, 10, 7, 0),
  });

  assert.ok(result.fieldErrors.revertRecurrenceDate);
});

test("monthly revert after days that lands on the next price change is rejected", () => {
  const result = validateScheduleConfig({
    changePricesSchedule: "later",
    scheduleRecurrenceType: "monthly",
    scheduleRecurrenceDayOfMonth: "1",
    changePricesAtTime: "09:00 AM",
    revertPrices: true,
    revertRecurrenceType: "monthly",
    revertRecurrenceDayOfMonth: "28",
    revertPricesAtTime: "09:00 AM",
    now: at(2026, 0, 10, 7, 0),
  });

  assert.ok(result.fieldErrors.revertTimeStr);
});

test("validateScheduleConfig skips schedule fields when running now", () => {
  const result = validateScheduleConfig({
    changePricesSchedule: "now",
    changePricesAtDate: "",
    changePricesAtTime: "",
  });

  assert.equal(result.errors.length, 0);
});

test("one-time schedule respects shop timezone", () => {
  const scheduledAt = parseScheduleDateTime("7/11/2026", "04:34 PM", "Asia/Kolkata");
  assert.ok(scheduledAt);
  assert.equal(formatDateMDY(scheduledAt, "Asia/Kolkata"), "7/11/2026");
  assert.equal(formatTime12Hour(scheduledAt, "Asia/Kolkata"), "4:34 PM");
});

test("daily schedule uses shop timezone for next occurrence", () => {
  const now = new Date("2026-07-18T06:00:00.000Z"); // 11:30 AM IST
  const scheduledAt = computeScheduledAt({
    recurrenceType: "daily",
    changePricesAtTime: "04:30 PM",
    now,
    timeZone: "Asia/Kolkata",
  });

  assert.equal(formatDateMDY(scheduledAt, "Asia/Kolkata"), "7/18/2026");
  assert.equal(formatTime12Hour(scheduledAt, "Asia/Kolkata"), "4:30 PM");
});

test("parseStoredDate treats timezone-less ISO values as UTC", () => {
  const parsed = parseStoredDate("2026-08-15T17:00:00.000");
  assert.equal(formatScheduleDateTime(parsed, "Asia/Kolkata"), "8/15/2026, 10:30 PM");
});

test("formatScheduleDateTime matches entered shop-local schedule time", () => {
  const scheduledAt = parseScheduleDateTime("8/15/2026", "10:30 PM", "Asia/Kolkata");
  assert.equal(formatScheduleDateTime(scheduledAt, "Asia/Kolkata"), "8/15/2026, 10:30 PM");
});

test("formatScheduledTaskLabel prefers stored user-entered schedule strings", () => {
  const label = formatScheduledTaskLabel({
    actionData: {
      changePricesAtDate: "8/15/2026",
      changePricesAtTime: "10:30 PM",
      scheduleTimezone: "Asia/Kolkata",
    },
    scheduledAt: "2026-08-15T21:10:00.000Z",
    dateField: "changePricesAtDate",
    timeField: "changePricesAtTime",
    shopTimezone: "Asia/Kolkata",
  });

  assert.equal(label, "8/15/2026, 10:30 PM");
});

console.log("All schedule tests passed.");
