export function normalizeTagList(value) {
  if (value == null) return [];

  const list = Array.isArray(value) ? value : [value];
  const seen = new Set();
  const tags = [];

  for (const item of list) {
    const tag = String(item ?? "").trim();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }

  return tags;
}

export function getTaskTagChanges(actionData) {
  return {
    added: normalizeTagList(actionData?.tagsToAdd ?? actionData?.runPayload?.tagsToAddList),
    removed: normalizeTagList(actionData?.tagsToRemove ?? actionData?.runPayload?.tagsToRemoveList),
  };
}

function hasOwnTagFields(log) {
  return Boolean(
    log &&
      (Object.prototype.hasOwnProperty.call(log, "tagsAdded") ||
        Object.prototype.hasOwnProperty.call(log, "tagsRemoved") ||
        Object.prototype.hasOwnProperty.call(log, "tagsToAdd") ||
        Object.prototype.hasOwnProperty.call(log, "tagsToRemove"))
  );
}

export function getLogTagChanges(log, taskTagChanges = {}) {
  if (hasOwnTagFields(log)) {
    return {
      added: normalizeTagList(log.tagsAdded ?? log.tagsToAdd),
      removed: normalizeTagList(log.tagsRemoved ?? log.tagsToRemove),
    };
  }

  return {
    added: normalizeTagList(taskTagChanges.added ?? taskTagChanges.tagsToAdd),
    removed: normalizeTagList(taskTagChanges.removed ?? taskTagChanges.tagsToRemove),
  };
}

export function formatTagChangeLines({ added = [], removed = [] } = {}) {
  const addedTags = normalizeTagList(added);
  const removedTags = normalizeTagList(removed);
  const lines = [];

  if (addedTags.length > 0) {
    lines.push(`Added: ${addedTags.join(", ")}`);
  }
  if (removedTags.length > 0) {
    lines.push(`Removed: ${removedTags.join(", ")}`);
  }

  return lines;
}

export function attachProductTagChanges(logs, productId, added, removed) {
  if (!Array.isArray(logs) || !productId) return logs;

  const tagsAdded = normalizeTagList(added);
  const tagsRemoved = normalizeTagList(removed);

  for (const log of logs) {
    if (log?.productId === productId) {
      log.tagsAdded = tagsAdded;
      log.tagsRemoved = tagsRemoved;
    }
  }

  return logs;
}

function normalizePriceText(value) {
  if (value == null) return "-";
  const text = String(value).trim();
  return text === "" ? "-" : text;
}

function arePriceValuesEqual(oldText, newText) {
  if (oldText === newText) return true;

  const oldNum = Number.parseFloat(oldText);
  const newNum = Number.parseFloat(newText);
  return Number.isFinite(oldNum) && Number.isFinite(newNum) && oldNum === newNum;
}

export function getPriceChangeDisplay(oldValue, newValue) {
  const oldText = normalizePriceText(oldValue);
  const newText = normalizePriceText(newValue);

  if (oldText === "-" && newText === "-") {
    return { type: "blank", value: "-" };
  }

  if (arePriceValuesEqual(oldText, newText)) {
    return { type: "unchanged", value: newText };
  }

  return { type: "changed", oldValue: oldText, newValue: newText };
}
