import { formatDateMDY, formatTime12Hour } from "./schedule";

export function canViewTaskConfiguration(actionData) {
  return !!actionData?.runPayload;
}

export function getDefaultTaskConfigState(taskName = "") {
  return {
    editType: "all",
    matchType: "all",
    conditions: [{ field: "title", operator: "equals", value: "" }],
    searchResults: null,
    selectedCollectionId: "",
    csvFileName: null,
    changePrice: "1",
    percentType: "1",
    percentValue: "",
    fixedType: "3",
    fixedValue: "",
    roundCents: "1",
    comparePriceType: "6",
    costPriceType: "6",
    fixedPriceAmount: "",
    priceFormula: "price * 1.1",
    comparePriceFormula: "price * 1.2",
    comparePercentType: "1",
    comparePercentValue: "",
    compareFixedType: "3",
    compareFixedValue: "",
    compareFixedPriceAmount: "",
    compareRoundCents: "1",
    costPercentType: "1",
    costPercentValue: "",
    costFixedType: "3",
    costFixedValue: "",
    costFixedPriceAmount: "",
    costRoundCents: "1",
    examplePrice: "22.99",
    exampleCompare: "24.99",
    exampleCost: "12.50",
    calcPrice: "—",
    calcCompare: "—",
    calcCost: "—",
    calcWarnings: [],
    addTagsActive: true,
    removeTagsActive: true,
    tagToAddInput: "",
    tagsToAdd: [],
    tagToRemoveInput: "",
    tagsToRemove: [],
    scheduleType: "now",
    revertLater: false,
    startDate: new Date(),
    startDateStr: "",
    startTimeStr: "",
    revertDate: new Date(),
    revertDateStr: "",
    revertTimeStr: "",
    taskName,
  };
}

export function buildTaskConfigState(task, actionData) {
  const payload = actionData?.runPayload;
  if (!payload) return null;

  const config = getDefaultTaskConfigState(task?.name || "");

  if (payload.editType) config.editType = payload.editType;
  if (payload.matchType) config.matchType = payload.matchType;
  if (payload.conditionsStr) {
    try {
      config.conditions = JSON.parse(payload.conditionsStr);
    } catch {
      // Keep default conditions if stored value is invalid.
    }
  }
  if (payload.collectionId) config.selectedCollectionId = payload.collectionId;

  if (payload.changePrice) config.changePrice = String(payload.changePrice);
  if (payload.percentType) config.percentType = String(payload.percentType);
  if (payload.percentValue != null) config.percentValue = String(payload.percentValue);
  if (payload.fixedType) config.fixedType = String(payload.fixedType);
  if (payload.fixedValue != null) config.fixedValue = String(payload.fixedValue);
  if (payload.fixedPriceAmount != null) {
    config.fixedPriceAmount = String(payload.fixedPriceAmount);
  }
  if (payload.roundCents) config.roundCents = String(payload.roundCents);
  if (payload.priceFormula) config.priceFormula = payload.priceFormula;

  if (payload.comparePriceType) config.comparePriceType = String(payload.comparePriceType);
  if (payload.comparePercentType) config.comparePercentType = String(payload.comparePercentType);
  if (payload.comparePercentValue != null) {
    config.comparePercentValue = String(payload.comparePercentValue);
  }
  if (payload.compareFixedType) config.compareFixedType = String(payload.compareFixedType);
  if (payload.compareFixedValue != null) {
    config.compareFixedValue = String(payload.compareFixedValue);
  }
  if (payload.compareFixedPriceAmount != null) {
    config.compareFixedPriceAmount = String(payload.compareFixedPriceAmount);
  }
  if (payload.compareRoundCents) config.compareRoundCents = String(payload.compareRoundCents);
  if (payload.comparePriceFormula) config.comparePriceFormula = payload.comparePriceFormula;

  if (payload.costPriceType) config.costPriceType = String(payload.costPriceType);
  if (payload.costPercentType) config.costPercentType = String(payload.costPercentType);
  if (payload.costPercentValue != null) {
    config.costPercentValue = String(payload.costPercentValue);
  }
  if (payload.costFixedType) config.costFixedType = String(payload.costFixedType);
  if (payload.costFixedValue != null) config.costFixedValue = String(payload.costFixedValue);
  if (payload.costFixedPriceAmount != null) {
    config.costFixedPriceAmount = String(payload.costFixedPriceAmount);
  }
  if (payload.costRoundCents) config.costRoundCents = String(payload.costRoundCents);

  const tagsToAdd = Array.isArray(payload.tagsToAddList) ? payload.tagsToAddList : [];
  const tagsToRemove = Array.isArray(payload.tagsToRemoveList) ? payload.tagsToRemoveList : [];
  config.tagsToAdd = tagsToAdd;
  config.tagsToRemove = tagsToRemove;
  config.addTagsActive =
    typeof payload.addTagsActive === "boolean" ? payload.addTagsActive : tagsToAdd.length > 0;
  config.removeTagsActive =
    typeof payload.removeTagsActive === "boolean"
      ? payload.removeTagsActive
      : tagsToRemove.length > 0;

  config.taskName = task?.name || config.taskName;
  config.revertLater = !!actionData.revertEnabled || !!task?.revertAt;

  const isScheduled =
    actionData.taskType === "scheduled_edit" || task?.status === "scheduled";
  config.scheduleType = isScheduled ? "later" : "now";

  if (task?.scheduledAt) {
    const scheduledAt = new Date(task.scheduledAt);
    config.startDate = scheduledAt;
    config.startDateStr = formatDateMDY(scheduledAt);
    config.startTimeStr = formatTime12Hour(scheduledAt);
  }

  if (task?.revertAt) {
    const revertAt = new Date(task.revertAt);
    config.revertDate = revertAt;
    config.revertDateStr = formatDateMDY(revertAt);
    config.revertTimeStr = formatTime12Hour(revertAt);
  }

  return config;
}
