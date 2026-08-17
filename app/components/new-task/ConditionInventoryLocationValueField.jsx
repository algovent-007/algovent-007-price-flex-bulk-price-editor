import { getFieldValue, getNumericFieldValue } from "../../utils/numeric-input";
import {
  formatInventoryLocationConditionValue,
  parseInventoryLocationConditionValue,
} from "../../utils/inventory-location-conditions";

import { useI18n } from "../../i18n/I18nProvider";

export default function ConditionInventoryLocationValueField({
  value,
  onChange,
  locations = [],
  readOnly = false,
  error = "",
}) {
  const { t } = useI18n();
  const parsed = parseInventoryLocationConditionValue(value);
  const selectedLocationId =
    parsed.locationId ||
    locations[0]?.id ||
    "";

  const emitChange = (quantity, locationId) => {
    onChange(formatInventoryLocationConditionValue(quantity, locationId));
  };

  return (
    <s-grid gridTemplateColumns="1fr 1.5fr" gap="small" alignItems="end">
      <s-text-field
        label={t("conditions.valueLabel")}
        labelAccessibilityVisibility="exclusive"
        placeholder={t("conditions.enterStockLevel")}
        value={parsed.quantity}
        disabled={readOnly}
        error={error}
        onInput={
          readOnly
            ? undefined
            : (e) => emitChange(getNumericFieldValue(e), selectedLocationId)
        }
      />

      <s-select
        label={t("conditions.location")}
        labelAccessibilityVisibility="exclusive"
        value={selectedLocationId}
        disabled={readOnly || locations.length === 0}
        onInput={
          readOnly
            ? undefined
            : (e) => emitChange(parsed.quantity, getFieldValue(e))
        }
      >
        {locations.length === 0 ? (
          <s-option value="">{t("conditions.noLocations")}</s-option>
        ) : (
          locations.map((location) => (
            <s-option key={location.id} value={location.id}>
              {location.name}
            </s-option>
          ))
        )}
      </s-select>
    </s-grid>
  );
}
