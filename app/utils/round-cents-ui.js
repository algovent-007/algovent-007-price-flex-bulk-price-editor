import {
  DEFAULT_END_PATTERN,
  isLegacyEndingDigits,
  parseEndingPattern,
  serializeEndingPattern,
} from "./ending-price-pattern.js";
import {
  DEFAULT_MULTIPLE_PATTERN,
  parseMultiplePattern,
  serializeMultiplePattern,
} from "./multiple-price-pattern.js";

export const ROUNDING_MODES = {
  NONE: "none",
  NEAREST_CENT: "nearest_cent",
  WHOLE_NUMBER: "whole_number",
  END_99: "end_99",
  END_CUSTOM: "end_custom",
  MULTIPLE: "multiple",
};

export const ROUNDING_DIRECTIONS = {
  CLOSEST: "closest",
  UP: "up",
  DOWN: "down",
};

export function modeSupportsDirection(mode) {
  return (
    mode === ROUNDING_MODES.NEAREST_CENT ||
    mode === ROUNDING_MODES.WHOLE_NUMBER ||
    mode === ROUNDING_MODES.MULTIPLE ||
    mode === ROUNDING_MODES.END_99 ||
    mode === ROUNDING_MODES.END_CUSTOM
  );
}

function isEnd99Pattern(pattern) {
  return pattern.cents.join("") === "99";
}

export function decodeRoundCents(roundCents, roundCentsDigit) {
  const digit = String(roundCentsDigit ?? "");

  if (roundCents === "10") {
    return {
      mode: ROUNDING_MODES.NEAREST_CENT,
      direction: ROUNDING_DIRECTIONS.UP,
      digit: digit || "2",
      endingPattern: null,
    };
  }

  if (roundCents === "11") {
    return {
      mode: ROUNDING_MODES.NEAREST_CENT,
      direction: ROUNDING_DIRECTIONS.DOWN,
      digit: digit || "2",
      endingPattern: null,
    };
  }

  if (roundCents === "2") {
    return {
      mode: ROUNDING_MODES.NEAREST_CENT,
      direction: ROUNDING_DIRECTIONS.CLOSEST,
      digit: digit || "2",
      endingPattern: null,
    };
  }

  if (roundCents === "3") {
    return {
      mode: ROUNDING_MODES.WHOLE_NUMBER,
      direction: ROUNDING_DIRECTIONS.CLOSEST,
      digit: "",
      endingPattern: null,
    };
  }

  if (roundCents === "4") {
    return {
      mode: ROUNDING_MODES.WHOLE_NUMBER,
      direction: ROUNDING_DIRECTIONS.UP,
      digit: "",
      endingPattern: null,
    };
  }

  if (roundCents === "5") {
    return {
      mode: ROUNDING_MODES.WHOLE_NUMBER,
      direction: ROUNDING_DIRECTIONS.DOWN,
      digit: "",
      endingPattern: null,
    };
  }

  if (roundCents === "9") {
    if (digit === "99" && isLegacyEndingDigits(digit)) {
      return {
        mode: ROUNDING_MODES.END_99,
        direction: ROUNDING_DIRECTIONS.CLOSEST,
        digit: "99",
        endingPattern: null,
      };
    }

    const endingPattern = parseEndingPattern(digit || serializeEndingPattern(DEFAULT_END_PATTERN));

    if (isEnd99Pattern(endingPattern)) {
      return {
        mode: ROUNDING_MODES.END_99,
        direction: endingPattern.direction,
        digit:
          endingPattern.direction === ROUNDING_DIRECTIONS.CLOSEST
            ? "99"
            : serializeEndingPattern({
                whole: ["*"],
                cents: ["9", "9"],
                direction: endingPattern.direction,
              }),
        endingPattern: null,
      };
    }

    return {
      mode: ROUNDING_MODES.END_CUSTOM,
      direction: endingPattern.direction,
      digit: digit || serializeEndingPattern(DEFAULT_END_PATTERN),
      endingPattern,
    };
  }

  if (roundCents === "6" || roundCents === "7" || roundCents === "8") {
    const multiplePattern = parseMultiplePattern(digit);
    const direction =
      roundCents === "7"
        ? ROUNDING_DIRECTIONS.UP
        : roundCents === "8"
          ? ROUNDING_DIRECTIONS.DOWN
          : ROUNDING_DIRECTIONS.CLOSEST;

    return {
      mode: ROUNDING_MODES.MULTIPLE,
      direction,
      digit: digit.startsWith("m:") ? digit : serializeMultiplePattern(multiplePattern),
      endingPattern: null,
      multiplePattern,
    };
  }

  if (roundCents === "1") {
    return {
      mode: ROUNDING_MODES.NONE,
      direction: ROUNDING_DIRECTIONS.CLOSEST,
      digit: "",
      endingPattern: null,
      multiplePattern: null,
    };
  }

  return {
    mode: ROUNDING_MODES.NEAREST_CENT,
    direction: ROUNDING_DIRECTIONS.CLOSEST,
    digit: "2",
    endingPattern: null,
  };
}

function resolveNearestCentDigit(digit) {
  const parsed = parseInt(String(digit ?? "2"), 10);
  if (Number.isNaN(parsed) || parsed < 0) return "2";
  return String(Math.min(parsed, 4));
}

export function encodeRoundCents(mode, direction, digit = "") {
  switch (mode) {
    case ROUNDING_MODES.NONE:
      return { roundCents: "1", roundCentsDigit: "" };

    case ROUNDING_MODES.NEAREST_CENT: {
      const places = resolveNearestCentDigit(digit);
      if (direction === ROUNDING_DIRECTIONS.UP) {
        return { roundCents: "10", roundCentsDigit: places };
      }
      if (direction === ROUNDING_DIRECTIONS.DOWN) {
        return { roundCents: "11", roundCentsDigit: places };
      }
      return { roundCents: "2", roundCentsDigit: places };
    }

    case ROUNDING_MODES.WHOLE_NUMBER:
      if (direction === ROUNDING_DIRECTIONS.UP) {
        return { roundCents: "4", roundCentsDigit: "" };
      }
      if (direction === ROUNDING_DIRECTIONS.DOWN) {
        return { roundCents: "5", roundCentsDigit: "" };
      }
      return { roundCents: "3", roundCentsDigit: "" };

    case ROUNDING_MODES.END_99: {
      const basePattern =
        typeof digit === "string" && digit.startsWith("p:")
          ? parseEndingPattern(digit)
          : typeof digit === "object" && digit
            ? digit
            : { whole: ["*"], cents: ["9", "9"], direction };

      const pattern = {
        ...basePattern,
        cents: ["9", "9"],
        direction,
      };

      if (
        direction === ROUNDING_DIRECTIONS.CLOSEST &&
        pattern.whole.every((slot) => slot === "*")
      ) {
        return { roundCents: "9", roundCentsDigit: "99" };
      }

      return {
        roundCents: "9",
        roundCentsDigit: serializeEndingPattern(pattern),
      };
    }

    case ROUNDING_MODES.END_CUSTOM: {
      const pattern =
        typeof digit === "string" && digit.startsWith("p:")
          ? parseEndingPattern(digit)
          : typeof digit === "object" && digit
            ? digit
            : parseEndingPattern(digit || serializeEndingPattern(DEFAULT_END_PATTERN));

      return {
        roundCents: "9",
        roundCentsDigit: serializeEndingPattern({
          ...pattern,
          direction: direction || pattern.direction,
        }),
      };
    }

    case ROUNDING_MODES.MULTIPLE: {
      const multiple =
        typeof digit === "string" && digit.startsWith("m:")
          ? digit
          : typeof digit === "object" && digit
            ? serializeMultiplePattern(digit)
            : serializeMultiplePattern(parseMultiplePattern(digit || DEFAULT_MULTIPLE_PATTERN));

      if (direction === ROUNDING_DIRECTIONS.UP) {
        return { roundCents: "7", roundCentsDigit: multiple };
      }
      if (direction === ROUNDING_DIRECTIONS.DOWN) {
        return { roundCents: "8", roundCentsDigit: multiple };
      }
      return { roundCents: "6", roundCentsDigit: multiple };
    }

    default:
      return { roundCents: "2", roundCentsDigit: "2" };
  }
}
