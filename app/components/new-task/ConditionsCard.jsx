import PriceChangePreview from "./PriceChangePreview";
import { getFieldValue } from "../../utils/numeric-input";
import ConditionDateValueField from "./ConditionDateValueField";
import ConditionMetafieldValueField from "./ConditionMetafieldValueField";
import ConditionInventoryLocationValueField from "./ConditionInventoryLocationValueField";
import ConditionWeightValueField from "./ConditionWeightValueField";
import {
  CONDITION_FIELDS,
  getConditionOperators,
  isCollectionConditionField,
  isDateConditionField,
  isInventoryLocationConditionField,
  isMetafieldConditionField,
  isVariantMetafieldConditionField,
  isPublishedStatusConditionField,
  isStatusConditionField,
  isTaxableConditionField,
  isInventoryOutOfStockPolicyConditionField,
  isInventoryPolicyConditionField,
  isPhysicalProductConditionField,
  isVariantWeightConditionField,
  normalizeCollectionValue,
  normalizeInventoryOutOfStockPolicyValue,
  normalizeInventoryTrackingValue,
  normalizePhysicalProductValue,
  normalizeProductStatusValue,
  normalizePublishedStatusValue,
  normalizeTaxableValue,
  PRODUCT_STATUS_OPTIONS,
  PUBLISHED_STATUS_OPTIONS,
  TAXABLE_OPTIONS,
  INVENTORY_OUT_OF_STOCK_POLICY_OPTIONS,
  INVENTORY_TRACKING_OPTIONS,
  PHYSICAL_PRODUCT_OPTIONS,
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
  collections = [],
  fieldErrors = {},
  clearFieldError,
}) {
  const conditionValueError = (index) => fieldErrors?.[`condition-${index}-value`];

  const handleValueChange = (index, nextValue) => {
    clearFieldError?.(`condition-${index}-value`);
    handleConditionChange(index, "value", nextValue);
  };

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
                  error={conditionValueError(index)}
                  onChange={(nextValue) => handleValueChange(index, nextValue)}
                />
              ) : isStatusConditionField(condition.field) ? (
                <s-select
                  label="Value"
                  labelAccessibilityVisibility="exclusive"
                  value={normalizeProductStatusValue(condition.value)}
                  disabled={readOnly}
                  error={conditionValueError(index)}
                  onInput={
                    readOnly
                      ? undefined
                      : (e) => handleValueChange(index, getFieldValue(e))
                  }
                >
                  {PRODUCT_STATUS_OPTIONS.map((option) => (
                    <s-option key={option.value} value={option.value}>
                      {option.label}
                    </s-option>
                  ))}
                </s-select>
              ) : isTaxableConditionField(condition.field) ? (
                <s-select
                  label="Value"
                  labelAccessibilityVisibility="exclusive"
                  value={normalizeTaxableValue(condition.value)}
                  disabled={readOnly}
                  error={conditionValueError(index)}
                  onInput={
                    readOnly
                      ? undefined
                      : (e) => handleValueChange(index, getFieldValue(e))
                  }
                >
                  {TAXABLE_OPTIONS.map((option) => (
                    <s-option key={option.value} value={option.value}>
                      {option.label}
                    </s-option>
                  ))}
                </s-select>
              ) : isInventoryOutOfStockPolicyConditionField(condition.field) ? (
                <s-select
                  label="Value"
                  labelAccessibilityVisibility="exclusive"
                  value={normalizeInventoryOutOfStockPolicyValue(condition.value)}
                  disabled={readOnly}
                  error={conditionValueError(index)}
                  onInput={
                    readOnly
                      ? undefined
                      : (e) => handleValueChange(index, getFieldValue(e))
                  }
                >
                  {INVENTORY_OUT_OF_STOCK_POLICY_OPTIONS.map((option) => (
                    <s-option key={option.value} value={option.value}>
                      {option.label}
                    </s-option>
                  ))}
                </s-select>
              ) : isInventoryPolicyConditionField(condition.field) ? (
                <s-select
                  label="Value"
                  labelAccessibilityVisibility="exclusive"
                  value={normalizeInventoryTrackingValue(condition.value)}
                  disabled={readOnly}
                  error={conditionValueError(index)}
                  onInput={
                    readOnly
                      ? undefined
                      : (e) => handleValueChange(index, getFieldValue(e))
                  }
                >
                  {INVENTORY_TRACKING_OPTIONS.map((option) => (
                    <s-option key={option.value} value={option.value}>
                      {option.label}
                    </s-option>
                  ))}
                </s-select>
              ) : isPhysicalProductConditionField(condition.field) ? (
                <s-select
                  label="Value"
                  labelAccessibilityVisibility="exclusive"
                  value={normalizePhysicalProductValue(condition.value)}
                  disabled={readOnly}
                  error={conditionValueError(index)}
                  onInput={
                    readOnly
                      ? undefined
                      : (e) => handleValueChange(index, getFieldValue(e))
                  }
                >
                  {PHYSICAL_PRODUCT_OPTIONS.map((option) => (
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
                  error={conditionValueError(index)}
                  onInput={
                    readOnly
                      ? undefined
                      : (e) => handleValueChange(index, getFieldValue(e))
                  }
                >
                  {PUBLISHED_STATUS_OPTIONS.map((option) => (
                    <s-option key={option.value} value={option.value}>
                      {option.label}
                    </s-option>
                  ))}
                </s-select>
              ) : isMetafieldConditionField(condition.field) ? (
                <ConditionMetafieldValueField
                  value={condition.value}
                  operator={condition.operator}
                  readOnly={readOnly}
                  index={index}
                  error={conditionValueError(index)}
                  metafieldType={
                    isVariantMetafieldConditionField(condition.field) ? "variant" : "product"
                  }
                  onChange={(nextValue) => handleValueChange(index, nextValue)}
                />
              ) : isVariantWeightConditionField(condition.field) ? (
                <ConditionWeightValueField
                  value={condition.value}
                  readOnly={readOnly}
                  error={conditionValueError(index)}
                  onChange={(nextValue) => handleValueChange(index, nextValue)}
                />
              ) : isInventoryLocationConditionField(condition.field) ? (
                <ConditionInventoryLocationValueField
                  value={condition.value}
                  locations={locations}
                  readOnly={readOnly}
                  error={conditionValueError(index)}
                  onChange={(nextValue) => handleValueChange(index, nextValue)}
                />
              ) : isCollectionConditionField(condition.field) ? (
                <s-select
                  label="Value"
                  labelAccessibilityVisibility="exclusive"
                  value={normalizeCollectionValue(condition.value, collections)}
                  disabled={readOnly || collections.length === 0}
                  error={conditionValueError(index)}
                  onInput={
                    readOnly
                      ? undefined
                      : (e) => handleValueChange(index, getFieldValue(e))
                  }
                >
                  {collections.length === 0 ? (
                    <s-option value="">No collections found</s-option>
                  ) : (
                    collections.map((collection) => (
                      <s-option key={collection.id} value={collection.id}>
                        {collection.title}
                      </s-option>
                    ))
                  )}
                </s-select>
              ) : (
                <s-text-field
                  label="Value"
                  labelAccessibilityVisibility="exclusive"
                  placeholder="Enter value"
                  value={condition.value}
                  disabled={readOnly}
                  error={conditionValueError(index)}
                  onInput={
                    readOnly
                      ? undefined
                      : (e) => handleValueChange(index, getFieldValue(e))
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

            {fieldErrors?.productSearch && (
              <s-banner tone="critical">{fieldErrors.productSearch}</s-banner>
            )}

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
