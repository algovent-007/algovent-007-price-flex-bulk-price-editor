const NAVIGATION_KEYS = new Set([
  "Backspace",
  "Delete",
  "Tab",
  "Escape",
  "Enter",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
]);

export function getNumericFieldValue(event) {
  return event.currentTarget?.value ?? event.target?.value ?? "";
}

export function sanitizeNumericInput(value) {
  if (value === "" || value == null) return "";

  const cleaned = String(value).replace(/[^\d.]/g, "");
  const [whole = "", ...fractionParts] = cleaned.split(".");

  if (fractionParts.length === 0) {
    return whole;
  }

  return `${whole}.${fractionParts.join("")}`;
}

export function isAllowedNumericKeyDown(event) {
  const { key, ctrlKey, metaKey, altKey } = event;

  if (ctrlKey || metaKey || altKey) {
    return true;
  }

  if (NAVIGATION_KEYS.has(key)) {
    return true;
  }

  if (/^\d$/.test(key)) {
    return true;
  }

  if (key === "." || key === ",") {
    return !getNumericFieldValue(event).includes(".");
  }

  return false;
}

export function createNumericInputHandlers(setter, readOnly = false) {
  if (readOnly) {
    return { onInput: undefined, onKeyDown: undefined };
  }

  return {
    onInput: (event) => {
      const next = sanitizeNumericInput(getNumericFieldValue(event));
      setter(next);

      const element = event.currentTarget ?? event.target;
      if (element && element.value !== next) {
        element.value = next;
      }
    },
    onKeyDown: (event) => {
      if (!isAllowedNumericKeyDown(event)) {
        event.preventDefault();
      }
    },
  };
}
