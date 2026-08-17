import { formatDateMDY } from "./schedule.js";

const TASK_SEQUENCE_NAME = /^Task\s+(\d+)\s+-/i;

export function nextTaskSequenceNumber(taskNames = []) {
  let max = 0;
  for (const name of taskNames) {
    const match = String(name || "").match(TASK_SEQUENCE_NAME);
    if (!match) continue;
    const value = Number.parseInt(match[1], 10);
    if (Number.isFinite(value) && value > max) max = value;
  }
  return max + 1;
}

export function createDefaultTaskName({ number, date = new Date(), timeZone } = {}) {
  const sequence = Number.isFinite(number) && number > 0 ? number : 1;
  const dateLabel = formatDateMDY(date, timeZone) || formatDateMDY(new Date(), timeZone);
  return `Task ${sequence} - ${dateLabel}`;
}
