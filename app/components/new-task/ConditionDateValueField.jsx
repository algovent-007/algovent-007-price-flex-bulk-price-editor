import { getFieldValue } from "../../utils/numeric-input";
import { formatDateIso, parseDateString, parseIsoDate } from "../../utils/schedule";
import { useI18n } from "../../i18n/I18nProvider";

function parseConditionDateValue(value) {
  return parseIsoDate(value) || parseDateString(value);
}

function toIsoDateValue(value) {
  const parsed = parseConditionDateValue(value);
  return parsed ? formatDateIso(parsed) : String(value || "").trim();
}

export default function ConditionDateValueField({ value, onChange, readOnly = false, error = "" }) {
  const { t } = useI18n();
  const isoValue = toIsoDateValue(value);

  const handleChange = (event) => {
    onChange(getFieldValue(event));
  };

  return (
    <s-date-field
      label={t("conditions.valueLabel")}
      labelAccessibilityVisibility="exclusive"
      placeholder={t("conditions.selectDate")}
      value={isoValue}
      readOnly={readOnly}
      error={error}
      onChange={readOnly ? undefined : handleChange}
      onInput={readOnly ? undefined : handleChange}
    />
  );
}
