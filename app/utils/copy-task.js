export const COPY_TASK_STORAGE_KEY = "price_flex_copy_task";

export function canCopyTask(actionData) {
  return (
    actionData.taskType !== "rollback" &&
    actionData.taskType !== "scheduled_rollback" &&
    !!actionData.runPayload
  );
}

export function storeTaskCopy({ task, actionData }) {
  sessionStorage.setItem(
    COPY_TASK_STORAGE_KEY,
    JSON.stringify({
      runPayload: actionData.runPayload,
      taskName: `Copy of ${task.name}`,
      revertEnabled: !!actionData.revertEnabled,
    })
  );
}

export function readStoredTaskCopy() {
  const raw = sessionStorage.getItem(COPY_TASK_STORAGE_KEY);
  if (!raw) return null;

  sessionStorage.removeItem(COPY_TASK_STORAGE_KEY);

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function applyStoredTaskCopy(copyData, setters) {
  const payload = copyData?.runPayload;
  if (!payload) return false;

  const {
    setEditType,
    setMatchType,
    setConditions,
    setSelectedCollectionId,
    setChangePrice,
    setPercentType,
    setPercentValue,
    setFixedType,
    setFixedValue,
    setFixedPriceAmount,
    setRoundCents,
    setPriceFormula,
    setComparePriceType,
    setComparePercentType,
    setComparePercentValue,
    setCompareFixedType,
    setCompareFixedValue,
    setCompareFixedPriceAmount,
    setCompareRoundCents,
    setComparePriceFormula,
    setCostPriceType,
    setCostPercentType,
    setCostPercentValue,
    setCostFixedType,
    setCostFixedValue,
    setCostFixedPriceAmount,
    setCostRoundCents,
    setTagsToAdd,
    setTagsToRemove,
    setAddTagsActive,
    setRemoveTagsActive,
    setTaskName,
    setRevertLater,
  } = setters;

  if (payload.editType) setEditType(payload.editType);
  if (payload.matchType) setMatchType(payload.matchType);
  if (payload.conditionsStr) {
    try {
      setConditions(JSON.parse(payload.conditionsStr));
    } catch {
      // Keep default conditions if stored value is invalid.
    }
  }
  if (payload.collectionId) setSelectedCollectionId(payload.collectionId);

  if (payload.changePrice) setChangePrice(String(payload.changePrice));
  if (payload.percentType) setPercentType(String(payload.percentType));
  if (payload.percentValue != null) setPercentValue(String(payload.percentValue));
  if (payload.fixedType) setFixedType(String(payload.fixedType));
  if (payload.fixedValue != null) setFixedValue(String(payload.fixedValue));
  if (payload.fixedPriceAmount != null) setFixedPriceAmount(String(payload.fixedPriceAmount));
  if (payload.roundCents) setRoundCents(String(payload.roundCents));
  if (payload.priceFormula) setPriceFormula(payload.priceFormula);

  if (payload.comparePriceType) setComparePriceType(String(payload.comparePriceType));
  if (payload.comparePercentType) setComparePercentType(String(payload.comparePercentType));
  if (payload.comparePercentValue != null) {
    setComparePercentValue(String(payload.comparePercentValue));
  }
  if (payload.compareFixedType) setCompareFixedType(String(payload.compareFixedType));
  if (payload.compareFixedValue != null) setCompareFixedValue(String(payload.compareFixedValue));
  if (payload.compareFixedPriceAmount != null) {
    setCompareFixedPriceAmount(String(payload.compareFixedPriceAmount));
  }
  if (payload.compareRoundCents) setCompareRoundCents(String(payload.compareRoundCents));
  if (payload.comparePriceFormula) setComparePriceFormula(payload.comparePriceFormula);

  if (payload.costPriceType) setCostPriceType(String(payload.costPriceType));
  if (payload.costPercentType) setCostPercentType(String(payload.costPercentType));
  if (payload.costPercentValue != null) setCostPercentValue(String(payload.costPercentValue));
  if (payload.costFixedType) setCostFixedType(String(payload.costFixedType));
  if (payload.costFixedValue != null) setCostFixedValue(String(payload.costFixedValue));
  if (payload.costFixedPriceAmount != null) {
    setCostFixedPriceAmount(String(payload.costFixedPriceAmount));
  }
  if (payload.costRoundCents) setCostRoundCents(String(payload.costRoundCents));

  const tagsToAdd = Array.isArray(payload.tagsToAddList) ? payload.tagsToAddList : [];
  const tagsToRemove = Array.isArray(payload.tagsToRemoveList) ? payload.tagsToRemoveList : [];
  setTagsToAdd(tagsToAdd);
  setTagsToRemove(tagsToRemove);
  setAddTagsActive(
    typeof payload.addTagsActive === "boolean" ? payload.addTagsActive : tagsToAdd.length > 0
  );
  setRemoveTagsActive(
    typeof payload.removeTagsActive === "boolean"
      ? payload.removeTagsActive
      : tagsToRemove.length > 0
  );

  if (copyData.taskName) setTaskName(copyData.taskName);
  if (typeof copyData.revertEnabled === "boolean") setRevertLater(copyData.revertEnabled);

  return true;
}
