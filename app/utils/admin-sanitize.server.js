const SENSITIVE_KEY = /token|password|secret|credential|authorization|cookie|session/i;

export function sanitizeAuditDetails(details) {
  if (details == null) {
    return null;
  }

  if (typeof details !== "object") {
    return JSON.stringify({ value: String(details) });
  }

  const cleaned = {};
  for (const [key, value] of Object.entries(details)) {
    if (SENSITIVE_KEY.test(key)) {
      continue;
    }
    if (value == null) {
      cleaned[key] = value;
    } else if (typeof value === "object") {
      cleaned[key] = JSON.parse(sanitizeAuditDetails(value) || "{}");
    } else {
      cleaned[key] = value;
    }
  }

  return JSON.stringify(cleaned);
}

export function parseAuditDetails(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
