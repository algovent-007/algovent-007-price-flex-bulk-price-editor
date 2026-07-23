export function parseDateString(dateStr) {
  const parts = String(dateStr || "").trim().split("/");
  if (parts.length !== 3) return null;

  const month = parseInt(parts[0], 10) - 1;
  const day = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);

  if (month < 0 || month > 11 || day < 1 || day > 31 || year < 2000) {
    return null;
  }

  const date = new Date(year, month, day);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getMonth() !== month || date.getDate() !== day || date.getFullYear() !== year) {
    return null;
  }

  return date;
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

export function parseScheduleDateTime(dateStr, timeStr) {
  const date = parseDateString(dateStr);
  const time = parseTimeString(timeStr);
  if (!date || !time) return null;

  date.setHours(time.hours, time.minutes, 0, 0);
  return date;
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

export function isOneTimeScheduleRecurrence(recurrenceType) {
  return !recurrenceType || recurrenceType === "one_time";
}

function getNextDailyOccurrence(time, now) {
  const scheduledAt = new Date(now);
  scheduledAt.setHours(time.hours, time.minutes, 0, 0);

  if (scheduledAt <= now) {
    scheduledAt.setDate(scheduledAt.getDate() + 1);
  }

  return scheduledAt;
}

function getNextWeeklyOccurrence(dayOfWeek, time, now) {
  const targetDay = parseInt(dayOfWeek, 10);
  if (Number.isNaN(targetDay) || targetDay < 0 || targetDay > 6) return null;

  const scheduledAt = new Date(now);
  scheduledAt.setHours(time.hours, time.minutes, 0, 0);

  let daysUntil = (targetDay - scheduledAt.getDay() + 7) % 7;
  if (daysUntil === 0 && scheduledAt <= now) {
    daysUntil = 7;
  }
  scheduledAt.setDate(scheduledAt.getDate() + daysUntil);
  return scheduledAt;
}

function getValidDayOfMonth(year, month, targetDay) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return Math.min(targetDay, lastDay);
}

function getNextMonthlyOccurrence(dayOfMonth, time, now) {
  const targetDate = parseInt(dayOfMonth, 10);
  if (Number.isNaN(targetDate) || targetDate < 1 || targetDate > 31) return null;

  let year = now.getFullYear();
  let month = now.getMonth();
  let day = getValidDayOfMonth(year, month, targetDate);
  let scheduledAt = new Date(year, month, day);
  scheduledAt.setHours(time.hours, time.minutes, 0, 0);

  if (scheduledAt <= now) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
    day = getValidDayOfMonth(year, month, targetDate);
    scheduledAt = new Date(year, month, day);
    scheduledAt.setHours(time.hours, time.minutes, 0, 0);
  }

  return scheduledAt;
}

export function computeScheduledAt({
  recurrenceType,
  changePricesAtDate,
  changePricesAtTime,
  scheduleRecurrenceDayOfWeek,
  scheduleRecurrenceDayOfMonth,
  now,
}) {
  const time = parseTimeString(changePricesAtTime);
  if (!time) return null;

  if (isOneTimeScheduleRecurrence(recurrenceType)) {
    return parseScheduleDateTime(changePricesAtDate, changePricesAtTime);
  }

  if (recurrenceType === "daily") {
    return getNextDailyOccurrence(time, now);
  }

  if (recurrenceType === "weekly") {
    return getNextWeeklyOccurrence(scheduleRecurrenceDayOfWeek, time, now);
  }

  if (recurrenceType === "monthly") {
    return getNextMonthlyOccurrence(scheduleRecurrenceDayOfMonth, time, now);
  }

  return null;
}

export function validateScheduleConfig({
  changePricesSchedule,
  scheduleRecurrenceType = "one_time",
  changePricesAtDate,
  changePricesAtTime,
  scheduleRecurrenceDayOfWeek,
  scheduleRecurrenceDayOfMonth,
  revertPrices,
  revertPricesAtDate,
  revertPricesAtTime,
}) {
  const errors = [];
  const fieldErrors = {};
  const now = new Date();

  const addError = (field, message) => {
    errors.push(message);
    if (field && !fieldErrors[field]) {
      fieldErrors[field] = message;
    }
  };

  let scheduledAt = now;
  if (changePricesSchedule === "later") {
    const oneTime = isOneTimeScheduleRecurrence(scheduleRecurrenceType);
    const isWeekly = scheduleRecurrenceType === "weekly";
    const isMonthly = scheduleRecurrenceType === "monthly";

    if (oneTime) {
      if (!String(changePricesAtDate ?? "").trim()) {
        addError("startDateStr", "Enter a start date.");
      } else if (!parseDateString(changePricesAtDate)) {
        addError("startDateStr", "Enter a valid start date.");
      }
    }

    if (isWeekly) {
      if (!String(scheduleRecurrenceDayOfWeek ?? "").trim()) {
        addError("scheduleRecurrenceDay", "Pick a day.");
      } else if (
        !WEEKDAY_OPTIONS.some((option) => option.value === String(scheduleRecurrenceDayOfWeek))
      ) {
        addError("scheduleRecurrenceDay", "Pick a valid day.");
      }
    }

    if (isMonthly) {
      if (!String(scheduleRecurrenceDayOfMonth ?? "").trim()) {
        addError("scheduleRecurrenceDate", "Pick a date.");
      } else if (
        !MONTH_DAY_OPTIONS.some((option) => option.value === String(scheduleRecurrenceDayOfMonth))
      ) {
        addError("scheduleRecurrenceDate", "Pick a valid date.");
      }
    }

    if (!String(changePricesAtTime ?? "").trim()) {
      addError("startTimeStr", "Enter a start time.");
    } else if (!parseTimeString(changePricesAtTime)) {
      addError("startTimeStr", "Enter a valid start time.");
    }

    scheduledAt = computeScheduledAt({
      recurrenceType: scheduleRecurrenceType,
      changePricesAtDate,
      changePricesAtTime,
      scheduleRecurrenceDayOfWeek,
      scheduleRecurrenceDayOfMonth,
      now,
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
    if (!String(revertPricesAtDate ?? "").trim()) {
      addError("revertDateStr", "Enter a revert date.");
    } else if (!parseDateString(revertPricesAtDate)) {
      addError("revertDateStr", "Enter a valid revert date.");
    }

    if (!String(revertPricesAtTime ?? "").trim()) {
      addError("revertTimeStr", "Enter a revert time.");
    } else if (!parseTimeString(revertPricesAtTime)) {
      addError("revertTimeStr", "Enter a valid revert time.");
    }

    revertAt = parseScheduleDateTime(revertPricesAtDate, revertPricesAtTime);
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
  }

  return { errors, fieldErrors, scheduledAt, revertAt };
}

export function formatScheduleDateTime(date) {
  if (!date) return "";
  try {
    return new Date(date).toLocaleString();
  } catch {
    return String(date);
  }
}

export function formatDateMDY(date) {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

export function formatDateIso(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseIsoDate(iso) {
  const parts = String(iso || "").trim().split("-");
  if (parts.length !== 3) return null;

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  if (month < 0 || month > 11 || day < 1 || day > 31 || year < 2000) {
    return null;
  }

  const date = new Date(year, month, day);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getMonth() !== month || date.getDate() !== day || date.getFullYear() !== year) {
    return null;
  }

  return date;
}

export function formatTime12Hour(date) {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const meridiem = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${hours}:${String(minutes).padStart(2, "0")} ${meridiem}`;
}

export function getDefaultScheduleDateTime(minutesFromNow = 60) {
  const date = new Date();
  date.setMinutes(date.getMinutes() + minutesFromNow, 0, 0);
  return date;
}

export function getDefaultRevertDateTime(startDate, hoursAfter = 24) {
  const date = new Date(startDate);
  date.setHours(date.getHours() + hoursAfter);
  return date;
}
