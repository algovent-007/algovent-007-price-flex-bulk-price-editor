import {
  DEFAULT_MULTIPLE_PATTERN,
  addWholeDigit,
  formatMultipleSummary,
  removeWholeDigit,
  serializeMultiplePattern,
} from "../../utils/multiple-price-pattern";
import { usePatternDraft } from "./usePatternDraft";
import { useI18n } from "../../i18n/I18nProvider";

function sanitizeDigitInput(value) {
  const next = String(value ?? "").slice(-1);
  if (next === "*") return "*";
  if (/^\d$/.test(next)) return next;
  return "";
}

export default function MultiplePatternInput({
  pattern,
  readOnly = false,
  onPatternChange,
  error,
}) {
  const { t } = useI18n();
  const { draft, commitPattern } = usePatternDraft(
    pattern,
    DEFAULT_MULTIPLE_PATTERN,
    serializeMultiplePattern
  );
  const multipleLabel = formatMultipleSummary(draft);
  const canAddDigit = draft.whole.length < 6;
  const canRemoveDigit = draft.whole.length > 1;

  const updatePattern = (nextPattern) => {
    commitPattern(nextPattern, onPatternChange);
  };

  const applyDigit = (section, index, value) => {
    if (readOnly) return;

    if (section === "whole") {
      const nextWhole = [...draft.whole];
      nextWhole[index] = value;
      updatePattern({ ...draft, whole: nextWhole });
      return;
    }

    const nextCents = [...draft.cents];
    nextCents[index] = value;
    updatePattern({ ...draft, cents: nextCents });
  };

  const handleWholeDigitInput = (index, value) => {
    applyDigit("whole", index, sanitizeDigitInput(value) || "*");
  };

  const handleCentDigitInput = (index, value) => {
    applyDigit("cent", index, sanitizeDigitInput(value) || "0");
  };

  const handleDigitKeyDown = (section, index, event) => {
    if (readOnly) return;

    const { key } = event;
    if (key === "Backspace" || key === "Delete") {
      event.preventDefault();
      applyDigit(section, index, section === "whole" ? "*" : "0");
      return;
    }

    if (key === "*") {
      if (section !== "whole") return;
      event.preventDefault();
      applyDigit("whole", index, "*");
      return;
    }

    if (/^\d$/.test(key)) {
      event.preventDefault();
      applyDigit(section, index, key);
    }
  };

  const handleAddDigit = () => {
    if (!canAddDigit || readOnly) return;
    updatePattern(addWholeDigit(draft));
  };

  const handleRemoveDigit = () => {
    if (!canRemoveDigit || readOnly) return;
    updatePattern(removeWholeDigit(draft));
  };

  return (
    <s-stack direction="block" gap="small">
      <s-stack direction="inline" gap="base" alignItems="start">
        <s-stack direction="block" gap="small">
          <s-stack direction="inline" gap="small-100" alignItems="end">
            {draft.whole.map((digit, index) => (
              <s-box key={`whole-${index}`} maxInlineSize="52px">
                <s-text-field
                  label={t("rounding.wholeDigitAria", { index: index + 1 })}
                  labelAccessibilityVisibility="exclusive"
                  value={digit}
                  maxLength={1}
                  autocomplete="off"
                  disabled={readOnly}
                  onInput={(event) => handleWholeDigitInput(index, event.currentTarget.value)}
                  onKeyDown={(event) => handleDigitKeyDown("whole", index, event)}
                />
              </s-box>
            ))}
            <s-text aria-hidden="true">.</s-text>
            {draft.cents.map((digit, index) => (
              <s-box key={`cent-${index}`} maxInlineSize="52px">
                <s-text-field
                  label={t("rounding.centsDigitAria", { index: index + 1 })}
                  labelAccessibilityVisibility="exclusive"
                  value={digit}
                  maxLength={1}
                  autocomplete="off"
                  disabled={readOnly}
                  onInput={(event) => handleCentDigitInput(index, event.currentTarget.value)}
                  onKeyDown={(event) => handleDigitKeyDown("cent", index, event)}
                />
              </s-box>
            ))}
          </s-stack>

          <s-text>
            {t("rounding.multipleOf", { pattern: multipleLabel })}
          </s-text>

          {error && <s-banner tone="critical">{error}</s-banner>}
        </s-stack>

        {!readOnly && (
          <s-stack direction="block" gap="small-100">
            <s-button
              variant="tertiary"
              disabled={!canAddDigit}
              onClick={handleAddDigit}
            >
              {t("rounding.addDigit")}
            </s-button>
            <s-button
              variant="tertiary"
              disabled={!canRemoveDigit}
              onClick={handleRemoveDigit}
            >
              {t("rounding.removeDigit")}
            </s-button>
          </s-stack>
        )}
      </s-stack>
    </s-stack>
  );
}
