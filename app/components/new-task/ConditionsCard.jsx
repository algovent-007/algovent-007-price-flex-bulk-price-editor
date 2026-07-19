import PriceChangePreview from "./PriceChangePreview";
import { getFieldValue } from "../../utils/numeric-input";
import ConditionDateValueField from "./ConditionDateValueField";
import ConditionMetafieldValueField from "./ConditionMetafieldValueField";
import ConditionInventoryLocationValueField from "./ConditionInventoryLocationValueField";
import ConditionWeightValueField from "./ConditionWeightValueField";
import {
  CONDITION_FIELDS,
  getConditionOperators,
  isDateConditionField,
  isInventoryLocationConditionField,
  isProductMetafieldConditionField,
  isPublishedStatusConditionField,
  isStatusConditionField,
  isVariantWeightConditionField,
  normalizeProductStatusValue,
  normalizePublishedStatusValue,
  PRODUCT_STATUS_OPTIONS,
  PUBLISHED_STATUS_OPTIONS,
} from "./constants";

export default function ConditionsCard({
  readOnly = false,
  matchType,
  setMatchType,
  conditions,
  handleConditionChange,
  addCondition,
  removeCondition,
  handleSearch,
  isSearching,
  searchResults,
  previewVariants,
  locations = [],
}) {
  return (
    <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
      <s-stack direction="block" gap="base">
        <s-text type="strong">Products must match:</s-text>

        <s-choice-list
          name="match-type"
          label="Match type"
          labelAccessibilityVisibility="exclusive"
          values={[matchType || "all"]}
          disabled={readOnly}
          onInput={
            readOnly
              ? undefined
              : (e) => {
                  const next = e.currentTarget?.values?.[0] ?? e.target?.value;
                  if (next) setMatchType(next);
                }
          }
        >
          <s-choice value="all">All conditions</s-choice>
          <s-choice value="any">Any condition</s-choice>
        </s-choice-list>

        <s-stack direction="block" gap="base">
          {conditions.map((condition, index) => (
            <s-grid
              key={index}
              gridTemplateColumns={readOnly ? "1fr 1fr 2fr" : "1fr 1fr 2fr auto"}
              gap="base"
              alignItems="end"
            >
              <s-select
                label="Field"
                labelAccessibilityVisibility="exclusive"
                value={condition.field}
                disabled={readOnly}
                onInput={
                  readOnly
                    ? undefined
                    : (e) => handleConditionChange(index, "field", getFieldValue(e))
                }
              >
                {CONDITION_FIELDS.map((field) => (
                  <s-option key={field.value} value={field.value}>
                    {field.label}
                  </s-option>
                ))}
              </s-select>

              <s-select
                label="Operator"
                labelAccessibilityVisibility="exclusive"
                value={condition.operator}
                disabled={readOnly}
                onInput={
                  readOnly
                    ? undefined
                    : (e) => handleConditionChange(index, "operator", getFieldValue(e))
                }
              >
                {getConditionOperators(condition.field).map((op) => (
                  <s-option key={op.value} value={op.value}>
                    {op.label}
                  </s-option>
                ))}
              </s-select>

              {isDateConditionField(condition.field) ? (
                <ConditionDateValueField
                  value={condition.value}
                  readOnly={readOnly}
                  onChange={(nextValue) => handleConditionChange(index, "value", nextValue)}
                />
              ) : isStatusConditionField(condition.field) ? (
                <s-select
                  label="Value"
                  labelAccessibilityVisibility="exclusive"
                  value={normalizeProductStatusValue(condition.value)}
                  disabled={readOnly}
                  onInput={
                    readOnly
                      ? undefined
                      : (e) => handleConditionChange(index, "value", getFieldValue(e))
                  }
                >
                  {PRODUCT_STATUS_OPTIONS.map((option) => (
                    <s-option key={option.value} value={option.value}>
                      {option.label}
                    </s-option>
                  ))}
                </s-select>
              ) : isPublishedStatusConditionField(condition.field) ? (
                <s-select
                  label="Value"
                  labelAccessibilityVisibility="exclusive"
                  value={normalizePublishedStatusValue(condition.value)}
                  disabled={readOnly}
                  onInput={
                    readOnly
                      ? undefined
                      : (e) => handleConditionChange(index, "value", getFieldValue(e))
                  }
                >
                  {PUBLISHED_STATUS_OPTIONS.map((option) => (
                    <s-option key={option.value} value={option.value}>
                      {option.label}
                    </s-option>
                  ))}
                </s-select>
              ) : isProductMetafieldConditionField(condition.field) ? (
                <ConditionMetafieldValueField
                  value={condition.value}
                  operator={condition.operator}
                  readOnly={readOnly}
                  index={index}
                  onChange={(nextValue) => handleConditionChange(index, "value", nextValue)}
                />
              ) : isVariantWeightConditionField(condition.field) ? (
                <ConditionWeightValueField
                  value={condition.value}
                  readOnly={readOnly}
                  onChange={(nextValue) => handleConditionChange(index, "value", nextValue)}
                />
              ) : isInventoryLocationConditionField(condition.field) ? (
                <ConditionInventoryLocationValueField
                  value={condition.value}
                  locations={locations}
                  readOnly={readOnly}
                  onChange={(nextValue) => handleConditionChange(index, "value", nextValue)}
                />
              ) : (
                <s-text-field
                  label="Value"
                  labelAccessibilityVisibility="exclusive"
                  placeholder="Enter value"
                  value={condition.value}
                  disabled={readOnly}
                  onInput={
                    readOnly
                      ? undefined
                      : (e) => handleConditionChange(index, "value", getFieldValue(e))
                  }
                />
              )}

              {!readOnly && (
                <s-button
                  icon="delete"
                  tone="critical"
                  accessibilityLabel="Remove condition"
                  onClick={() => removeCondition(index)}
                />
              )}
            </s-grid>
          ))}
        </s-stack>

        {!readOnly && (
          <>
            <s-button onClick={addCondition}>Add another condition</s-button>

            <s-stack direction="inline" justifyContent="end">
              <s-button variant="primary" onClick={handleSearch} loading={isSearching}>
                Search For Products
              </s-button>
            </s-stack>
          </>
        )}

        {searchResults && (
          <PriceChangePreview previewVariants={previewVariants} visible />
        )}
      </s-stack>
    </s-box>
  );
}
