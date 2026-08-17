import { getFieldValue, getNumericFieldValue } from "../../utils/numeric-input";
import {
  formatWeightConditionValue,
  parseWeightConditionValue,
  WEIGHT_UNIT_OPTIONS,
} from "../../utils/weight-conditions";

import { translateError } from "../../i18n/errors";
import { useI18n } from "../../i18n/I18nProvider";

export default function ConditionWeightValueField({
  value,
  onChange,
  readOnly = false,
  error = "",
}) {
  const { t } = useI18n();
  const parsed = parseWeightConditionValue(value);

  const emitChange = (amount, unit) => {
    onChange(formatWeightConditionValue(amount, unit));
  };

  return (
    <s-grid gridTemplateColumns="1fr auto" gap="small" alignItems="end">
      <s-text-field
        label={t("conditions.valueLabel")}
        labelAccessibilityVisibility="exclusive"
        placeholder={t("conditions.enterWeight")}
        value={parsed.amount}
        disabled={readOnly}
        error={translateError(t, error)}
        onInput={
          readOnly
            ? undefined
            : (e) => emitChange(getNumericFieldValue(e), parsed.unit)
        }
      />

      <s-select
        label={t("conditions.unit")}
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
