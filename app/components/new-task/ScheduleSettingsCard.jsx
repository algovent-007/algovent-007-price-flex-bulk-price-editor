import { useEffect, useId, useRef, useState } from "react";
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
  const rawModalId = useId();
  const modalId = `schedule-date-picker-${rawModalId.replace(/:/g, "")}`;
  const modalRef = useRef(null);
  const [draftDateIso, setDraftDateIso] = useState(formatDateIso(selectedDate));

  useEffect(() => {
    setDraftDateIso(formatDateIso(selectedDate));
  }, [selectedDate]);

  const openDatePicker = () => {
    setDraftDateIso(formatDateIso(selectedDate));
    modalRef.current?.showOverlay?.();
  };

  const applyDate = () => {
    const parsed = parseIsoDate(draftDateIso);
    if (parsed) onSelectDate(parsed);
    modalRef.current?.hideOverlay?.();
  };

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
        <s-box>
          <s-button variant="secondary" onClick={openDatePicker}>
            Choose date
          </s-button>
        </s-box>
      )}

      {!readOnly && (
        <s-modal
          id={modalId}
          ref={modalRef}
          heading="Choose date"
          onHide={() => setDraftDateIso(formatDateIso(selectedDate))}
        >
          <s-date-picker
            type="single"
            value={draftDateIso}
            onChange={(e) => setDraftDateIso(e.target?.value || draftDateIso)}
          />

          <s-button slot="secondary-actions" commandFor={modalId} command="--hide">
            Cancel
          </s-button>
          <s-button slot="primary-action" variant="primary" onClick={applyDate}>
            Apply
          </s-button>
        </s-modal>
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
    <s-box padding="base" borderWidth="base" borderRadius="base" background="base">
      <s-stack direction="block" gap="loose">
        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(280px, 1fr))" gap="large">
          <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
            <s-stack direction="block" gap="base">
              <s-heading>Price change timing</s-heading>
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
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
            <s-stack direction="block" gap="base">
              <s-heading>Automatic revert</s-heading>
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
          </s-box>
        </s-grid>

        <s-box paddingBlockStart="base">
          <s-banner tone="info">
            Dates and times shown above use {timezoneStr} as the timezone, where the current time is{" "}
            {currentTimeStr}.
          </s-banner>
        </s-box>
      </s-stack>
    </s-box>
  );
}
