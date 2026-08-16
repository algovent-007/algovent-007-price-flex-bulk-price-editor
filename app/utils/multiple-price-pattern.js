import {
  addWholeDigit,
  normalizeEndingPattern,
  removeWholeDigit,
} from "./ending-price-pattern.js";

export const DEFAULT_MULTIPLE_PATTERN = {
  whole: ["*", "*"],
  cents: ["1", "0"],
};

export function parseMultiplePattern(roundCentsDigit) {
  const raw = String(roundCentsDigit ?? "");

  if (raw.startsWith("m:")) {
    try {
      return normalizeEndingPattern(JSON.parse(raw.slice(2)));
    } catch {
      return normalizeEndingPattern(DEFAULT_MULTIPLE_PATTERN);
    }
  }

  const parsed = parseInt(raw, 10);
  if (!Number.isNaN(parsed) && parsed > 0) {
    const cents = String(parsed).padStart(2, "0").slice(-2).split("");
    return normalizeEndingPattern({
      whole: ["*", "*"],
      cents,
    });
  }

  return normalizeEndingPattern(DEFAULT_MULTIPLE_PATTERN);
}

export function serializeMultiplePattern(pattern) {
  const normalized = normalizeEndingPattern(pattern);
  return `m:${JSON.stringify(normalized)}`;
}

export function formatMultipleSummary(pattern) {
  const normalized = normalizeEndingPattern(pattern);
  const centsLabel = `.${normalized.cents.join("")}`;
  const hasFixedWholeDigits = normalized.whole.some((digit) => digit !== "*");

  if (!hasFixedWholeDigits) {
    return centsLabel;
  }

  return `${normalized.whole.join("")}${centsLabel}`;
}

export function multiplePatternToValue(pattern) {
  const normalized = normalizeEndingPattern(pattern);
  const wholeStr = normalized.whole.map((digit) => (digit === "*" ? "0" : digit)).join("");
  const wholeNum = parseInt(wholeStr, 10) || 0;
  const centsNum = parseInt(normalized.cents.join(""), 10) || 0;
  const value = wholeNum + centsNum / 100;

  if (value <= 0) {
    return 0.1;
  }

  return Math.min(value, 1000);
}

/** @deprecated Use multiplePatternToValue instead. */
export function multiplePatternToCents(pattern) {
  return Math.round(multiplePatternToValue(pattern) * 100);
}

export function parseMultipleValue(roundCentsDigit) {
  const raw = String(roundCentsDigit ?? "");

  if (raw.startsWith("m:")) {
    return multiplePatternToValue(parseMultiplePattern(raw));
  }

  if (raw.startsWith("p:")) {
    return 0.05;
  }

  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return 0.05;
  }

  // Legacy values store the increment in cents (for example, 5 => $0.05).
  return Math.min(parsed, 10000) / 100;
}

export { addWholeDigit, removeWholeDigit };
