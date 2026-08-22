const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function pad(value) {
  return String(value).padStart(2, "0");
}

export function getTimezoneOffsetLabel(timeZone, date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
    }).formatToParts(date);
    const name = parts.find((part) => part.type === "timeZoneName")?.value || "UTC";
    return name.replace("GMT", "UTC").replace("UTCUTC", "UTC");
  } catch {
    return "UTC";
  }
}

export function formatAdminDateTime(value, timeZone = "UTC") {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).formatToParts(date);

    const read = (type) => parts.find((part) => part.type === type)?.value || "";
    const day = read("day");
    const month = read("month");
    const year = read("year");
    const hour = read("hour");
    const minute = read("minute");
    const dayPeriod = read("dayPeriod").toUpperCase();

    return {
      date: `${day}-${month}-${year}`,
      time: `${dayPeriod}: ${pad(hour)}:${minute}`,
      zone: getTimezoneOffsetLabel(timeZone, date),
    };
  } catch {
    const month = MONTHS[date.getUTCMonth()];
    const hours = date.getUTCHours();
    const dayPeriod = hours >= 12 ? "PM" : "AM";
    const hour12 = hours % 12 || 12;

    return {
      date: `${pad(date.getUTCDate())}-${month}-${date.getUTCFullYear()}`,
      time: `${dayPeriod}: ${pad(hour12)}:${pad(date.getUTCMinutes())}`,
      zone: "UTC",
    };
  }
}

export function formatAdminDateTimeLines(value, timeZone = "UTC") {
  const formatted = formatAdminDateTime(value, timeZone);
  if (!formatted) return ["—"];
  return [formatted.date, formatted.time, formatted.zone];
}
