import { useId, useMemo } from "react";
import {
  DEFAULT_END_PATTERN,
  parseEndingPattern,
  serializeEndingPattern,
} from "../../utils/ending-price-pattern";
import { DEFAULT_MULTIPLE_PATTERN } from "../../utils/multiple-price-pattern";
import {
  ROUNDING_DIRECTIONS,
  ROUNDING_MODES,
  decodeRoundCents,
  encodeRoundCents,
  modeSupportsDirection,
} from "../../utils/round-cents-ui";
import EndPricePatternInput from "./EndPricePatternInput";
import MultiplePatternInput from "./MultiplePatternInput";

export default function RoundCentsFields({
  roundCents,
  roundCentsDigit,
  setRoundCents,
  setRoundCentsDigit,
  readOnly = false,
  fieldError,
  clearFieldError,
  errorKey = "roundCentsDigit",
}) {
  const rawId = useId();
  const directionTooltipId = `round-direction-help-${rawId.replace(/:/g, "")}-${errorKey}`;
  const fieldId = errorKey.replace(/[^a-z0-9-]/gi, "-");

  const { mode, direction, digit, endingPattern, multiplePattern } = useMemo(
    () => decodeRoundCents(roundCents, roundCentsDigit),
    [roundCents, roundCentsDigit]
  );

  const applyRoundCents = (nextMode, nextDirection = direction, nextDigit = digit) => {
    const encoded = encodeRoundCents(nextMode, nextDirection, nextDigit);
    setRoundCents(encoded.roundCents);
    setRoundCentsDigit(encoded.roundCentsDigit);
  };

  const handleModeChange = (nextMode) => {
    if (!nextMode || nextMode === mode) return;

    let nextDigit = digit;
    if (nextMode === ROUNDING_MODES.END_99) {
      nextDigit =
        typeof digit === "string" && digit.startsWith("p:")
          ? parseEndingPattern(digit)
          : { whole: ["*"], cents: ["9", "9"], direction };
    } else if (nextMode === ROUNDING_MODES.END_CUSTOM) {
      nextDigit = serializeEndingPattern(
        endingPattern ?? {
          ...DEFAULT_END_PATTERN,
          direction,
        }
      );
    } else if (nextMode === ROUNDING_MODES.MULTIPLE) {
      nextDigit =
        multiplePattern ?? {
          ...DEFAULT_MULTIPLE_PATTERN,
        };
    } else if (nextMode === ROUNDING_MODES.NONE) {
      nextDigit = "";
    } else {
      nextDigit = digit || "2";
    }

    const nextDirection = modeSupportsDirection(nextMode)
      ? direction
      : ROUNDING_DIRECTIONS.CLOSEST;
    applyRoundCents(nextMode, nextDirection, nextDigit);
  };

  const handleDirectionChange = (nextDirection) => {
    if (!nextDirection || nextDirection === direction) return;

    if (mode === ROUNDING_MODES.END_CUSTOM) {
      applyRoundCents(mode, nextDirection, {
        ...(endingPattern ?? DEFAULT_END_PATTERN),
        direction: nextDirection,
      });
      return;
    }

    if (mode === ROUNDING_MODES.END_99) {
      const basePattern =
        typeof digit === "string" && digit.startsWith("p:")
          ? parseEndingPattern(digit)
          : { whole: ["*"], cents: ["9", "9"], direction: nextDirection };
      applyRoundCents(mode, nextDirection, {
        ...basePattern,
        cents: ["9", "9"],
        direction: nextDirection,
      });
      return;
    }

    if (mode === ROUNDING_MODES.MULTIPLE) {
      applyRoundCents(mode, nextDirection, multiplePattern ?? DEFAULT_MULTIPLE_PATTERN);
      return;
    }

    applyRoundCents(mode, nextDirection, digit);
  };

  const handleMultiplePatternChange = (nextPattern) => {
    const encoded = encodeRoundCents(mode, direction, nextPattern);
    setRoundCents(encoded.roundCents);
    setRoundCentsDigit(encoded.roundCentsDigit);
    clearFieldError?.(errorKey);
  };

  const handlePatternChange = (nextPattern) => {
    const encoded = encodeRoundCents(mode, direction, nextPattern);
    setRoundCents(encoded.roundCents);
    setRoundCentsDigit(encoded.roundCentsDigit);
    clearFieldError?.(errorKey);
  };

  const showDirection = modeSupportsDirection(mode);
  const showEndingPattern = mode === ROUNDING_MODES.END_CUSTOM;
  const showMultipleValue = mode === ROUNDING_MODES.MULTIPLE;

  return (
    <s-stack direction="block" gap="base">
      <s-select
        label="Round off cents"
        value={mode}
        disabled={readOnly}
        onInput={
          readOnly
            ? undefined
            : (e) => {
                const next = e.currentTarget?.value ?? e.target?.value;
                handleModeChange(next);
              }
        }
      >
        <s-option value={ROUNDING_MODES.NONE}>No</s-option>
        <s-option value={ROUNDING_MODES.NEAREST_CENT}>Round to nearest .01</s-option>
        <s-option value={ROUNDING_MODES.WHOLE_NUMBER}>Round to nearest whole number</s-option>
        <s-option value={ROUNDING_MODES.END_99}>End prices in .99</s-option>
        <s-option value={ROUNDING_MODES.END_CUSTOM}>End prices in a certain number</s-option>
        <s-option value={ROUNDING_MODES.MULTIPLE}>Round prices to a certain multiple</s-option>
      </s-select>

      {showEndingPattern && (
        <EndPricePatternInput
          pattern={endingPattern ?? DEFAULT_END_PATTERN}
          readOnly={readOnly}
          onPatternChange={handlePatternChange}
          error={fieldError?.(errorKey)}
        />
      )}

      {showMultipleValue && (
        <MultiplePatternInput
          pattern={multiplePattern ?? DEFAULT_MULTIPLE_PATTERN}
          readOnly={readOnly}
          onPatternChange={handleMultiplePatternChange}
          error={fieldError?.(errorKey)}
        />
      )}

      {showDirection && (
        <s-stack direction="block" gap="small">
          <s-stack direction="inline" gap="small-100" alignItems="center">
            <s-text type="strong">Rounding direction</s-text>
            <s-icon type="info" interestFor={directionTooltipId} />
            <s-tooltip id={directionTooltipId}>
              Choose whether prices should round to the closest match, always up, or always down.
            </s-tooltip>
          </s-stack>
          <s-choice-list
            name={`rounding-direction-${fieldId}`}
            label="Rounding direction"
            labelAccessibilityVisibility="exclusive"
            variant="list"
            values={[direction]}
            disabled={readOnly}
            onInput={
              readOnly
                ? undefined
                : (e) => {
                    const next = e.currentTarget?.values?.[0] ?? e.target?.value;
                    handleDirectionChange(next);
                  }
            }
          >
            <s-choice value={ROUNDING_DIRECTIONS.CLOSEST}>
              Round up or down (whatever is closest)
            </s-choice>
            <s-choice value={ROUNDING_DIRECTIONS.UP}>Always round up</s-choice>
            <s-choice value={ROUNDING_DIRECTIONS.DOWN}>Always round down</s-choice>
          </s-choice-list>
        </s-stack>
      )}
    </s-stack>
  );
}
