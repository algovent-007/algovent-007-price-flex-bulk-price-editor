import { formatDateIso, formatDateMDY, parseIsoDate } from "../../utils/schedule";

function ScheduleDateTimeFields({
  readOnly = false,
  dateStr,
  timeStr,
  onDateChange,
  onTimeChange,
  selectedDate,
  onSelectDate,
}) {
  return (
    <s-stack direction="block" gap="base">
      <s-grid gridTemplateColumns="1fr 1fr" gap="base" alignItems="end">
        <s-text-field
          label="Date"
          value={dateStr}
          disabled={readOnly}
          onInput={readOnly ? undefined : (e) => onDateChange(e.target.value)}
          details="M/D/YYYY"
        />
        <s-text-field
          label="Time"
          value={timeStr}
          disabled={readOnly}
          onInput={readOnly ? undefined : (e) => onTimeChange(e.target.value)}
          details="Example: 4:30 PM"
        />
      </s-grid>
      {!readOnly && (
        <s-date-picker
          type="single"
          value={formatDateIso(selectedDate)}
          onChange={(e) => {
            const parsed = parseIsoDate(e.target?.value);
            if (parsed) onSelectDate(parsed);
          }}
        />
      )}
    </s-stack>
  );
}

export default function ScheduleSettingsCard({
  readOnly = false,
  scheduleType,
  setScheduleType,
  revertLater,
  setRevertLater,
  startDateStr,
  startTimeStr,
  setStartTimeStr,
  handleStartDateChange,
  startDate,
  onStartDateSelect,
  revertDateStr,
  revertTimeStr,
  setRevertTimeStr,
  handleRevertDateChange,
  revertDate,
  onRevertDateSelect,
  timezoneStr,
  currentTimeStr,
}) {
  return (
    <s-stack direction="block" gap="loose">
      <s-grid gridTemplateColumns="1fr 1fr" gap="large">
        <s-stack direction="block" gap="base">
          <s-choice-list
            name="change_prices_schedule"
            label="When to change prices"
            labelAccessibilityVisibility="exclusive"
            value={scheduleType}
            disabled={readOnly}
            onInput={
              readOnly
                ? undefined
                : (e) => {
                    const next = e.currentTarget?.values?.[0] ?? e.target?.value;
                    if (next) setScheduleType(next);
                  }
            }
          >
            <s-choice value="now">Change prices now</s-choice>
            <s-choice value="later">Change prices later</s-choice>
          </s-choice-list>

          {scheduleType === "later" && (
            <ScheduleDateTimeFields
              readOnly={readOnly}
              dateStr={startDateStr}
              timeStr={startTimeStr}
              onDateChange={handleStartDateChange}
              onTimeChange={setStartTimeStr}
              selectedDate={startDate}
              onSelectDate={onStartDateSelect}
            />
          )}
        </s-stack>

        <s-stack direction="block" gap="base">
          <s-checkbox
            label="Revert to original prices later?"
            checked={revertLater}
            disabled={readOnly}
            onChange={
              readOnly ? undefined : (e) => setRevertLater(e.currentTarget.checked)
            }
          />

          {revertLater && (
            <ScheduleDateTimeFields
              readOnly={readOnly}
              dateStr={revertDateStr}
              timeStr={revertTimeStr}
              onDateChange={handleRevertDateChange}
              onTimeChange={setRevertTimeStr}
              selectedDate={revertDate}
              onSelectDate={onRevertDateSelect}
            />
          )}
        </s-stack>
      </s-grid>

      <s-text color="subdued">
        Dates and times shown above use {timezoneStr} as the timezone, where the current time is{" "}
        {currentTimeStr}
      </s-text>
    </s-stack>
  );
}
