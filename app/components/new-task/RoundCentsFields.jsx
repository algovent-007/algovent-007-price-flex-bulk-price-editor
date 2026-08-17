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
import { useI18n } from "../../i18n/I18nProvider";

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
  const { t } = useI18n();
  const rawId = useId();
  const endingTooltipId = `round-ending-help-${rawId.replace(/:/g, "")}-${errorKey}`;
  const multipleTooltipId = `round-multiple-help-${rawId.replace(/:/g, "")}-${errorKey}`;
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
        label={t("rounding.label")}
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
        <s-option value={ROUNDING_MODES.NONE}>{t("rounding.none")}</s-option>
        <s-option value={ROUNDING_MODES.NEAREST_CENT}>{t("rounding.nearestCent")}</s-option>
        <s-option value={ROUNDING_MODES.WHOLE_NUMBER}>{t("rounding.wholeNumber")}</s-option>
        <s-option value={ROUNDING_MODES.END_99}>{t("rounding.end99")}</s-option>
        <s-option value={ROUNDING_MODES.END_CUSTOM}>{t("rounding.endCustom")}</s-option>
        <s-option value={ROUNDING_MODES.MULTIPLE}>{t("rounding.multiple")}</s-option>
      </s-select>

      {showEndingPattern && (
        <s-stack direction="block" gap="small">
          <s-stack direction="inline" gap="small-100" alignItems="center">
            <s-text type="strong">{t("rounding.endCustom")}</s-text>
            <s-tooltip id={endingTooltipId}>
              {t("rounding.endCustomHelp")}
            </s-tooltip>
            <s-button
              variant="tertiary"
              interestFor={endingTooltipId}
              accessibilityLabel={t("rounding.endCustomAria")}
            >
              <s-icon type="info"></s-icon>
            </s-button>
          </s-stack>
          <EndPricePatternInput
            pattern={endingPattern ?? DEFAULT_END_PATTERN}
            readOnly={readOnly}
            onPatternChange={handlePatternChange}
            error={fieldError?.(errorKey)}
          />
        </s-stack>
      )}

      {showMultipleValue && (
        <s-stack direction="block" gap="small">
          <s-stack direction="inline" gap="small-100" alignItems="center">
            <s-text type="strong">{t("rounding.multiple")}</s-text>
            <s-tooltip id={multipleTooltipId}>
              {t("rounding.multipleHelp")}
            </s-tooltip>
            <s-button
              variant="tertiary"
              interestFor={multipleTooltipId}
              accessibilityLabel={t("rounding.multipleAria")}
            >
              <s-icon type="info"></s-icon>
            </s-button>
          </s-stack>
          <MultiplePatternInput
            pattern={multiplePattern ?? DEFAULT_MULTIPLE_PATTERN}
            readOnly={readOnly}
            onPatternChange={handleMultiplePatternChange}
            error={fieldError?.(errorKey)}
          />
        </s-stack>
      )}

      {showDirection && (
        <s-stack direction="block" gap="small">
          <s-stack direction="inline" gap="small-100" alignItems="center">
            <s-text type="strong">{t("rounding.direction")}</s-text>
            <s-tooltip id={directionTooltipId}>
              {t("rounding.directionHelp")}
            </s-tooltip>
            <s-button
              variant="tertiary"
              interestFor={directionTooltipId}
              accessibilityLabel={t("rounding.directionAria")}
            >
              <s-icon type="info"></s-icon>
            </s-button>
          </s-stack>
          <s-choice-list
            name={`rounding-direction-${fieldId}`}
            label={t("rounding.direction")}
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
              {t("rounding.closest")}
            </s-choice>
            <s-choice value={ROUNDING_DIRECTIONS.UP}>{t("rounding.up")}</s-choice>
            <s-choice value={ROUNDING_DIRECTIONS.DOWN}>{t("rounding.down")}</s-choice>
          </s-choice-list>
        </s-stack>
      )}
    </s-stack>
  );
}
