import { useI18n } from "../../i18n/I18nProvider";
import { translateError } from "../../i18n/errors";

export default function CollectionCard({
  readOnly = false,
  collections,
  selectedCollectionId,
  setSelectedCollectionId,
  handleSearch,
  isSearching,
  fieldErrors = {},
  clearFieldError,
}) {
  const { t } = useI18n();
  return (
    <s-box padding="base" borderWidth="base" borderRadius="base" background="base">
      <s-stack direction="block" gap="base">
        <s-select
          label={t("conditions.selectCollectionLabel")}
          value={selectedCollectionId}
          disabled={readOnly}
          error={translateError(t, fieldErrors?.collectionId)}
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
            <s-option value="">{t("conditions.noCollections")}</s-option>
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
              <s-banner tone="critical">{translateError(t, fieldErrors.productSearch)}</s-banner>
            )}

            <s-stack direction="inline" justifyContent="end">
              <s-button variant="primary" onClick={handleSearch} loading={isSearching}>
                {t("newTask.searchForProducts")}
              </s-button>
            </s-stack>
          </>
        )}
      </s-stack>
    </s-box>
  );
}
