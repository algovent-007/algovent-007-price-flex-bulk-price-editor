import { useI18n } from "../../i18n/I18nProvider";

export default function AdvancedSettingsCard({
  readOnly = false,
  addTagsActive,
  setAddTagsActive,
  removeTagsActive,
  setRemoveTagsActive,
  tagToAddInput,
  setTagToAddInput,
  handleTagToAddKeyDown,
  addTagToAddFromInput,
  tagsToAdd,
  removeTagToAdd,
  tagToRemoveInput,
  setTagToRemoveInput,
  handleTagToRemoveKeyDown,
  addTagToRemoveFromInput,
  tagsToRemove,
  removeTagToRemove,
}) {
  const { t } = useI18n();

  return (
    <s-box paddingBlockEnd="large">
      <s-box padding="base" borderWidth="base" borderRadius="base" background="base">
        <s-stack direction="block" gap="large">
          <s-grid gridTemplateColumns="1fr 1fr" gap="large">
            <s-stack direction="block" gap="base">
              <s-checkbox
                label={t("tags.addWhileActive")}
                checked={addTagsActive}
                disabled={readOnly}
                onChange={
                  readOnly ? undefined : (e) => setAddTagsActive(e.currentTarget.checked)
                }
              />

              {addTagsActive && (
                <s-stack direction="block" gap="base">
                  {!readOnly && (
                    <s-grid gridTemplateColumns="1fr auto" gap="small" alignItems="end">
                      <s-text-field
                        placeholder={t("tags.typeToAdd")}
                        value={tagToAddInput}
                        onInput={(e) => setTagToAddInput(e.target.value)}
                        onKeyDown={handleTagToAddKeyDown}
                        label={t("tags.typeToAdd")}
                        labelAccessibilityVisibility="exclusive"
                      />
                      <s-button onClick={addTagToAddFromInput}>{t("common.add")}</s-button>
                    </s-grid>
                  )}

                  {tagsToAdd.length > 0 && (
                    <s-stack direction="inline" gap="small">
                      {tagsToAdd.map((tag) =>
                        readOnly ? (
                          <s-chip key={tag}>{tag}</s-chip>
                        ) : (
                          <s-clickable-chip
                            key={tag}
                            removable
                            accessibilityLabel={t("tags.removeTag", { tag })}
                            onRemove={() => removeTagToAdd(tag)}
                          >
                            {tag}
                          </s-clickable-chip>
                        )
                      )}
                    </s-stack>
                  )}

                  {!readOnly && (
                    <s-button
                      variant="plain"
                      onClick={() => {
                        alert(t("tags.taggingHelp"));
                      }}
                    >
                      {t("tags.howTaggingWorks")}
                    </s-button>
                  )}
                </s-stack>
              )}
            </s-stack>

            <s-stack direction="block" gap="base">
              <s-checkbox
                label={t("tags.removeWhileActive")}
                checked={removeTagsActive}
                disabled={readOnly}
                onChange={
                  readOnly ? undefined : (e) => setRemoveTagsActive(e.currentTarget.checked)
                }
              />

              {removeTagsActive && (
                <s-stack direction="block" gap="base">
                  {!readOnly && (
                    <s-grid gridTemplateColumns="1fr auto" gap="small" alignItems="end">
                      <s-text-field
                        placeholder={t("tags.typeToRemove")}
                        value={tagToRemoveInput}
                        onInput={(e) => setTagToRemoveInput(e.target.value)}
                        onKeyDown={handleTagToRemoveKeyDown}
                        label={t("tags.typeToRemove")}
                        labelAccessibilityVisibility="exclusive"
                      />
                      <s-button onClick={addTagToRemoveFromInput}>{t("common.add")}</s-button>
                    </s-grid>
                  )}

                  {tagsToRemove.length > 0 && (
                    <s-stack direction="inline" gap="small">
                      {tagsToRemove.map((tag) =>
                        readOnly ? (
                          <s-chip key={tag}>{tag}</s-chip>
                        ) : (
                          <s-clickable-chip
                            key={tag}
                            removable
                            accessibilityLabel={t("tags.removeTag", { tag })}
                            onRemove={() => removeTagToRemove(tag)}
                          >
                            {tag}
                          </s-clickable-chip>
                        )
                      )}
                    </s-stack>
                  )}
                </s-stack>
              )}
            </s-stack>
          </s-grid>
        </s-stack>
      </s-box>
    </s-box>
  );
}
