const WEIGHT_UNIT_ALIASES = {
  POUND: "POUNDS",
  POUNDS: "POUNDS",
  LB: "POUNDS",
  LBS: "POUNDS",
  OUNCE: "OUNCES",
  OUNCES: "OUNCES",
  OZ: "OUNCES",
  KILOGRAM: "KILOGRAMS",
  KILOGRAMS: "KILOGRAMS",
  KG: "KILOGRAMS",
  GRAM: "GRAMS",
  GRAMS: "GRAMS",
  G: "GRAMS",
};

export const WEIGHT_UNIT_OPTIONS = [
  { value: "POUNDS", label: "lb" },
  { value: "OUNCES", label: "oz" },
  { value: "KILOGRAMS", label: "kg" },
  { value: "GRAMS", label: "g" },
];

const WEIGHT_TO_GRAMS = {
  GRAMS: 1,
  KILOGRAMS: 1000,
  OUNCES: 28.3495,
  POUNDS: 453.592,
};

function parseNumber(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeWeightUnit(unit) {
  const normalized = String(unit ?? "")
    .trim()
    .toUpperCase()
    .replace(/\./g, "");
  return WEIGHT_UNIT_ALIASES[normalized] || normalized;
}

export function weightToGrams(value, unit) {
  const amount = parseNumber(value);
  if (amount == null) return null;

  const normalizedUnit = normalizeWeightUnit(unit);
  const factor = WEIGHT_TO_GRAMS[normalizedUnit];
  if (!factor) return null;

  return amount * factor;
}

export function parseWeightConditionValue(value) {
  const trimmed = String(value ?? "").trim();
  const pipeIndex = trimmed.lastIndexOf("|");

  if (pipeIndex > 0) {
    return {
      amount: trimmed.slice(0, pipeIndex).trim(),
      unit: normalizeWeightUnit(trimmed.slice(pipeIndex + 1).trim()) || "POUNDS",
    };
  }

  const spacedMatch = trimmed.match(/^([\d.]+)\s+(\S+)$/);
  if (spacedMatch) {
    return {
      amount: spacedMatch[1],
      unit: normalizeWeightUnit(spacedMatch[2]) || "POUNDS",
    };
  }

  return { amount: trimmed, unit: "POUNDS" };
}

export function formatWeightConditionValue(amount, unit) {
  const parsedAmount = parseNumber(amount);
  const normalizedUnit = normalizeWeightUnit(unit) || "POUNDS";
  if (parsedAmount == null) return "";
  return `${parsedAmount}|${normalizedUnit}`;
}

export function isValidWeightConditionValue(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return false;

  const { amount, unit } = parseWeightConditionValue(trimmed);
  return parseNumber(amount) != null && Boolean(normalizeWeightUnit(unit));
}

export function getWeightConditionSummary(value) {
  const { amount, unit } = parseWeightConditionValue(value);
  const parsedAmount = parseNumber(amount);
  if (parsedAmount == null) return "";

  const label =
    WEIGHT_UNIT_OPTIONS.find((option) => option.value === normalizeWeightUnit(unit))?.label ||
    unit;

  return `${parsedAmount} ${label}`;
}
