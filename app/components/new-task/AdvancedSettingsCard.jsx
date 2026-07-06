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
  const taggingHelpMessage =
    "When a price change task runs, tags in the 'Add tags' section are added to all updated products, and tags in the 'Remove tags' section are removed. On rollback, the added tags are removed, and the removed tags are restored.";

  return (
    <s-box paddingBlockEnd="large">
      <s-box padding="base" borderWidth="base" borderRadius="base" background="base">
        <s-stack direction="block" gap="large">
          <s-grid gridTemplateColumns="1fr 1fr" gap="large">
            <s-stack direction="block" gap="base">
              <s-checkbox
                label="Add tags while price change job is active"
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
                        placeholder="Type in tag to add"
                        value={tagToAddInput}
                        onInput={(e) => setTagToAddInput(e.target.value)}
                        onKeyDown={handleTagToAddKeyDown}
                        label="Type in tag to add"
                        labelAccessibilityVisibility="exclusive"
                      />
                      <s-button onClick={addTagToAddFromInput}>Add</s-button>
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
                            accessibilityLabel={`Remove tag ${tag}`}
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
                        alert(taggingHelpMessage);
                      }}
                    >
                      How does tagging work?
                    </s-button>
                  )}
                </s-stack>
              )}
            </s-stack>

            <s-stack direction="block" gap="base">
              <s-checkbox
                label="Remove tags while price change is active"
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
                        placeholder="Type in tag to remove"
                        value={tagToRemoveInput}
                        onInput={(e) => setTagToRemoveInput(e.target.value)}
                        onKeyDown={handleTagToRemoveKeyDown}
                        label="Type in tag to remove"
                        labelAccessibilityVisibility="exclusive"
                      />
                      <s-button onClick={addTagToRemoveFromInput}>Add</s-button>
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
                            accessibilityLabel={`Remove tag ${tag}`}
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
