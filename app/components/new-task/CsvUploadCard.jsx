import { downloadCsvTemplate } from "../../utils/csv-bulk-edit";

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
  const modeLabel =
    editType === "csv-direct"
      ? "Upload a CSV with variant IDs or SKUs and the exact prices to apply."
      : "Upload a CSV listing the variants you want to edit. Pricing rules from step 2 will be applied.";

  return (
    <s-box padding="base" borderWidth="base" borderRadius="base" background="base">
      <s-stack direction="block" gap="base">
        {editType === "csv-direct" && (
          <s-banner tone="info">
            Direct CSV mode applies the prices from your uploaded file. Pricing rules in step 2 are
            ignored.
          </s-banner>
        )}

        <s-text type="strong">Upload CSV</s-text>
        <s-text color="subdued">{modeLabel}</s-text>
        {!readOnly && <s-link href="/app/support">Know more</s-link>}

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
                Upload File
              </s-button>
              <s-button
                variant="secondary"
                onClick={() => (onDownloadTemplate ? onDownloadTemplate() : downloadCsvTemplate(editType))}
              >
                Download template
              </s-button>
            </s-stack>
          )}
          {csvFileName ? (
            <s-text color="subdued">
              Selected: {csvFileName}
              {csvRowCount > 0 ? ` (${csvRowCount} row${csvRowCount === 1 ? "" : "s"})` : ""}
            </s-text>
          ) : readOnly ? (
            <s-text color="subdued">No CSV file recorded for this task.</s-text>
          ) : null}
          {!readOnly && error && <s-banner tone="critical">{error}</s-banner>}
        </s-stack>
      </s-stack>
    </s-box>
  );
}
