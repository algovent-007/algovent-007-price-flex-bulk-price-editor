import { validateScheduleConfig } from "./schedule";
import { validatePricingConfig } from "./pricing";
import {
  buildPricingRulesSnapshot,
  loadSavedPricingRules,
} from "./saved-pricing-rules";
import {
  isMetafieldConditionField,
  isValueAllowedForField,
  metafieldConditionNeedsValue,
} from "../components/new-task/constants";

function snapshotsEqual(saved, current) {
  const keys = new Set([...Object.keys(saved || {}), ...Object.keys(current || {})]);
  for (const key of keys) {
    if (String(saved?.[key] ?? "") !== String(current?.[key] ?? "")) {
      return false;
    }
  }
  return true;
}

export function pricingRulesMatchSaved(shop, values) {
  const saved = loadSavedPricingRules(shop);
  if (!saved) return false;
  return snapshotsEqual(saved, buildPricingRulesSnapshot(values));
}

function isConditionComplete(condition) {
  if (!condition?.field || !condition?.operator) {
    return false;
  }

  if (isMetafieldConditionField(condition.field)) {
    const trimmed = String(condition.value ?? "").trim();
    if (!trimmed) return false;
    if (metafieldConditionNeedsValue(condition.operator)) {
      return isValueAllowedForField(condition.field, condition.value);
    }
    return trimmed.includes(".");
  }

  if (!String(condition.value ?? "").trim()) {
    return false;
  }

  return isValueAllowedForField(condition.field, condition.value);
}

function validateProductSelection(formState, addError) {
  if (formState.editType === "csv-all" || formState.editType === "csv-direct") {
    if (!formState.csvFileName) {
      addError("csvFile", "Please upload a CSV file before running the task.");
    }
    return;
  }

  if (formState.editType === "conditions") {
    formState.conditions.forEach((condition, index) => {
      if (!isConditionComplete(condition)) {
        addError(`condition-${index}-value`, "Enter a value for this condition.");
      }
    });

    if (!formState.productsList.length) {
      addError("productSearch", "Please search for products before running the task.");
    }
  }

  if (formState.editType === "collection") {
    if (!formState.selectedCollectionId) {
      addError("collectionId", "Please select a collection before running the task.");
    }
    if (!formState.productsList.length) {
      addError("productSearch", "Please search for products before running the task.");
    }
  }
}

export function validateRunTaskForm(formState) {
  const fieldErrors = {};
  const messages = [];

  const addError = (field, message) => {
    messages.push(message);
    if (field && !fieldErrors[field]) {
      fieldErrors[field] = message;
    } else if (!field) {
      fieldErrors.general = fieldErrors.general
        ? `${fieldErrors.general} ${message}`
        : message;
    }
  };

  if (!pricingRulesMatchSaved(formState.shop, formState)) {
    addError("pricingRulesSave", "Please save your pricing rules before running the task.");
  }

  const pricingValidation = validatePricingConfig({
    changePrice: formState.changePrice,
    percentType: formState.percentType,
    percentValue: formState.percentValue,
    fixedType: formState.fixedType,
    fixedValue: formState.fixedValue,
    fixedPriceAmount: formState.fixedPriceAmount,
    priceFormula: formState.priceFormula,
    comparePriceType: formState.comparePriceType,
    comparePercentType: formState.comparePercentType,
    comparePercentValue: formState.comparePercentValue,
    compareFixedType: formState.compareFixedType,
    compareFixedValue: formState.compareFixedValue,
    compareFixedPriceAmount: formState.compareFixedPriceAmount,
    comparePriceFormula: formState.comparePriceFormula,
    costPriceType: formState.costPriceType,
    costPercentType: formState.costPercentType,
    costPercentValue: formState.costPercentValue,
    costFixedType: formState.costFixedType,
    costFixedValue: formState.costFixedValue,
    costFixedPriceAmount: formState.costFixedPriceAmount,
  });

  Object.entries(pricingValidation.fieldErrors).forEach(([field, message]) => {
    addError(field, message);
  });

  validateProductSelection(formState, addError);

  if (!String(formState.taskName ?? "").trim()) {
    addError("taskName", "Enter a task name.");
  }

  const scheduleValidation = validateScheduleConfig({
    changePricesSchedule: formState.scheduleType,
    scheduleRecurrenceType: formState.scheduleRecurrenceType,
    scheduleRecurrenceDayOfWeek: formState.scheduleRecurrenceDayOfWeek,
    scheduleRecurrenceDayOfMonth: formState.scheduleRecurrenceDayOfMonth,
    changePricesAtDate: formState.startDateStr,
    changePricesAtTime: formState.startTimeStr,
    revertPrices: formState.revertLater,
    revertPricesAtDate: formState.revertDateStr,
    revertPricesAtTime: formState.revertTimeStr,
  });

  Object.entries(scheduleValidation.fieldErrors).forEach(([field, message]) => {
    addError(field, message);
  });

  return { fieldErrors, messages: [...new Set(messages)] };
}
