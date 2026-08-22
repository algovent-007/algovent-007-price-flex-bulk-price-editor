import { useEffect, useId, useRef, useState } from "react";
import {
  formatDateIso,
  parseIsoDate,
  SCHEDULE_RECURRENCE_OPTIONS,
  WEEKDAY_OPTIONS,
  MONTH_DAY_OPTIONS,
  isOneTimeScheduleRecurrence,
  getScheduleDatePickerAllowRange,
} from "../../utils/schedule";
import styles from "./ScheduleSettingsCard.module.css";
import { translateError } from "../../i18n/errors";
import { useI18n } from "../../i18n/I18nProvider";

function ScheduleTimeField({
  readOnly = false,
  timeStr,
  onTimeChange,
  timeError = "",
  onClearTimeError,
}) {
  const { t } = useI18n();
  return (
    <s-text-field
      label={t("schedule.time")}
      value={timeStr}
      disabled={readOnly}
      error={translateError(t, timeError)}
      onInput={
        readOnly
          ? undefined
          : (e) => {
              onClearTimeError?.();
              onTimeChange(e.target.value);
            }
      }
      details={t("schedule.timeExample")}
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
  timeZone,
  allowDates,
}) {
  const { t } = useI18n();
  const resolvedDateLabel = dateLabel === "Date" ? t("schedule.date") : dateLabel;
  const rawModalId = useId();
  const modalId = `schedule-date-picker-${rawModalId.replace(/:/g, "")}`;
  const modalRef = useRef(null);
  const [draftDateIso, setDraftDateIso] = useState(formatDateIso(selectedDate, timeZone));

  useEffect(() => {
    setDraftDateIso(formatDateIso(selectedDate, timeZone));
  }, [selectedDate, timeZone]);

  const openDatePicker = () => {
    setDraftDateIso(formatDateIso(selectedDate, timeZone));
    modalRef.current?.showOverlay?.();
  };

  const applyDate = () => {
    const parsed = parseIsoDate(draftDateIso, timeZone);
    if (parsed) onSelectDate(parsed);
    modalRef.current?.hideOverlay?.();
  };

  return (
    <s-stack direction="block" gap="base">
      <div className={styles.pickTimeRow}>
        <s-text-field
          label={resolvedDateLabel}
          value={dateStr}
          disabled={readOnly}
          error={translateError(t, dateError)}
          onInput={
            readOnly
              ? undefined
              : (e) => {
                  onClearDateError?.();
                  onDateChange(e.target.value);
                }
          }
          details={t("schedule.dateFormat")}
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
            {t("schedule.chooseDate")}
          </s-button>
        </s-box>
      )}

      {!readOnly && (
        <s-modal
          id={modalId}
          ref={modalRef}
          heading={resolvedDateLabel}
          onHide={() => setDraftDateIso(formatDateIso(selectedDate, timeZone))}
        >
          <s-date-picker
            type="single"
            value={draftDateIso}
            allow={allowDates}
            onChange={(e) => setDraftDateIso(e.target?.value || draftDateIso)}
          />

          <s-button slot="secondary-actions" commandFor={modalId} command="--hide">
            {t("common.cancel")}
          </s-button>
          <s-button slot="primary-action" variant="primary" onClick={applyDate}>
            {t("schedule.applyDate")}
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
  const { t } = useI18n();
  return (
    <div className={styles.pickTimeRow}>
      {scrollablePick ? (
        <ScheduleScrollableSelect
          key={pickKey}
          label={pickLabel}
          value={pickValue}
          options={pickOptionsData}
          disabled={readOnly}
          error={translateError(t, pickError)}
          onChange={onPickChange}
          onClearError={onClearPickError}
        />
      ) : (
        <s-select
          key={pickKey}
          label={pickLabel}
          value={pickValue}
          disabled={readOnly}
          error={translateError(t, pickError)}
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
        label={t("schedule.time")}
        value={timeStr}
        disabled={readOnly}
        error={translateError(t, timeError)}
        onInput={
          readOnly
            ? undefined
            : (e) => {
                onClearTimeError?.();
                onTimeChange(e.target.value);
              }
        }
        details={t("schedule.timeExample")}
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
  const { t } = useI18n();
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
        pickLabel={t("schedule.pickDay")}
        pickValue={scheduleRecurrenceDayOfWeek || "1"}
        onPickChange={(value) => setScheduleRecurrenceDayOfWeek?.(value)}
        pickError={fieldErrors?.scheduleRecurrenceDay}
        onClearPickError={() => clearFieldError?.("scheduleRecurrenceDay")}
        pickOptions={WEEKDAY_OPTIONS.map((option) => (
          <s-option key={option.value} value={option.value}>
            {t(`schedule.weekday.${option.value}`)}
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
        pickLabel={t("schedule.pickDate")}
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
  hasSavedTimezone = true,
  currentTimeStr,
  fieldErrors = {},
  clearFieldError,
}) {
  const { t } = useI18n();
  const recurrenceLabelKey = {
    one_time: "schedule.oneTime",
    daily: "schedule.daily",
    weekly: "schedule.weekly",
    monthly: "schedule.monthly",
  };
  return (
    <s-box padding="base" borderWidth="base" borderRadius="base" background="base">
      <s-stack direction="block" gap="loose">
        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(280px, 1fr))" gap="large">
          <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
            <s-stack direction="block" gap="base">
              <s-heading>{t("schedule.priceChangeTiming")}</s-heading>
              <s-choice-list
                name="change_prices_schedule"
                label={t("schedule.whenToChange")}
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
                <s-choice value="now">{t("schedule.changeNow")}</s-choice>
                <s-choice value="later">{t("schedule.changeLater")}</s-choice>
              </s-choice-list>

              {scheduleType === "later" && (
                <>
                  <s-select
                    label={t("schedule.scheduleType")}
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
                        {t(recurrenceLabelKey[option.value] || "schedule.oneTime")}
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
                      timeZone={timezoneStr}
                      allowDates={getScheduleDatePickerAllowRange(new Date(), timezoneStr)}
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
              <s-heading>{t("schedule.automaticRevert")}</s-heading>
              <s-checkbox
                label={t("schedule.revertLater")}
                checked={revertLater}
                disabled={readOnly}
                onChange={
                  readOnly ? undefined : (e) => setRevertLater(e.currentTarget.checked)
                }
              />

              {revertLater && (
                <ScheduleDateTimeFields
                  readOnly={
                    readOnly ||
                    (scheduleType === "later" &&
                      !isOneTimeScheduleRecurrence(scheduleRecurrenceType))
                  }
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
                  timeZone={timezoneStr}
                />
              )}
            </s-stack>
          </s-box>
        </s-grid>

        <s-box paddingBlockStart="base">
          <s-banner tone="info">
            {t("schedule.timezoneBanner", { timezone: timezoneStr, currentTime: currentTimeStr })}
            {!hasSavedTimezone ? t("schedule.saveTimezoneHint") : ""}
          </s-banner>
        </s-box>
      </s-stack>
    </s-box>
  );
}
