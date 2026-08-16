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

export function multiplePatternToCents(pattern) {
  const normalized = normalizeEndingPattern(pattern);
  const wholeStr = normalized.whole.map((digit) => (digit === "*" ? "0" : digit)).join("");
  const wholeNum = parseInt(wholeStr, 10) || 0;
  const centsNum = parseInt(normalized.cents.join(""), 10) || 0;
  const totalCents = wholeNum * 100 + centsNum;

  return totalCents > 0 ? totalCents : 10;
}

export { addWholeDigit, removeWholeDigit };
