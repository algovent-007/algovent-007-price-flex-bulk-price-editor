import { useEffect, useId, useRef, useState } from "react";
import { getFieldValue } from "../../utils/numeric-input";
import {
  formatMetafieldConditionValue,
  getMetafieldConditionSummary,
  getMetafieldDraftFromValue,
  metafieldConditionNeedsValue,
} from "./constants";
import { useI18n } from "../../i18n/I18nProvider";

export default function ConditionMetafieldValueField({
  value,
  operator,
  onChange,
  readOnly = false,
  index = 0,
  error = "",
  metafieldType = "product",
}) {
  const { t } = useI18n();
  const isVariant = metafieldType === "variant";
  const config = {
    modalIdPrefix: isVariant ? "variant-metafield-config" : "product-metafield-config",
    heading: t(isVariant ? "conditions.metafield.variantHeading" : "conditions.metafield.productHeading"),
    nameLabel: t(isVariant ? "conditions.metafield.variantNameLabel" : "conditions.metafield.productNameLabel"),
    valueLabel: t(isVariant ? "conditions.metafield.variantValueLabel" : "conditions.metafield.productValueLabel"),
    warningText: t(isVariant ? "conditions.metafield.variantWarning" : "conditions.metafield.productWarning"),
  };
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
            {t("conditions.configure")}
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
              placeholder={t("conditions.metafield.placeholder")}
              value={draftName}
              onInput={(e) => setDraftName(getFieldValue(e))}
            />

            <s-text-field
              label={config.valueLabel}
              placeholder={t("conditions.valueLabel")}
              value={draftValue}
              onInput={(e) => setDraftValue(getFieldValue(e))}
            />

            <s-banner tone="warning">{config.warningText}</s-banner>
          </s-stack>

          <s-button slot="secondary-actions" commandFor={modalId} command="--hide">
            {t("common.close")}
          </s-button>
          <s-button slot="primary-action" variant="primary" onClick={applyCondition}>
            {t("conditions.addCondition")}
          </s-button>
        </s-modal>
      )}
    </>
  );
}
