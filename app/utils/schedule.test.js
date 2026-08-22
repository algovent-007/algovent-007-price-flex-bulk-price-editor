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
  getDefaultRevertDateTime,
  getScheduleDatePickerAllowRange,
  SCHEDULE_DATE_PICKER_MAX_DAYS,
  RECURRING_REVERT_OFFSET_HOURS,
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

test("recurring revert is exactly 3 hours after the primary run", () => {
  const result = validateScheduleConfig({
    changePricesSchedule: "later",
    scheduleRecurrenceType: "daily",
    changePricesAtTime: "10:00 AM",
    revertPrices: true,
  });

  assert.equal(result.errors.length, 0);
  assert.equal(
    result.revertAt.getTime() - result.scheduledAt.getTime(),
    RECURRING_REVERT_OFFSET_HOURS * 60 * 60 * 1000,
  );
  assert.equal(formatTime12Hour(result.revertAt), "1:00 PM");
});

test("recurring revert offset crosses midnight", () => {
  const start = at(2026, 6, 18, 22, 0);
  const revertAt = getDefaultRevertDateTime(start, RECURRING_REVERT_OFFSET_HOURS);

  assert.equal(revertAt.getDate(), 19);
  assert.equal(revertAt.getHours(), 1);
  assert.equal(revertAt.getMinutes(), 0);
});

test("schedule date picker allows today through 28 days ahead", () => {
  const now = at(2026, 6, 18, 10, 0);
  assert.equal(SCHEDULE_DATE_PICKER_MAX_DAYS, 28);
  assert.equal(getScheduleDatePickerAllowRange(now), "2026-07-18--2026-08-15");
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
