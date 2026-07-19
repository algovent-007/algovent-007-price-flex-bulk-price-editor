import { useEffect, useId, useRef, useState } from "react";
import { getFieldValue } from "../../utils/numeric-input";
import {
  formatMetafieldConditionValue,
  getMetafieldConditionSummary,
  getMetafieldDraftFromValue,
  metafieldConditionNeedsValue,
} from "./constants";

export default function ConditionMetafieldValueField({
  value,
  operator,
  onChange,
  readOnly = false,
  index = 0,
}) {
  const rawModalId = useId();
  const modalId = `product-metafield-config-${index}-${rawModalId.replace(/:/g, "")}`;
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
      </s-stack>

      {!readOnly && (
        <s-modal
          id={modalId}
          ref={modalRef}
          heading="Provide Product Metafield Name and Value"
          onHide={resetDraft}
        >
          <s-stack direction="block" gap="base">
            <s-text-field
              label="Metafield Name"
              placeholder="Namespace.Key"
              value={draftName}
              onInput={(e) => setDraftName(getFieldValue(e))}
            />

            <s-text-field
              label="Metafield Value"
              placeholder="Value"
              value={draftValue}
              onInput={(e) => setDraftValue(getFieldValue(e))}
            />

            <s-banner tone="warning">
              Click Add Condition to save; values are used when you click Search for products. The
              product selection rules contain metafield condition. This will make the update process
              slower than usual because of additional calls to the Shopify API.
            </s-banner>
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
