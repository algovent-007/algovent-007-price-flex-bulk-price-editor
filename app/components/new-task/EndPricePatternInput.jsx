import styles from "./EndPricePatternInput.module.css";
import {
  DEFAULT_END_PATTERN,
  addWholeDigit,
  formatEndingSummary,
  normalizeEndingPattern,
  removeWholeDigit,
  serializeEndingPattern,
} from "../../utils/ending-price-pattern";
import { usePatternDraft } from "./usePatternDraft";

function sanitizeDigitInput(value) {
  const next = String(value ?? "").slice(-1);
  if (next === "*") return "*";
  if (/^\d$/.test(next)) return next;
  return "";
}

export default function EndPricePatternInput({
  pattern,
  readOnly = false,
  onPatternChange,
  error,
}) {
  const { draft, commitPattern } = usePatternDraft(
    pattern,
    DEFAULT_END_PATTERN,
    serializeEndingPattern
  );
  const endingLabel = formatEndingSummary(draft);
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
      <div className={styles.patternSection}>
        <div className={styles.patternControls}>
          <div className={styles.patternRow}>
            {draft.whole.map((digit, index) => (
              <input
                key={`whole-${index}`}
                className={styles.digitBox}
                value={digit}
                maxLength={1}
                type="text"
                autoComplete="off"
                disabled={readOnly}
                aria-label={`Whole number digit ${index + 1}`}
                onChange={(event) => handleWholeDigitInput(index, event.target.value)}
                onInput={(event) => handleWholeDigitInput(index, event.currentTarget.value)}
                onKeyDown={(event) => handleDigitKeyDown("whole", index, event)}
              />
            ))}
            <span className={styles.decimalPoint} aria-hidden="true">
              .
            </span>
            {draft.cents.map((digit, index) => (
              <input
                key={`cent-${index}`}
                className={styles.digitBox}
                value={digit}
                maxLength={1}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                disabled={readOnly}
                aria-label={`Cents digit ${index + 1}`}
                onChange={(event) => handleCentDigitInput(index, event.target.value)}
                onInput={(event) => handleCentDigitInput(index, event.currentTarget.value)}
                onKeyDown={(event) => handleDigitKeyDown("cent", index, event)}
              />
            ))}
          </div>

          <p className={styles.summaryText}>
            Make prices end in <span className={styles.summaryValue}>{endingLabel}</span>
          </p>

          <s-link href="/app/support">Learn more about &apos;End prices in a certain number&apos; rounding</s-link>

          {error && <s-banner tone="critical">{error}</s-banner>}
        </div>

        {!readOnly && (
          <div className={styles.patternActions}>
            <button
              type="button"
              className={styles.patternActionButton}
              disabled={!canAddDigit}
              onClick={handleAddDigit}
            >
              Add digit
            </button>
            <button
              type="button"
              className={styles.patternActionButton}
              disabled={!canRemoveDigit}
              onClick={handleRemoveDigit}
            >
              Remove digit
            </button>
          </div>
        )}
      </div>
    </s-stack>
  );
}
