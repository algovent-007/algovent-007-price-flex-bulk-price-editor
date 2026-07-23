import { getFieldValue, getNumericFieldValue } from "../../utils/numeric-input";
import {
  formatWeightConditionValue,
  parseWeightConditionValue,
  WEIGHT_UNIT_OPTIONS,
} from "../../utils/weight-conditions";

export default function ConditionWeightValueField({
  value,
  onChange,
  readOnly = false,
  error = "",
}) {
  const parsed = parseWeightConditionValue(value);

  const emitChange = (amount, unit) => {
    onChange(formatWeightConditionValue(amount, unit));
  };

  return (
    <s-grid gridTemplateColumns="1fr auto" gap="small" alignItems="end">
      <s-text-field
        label="Value"
        labelAccessibilityVisibility="exclusive"
        placeholder="Enter weight"
        value={parsed.amount}
        disabled={readOnly}
        error={error}
        onInput={
          readOnly
            ? undefined
            : (e) => emitChange(getNumericFieldValue(e), parsed.unit)
        }
      />

      <s-select
        label="Unit"
        labelAccessibilityVisibility="exclusive"
        value={parsed.unit}
        disabled={readOnly}
        onInput={
          readOnly
            ? undefined
            : (e) => emitChange(parsed.amount, getFieldValue(e))
        }
      >
        {WEIGHT_UNIT_OPTIONS.map((option) => (
          <s-option key={option.value} value={option.value}>
            {option.label}
          </s-option>
        ))}
      </s-select>
    </s-grid>
  );
}
