import PriceChangePreview from "./PriceChangePreview";
import { CONDITION_FIELDS, CONDITION_OPERATORS } from "./constants";

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
}) {
  return (
    <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
      <s-stack direction="block" gap="base">
        <s-text type="strong">Products must match:</s-text>

        <s-choice-list
          name="match-type"
          label="Match type"
          labelAccessibilityVisibility="exclusive"
          value={matchType}
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
                    : (e) => handleConditionChange(index, "field", e.target.value)
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
                    : (e) => handleConditionChange(index, "operator", e.target.value)
                }
              >
                {CONDITION_OPERATORS.map((op) => (
                  <s-option key={op.value} value={op.value}>
                    {op.label}
                  </s-option>
                ))}
              </s-select>

              <s-text-field
                label="Value"
                labelAccessibilityVisibility="exclusive"
                placeholder="Enter value"
                value={condition.value}
                disabled={readOnly}
                onInput={
                  readOnly
                    ? undefined
                    : (e) => handleConditionChange(index, "value", e.target.value)
                }
              />

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
