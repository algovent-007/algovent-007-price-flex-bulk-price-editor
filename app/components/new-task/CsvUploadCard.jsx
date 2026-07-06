export default function CsvUploadCard({
  readOnly = false,
  csvFileInputRef,
  csvFileName,
  onFileChange,
  onUploadClick,
}) {
  return (
    <s-box padding="base" borderWidth="base" borderRadius="base" background="base">
      <s-stack direction="block" gap="base">
        <s-text type="strong">Upload CSV</s-text>
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
            <s-button variant="primary" onClick={onUploadClick}>
              Upload File
            </s-button>
          )}
          {csvFileName ? (
            <s-text color="subdued">Selected: {csvFileName}</s-text>
          ) : readOnly ? (
            <s-text color="subdued">No CSV file recorded for this task.</s-text>
          ) : null}
        </s-stack>
      </s-stack>
    </s-box>
  );
}
