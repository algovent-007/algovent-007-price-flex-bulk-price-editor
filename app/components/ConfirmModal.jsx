/* eslint-disable react/prop-types -- this codebase does not use PropTypes */
import { useI18n } from "../i18n/I18nProvider";

export default function ConfirmModal({
  id,
  heading,
  message,
  confirmLabel,
  confirmTone,
  modalRef,
  onConfirm,
  onHide,
}) {
  const { t } = useI18n();

  return (
    <s-modal id={id} ref={modalRef} heading={heading} onHide={onHide}>
      <s-paragraph>{message}</s-paragraph>
      <s-button slot="secondary-actions" commandFor={id} command="--hide">
        {t("common.cancel")}
      </s-button>
      <s-button
        slot="primary-action"
        variant="primary"
        tone={confirmTone}
        onClick={() => {
          onConfirm();
          modalRef.current?.hideOverlay?.();
        }}
      >
        {confirmLabel}
      </s-button>
    </s-modal>
  );
}
