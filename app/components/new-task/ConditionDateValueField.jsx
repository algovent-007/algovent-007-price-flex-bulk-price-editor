import { getFieldValue } from "../../utils/numeric-input";
import { formatDateIso, parseDateString, parseIsoDate } from "../../utils/schedule";

function parseConditionDateValue(value) {
  return parseIsoDate(value) || parseDateString(value);
}

function toIsoDateValue(value) {
  const parsed = parseConditionDateValue(value);
  return parsed ? formatDateIso(parsed) : String(value || "").trim();
}

export default function ConditionDateValueField({ value, onChange, readOnly = false, error = "" }) {
  const isoValue = toIsoDateValue(value);

  const handleChange = (event) => {
    onChange(getFieldValue(event));
  };

  return (
    <s-date-field
      label="Value"
      labelAccessibilityVisibility="exclusive"
      placeholder="Select date"
      value={isoValue}
      readOnly={readOnly}
      error={error}
      onChange={readOnly ? undefined : handleChange}
      onInput={readOnly ? undefined : handleChange}
    />
  );
}
