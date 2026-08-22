export const COPY_TASK_STORAGE_KEY = "price_flex_copy_task";

export function canCopyTask(actionData) {
  return (
    actionData.taskType !== "rollback" &&
    actionData.taskType !== "scheduled_rollback" &&
    !!actionData.runPayload
  );
}

export function canEditScheduledTask(actionData) {
  return actionData.taskType !== "scheduled_rollback" && !!actionData.runPayload;
}

function getScheduleDraft(task, actionData) {
  return {
    scheduleType: "later",
    scheduleRecurrenceType: actionData.scheduleRecurrenceType || "one_time",
    scheduleRecurrenceDayOfWeek: actionData.scheduleRecurrenceDayOfWeek || "1",
    scheduleRecurrenceDayOfMonth: actionData.scheduleRecurrenceDayOfMonth || "1",
    revertRecurrenceType: actionData.revertRecurrenceType || "one_time",
    revertRecurrenceDayOfWeek: actionData.revertRecurrenceDayOfWeek || "1",
    revertRecurrenceDayOfMonth: actionData.revertRecurrenceDayOfMonth || "1",
    startDateStr: actionData.changePricesAtDate || "",
    startTimeStr: actionData.changePricesAtTime || "",
    revertDateStr: actionData.revertPricesAtDate || "",
    revertTimeStr: actionData.revertPricesAtTime || "",
    scheduledAt: task.scheduledAt || null,
    revertAt: task.revertAt || null,
  };
}

export function storeTaskCopy({ task, actionData, taskName, includeSchedule = false }) {
  sessionStorage.setItem(
    COPY_TASK_STORAGE_KEY,
    JSON.stringify({
      mode: "copy",
      runPayload: actionData.runPayload,
      taskName: taskName || `Copy of ${task.name}`,
      revertEnabled: !!actionData.revertEnabled,
      ...(includeSchedule ? getScheduleDraft(task, actionData) : {}),
    }),
  );
}

export function storeTaskEdit({ task, actionData }) {
  sessionStorage.setItem(
    COPY_TASK_STORAGE_KEY,
    JSON.stringify({
      mode: "edit",
      editingTaskId: task.id,
      runPayload: actionData.runPayload,
      taskName: task.name,
      revertEnabled: !!actionData.revertEnabled,
      ...getScheduleDraft(task, actionData),
    }),
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
    setCsvFileName,
    setCsvRows,
    setChangePrice,
    setPercentType,
    setPercentValue,
    setFixedType,
    setFixedValue,
    setFixedPriceAmount,
    setRoundCents,
    setRoundCentsDigit,
    setPriceFormula,
    setComparePriceType,
    setComparePercentType,
    setComparePercentValue,
    setCompareFixedType,
    setCompareFixedValue,
    setCompareFixedPriceAmount,
    setCompareRoundCents,
    setCompareRoundCentsDigit,
    setComparePriceFormula,
    setCostPriceType,
    setCostPercentType,
    setCostPercentValue,
    setCostFixedType,
    setCostFixedValue,
    setCostFixedPriceAmount,
    setCostRoundCents,
    setCostRoundCentsDigit,
    setTagsToAdd,
    setTagsToRemove,
    setAddTagsActive,
    setRemoveTagsActive,
    setTaskName,
    setRevertLater,
    setRevertRecurrenceType,
    setRevertRecurrenceDayOfWeek,
    setRevertRecurrenceDayOfMonth,
    setScheduleType,
    setScheduleRecurrenceType,
    setScheduleRecurrenceDayOfWeek,
    setScheduleRecurrenceDayOfMonth,
    setStartDate,
    setStartDateStr,
    setStartTimeStr,
    setRevertDate,
    setRevertDateStr,
    setRevertTimeStr,
    setEditingTaskId,
  } = setters;

  if (payload.editType) setEditType(payload.editType);
  if (payload.csvFileName) setCsvFileName(payload.csvFileName);
  if (Array.isArray(payload.csvRows)) setCsvRows(payload.csvRows);
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
  if (payload.roundCentsDigit != null) setRoundCentsDigit(String(payload.roundCentsDigit));
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
  if (payload.compareRoundCentsDigit != null) {
    setCompareRoundCentsDigit(String(payload.compareRoundCentsDigit));
  }
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
  if (payload.costRoundCentsDigit != null) setCostRoundCentsDigit(String(payload.costRoundCentsDigit));

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
  if (copyData.revertRecurrenceType) {
    setRevertRecurrenceType?.(copyData.revertRecurrenceType);
  }
  if (copyData.revertRecurrenceDayOfWeek) {
    setRevertRecurrenceDayOfWeek?.(copyData.revertRecurrenceDayOfWeek);
  }
  if (copyData.revertRecurrenceDayOfMonth) {
    setRevertRecurrenceDayOfMonth?.(copyData.revertRecurrenceDayOfMonth);
  }
  if (copyData.scheduleType) setScheduleType?.(copyData.scheduleType);
  if (copyData.scheduleRecurrenceType) {
    setScheduleRecurrenceType?.(copyData.scheduleRecurrenceType);
  }
  if (copyData.scheduleRecurrenceDayOfWeek) {
    setScheduleRecurrenceDayOfWeek?.(copyData.scheduleRecurrenceDayOfWeek);
  }
  if (copyData.scheduleRecurrenceDayOfMonth) {
    setScheduleRecurrenceDayOfMonth?.(copyData.scheduleRecurrenceDayOfMonth);
  }
  if (copyData.startDateStr) setStartDateStr?.(copyData.startDateStr);
  if (copyData.startTimeStr) setStartTimeStr?.(copyData.startTimeStr);
  if (copyData.revertDateStr) setRevertDateStr?.(copyData.revertDateStr);
  if (copyData.revertTimeStr) setRevertTimeStr?.(copyData.revertTimeStr);
  if (copyData.scheduledAt) {
    const scheduledAt = new Date(copyData.scheduledAt);
    if (!Number.isNaN(scheduledAt.getTime())) setStartDate?.(scheduledAt);
  }
  if (copyData.revertAt) {
    const revertAt = new Date(copyData.revertAt);
    if (!Number.isNaN(revertAt.getTime())) setRevertDate?.(revertAt);
  }
  if (copyData.mode === "edit" && copyData.editingTaskId) {
    setEditingTaskId?.(copyData.editingTaskId);
  }

  return true;
}
