import PriceChangePreview from "./PriceChangePreview";

export default function CollectionCard({
  readOnly = false,
  collections,
  selectedCollectionId,
  setSelectedCollectionId,
  handleSearch,
  isSearching,
  searchResults,
  previewVariants,
  fieldErrors = {},
  clearFieldError,
}) {
  return (
    <s-box padding="base" borderWidth="base" borderRadius="base" background="base">
      <s-stack direction="block" gap="base">
        <s-select
          label="Select collection"
          value={selectedCollectionId}
          disabled={readOnly}
          error={fieldErrors?.collectionId}
          onInput={
            readOnly
              ? undefined
              : (e) => {
                  clearFieldError?.("collectionId");
                  setSelectedCollectionId(e.target.value);
                }
          }
        >
          {collections.length === 0 ? (
            <s-option value="">No collections found</s-option>
          ) : (
            collections.map((collection) => (
              <s-option key={collection.id} value={collection.id}>
                {collection.title}
              </s-option>
            ))
          )}
        </s-select>

        {!readOnly && (
          <>
            {fieldErrors?.productSearch && (
              <s-banner tone="critical">{fieldErrors.productSearch}</s-banner>
            )}

            <s-stack direction="inline" justifyContent="end">
              <s-button
                variant="primary"
                onClick={handleSearch}
                loading={isSearching}
              >
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
