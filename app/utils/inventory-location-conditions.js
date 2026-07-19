function parseNumber(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function extractLocationNumericId(value) {
  const trimmed = String(value ?? "").trim();
  if (/^\d+$/.test(trimmed)) return trimmed;

  const gidMatch = trimmed.match(/Location\/(\d+)/i);
  return gidMatch ? gidMatch[1] : null;
}

export function parseInventoryLocationConditionValue(value) {
  const trimmed = String(value ?? "").trim();
  const pipeIndex = trimmed.lastIndexOf("|");

  if (pipeIndex > 0) {
    return {
      quantity: trimmed.slice(0, pipeIndex).trim(),
      locationId: trimmed.slice(pipeIndex + 1).trim(),
    };
  }

  const legacyMatch = trimmed.match(/^([^:]+):\s*(.+)$/);
  if (legacyMatch) {
    return {
      quantity: legacyMatch[2].trim(),
      locationId: legacyMatch[1].trim(),
    };
  }

  return { quantity: trimmed, locationId: "" };
}

export function formatInventoryLocationConditionValue(quantity, locationId) {
  const parsedQuantity = parseNumber(quantity);
  const trimmedLocationId = String(locationId ?? "").trim();
  if (parsedQuantity == null || !trimmedLocationId) return "";
  return `${parsedQuantity}|${trimmedLocationId}`;
}

export function isValidInventoryLocationConditionValue(value) {
  const { quantity, locationId } = parseInventoryLocationConditionValue(value);
  return parseNumber(quantity) != null && Boolean(String(locationId ?? "").trim());
}

export function getInventoryLocationConditionSummary(value, locations = []) {
  const { quantity, locationId } = parseInventoryLocationConditionValue(value);
  const parsedQuantity = parseNumber(quantity);
  if (parsedQuantity == null || !locationId) return "";

  const location =
    locations.find((entry) => entry.id === locationId) ||
    locations.find(
      (entry) => extractLocationNumericId(entry.id) === extractLocationNumericId(locationId)
    );

  const locationLabel = location?.name || locationId;
  return `${parsedQuantity} at ${locationLabel}`;
}

export function locationMatchesSelection(level, locationId) {
  const trimmedLocationId = String(locationId ?? "").trim();
  if (!trimmedLocationId) return false;

  const numericId = extractLocationNumericId(trimmedLocationId);
  if (numericId && level.locationId === numericId) return true;

  return (
    String(level.locationId ?? "") === trimmedLocationId ||
    String(level.locationName ?? "").trim() === trimmedLocationId
  );
}
