export default function CollectionCard({
  readOnly = false,
  collections,
  selectedCollectionId,
  setSelectedCollectionId,
  handleSearch,
  isSearching,
}) {
  return (
    <s-box padding="base" borderWidth="base" borderRadius="base" background="base">
      <s-stack direction="block" gap="base">
        <s-select
          label="Select collection"
          value={selectedCollectionId}
          disabled={readOnly}
          onInput={readOnly ? undefined : (e) => setSelectedCollectionId(e.target.value)}
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
          <s-stack direction="inline" justifyContent="end">
            <s-button
              variant="primary"
              onClick={handleSearch}
              loading={isSearching}
              disabled={!selectedCollectionId}
            >
              Search For Products
            </s-button>
          </s-stack>
        )}

      </s-stack>
    </s-box>
  );
}
