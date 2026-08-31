import { useEffect, useId, useRef, useState } from "react";
import {
  formatDateIso,
  parseIsoDate,
  SCHEDULE_RECURRENCE_OPTIONS,
  WEEKDAY_OPTIONS,
  MONTH_DAY_OPTIONS,
  AFTER_DAYS_OPTIONS,
  parseAfterDays,
  isOneTimeScheduleRecurrence,
  getRevertRecurrenceAllowedValues,
  resolveRevertRecurrenceType,
} from "../../utils/schedule";
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
      <s-grid gridTemplateColumns="1fr 1fr" gap="base" alignItems="end">
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
      </s-grid>
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

function SchedulePickAndTimeRow({
  readOnly = false,
  pickKey,
  pickLabel,
  pickValue,
  onPickChange,
  pickError = "",
  onClearPickError,
  pickOptions,
  timeStr,
  onTimeChange,
  timeError = "",
  onClearTimeError,
}) {
  const { t } = useI18n();
  return (
    <s-grid gridTemplateColumns="1fr 1fr" gap="base" alignItems="end">
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
    </s-grid>
  );
}

const RECURRENCE_LABEL_KEY = {
  one_time: "schedule.oneTime",
  daily: "schedule.daily",
  weekly: "schedule.weekly",
  monthly: "schedule.monthly",
};

function RecurrenceTypeSelect({ readOnly = false, value, onChange, allowedValues }) {
  const { t } = useI18n();
  const options = allowedValues?.length
    ? SCHEDULE_RECURRENCE_OPTIONS.filter((option) => allowedValues.includes(option.value))
    : SCHEDULE_RECURRENCE_OPTIONS;
  const disabled = readOnly || (allowedValues?.length === 1);

  return (
    <s-select
      label={t("schedule.scheduleType")}
      value={value || "one_time"}
      disabled={disabled}
      onInput={disabled ? undefined : (e) => onChange?.(e.target.value)}
    >
      {options.map((option) => (
        <s-option key={option.value} value={option.value}>
          {t(RECURRENCE_LABEL_KEY[option.value] || "schedule.oneTime")}
        </s-option>
      ))}
    </s-select>
  );
}

function ScheduleRecurringFields({
  readOnly = false,
  recurrenceType,
  timeStr,
  onTimeChange,
  timeErrorKey,
  dayErrorKey,
  monthErrorKey,
  dayOfWeek,
  onDayOfWeekChange,
  dayOfMonth,
  onDayOfMonthChange,
  monthMode = "date",
  fieldErrors = {},
  clearFieldError,
}) {
  const { t } = useI18n();
  if (recurrenceType === "daily") {
    return (
      <ScheduleTimeField
        readOnly={readOnly}
        timeStr={timeStr}
        onTimeChange={onTimeChange}
        timeError={fieldErrors?.[timeErrorKey]}
        onClearTimeError={() => clearFieldError?.(timeErrorKey)}
      />
    );
  }

  if (recurrenceType === "weekly") {
    return (
      <SchedulePickAndTimeRow
        key={`${dayErrorKey}-weekly`}
        pickKey={`${dayErrorKey}-weekly`}
        readOnly={readOnly}
        pickLabel={t("schedule.pickDay")}
        pickValue={dayOfWeek || "1"}
        onPickChange={(value) => onDayOfWeekChange?.(value)}
        pickError={fieldErrors?.[dayErrorKey]}
        onClearPickError={() => clearFieldError?.(dayErrorKey)}
        pickOptions={WEEKDAY_OPTIONS.map((option) => (
          <s-option key={option.value} value={option.value}>
            {t(`schedule.weekday.${option.value}`)}
          </s-option>
        ))}
        timeStr={timeStr}
        onTimeChange={onTimeChange}
        timeError={fieldErrors?.[timeErrorKey]}
        onClearTimeError={() => clearFieldError?.(timeErrorKey)}
      />
    );
  }

  if (recurrenceType === "monthly") {
    const afterDays = monthMode === "afterDays";
    const monthOptions = afterDays ? AFTER_DAYS_OPTIONS : MONTH_DAY_OPTIONS;
    const pickValue = afterDays
      ? String(parseAfterDays(dayOfMonth) || "1")
      : dayOfMonth || "1";

    return (
      <SchedulePickAndTimeRow
        key={`${monthErrorKey}-monthly-${monthMode}`}
        pickKey={`${monthErrorKey}-monthly`}
        readOnly={readOnly}
        pickLabel={t(afterDays ? "schedule.afterDays" : "schedule.pickDate")}
        pickValue={pickValue}
        onPickChange={(value) => onDayOfMonthChange?.(value)}
        pickError={fieldErrors?.[monthErrorKey]}
        onClearPickError={() => clearFieldError?.(monthErrorKey)}
        pickOptions={monthOptions.map((option) => (
          <s-option key={option.value} value={option.value}>
            {option.label}
          </s-option>
        ))}
        timeStr={timeStr}
        onTimeChange={onTimeChange}
        timeError={fieldErrors?.[timeErrorKey]}
        onClearTimeError={() => clearFieldError?.(timeErrorKey)}
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
  revertRecurrenceType,
  setRevertRecurrenceType,
  revertRecurrenceDayOfWeek,
  setRevertRecurrenceDayOfWeek,
  revertRecurrenceDayOfMonth,
  setRevertRecurrenceDayOfMonth,
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
  const revertAllowedValues = getRevertRecurrenceAllowedValues(
    scheduleType,
    scheduleRecurrenceType
  );
  const revertScheduleType = resolveRevertRecurrenceType(
    scheduleType,
    scheduleRecurrenceType,
    revertRecurrenceType
  );
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
                  <RecurrenceTypeSelect
                    readOnly={readOnly}
                    value={scheduleRecurrenceType}
                    onChange={setScheduleRecurrenceType}
                  />

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
                    />
                  ) : (
                    <ScheduleRecurringFields
                      key={scheduleRecurrenceType}
                      readOnly={readOnly}
                      recurrenceType={scheduleRecurrenceType}
                      timeStr={startTimeStr}
                      onTimeChange={setStartTimeStr}
                      timeErrorKey="startTimeStr"
                      dayErrorKey="scheduleRecurrenceDay"
                      monthErrorKey="scheduleRecurrenceDate"
                      dayOfWeek={scheduleRecurrenceDayOfWeek}
                      onDayOfWeekChange={setScheduleRecurrenceDayOfWeek}
                      dayOfMonth={scheduleRecurrenceDayOfMonth}
                      onDayOfMonthChange={setScheduleRecurrenceDayOfMonth}
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
                <>
                  <RecurrenceTypeSelect
                    readOnly
                    value={revertScheduleType}
                    allowedValues={revertAllowedValues}
                  />

                  {scheduleType === "later" &&
                  !isOneTimeScheduleRecurrence(scheduleRecurrenceType) &&
                  !isOneTimeScheduleRecurrence(revertScheduleType) ? (
                    <s-text color="subdued">{t("schedule.revertMinGapHint")}</s-text>
                  ) : null}

                  {isOneTimeScheduleRecurrence(revertScheduleType) ? (
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
                      timeZone={timezoneStr}
                    />
                  ) : (
                    <ScheduleRecurringFields
                      key={revertScheduleType}
                      readOnly={readOnly}
                      recurrenceType={revertScheduleType}
                      timeStr={revertTimeStr}
                      onTimeChange={setRevertTimeStr}
                      timeErrorKey="revertTimeStr"
                      dayErrorKey="revertRecurrenceDay"
                      monthErrorKey="revertRecurrenceDate"
                      dayOfWeek={revertRecurrenceDayOfWeek}
                      onDayOfWeekChange={setRevertRecurrenceDayOfWeek}
                      dayOfMonth={revertRecurrenceDayOfMonth}
                      onDayOfMonthChange={setRevertRecurrenceDayOfMonth}
                      monthMode={revertScheduleType === "monthly" ? "afterDays" : "date"}
                      fieldErrors={fieldErrors}
                      clearFieldError={clearFieldError}
                    />
                  )}
                </>
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
