export const ROUNDING_DIRECTIONS = {
  CLOSEST: "closest",
  UP: "up",
  DOWN: "down",
};

export const DEFAULT_END_PATTERN = {
  whole: ["*", "*"],
  cents: ["5", "0"],
  direction: ROUNDING_DIRECTIONS.CLOSEST,
};

const MIN_WHOLE_DIGITS = 1;
const MAX_WHOLE_DIGITS = 6;

function normalizeDigit(value) {
  const next = String(value ?? "").slice(-1);
  if (next === "*") return "*";
  if (/^\d$/.test(next)) return next;
  return "";
}

export function normalizeEndingPattern(pattern) {
  const whole = Array.isArray(pattern?.whole) && pattern.whole.length > 0
    ? pattern.whole.map((digit) => (digit === "*" ? "*" : normalizeDigit(digit) || "*"))
    : [...DEFAULT_END_PATTERN.whole];

  let cents = Array.isArray(pattern?.cents) ? [...pattern.cents] : [...DEFAULT_END_PATTERN.cents];
  if (cents.length < 2) {
    cents = [...DEFAULT_END_PATTERN.cents];
  }
  cents = cents.slice(0, 2).map((digit) => normalizeDigit(digit) || "0");

  const direction = Object.values(ROUNDING_DIRECTIONS).includes(pattern?.direction)
    ? pattern.direction
    : ROUNDING_DIRECTIONS.CLOSEST;

  return { whole, cents, direction };
}

export function parseEndingPattern(roundCentsDigit) {
  const raw = String(roundCentsDigit ?? "");

  if (raw.startsWith("p:")) {
    try {
      return normalizeEndingPattern(JSON.parse(raw.slice(2)));
    } catch {
      return normalizeEndingPattern(DEFAULT_END_PATTERN);
    }
  }

  const cleaned = raw.replace(/\D/g, "");
  if (!cleaned) {
    return normalizeEndingPattern(DEFAULT_END_PATTERN);
  }

  const cents = cleaned.slice(-2).padStart(2, "0").split("");
  return normalizeEndingPattern({
    whole: ["*"],
    cents,
    direction: ROUNDING_DIRECTIONS.CLOSEST,
  });
}

export function serializeEndingPattern(pattern) {
  const normalized = normalizeEndingPattern(pattern);
  return `p:${JSON.stringify(normalized)}`;
}

export function formatEndingSummary(pattern) {
  const normalized = normalizeEndingPattern(pattern);
  const centsLabel = `.${normalized.cents.join("")}`;
  const hasFixedWholeDigits = normalized.whole.some((digit) => digit !== "*");

  if (!hasFixedWholeDigits) {
    return centsLabel;
  }

  return `${normalized.whole.join("")}${centsLabel}`;
}

function buildWholeNumber(price, wholePattern) {
  const wholeStr = String(Math.max(0, Math.floor(price)));
  const padded = wholeStr.padStart(wholePattern.length, "0");
  let result = "";

  for (let index = 0; index < wholePattern.length; index += 1) {
    const slot = wholePattern[index];
    const sourceIndex = padded.length - wholePattern.length + index;
    const sourceDigit = sourceIndex >= 0 ? padded[sourceIndex] : "0";
    result += slot === "*" ? sourceDigit : slot;
  }

  return parseInt(result, 10);
}

function applyCentsEnding(price, ending, direction) {
  const whole = Math.floor(price);
  const fractional = price - whole;

  if (direction === ROUNDING_DIRECTIONS.UP) {
    if (fractional <= ending + 1e-9) return whole + ending;
    return whole + 1 + ending;
  }

  if (direction === ROUNDING_DIRECTIONS.DOWN) {
    if (fractional >= ending - 1e-9) return whole + ending;
    return Math.max(0, whole - 1 + ending);
  }

  const candidateDown =
    fractional >= ending ? whole + ending : Math.max(0, whole - 1 + ending);
  const candidateUp = fractional <= ending ? whole + ending : whole + 1 + ending;
  return Math.abs(price - candidateDown) <= Math.abs(candidateUp - price)
    ? candidateDown
    : candidateUp;
}

function buildPatternCandidates(price, pattern) {
  const ending = parseInt(pattern.cents.join(""), 10) / 100;
  const center = Math.floor(price);
  const candidates = new Set();

  for (let whole = Math.max(0, center - 10); whole <= center + 10; whole += 1) {
    candidates.add(buildWholeNumber(whole + ending, pattern.whole) + ending);
  }

  return [...candidates].sort((left, right) => left - right);
}

function pickPatternCandidate(price, candidates, direction) {
  if (candidates.length === 0) {
    return price;
  }

  if (direction === ROUNDING_DIRECTIONS.UP) {
    return candidates.find((candidate) => candidate >= price - 1e-9) ?? candidates[candidates.length - 1];
  }

  if (direction === ROUNDING_DIRECTIONS.DOWN) {
    return (
      [...candidates].reverse().find((candidate) => candidate <= price + 1e-9) ?? candidates[0]
    );
  }

  let best = candidates[0];
  let bestDistance = Math.abs(price - best);

  for (const candidate of candidates) {
    const distance = Math.abs(price - candidate);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }

  return best;
}

function applyFixedWholeEnding(price, pattern) {
  const candidates = buildPatternCandidates(price, pattern);
  return pickPatternCandidate(price, candidates, pattern.direction);
}

export function applyEndingPattern(price, patternInput) {
  const pattern = normalizeEndingPattern(patternInput);
  const ending = parseInt(pattern.cents.join(""), 10) / 100;
  const allWholeWildcards = pattern.whole.every((digit) => digit === "*");

  if (allWholeWildcards) {
    return applyCentsEnding(price, ending, pattern.direction);
  }

  return applyFixedWholeEnding(price, pattern);
}

export function addWholeDigit(pattern) {
  const normalized = normalizeEndingPattern(pattern);
  if (normalized.whole.length >= MAX_WHOLE_DIGITS) {
    return normalized;
  }

  return normalizeEndingPattern({
    ...normalized,
    whole: ["*", ...normalized.whole],
  });
}

export function removeWholeDigit(pattern) {
  const normalized = normalizeEndingPattern(pattern);
  if (normalized.whole.length <= MIN_WHOLE_DIGITS) {
    return normalized;
  }

  return normalizeEndingPattern({
    ...normalized,
    whole: normalized.whole.slice(1),
  });
}

export function isLegacyEndingDigits(roundCentsDigit) {
  const raw = String(roundCentsDigit ?? "");
  return raw !== "" && !raw.startsWith("p:") && /^\d+$/.test(raw);
}
