import { downloadCsvTemplate } from "../../utils/csv-bulk-edit";
import { translateError } from "../../i18n/errors";
import { useI18n } from "../../i18n/I18nProvider";

function firstFile(files) {
  if (!files) return null;
  if (Array.isArray(files)) return files[0] || null;
  return files[0] || null;
}

export default function CsvUploadCard({
  readOnly = false,
  editType,
  csvFileName,
  csvRowCount = 0,
  onFileChange,
  onDownloadTemplate,
  error = "",
}) {
  const { t } = useI18n();
  const modeLabel =
    editType === "csv-direct" ? t("csv.directHelp") : t("csv.allHelp");
  const dropError = translateError(t, error);

  const handleDropZoneChange = (event) => {
    const file = firstFile(event.currentTarget?.files || event.target?.files);
    if (!file) return;
    onFileChange?.({ target: { files: [file] } });
  };

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
          <s-drop-zone
            label={t("csv.uploadFile")}
            accessibilityLabel={t("csv.uploadFile")}
            accept=".csv,text/csv"
            error={error ? dropError : undefined}
            onChange={handleDropZoneChange}
          />
        )}

        <s-stack direction="block" gap="small">
          {!readOnly && (
            <s-button
              variant="secondary"
              onClick={() => (onDownloadTemplate ? onDownloadTemplate() : downloadCsvTemplate(editType))}
            >
              {t("csv.downloadTemplate")}
            </s-button>
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
        </s-stack>
      </s-stack>
    </s-box>
  );
}
