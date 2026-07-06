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

export function validateScheduleConfig({
  changePricesSchedule,
  changePricesAtDate,
  changePricesAtTime,
  revertPrices,
  revertPricesAtDate,
  revertPricesAtTime,
}) {
  const errors = [];
  const now = new Date();

  let scheduledAt = now;
  if (changePricesSchedule === "later") {
    scheduledAt = parseScheduleDateTime(changePricesAtDate, changePricesAtTime);
    if (!scheduledAt) {
      errors.push("Enter a valid start date and time for the price change.");
    } else if (scheduledAt <= now) {
      errors.push("Scheduled start time must be in the future.");
    }
  }

  let revertAt = null;
  if (revertPrices === "true" || revertPrices === true) {
    revertAt = parseScheduleDateTime(revertPricesAtDate, revertPricesAtTime);
    if (!revertAt) {
      errors.push("Enter a valid revert date and time.");
    } else if (scheduledAt && revertAt <= scheduledAt) {
      errors.push("Revert time must be after the price change time.");
    }
  }

  return { errors, scheduledAt, revertAt };
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
