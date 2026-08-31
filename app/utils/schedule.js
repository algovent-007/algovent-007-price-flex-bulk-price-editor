const WEEKDAY_FROM_SHORT = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function parseDateStringParts(dateStr) {
  const parts = String(dateStr || "").trim().split("/");
  if (parts.length !== 3) return null;

  const month = parseInt(parts[0], 10);
  const day = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);

  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000) {
    return null;
  }

  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(probe.getTime()) ||
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

export function parseDateString(dateStr, timeZone) {
  const parts = parseDateStringParts(dateStr);
  if (!parts) return null;

  return wallClockToDate({
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hours: 0,
    minutes: 0,
    timeZone,
  });
}

export function parseTimeString(timeStr) {
  const trimmed = String(timeStr || "").trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = match[3].toUpperCase();

  if (minutes < 0 || minutes > 59 || hours < 1 || hours > 12) {
    return null;
  }

  if (meridiem === "PM" && hours < 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;

  return { hours, minutes };
}

export const HOUR_12_OPTIONS = Array.from({ length: 12 }, (_, index) => String(index + 1));
export const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));
export const MERIDIEM_OPTIONS = ["AM", "PM"];

export function splitTime12Hour(timeStr) {
  const parsed = parseTimeString(timeStr);
  if (!parsed) {
    return { hour: "12", minute: "00", meridiem: "PM" };
  }

  let hour = parsed.hours % 12;
  if (hour === 0) hour = 12;

  return {
    hour: String(hour),
    minute: String(parsed.minutes).padStart(2, "0"),
    meridiem: parsed.hours >= 12 ? "PM" : "AM",
  };
}

export function joinTime12Hour({ hour, minute, meridiem } = {}) {
  const parsedHour = Number.parseInt(String(hour), 10);
  const parsedMinute = Number.parseInt(String(minute), 10);
  const period = String(meridiem || "AM").toUpperCase() === "PM" ? "PM" : "AM";

  if (!Number.isFinite(parsedHour) || parsedHour < 1 || parsedHour > 12) return "";
  if (!Number.isFinite(parsedMinute) || parsedMinute < 0 || parsedMinute > 59) return "";

  return `${parsedHour}:${String(parsedMinute).padStart(2, "0")} ${period}`;
}

export function getZonedDateTimeParts(date, timeZone) {
  if (!timeZone) {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hours: date.getHours(),
      minutes: date.getMinutes(),
      seconds: date.getSeconds(),
      weekday: date.getDay(),
    };
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    weekday: "short",
    hour12: false,
  });

  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  let hours = parseInt(parts.hour, 10);
  if (hours === 24) hours = 0;

  return {
    year: parseInt(parts.year, 10),
    month: parseInt(parts.month, 10),
    day: parseInt(parts.day, 10),
    hours,
    minutes: parseInt(parts.minute, 10),
    seconds: parseInt(parts.second, 10),
    weekday: WEEKDAY_FROM_SHORT[parts.weekday] ?? 0,
  };
}

export function wallClockToDate({
  year,
  month,
  day,
  hours = 0,
  minutes = 0,
  seconds = 0,
  timeZone,
}) {
  if (!timeZone) {
    const date = new Date(year, month - 1, day, hours, minutes, seconds, 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  let utcMs = Date.UTC(year, month - 1, day, hours, minutes, seconds, 0);

  for (let attempt = 0; attempt < 5; attempt++) {
    const zoned = getZonedDateTimeParts(new Date(utcMs), timeZone);
    const desired = Date.UTC(year, month - 1, day, hours, minutes, seconds, 0);
    const actual = Date.UTC(
      zoned.year,
      zoned.month - 1,
      zoned.day,
      zoned.hours,
      zoned.minutes,
      zoned.seconds
    );
    const diff = desired - actual;
    if (diff === 0) break;
    utcMs += diff;
  }

  const result = new Date(utcMs);
  return Number.isNaN(result.getTime()) ? null : result;
}

function addCalendarDays({ year, month, day }, days) {
  const next = new Date(Date.UTC(year, month - 1, day));
  next.setUTCDate(next.getUTCDate() + days);
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

export function parseScheduleDateTime(dateStr, timeStr, timeZone) {
  const parts = parseDateStringParts(dateStr);
  const time = parseTimeString(timeStr);
  if (!parts || !time) return null;

  return wallClockToDate({
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hours: time.hours,
    minutes: time.minutes,
    timeZone,
  });
}

export const SCHEDULE_RECURRENCE_OPTIONS = [
  { value: "one_time", label: "One Time" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export const WEEKDAY_OPTIONS = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

export const MONTH_DAY_OPTIONS = Array.from({ length: 31 }, (_, index) => {
  const day = String(index + 1);
  return { value: day, label: day };
});

export const AFTER_DAYS_OPTIONS = Array.from({ length: 28 }, (_, index) => {
  const day = String(index + 1);
  return { value: day, label: day };
});

export function parseAfterDays(value) {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 28) return null;
  return parsed;
}

export function isOneTimeScheduleRecurrence(recurrenceType) {
  return !recurrenceType || recurrenceType === "one_time";
}

export function resolveRevertRecurrenceType(
  changePricesSchedule,
  scheduleRecurrenceType,
  _revertRecurrenceType
) {
  if (changePricesSchedule !== "later") {
    return "one_time";
  }

  return isOneTimeScheduleRecurrence(scheduleRecurrenceType)
    ? "one_time"
    : scheduleRecurrenceType;
}

export function getRevertRecurrenceAllowedValues(changePricesSchedule, scheduleRecurrenceType) {
  return [resolveRevertRecurrenceType(changePricesSchedule, scheduleRecurrenceType)];
}

export const RECURRING_REVERT_MIN_GAP_HOURS = 3;
export const RECURRING_REVERT_GAP_ERROR =
  "Revert time must be at least 3 hours after the price change time.";

export function needsRecurringRevertGap(
  changePricesSchedule,
  scheduleRecurrenceType,
  revertRecurrenceType
) {
  return (
    changePricesSchedule === "later" &&
    !isOneTimeScheduleRecurrence(scheduleRecurrenceType) &&
    !isOneTimeScheduleRecurrence(revertRecurrenceType)
  );
}

function getNextDailyOccurrence(time, now, timeZone) {
  const zonedNow = getZonedDateTimeParts(now, timeZone);
  let { year, month, day } = zonedNow;

  let scheduledAt = wallClockToDate({
    year,
    month,
    day,
    hours: time.hours,
    minutes: time.minutes,
    timeZone,
  });

  if (scheduledAt <= now) {
    ({ year, month, day } = addCalendarDays({ year, month, day }, 1));
    scheduledAt = wallClockToDate({
      year,
      month,
      day,
      hours: time.hours,
      minutes: time.minutes,
      timeZone,
    });
  }

  return scheduledAt;
}

function getNextWeeklyOccurrence(dayOfWeek, time, now, timeZone) {
  const targetDay = parseInt(dayOfWeek, 10);
  if (Number.isNaN(targetDay) || targetDay < 0 || targetDay > 6) return null;

  const zonedNow = getZonedDateTimeParts(now, timeZone);
  let { year, month, day } = zonedNow;
  let daysUntil = (targetDay - zonedNow.weekday + 7) % 7;

  if (daysUntil === 0) {
    const scheduledAt = wallClockToDate({
      year,
      month,
      day,
      hours: time.hours,
      minutes: time.minutes,
      timeZone,
    });
    if (scheduledAt <= now) {
      daysUntil = 7;
    }
  }

  if (daysUntil > 0) {
    ({ year, month, day } = addCalendarDays({ year, month, day }, daysUntil));
  }

  return wallClockToDate({
    year,
    month,
    day,
    hours: time.hours,
    minutes: time.minutes,
    timeZone,
  });
}

function getValidDayOfMonth(year, month, targetDay) {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Math.min(targetDay, lastDay);
}

function getNextMonthlyOccurrence(dayOfMonth, time, now, timeZone) {
  const targetDate = parseInt(dayOfMonth, 10);
  if (Number.isNaN(targetDate) || targetDate < 1 || targetDate > 31) return null;

  const zonedNow = getZonedDateTimeParts(now, timeZone);
  let year = zonedNow.year;
  let month = zonedNow.month;
  let day = getValidDayOfMonth(year, month, targetDate);

  let scheduledAt = wallClockToDate({
    year,
    month,
    day,
    hours: time.hours,
    minutes: time.minutes,
    timeZone,
  });

  if (scheduledAt <= now) {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    day = getValidDayOfMonth(year, month, targetDate);
    scheduledAt = wallClockToDate({
      year,
      month,
      day,
      hours: time.hours,
      minutes: time.minutes,
      timeZone,
    });
  }

  return scheduledAt;
}

function getOccurrenceAfterDays(fromDate, afterDays, time, timeZone) {
  const days = parseAfterDays(afterDays);
  if (!days || !time || !(fromDate instanceof Date) || Number.isNaN(fromDate.getTime())) {
    return null;
  }

  const parts = getZonedDateTimeParts(fromDate, timeZone);
  const next = addCalendarDays(
    { year: parts.year, month: parts.month, day: parts.day },
    days
  );

  return wallClockToDate({
    year: next.year,
    month: next.month,
    day: next.day,
    hours: time.hours,
    minutes: time.minutes,
    timeZone,
  });
}

export function computeScheduledAt({
  recurrenceType,
  changePricesAtDate,
  changePricesAtTime,
  scheduleRecurrenceDayOfWeek,
  scheduleRecurrenceDayOfMonth,
  afterDays,
  now,
  timeZone,
}) {
  const time = parseTimeString(changePricesAtTime);
  if (!time) return null;

  if (isOneTimeScheduleRecurrence(recurrenceType)) {
    return parseScheduleDateTime(changePricesAtDate, changePricesAtTime, timeZone);
  }

  if (recurrenceType === "daily") {
    return getNextDailyOccurrence(time, now, timeZone);
  }

  if (recurrenceType === "weekly") {
    return getNextWeeklyOccurrence(scheduleRecurrenceDayOfWeek, time, now, timeZone);
  }

  if (recurrenceType === "monthly") {
    if (afterDays != null && afterDays !== "") {
      return getOccurrenceAfterDays(now, afterDays, time, timeZone);
    }
    return getNextMonthlyOccurrence(scheduleRecurrenceDayOfMonth, time, now, timeZone);
  }

  return null;
}

function addRecurrenceFieldErrors({
  recurrenceType,
  dateValue,
  timeValue,
  dayOfWeek,
  dayOfMonth,
  dateField,
  timeField,
  dayField,
  monthField,
  dateRequired,
  validDate,
  timeRequired,
  validTime,
  monthMode = "date",
  addError,
}) {
  const oneTime = isOneTimeScheduleRecurrence(recurrenceType);
  const isWeekly = recurrenceType === "weekly";
  const isMonthly = recurrenceType === "monthly";

  if (oneTime) {
    if (!String(dateValue ?? "").trim()) {
      addError(dateField, dateRequired);
    } else if (!parseDateStringParts(dateValue)) {
      addError(dateField, validDate);
    }
  }

  if (isWeekly) {
    if (!String(dayOfWeek ?? "").trim()) {
      addError(dayField, "Pick a day.");
    } else if (!WEEKDAY_OPTIONS.some((option) => option.value === String(dayOfWeek))) {
      addError(dayField, "Pick a valid day.");
    }
  }

  if (isMonthly) {
    if (monthMode === "afterDays") {
      if (!String(dayOfMonth ?? "").trim()) {
        addError(monthField, "Enter after days.");
      } else if (!parseAfterDays(dayOfMonth)) {
        addError(monthField, "Pick a valid after days value.");
      }
    } else if (!String(dayOfMonth ?? "").trim()) {
      addError(monthField, "Pick a date.");
    } else if (!MONTH_DAY_OPTIONS.some((option) => option.value === String(dayOfMonth))) {
      addError(monthField, "Pick a valid date.");
    }
  }

  if (!String(timeValue ?? "").trim()) {
    addError(timeField, timeRequired);
  } else if (!parseTimeString(timeValue)) {
    addError(timeField, validTime);
  }

  return oneTime;
}

export function validateScheduleConfig({
  changePricesSchedule,
  scheduleRecurrenceType = "one_time",
  changePricesAtDate,
  changePricesAtTime,
  scheduleRecurrenceDayOfWeek,
  scheduleRecurrenceDayOfMonth,
  revertPrices,
  revertRecurrenceType = "one_time",
  revertPricesAtDate,
  revertPricesAtTime,
  revertRecurrenceDayOfWeek,
  revertRecurrenceDayOfMonth,
  timeZone,
  now = new Date(),
}) {
  const errors = [];
  const fieldErrors = {};

  const addError = (field, message) => {
    errors.push(message);
    if (field && !fieldErrors[field]) {
      fieldErrors[field] = message;
    }
  };

  let scheduledAt = now;
  if (changePricesSchedule === "later") {
    const oneTime = addRecurrenceFieldErrors({
      recurrenceType: scheduleRecurrenceType,
      dateValue: changePricesAtDate,
      timeValue: changePricesAtTime,
      dayOfWeek: scheduleRecurrenceDayOfWeek,
      dayOfMonth: scheduleRecurrenceDayOfMonth,
      dateField: "startDateStr",
      timeField: "startTimeStr",
      dayField: "scheduleRecurrenceDay",
      monthField: "scheduleRecurrenceDate",
      dateRequired: "Enter a start date.",
      validDate: "Enter a valid start date.",
      timeRequired: "Enter a start time.",
      validTime: "Enter a valid start time.",
      addError,
    });

    scheduledAt = computeScheduledAt({
      recurrenceType: scheduleRecurrenceType,
      changePricesAtDate,
      changePricesAtTime,
      scheduleRecurrenceDayOfWeek,
      scheduleRecurrenceDayOfMonth,
      now,
      timeZone,
    });

    if (oneTime) {
      if (
        String(changePricesAtDate ?? "").trim() &&
        String(changePricesAtTime ?? "").trim() &&
        !scheduledAt
      ) {
        addError("startDateStr", "Enter a valid start date and time.");
        addError("startTimeStr", "Enter a valid start date and time.");
      } else if (scheduledAt && scheduledAt <= now) {
        addError("startDateStr", "Scheduled start time must be in the future.");
        addError("startTimeStr", "Scheduled start time must be in the future.");
      }
    } else if (String(changePricesAtTime ?? "").trim() && !scheduledAt) {
      addError("startTimeStr", "Enter a valid start time.");
    }
  }

  let revertAt = null;
  if (revertPrices === "true" || revertPrices === true) {
    const revertUsesAfterDays = revertRecurrenceType === "monthly";
    const oneTime = addRecurrenceFieldErrors({
      recurrenceType: revertRecurrenceType,
      dateValue: revertPricesAtDate,
      timeValue: revertPricesAtTime,
      dayOfWeek: revertRecurrenceDayOfWeek,
      dayOfMonth: revertRecurrenceDayOfMonth,
      dateField: "revertDateStr",
      timeField: "revertTimeStr",
      dayField: "revertRecurrenceDay",
      monthField: "revertRecurrenceDate",
      dateRequired: "Enter a revert date.",
      validDate: "Enter a valid revert date.",
      timeRequired: "Enter a revert time.",
      validTime: "Enter a valid revert time.",
      monthMode: revertUsesAfterDays ? "afterDays" : "date",
      addError,
    });

    const revertAnchor = scheduledAt instanceof Date ? scheduledAt : now;
    revertAt = computeScheduledAt({
      recurrenceType: revertRecurrenceType,
      changePricesAtDate: revertPricesAtDate,
      changePricesAtTime: revertPricesAtTime,
      scheduleRecurrenceDayOfWeek: revertRecurrenceDayOfWeek,
      scheduleRecurrenceDayOfMonth: revertRecurrenceDayOfMonth,
      afterDays: revertUsesAfterDays ? revertRecurrenceDayOfMonth : undefined,
      now: revertAnchor,
      timeZone,
    });

    if (oneTime) {
      if (
        String(revertPricesAtDate ?? "").trim() &&
        String(revertPricesAtTime ?? "").trim() &&
        !revertAt
      ) {
        addError("revertDateStr", "Enter a valid revert date and time.");
        addError("revertTimeStr", "Enter a valid revert date and time.");
      } else if (scheduledAt && revertAt && revertAt <= scheduledAt) {
        addError("revertDateStr", "Revert time must be after the price change time.");
        addError("revertTimeStr", "Revert time must be after the price change time.");
      }
    } else if (String(revertPricesAtTime ?? "").trim() && !revertAt) {
      addError("revertTimeStr", "Enter a valid revert time.");
    } else if (scheduledAt && revertAt && revertAt <= scheduledAt) {
      addError("revertTimeStr", "Revert time must be after the price change time.");
    }

    if (
      needsRecurringRevertGap(changePricesSchedule, scheduleRecurrenceType, revertRecurrenceType) &&
      scheduledAt instanceof Date &&
      revertAt instanceof Date
    ) {
      const minRevertAt = new Date(
        scheduledAt.getTime() + RECURRING_REVERT_MIN_GAP_HOURS * 60 * 60 * 1000
      );
      const nextScheduledAt = computeScheduledAt({
        recurrenceType: scheduleRecurrenceType,
        changePricesAtDate,
        changePricesAtTime,
        scheduleRecurrenceDayOfWeek,
        scheduleRecurrenceDayOfMonth,
        now: scheduledAt,
        timeZone,
      });
      const tooSoon = revertAt.getTime() < minRevertAt.getTime();
      const afterNextRun =
        nextScheduledAt instanceof Date && revertAt.getTime() >= nextScheduledAt.getTime();
      if (tooSoon || afterNextRun) {
        addError("revertTimeStr", RECURRING_REVERT_GAP_ERROR);
      }
    }
  }

  return { errors, fieldErrors, scheduledAt, revertAt };
}

export function parseStoredDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const trimmed = String(value).trim();
  if (!trimmed) return null;

  // ISO datetimes without a timezone are treated as local time by JS; stored
  // schedule values are always UTC, so force UTC interpretation in that case.
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed) && !/[zZ]|[+-]\d{2}(?::?\d{2})?$/.test(trimmed)) {
    const parsed = new Date(`${trimmed}Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getTaskScheduleTimezone(actionData, shopTimezone) {
  return actionData?.scheduleTimezone || shopTimezone || undefined;
}

export function formatScheduledTaskLabel({
  actionData,
  scheduledAt,
  dateField,
  timeField,
  shopTimezone,
}) {
  const dateStr = String(actionData?.[dateField] ?? "").trim();
  const timeStr = String(actionData?.[timeField] ?? "").trim();

  if (dateStr && timeStr) {
    return `${dateStr}, ${timeStr}`;
  }

  if (timeStr && scheduledAt) {
    const taskTimezone = getTaskScheduleTimezone(actionData, shopTimezone);
    return `${formatDateMDY(scheduledAt, taskTimezone)}, ${timeStr}`;
  }

  const taskTimezone = getTaskScheduleTimezone(actionData, shopTimezone);
  return formatScheduleDateTime(scheduledAt, taskTimezone);
}

export function formatScheduleDateTime(date, timeZone) {
  const parsed = parseStoredDate(date);
  if (!parsed) return "";

  try {
    const dateLabel = formatDateMDY(parsed, timeZone);
    const timeLabel = formatTime12Hour(parsed, timeZone);
    return `${dateLabel}, ${timeLabel}`;
  } catch {
    return String(date);
  }
}

export function slimTaskActionDetails(actionDetails, extra = {}) {
  let actionData = {};
  try {
    actionData = JSON.parse(actionDetails || "{}");
  } catch {
    return JSON.stringify(extra);
  }

  const rest = { ...actionData };
  delete rest.logs;
  delete rest.searchResults;
  delete rest.csvRows;
  delete rest.productIds;
  if (rest.runPayload && typeof rest.runPayload === "object") {
    const payload = { ...rest.runPayload };
    delete payload.searchResults;
    delete payload.products;
    rest.runPayload = payload;
  }

  return JSON.stringify({ ...rest, ...extra });
}

export function serializeScheduledTasks(tasks, shopTimezone) {
  return tasks.map((task) => {
    let actionData = {};
    try {
      actionData = JSON.parse(task.actionDetails || "{}");
    } catch {
      actionData = {};
    }

    const taskTimezone = getTaskScheduleTimezone(actionData, shopTimezone);
    const scheduledAt = parseStoredDate(task.scheduledAt);
    const revertAt = parseStoredDate(task.revertAt);
    const isRollback = actionData.taskType === "scheduled_rollback";

    return {
      ...task,
      actionDetails: slimTaskActionDetails(task.actionDetails),
      scheduledAt: scheduledAt?.toISOString() ?? null,
      revertAt: revertAt?.toISOString() ?? null,
      runsAtLabel: formatScheduledTaskLabel({
        actionData,
        scheduledAt,
        dateField: isRollback ? "revertPricesAtDate" : "changePricesAtDate",
        timeField: isRollback ? "revertPricesAtTime" : "changePricesAtTime",
        shopTimezone,
      }),
      revertAtLabel:
        !isRollback && revertAt
          ? formatScheduledTaskLabel({
              actionData,
              scheduledAt: revertAt,
              dateField: "revertPricesAtDate",
              timeField: "revertPricesAtTime",
              shopTimezone,
            })
          : null,
      scheduleTimezone: taskTimezone || shopTimezone,
    };
  });
}

export function formatDateMDY(date, timeZone) {
  const parsed = parseStoredDate(date);
  if (!parsed) return "";
  const parts = getZonedDateTimeParts(parsed, timeZone);
  return `${parts.month}/${parts.day}/${parts.year}`;
}

export function formatDateIso(date, timeZone) {
  const parsed = parseStoredDate(date);
  if (!parsed) return "";
  const parts = getZonedDateTimeParts(parsed, timeZone);
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${parts.year}-${month}-${day}`;
}

export function parseIsoDate(iso, timeZone) {
  const parts = String(iso || "").trim().split("-");
  if (parts.length !== 3) return null;

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000) {
    return null;
  }

  return wallClockToDate({
    year,
    month,
    day,
    hours: 0,
    minutes: 0,
    timeZone,
  });
}

export function formatTime12Hour(date, timeZone) {
  const parsed = parseStoredDate(date);
  if (!parsed) return "";
  const parts = getZonedDateTimeParts(parsed, timeZone);
  let hours = parts.hours;
  const minutes = parts.minutes;
  const meridiem = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${hours}:${String(minutes).padStart(2, "0")} ${meridiem}`;
}

export function getMinRecurringRevertAt(scheduledAt) {
  if (!(scheduledAt instanceof Date) || Number.isNaN(scheduledAt.getTime())) return null;
  return new Date(scheduledAt.getTime() + RECURRING_REVERT_MIN_GAP_HOURS * 60 * 60 * 1000);
}

export function getRecurringRevertGapDefaults(scheduledAt, timeZone) {
  const revertAt = getMinRecurringRevertAt(scheduledAt);
  if (!revertAt) return null;
  const parts = getZonedDateTimeParts(revertAt, timeZone);
  return {
    revertAt,
    timeStr: formatTime12Hour(revertAt, timeZone),
    dayOfWeek: String(parts.weekday),
    dayOfMonth: String(parts.day),
  };
}

export function formatCurrentTimeInTimezone(timeZone) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date());
  } catch {
    return "";
  }
}

export function getDefaultScheduleDateTime(minutesFromNow = 60, timeZone) {
  const target = new Date(Date.now() + minutesFromNow * 60 * 1000);
  const parts = getZonedDateTimeParts(target, timeZone);
  return wallClockToDate({
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hours: parts.hours,
    minutes: parts.minutes,
    timeZone,
  });
}

export function getDefaultRevertDateTime(startDate, hoursAfter = 24, timeZone) {
  const target = new Date(new Date(startDate).getTime() + hoursAfter * 60 * 60 * 1000);
  const parts = getZonedDateTimeParts(target, timeZone);
  return wallClockToDate({
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hours: parts.hours,
    minutes: parts.minutes,
    timeZone,
  });
}
