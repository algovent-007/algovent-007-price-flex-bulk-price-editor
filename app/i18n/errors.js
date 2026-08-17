/** Map known English/server error strings onto translation keys. */
export const ERROR_MESSAGE_KEYS = {
  "Unknown action.": "errors.unknownAction",
  "Unknown intent": "scheduled.errors.unknownIntent",
  "Task ID is required": "scheduled.errors.taskIdRequired",
  "Task not found": "scheduled.errors.taskNotFound",
  "Task was not found for this shop.": "scheduled.errors.taskNotFound",
  "Only scheduled tasks can be cancelled": "scheduled.errors.onlyScheduled",
  "Only scheduled tasks can be edited": "scheduled.errors.onlyScheduledEdit",
  "Scheduled rollback tasks cannot be edited": "scheduled.errors.cannotEditRollback",
  "Only completed tasks can be rolled back": "history.errors.onlyCompleted",
  "Invalid task data": "history.errors.invalidTaskData",
  "This task has already been rolled back": "history.errors.alreadyRolledBack",
  "No changes to roll back": "history.errors.noChanges",
  "This task cannot be rolled back because it was created before rollback support was added.":
    "history.errors.beforeSupport",
  "Name, email, and timezone are required.": "account.errors.required",
  "Please upload a CSV file before running the task.": "errors.csvBeforeRun",
  "Please load products from your CSV before running the task.": "errors.loadCsvProducts",
  "Enter a value for this condition.": "errors.conditionValue",
  "Please search for products before running the task.": "errors.searchBeforeRun",
  "Please select a collection before running the task.": "errors.selectCollection",
  "Please save your pricing rules before running the task.": "errors.savePricingRules",
  "Enter a task name.": "errors.taskName",
  "Enter a fixed price amount.": "errors.fixedPriceAmount",
  "Enter a price formula.": "errors.priceFormula",
  "Enter a fixed compare-at price amount.": "errors.compareFixedAmount",
  "Enter a compare-at price formula.": "errors.compareFormula",
  "Enter a fixed cost amount.": "errors.costFixedAmount",
  "Enter a start date.": "errors.startDate",
  "Enter a valid start date.": "errors.validStartDate",
  "Enter a start time.": "errors.startTime",
  "Enter a valid start time.": "errors.validStartTime",
  "Enter a valid start date and time.": "errors.validStartDateTime",
  "Enter a revert date.": "errors.revertDate",
  "Enter a valid revert date.": "errors.validRevertDate",
  "Enter a revert time.": "errors.revertTime",
  "Enter a valid revert time.": "errors.validRevertTime",
  "Enter a valid revert date and time.": "errors.validRevertDateTime",
  "Pick a valid day.": "errors.pickDay",
  "Pick a date.": "errors.pickDate",
  "Pick a valid date.": "errors.pickValidDate",
  "Please upload a CSV file.": "errors.uploadCsv",
  "No products found matching your criteria.": "newTask.noProductsFound",
  "Please complete all product condition fields before searching.": "newTask.completeConditions",
  "Please select a collection before searching.": "newTask.selectCollectionBeforeSearch",
  "Please upload a CSV file before loading products.": "newTask.uploadCsvBeforeLoad",
  "Invalid CSV data submitted.": "newTask.invalidCsv",
  "Failed to schedule task": "newTask.failedSchedule",
  "Please select a collection": "newTask.pleaseSelectCollection",
  "Please enter your shop domain to log in": "auth.missingShop",
  "Please enter a valid shop domain to log in": "auth.invalidShop",
};

export function translateError(t, message) {
  if (!message) return "";
  const key = ERROR_MESSAGE_KEYS[message];
  if (key) return t(key);
  if (typeof message === "string" && message.includes(".") && !message.includes(" ")) {
    const translated = t(message);
    return translated || message;
  }
  return message;
}
