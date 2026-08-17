import { downloadCsvTemplate } from "../../utils/csv-bulk-edit";
import { translateError } from "../../i18n/errors";
import { useI18n } from "../../i18n/I18nProvider";

export default function CsvUploadCard({
  readOnly = false,
  editType,
  csvFileInputRef,
  csvFileName,
  csvRowCount = 0,
  onFileChange,
  onUploadClick,
  onDownloadTemplate,
  error = "",
}) {
  const { t } = useI18n();
  const modeLabel =
    editType === "csv-direct" ? t("csv.directHelp") : t("csv.allHelp");

  return (
    <s-box padding="base" borderWidth="base" borderRadius="base" background="base">
      <s-stack direction="block" gap="base">
        {editType === "csv-direct" && (
          <s-banner tone="info">
            {t("csv.directBanner")}
          </s-banner>
        )}

        <s-text type="strong">{t("csv.upload")}</s-text>
        <s-text color="subdued">{modeLabel}</s-text>
        {!readOnly && <s-link href="/app/support">{t("csv.knowMore")}</s-link>}

        {!readOnly && (
          <input
            ref={csvFileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={onFileChange}
            style={{ display: "none" }}
          />
        )}

        <s-stack direction="block" gap="small">
          {!readOnly && (
            <s-stack direction="inline" gap="small">
              <s-button variant="primary" onClick={onUploadClick}>
                {t("csv.uploadFile")}
              </s-button>
              <s-button
                variant="secondary"
                onClick={() => (onDownloadTemplate ? onDownloadTemplate() : downloadCsvTemplate(editType))}
              >
                {t("csv.downloadTemplate")}
              </s-button>
            </s-stack>
          )}
          {csvFileName ? (
            <s-text color="subdued">
              {csvRowCount > 0
                ? t("csv.selectedFileRows", { name: csvFileName, count: csvRowCount })
                : t("csv.selectedFile", { name: csvFileName })}
            </s-text>
          ) : readOnly ? (
            <s-text color="subdued">{t("csv.noFile")}</s-text>
          ) : null}
          {!readOnly && error && <s-banner tone="critical">{translateError(t, error)}</s-banner>}
        </s-stack>
      </s-stack>
    </s-box>
  );
}
