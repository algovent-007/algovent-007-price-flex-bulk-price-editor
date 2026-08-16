import styles from "./EndPricePatternInput.module.css";
import { normalizeEndingPattern } from "../../utils/ending-price-pattern";
import {
  DEFAULT_MULTIPLE_PATTERN,
  addWholeDigit,
  formatMultipleSummary,
  removeWholeDigit,
} from "../../utils/multiple-price-pattern";

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
  const normalized = normalizeEndingPattern(pattern ?? DEFAULT_MULTIPLE_PATTERN);
  const multipleLabel = formatMultipleSummary(normalized);
  const canAddDigit = normalized.whole.length < 6;
  const canRemoveDigit = normalized.whole.length > 1;

  const updatePattern = (nextPattern) => {
    onPatternChange?.(normalizeEndingPattern(nextPattern));
  };

  const handleWholeDigitChange = (index, value) => {
    const nextWhole = [...normalized.whole];
    nextWhole[index] = sanitizeDigitInput(value) || "*";
    updatePattern({ ...normalized, whole: nextWhole });
  };

  const handleCentDigitChange = (index, value) => {
    const nextCents = [...normalized.cents];
    nextCents[index] = sanitizeDigitInput(value) || "0";
    updatePattern({ ...normalized, cents: nextCents });
  };

  const handleAddDigit = () => {
    if (!canAddDigit || readOnly) return;
    updatePattern(addWholeDigit(normalized));
  };

  const handleRemoveDigit = () => {
    if (!canRemoveDigit || readOnly) return;
    updatePattern(removeWholeDigit(normalized));
  };

  return (
    <s-stack direction="block" gap="small">
      <div className={styles.patternSection}>
        <div className={styles.patternControls}>
          <div className={styles.patternRow}>
            {normalized.whole.map((digit, index) => (
              <input
                key={`whole-${index}`}
                className={styles.digitBox}
                value={digit}
                maxLength={1}
                inputMode="text"
                disabled={readOnly}
                aria-label={`Whole number digit ${index + 1}`}
                onChange={(event) => handleWholeDigitChange(index, event.target.value)}
              />
            ))}
            <span className={styles.decimalPoint} aria-hidden="true">
              .
            </span>
            {normalized.cents.map((digit, index) => (
              <input
                key={`cent-${index}`}
                className={styles.digitBox}
                value={digit}
                maxLength={1}
                inputMode="numeric"
                disabled={readOnly}
                aria-label={`Cents digit ${index + 1}`}
                onChange={(event) => handleCentDigitChange(index, event.target.value)}
              />
            ))}
          </div>

          <p className={styles.summaryText}>
            Make prices a multiple of{" "}
            <span className={styles.summaryValue}>{multipleLabel}</span>
          </p>

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
