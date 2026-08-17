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
import { translateError } from "../../i18n/errors";
import { useI18n } from "../../i18n/I18nProvider";

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
  locations = [],
  collections = [],
  fieldErrors = {},
  clearFieldError,
}) {
  const { t } = useI18n();
  const conditionValueError = (index) => translateError(t, fieldErrors?.[`condition-${index}-value`]);

  const handleValueChange = (index, nextValue) => {
    clearFieldError?.(`condition-${index}-value`);
    handleConditionChange(index, "value", nextValue);
  };

  return (
    <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
      <s-stack direction="block" gap="base">
        <s-text type="strong">{t("conditions.mustMatch")}</s-text>

        <s-choice-list
          name="match-type"
          label={t("conditions.matchType")}
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
          <s-choice value="all">{t("conditions.allConditionsLabel")}</s-choice>
          <s-choice value="any">{t("conditions.anyConditionLabel")}</s-choice>
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
                label={t("conditions.fieldLabel")}
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
                  {t(`conditions.field.${field.value}`)}
                  </s-option>
                ))}
              </s-select>

              <s-select
                label={t("conditions.operatorLabel")}
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
                    {t(`conditions.operator.${op.value}`)}
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
                  label={t("conditions.valueLabel")}
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
                      {t(option.value === "ACTIVE" ? "conditions.statusActive" : "conditions.statusDraft")}
                    </s-option>
                  ))}
                </s-select>
              ) : isTaxableConditionField(condition.field) ? (
                <s-select
                  label={t("conditions.valueLabel")}
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
                      {t(option.value === "true" ? "conditions.taxableYes" : "conditions.taxableNo")}
                    </s-option>
                  ))}
                </s-select>
              ) : isInventoryOutOfStockPolicyConditionField(condition.field) ? (
                <s-select
                  label={t("conditions.valueLabel")}
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
                      {t(option.value === "CONTINUE" ? "conditions.continueSelling" : "conditions.stopSelling")}
                    </s-option>
                  ))}
                </s-select>
              ) : isInventoryPolicyConditionField(condition.field) ? (
                <s-select
                  label={t("conditions.valueLabel")}
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
                      {t(option.value === "true" ? "conditions.tracksInventory" : "conditions.dontTrackInventory")}
                    </s-option>
                  ))}
                </s-select>
              ) : isPhysicalProductConditionField(condition.field) ? (
                <s-select
                  label={t("conditions.valueLabel")}
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
                      {t(option.value === "true" ? "conditions.physicalYes" : "conditions.physicalNo")}
                    </s-option>
                  ))}
                </s-select>
              ) : isPublishedStatusConditionField(condition.field) ? (
                <s-select
                  label={t("conditions.valueLabel")}
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
                      {t(option.value === "published" ? "conditions.publishedYes" : "conditions.publishedNo")}
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
                  label={t("conditions.valueLabel")}
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
                    <s-option value="">{t("conditions.noCollections")}</s-option>
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
                  label={t("conditions.valueLabel")}
                  labelAccessibilityVisibility="exclusive"
                  placeholder={t("conditions.enterValue")}
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
                  accessibilityLabel={t("conditions.removeCondition")}
                  onClick={() => removeCondition(index)}
                />
              )}
            </s-grid>
          ))}
        </s-stack>

        {!readOnly && (
          <>
            <s-button onClick={addCondition}>{t("conditions.addCondition")}</s-button>

            {fieldErrors?.productSearch && (
              <s-banner tone="critical">{translateError(t, fieldErrors.productSearch)}</s-banner>
            )}

            <s-stack direction="inline" justifyContent="end">
              <s-button variant="primary" onClick={handleSearch} loading={isSearching}>
                {t("newTask.searchForProducts")}
              </s-button>
            </s-stack>
          </>
        )}
      </s-stack>
    </s-box>
  );
}
