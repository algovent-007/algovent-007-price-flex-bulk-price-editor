import { useEffect, useId, useRef, useState } from "react";
import {
  formatDateIso,
  parseIsoDate,
  SCHEDULE_RECURRENCE_OPTIONS,
  WEEKDAY_OPTIONS,
  MONTH_DAY_OPTIONS,
  isOneTimeScheduleRecurrence,
} from "../../utils/schedule";
import styles from "./ScheduleSettingsCard.module.css";
function ScheduleTimeField({
  readOnly = false,
  timeStr,
  onTimeChange,
  timeError = "",
  onClearTimeError,
}) {
  return (
    <s-text-field
      label="Time"
      value={timeStr}
      disabled={readOnly}
      error={timeError}
      onInput={
        readOnly
          ? undefined
          : (e) => {
              onClearTimeError?.();
              onTimeChange(e.target.value);
            }
      }
      details="Example: 4:30 PM"
    />
  );
}

function ScheduleDateTimeFields({
  readOnly = false,
  dateStr,
  timeStr,
  onDateChange,
  onTimeChange,
  selectedDate,
  onSelectDate,
  dateLabel = "Date",
  dateError = "",
  timeError = "",
  onClearDateError,
  onClearTimeError,
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
      <div className={styles.pickTimeRow}>
        <s-text-field
          label={dateLabel}
          value={dateStr}
          disabled={readOnly}
          error={dateError}
          onInput={
            readOnly
              ? undefined
              : (e) => {
                  onClearDateError?.();
                  onDateChange(e.target.value);
                }
          }
          details="M/D/YYYY"
        />
        <ScheduleTimeField
          readOnly={readOnly}
          timeStr={timeStr}
          onTimeChange={onTimeChange}
          timeError={timeError}
          onClearTimeError={onClearTimeError}
        />
      </div>
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
          heading={dateLabel}
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

function ScheduleScrollableSelect({
  label,
  value,
  options,
  disabled = false,
  error = "",
  onChange,
  onClearError,
}) {
  const listId = useId();
  const containerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const selectedLabel =
    options.find((option) => option.value === value)?.label ?? value ?? "";

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const handleSelect = (nextValue) => {
    onClearError?.();
    onChange?.(nextValue);
    setOpen(false);
  };

  return (
    <div className={styles.scrollableSelect} ref={containerRef}>
      <label className={styles.scrollableSelectLabel} htmlFor={listId}>
        {label}
      </label>
      <button
        id={listId}
        type="button"
        className={`${styles.scrollableSelectTrigger}${error ? ` ${styles.scrollableSelectTriggerError}` : ""}`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (!disabled) setOpen((current) => !current);
        }}
      >
        {selectedLabel}
      </button>
      {open && !disabled && (
        <div className={styles.scrollableSelectList} role="listbox" aria-label={label}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={`${styles.scrollableSelectOption}${
                option.value === value ? ` ${styles.scrollableSelectOptionSelected}` : ""
              }`}
              onClick={() => handleSelect(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
      {error ? <span className={styles.scrollableSelectError}>{error}</span> : null}
    </div>
  );
}

function SchedulePickAndTimeRow({
  readOnly = false,
  pickKey,
  pickLabel,
  pickValue,
  onPickChange,
  pickError = "",
  onClearPickError,
  pickOptions,
  pickOptionsData,
  scrollablePick = false,
  timeStr,
  onTimeChange,
  timeError = "",
  onClearTimeError,
}) {
  return (
    <div className={styles.pickTimeRow}>
      {scrollablePick ? (
        <ScheduleScrollableSelect
          key={pickKey}
          label={pickLabel}
          value={pickValue}
          options={pickOptionsData}
          disabled={readOnly}
          error={pickError}
          onChange={onPickChange}
          onClearError={onClearPickError}
        />
      ) : (
        <s-select
          key={pickKey}
          label={pickLabel}
          value={pickValue}
          disabled={readOnly}
          error={pickError}
          onInput={
            readOnly
              ? undefined
              : (e) => {
                  onClearPickError?.();
                  onPickChange(e.target.value);
                }
          }
        >
          {pickOptions}
        </s-select>
      )}
      <s-text-field
        label="Time"
        value={timeStr}
        disabled={readOnly}
        error={timeError}
        onInput={
          readOnly
            ? undefined
            : (e) => {
                onClearTimeError?.();
                onTimeChange(e.target.value);
              }
        }
        details="Example: 4:30 PM"
      />
    </div>
  );
}

function ScheduleRecurringFields({
  readOnly = false,
  scheduleRecurrenceType,
  startDateStr,
  startTimeStr,
  setStartTimeStr,
  handleStartDateChange,
  startDate,
  onStartDateSelect,
  scheduleRecurrenceDayOfWeek,
  setScheduleRecurrenceDayOfWeek,
  scheduleRecurrenceDayOfMonth,
  setScheduleRecurrenceDayOfMonth,
  fieldErrors = {},
  clearFieldError,
}) {
  if (scheduleRecurrenceType === "daily") {
    return (
      <ScheduleTimeField
        readOnly={readOnly}
        timeStr={startTimeStr}
        onTimeChange={setStartTimeStr}
        timeError={fieldErrors?.startTimeStr}
        onClearTimeError={() => clearFieldError?.("startTimeStr")}
      />
    );
  }

  if (scheduleRecurrenceType === "weekly") {
    return (
      <SchedulePickAndTimeRow
        key="weekly-schedule-pick"
        pickKey="weekly-schedule-pick"
        readOnly={readOnly}
        pickLabel="Pick day"
        pickValue={scheduleRecurrenceDayOfWeek || "1"}
        onPickChange={(value) => setScheduleRecurrenceDayOfWeek?.(value)}
        pickError={fieldErrors?.scheduleRecurrenceDay}
        onClearPickError={() => clearFieldError?.("scheduleRecurrenceDay")}
        pickOptions={WEEKDAY_OPTIONS.map((option) => (
          <s-option key={option.value} value={option.value}>
            {option.label}
          </s-option>
        ))}
        timeStr={startTimeStr}
        onTimeChange={setStartTimeStr}
        timeError={fieldErrors?.startTimeStr}
        onClearTimeError={() => clearFieldError?.("startTimeStr")}
      />
    );
  }

  if (scheduleRecurrenceType === "monthly") {
    return (
      <SchedulePickAndTimeRow
        key="monthly-schedule-pick"
        pickKey="monthly-schedule-pick"
        readOnly={readOnly}
        pickLabel="Pick date"
        pickValue={scheduleRecurrenceDayOfMonth || "1"}
        onPickChange={(value) => setScheduleRecurrenceDayOfMonth?.(value)}
        pickError={fieldErrors?.scheduleRecurrenceDate}
        onClearPickError={() => clearFieldError?.("scheduleRecurrenceDate")}
        scrollablePick
        pickOptionsData={MONTH_DAY_OPTIONS}
        pickOptions={MONTH_DAY_OPTIONS.map((option) => (
          <s-option key={option.value} value={option.value}>
            {option.label}
          </s-option>
        ))}
        timeStr={startTimeStr}
        onTimeChange={setStartTimeStr}
        timeError={fieldErrors?.startTimeStr}
        onClearTimeError={() => clearFieldError?.("startTimeStr")}
      />
    );
  }

  return null;
}

export default function ScheduleSettingsCard({
  readOnly = false,
  scheduleType,
  setScheduleType,
  scheduleRecurrenceType,
  setScheduleRecurrenceType,
  scheduleRecurrenceDayOfWeek,
  setScheduleRecurrenceDayOfWeek,
  scheduleRecurrenceDayOfMonth,
  setScheduleRecurrenceDayOfMonth,
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
  fieldErrors = {},
  clearFieldError,
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
                values={[scheduleType || "now"]}
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
                <>
                  <s-select
                    label="Schedule type"
                    value={scheduleRecurrenceType || "one_time"}
                    disabled={readOnly}
                    onInput={
                      readOnly
                        ? undefined
                        : (e) => setScheduleRecurrenceType?.(e.target.value)
                    }
                  >
                    {SCHEDULE_RECURRENCE_OPTIONS.map((option) => (
                      <s-option key={option.value} value={option.value}>
                        {option.label}
                      </s-option>
                    ))}
                  </s-select>

                  {isOneTimeScheduleRecurrence(scheduleRecurrenceType) ? (
                    <ScheduleDateTimeFields
                      readOnly={readOnly}
                      dateStr={startDateStr}
                      timeStr={startTimeStr}
                      onDateChange={handleStartDateChange}
                      onTimeChange={setStartTimeStr}
                      selectedDate={startDate}
                      onSelectDate={onStartDateSelect}
                      dateError={fieldErrors?.startDateStr}
                      timeError={fieldErrors?.startTimeStr}
                      onClearDateError={() => clearFieldError?.("startDateStr")}
                      onClearTimeError={() => clearFieldError?.("startTimeStr")}
                    />
                  ) : (
                    <ScheduleRecurringFields
                      key={scheduleRecurrenceType}
                      readOnly={readOnly}
                      scheduleRecurrenceType={scheduleRecurrenceType}
                      startDateStr={startDateStr}
                      startTimeStr={startTimeStr}
                      setStartTimeStr={setStartTimeStr}
                      handleStartDateChange={handleStartDateChange}
                      startDate={startDate}
                      onStartDateSelect={onStartDateSelect}
                      scheduleRecurrenceDayOfWeek={scheduleRecurrenceDayOfWeek}
                      setScheduleRecurrenceDayOfWeek={setScheduleRecurrenceDayOfWeek}
                      scheduleRecurrenceDayOfMonth={scheduleRecurrenceDayOfMonth}
                      setScheduleRecurrenceDayOfMonth={setScheduleRecurrenceDayOfMonth}
                      fieldErrors={fieldErrors}
                      clearFieldError={clearFieldError}
                    />
                  )}
                </>
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
                  dateError={fieldErrors?.revertDateStr}
                  timeError={fieldErrors?.revertTimeStr}
                  onClearDateError={() => clearFieldError?.("revertDateStr")}
                  onClearTimeError={() => clearFieldError?.("revertTimeStr")}
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
