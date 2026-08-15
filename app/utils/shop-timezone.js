const TIMEZONE_ALIASES = {
  "Asia/Calcutta": "Asia/Kolkata",
};

export function normalizeShopTimezone(timezone) {
  const trimmed = String(timezone || "").trim();
  if (!trimmed) return "";
  return TIMEZONE_ALIASES[trimmed] || trimmed;
}

export function getBrowserTimezone() {
  try {
    return normalizeShopTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return "";
  }
}

export function resolveClientScheduleTimezone({ loaderTimezone, hasSavedTimezone }) {
  if (hasSavedTimezone) {
    return normalizeShopTimezone(loaderTimezone) || "Asia/Kolkata";
  }

  return getBrowserTimezone() || normalizeShopTimezone(loaderTimezone) || "Asia/Kolkata";
}
