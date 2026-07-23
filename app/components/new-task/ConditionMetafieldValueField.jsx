import { useEffect, useId, useRef, useState } from "react";
import { getFieldValue } from "../../utils/numeric-input";
import {
  formatMetafieldConditionValue,
  getMetafieldConditionSummary,
  getMetafieldDraftFromValue,
  metafieldConditionNeedsValue,
} from "./constants";

const METAFIELD_FIELD_CONFIG = {
  product: {
    modalIdPrefix: "product-metafield-config",
    heading: "Provide Product Metafield Name and Value",
    nameLabel: "Metafield Name",
    valueLabel: "Metafield Value",
    warningText:
      "Click Add Condition to save; values are used when you click Search for products. The product selection rules contain metafield condition. This will make the update process slower than usual because of additional calls to the Shopify API.",
  },
  variant: {
    modalIdPrefix: "variant-metafield-config",
    heading: "Provide Product Variant Metafield Name and Value",
    nameLabel: "Product Variant Metafield",
    valueLabel: "Value",
    warningText:
      "Click Add Condition to save; values are used when you click Search for products. The product selection rules contain variant metafield condition. This will make the update process slower than usual because of additional calls to the Shopify API.",
  },
};

export default function ConditionMetafieldValueField({
  value,
  operator,
  onChange,
  readOnly = false,
  index = 0,
  error = "",
  metafieldType = "product",
}) {
  const config = METAFIELD_FIELD_CONFIG[metafieldType] ?? METAFIELD_FIELD_CONFIG.product;
  const rawModalId = useId();
  const modalId = `${config.modalIdPrefix}-${index}-${rawModalId.replace(/:/g, "")}`;
  const modalRef = useRef(null);
  const parsed = getMetafieldDraftFromValue(value);
  const [draftName, setDraftName] = useState(parsed.name);
  const [draftValue, setDraftValue] = useState(parsed.metafieldValue);
  const summary = getMetafieldConditionSummary(value, operator);

  useEffect(() => {
    const next = getMetafieldDraftFromValue(value);
    setDraftName(next.name);
    setDraftValue(next.metafieldValue);
  }, [value, operator]);

  const resetDraft = () => {
    const next = getMetafieldDraftFromValue(value);
    setDraftName(next.name);
    setDraftValue(next.metafieldValue);
  };

  const openModal = () => {
    resetDraft();
    modalRef.current?.showOverlay?.();
  };

  const applyCondition = () => {
    const trimmedName = draftName.trim();
    if (!trimmedName) return;
    if (metafieldConditionNeedsValue(operator) && !draftValue.trim()) return;

    onChange(formatMetafieldConditionValue(trimmedName, draftValue, operator));
    modalRef.current?.hideOverlay?.();
  };

  return (
    <>
      <s-stack direction="block" gap="small">
        {summary ? <s-text>{summary}</s-text> : null}
        {!readOnly ? (
          <s-button variant="secondary" onClick={openModal}>
            Configure
          </s-button>
        ) : (
          summary && <s-text color="subdued">{summary}</s-text>
        )}
        {error ? <s-banner tone="critical">{error}</s-banner> : null}
      </s-stack>

      {!readOnly && (
        <s-modal id={modalId} ref={modalRef} heading={config.heading} onHide={resetDraft}>
          <s-stack direction="block" gap="base">
            <s-text-field
              label={config.nameLabel}
              placeholder="Namespace.Key"
              value={draftName}
              onInput={(e) => setDraftName(getFieldValue(e))}
            />

            <s-text-field
              label={config.valueLabel}
              placeholder="Value"
              value={draftValue}
              onInput={(e) => setDraftValue(getFieldValue(e))}
            />

            <s-banner tone="warning">{config.warningText}</s-banner>
          </s-stack>

          <s-button slot="secondary-actions" commandFor={modalId} command="--hide">
            Close
          </s-button>
          <s-button slot="primary-action" variant="primary" onClick={applyCondition}>
            Add Condition
          </s-button>
        </s-modal>
      )}
    </>
  );
}
