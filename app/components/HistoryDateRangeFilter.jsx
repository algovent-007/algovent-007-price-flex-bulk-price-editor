/* eslint-disable react/prop-types -- this codebase does not use PropTypes */
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { getFieldValue } from "../utils/numeric-input";
import { formatDateIso, formatDateMDY, parseIsoDate } from "../utils/schedule";
import { useI18n } from "../i18n/I18nProvider";

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const POPOVER_ID = "history-date-range-popover";

function parseIsoDateParam(value) {
  const trimmed = String(value || "").trim();
  return ISO_DATE_PATTERN.test(trimmed) ? trimmed : "";
}

function shiftYearMonth(yearMonth, delta) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(yearMonth || ""));
  if (!match) return "";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function pickerViewFromDates(from, to, timezone) {
  return (from || to || formatDateIso(new Date(), timezone)).slice(0, 7);
}

function toPickerViewFromDates(from, to, timezone) {
  if (to) return to.slice(0, 7);
  return shiftYearMonth(pickerViewFromDates(from, to, timezone), 1);
}

function getDatePickerView(event) {
  return event.currentTarget?.view || event.target?.view || "";
}

function hideDateRangePopover(ref) {
  const popover = ref.current || document.getElementById(POPOVER_ID);
  popover?.hideOverlay?.();
}

export default function HistoryDateRangeFilter({ from, to, timezone, onApply, onClearApplied }) {
  const { t } = useI18n();
  const popoverRef = useRef(null);
  const pendingAppliedRef = useRef(null);
  const appliedFromRef = useRef(from || "");
  const appliedToRef = useRef(to || "");
  const [appliedFrom, setAppliedFrom] = useState(from || "");
  const [appliedTo, setAppliedTo] = useState(to || "");
  const [draftFrom, setDraftFrom] = useState(from || "");
  const [draftTo, setDraftTo] = useState(to || "");
  const [pickerView, setPickerView] = useState(() => pickerViewFromDates(from, to, timezone));
  const [toPickerView, setToPickerView] = useState(() => toPickerViewFromDates(from, to, timezone));

  const commitApplied = (nextFrom, nextTo) => {
    const applied = { from: nextFrom || "", to: nextTo || "" };
    pendingAppliedRef.current = applied;
    appliedFromRef.current = applied.from;
    appliedToRef.current = applied.to;
    setAppliedFrom(applied.from);
    setAppliedTo(applied.to);
    setDraftFrom(applied.from);
    setDraftTo(applied.to);
    setPickerView(pickerViewFromDates(applied.from, applied.to, timezone));
    setToPickerView(toPickerViewFromDates(applied.from, applied.to, timezone));
  };

  useEffect(() => {
    const loaderFrom = from || "";
    const loaderTo = to || "";
    const pending = pendingAppliedRef.current;
    if (pending) {
      if (pending.from === loaderFrom && pending.to === loaderTo) {
        pendingAppliedRef.current = null;
      }
      return;
    }
    appliedFromRef.current = loaderFrom;
    appliedToRef.current = loaderTo;
    setAppliedFrom(loaderFrom);
    setAppliedTo(loaderTo);
    setDraftFrom(loaderFrom);
    setDraftTo(loaderTo);
    setPickerView(pickerViewFromDates(loaderFrom, loaderTo, timezone));
    setToPickerView(toPickerViewFromDates(loaderFrom, loaderTo, timezone));
  }, [from, to, timezone]);

  const formatFilterDate = (iso) => {
    const date = parseIsoDate(iso, timezone);
    return date ? formatDateMDY(date, timezone) : iso;
  };

  const dateRangeButtonLabel =
    appliedFrom || appliedTo
      ? appliedFrom && appliedTo && appliedFrom !== appliedTo
        ? t("history.dateRangeValue", {
            from: formatFilterDate(appliedFrom),
            to: formatFilterDate(appliedTo),
          })
        : formatFilterDate(appliedFrom || appliedTo)
      : t("history.selectDateRange");

  const endDateAllow = draftFrom ? `${draftFrom}--` : "";
  const startDateAllow = draftTo ? `--${draftTo}` : "";

  const resetDraft = () => {
    setDraftFrom(appliedFromRef.current);
    setDraftTo(appliedToRef.current);
    setPickerView(pickerViewFromDates(appliedFromRef.current, appliedToRef.current, timezone));
    setToPickerView(toPickerViewFromDates(appliedFromRef.current, appliedToRef.current, timezone));
  };

  const updateDraftFromDate = (event) => {
    const nextFrom = parseIsoDateParam(getFieldValue(event));
    if (!nextFrom) return;
    setDraftFrom(nextFrom);
    setPickerView(nextFrom.slice(0, 7));
    if (draftTo && draftTo < nextFrom) setDraftTo(nextFrom);
  };

  const updateDraftToDate = (event) => {
    const nextTo = parseIsoDateParam(getFieldValue(event));
    if (!nextTo) return;
    setDraftTo(nextTo);
    setToPickerView(nextTo.slice(0, 7));
  };

  const applyDateRange = () => {
    let nextFrom = draftFrom;
    let nextTo = draftTo;
    if (nextFrom && nextTo && nextFrom > nextTo) {
      [nextFrom, nextTo] = [nextTo, nextFrom];
    }
    flushSync(() => {
      commitApplied(nextFrom, nextTo);
    });
    onApply({ from: nextFrom, to: nextTo });
    hideDateRangePopover(popoverRef);
  };

  const clearDateRangeDraft = () => {
    setDraftFrom("");
    setDraftTo("");
    setPickerView(pickerViewFromDates("", "", timezone));
    setToPickerView(toPickerViewFromDates("", "", timezone));
  };

  const clearAppliedDates = () => {
    flushSync(() => {
      commitApplied("", "");
    });
    onClearApplied();
  };

  return (
    <s-stack direction="inline" gap="small-100" alignItems="center">
      <s-button
        variant="secondary"
        icon="calendar"
        accessibilityLabel={t("history.dateRange")}
        commandFor={POPOVER_ID}
        command="--toggle"
        onClick={resetDraft}
      >
        {dateRangeButtonLabel}
      </s-button>
      {appliedFrom || appliedTo ? (
        <s-button variant="tertiary" onClick={clearAppliedDates}>
          {t("history.clearDates")}
        </s-button>
      ) : null}

      <s-popover
        id={POPOVER_ID}
        ref={popoverRef}
        inlineSize="640px"
        onHide={resetDraft}
      >
        <s-box padding="base">
          <s-stack direction="block" gap="base">
            <s-grid gridTemplateColumns="1fr 1fr" gap="base">
              <s-date-field
                label={t("history.dateFrom")}
                name="history-date-start-field"
                value={draftFrom}
                view={pickerView}
                allow={startDateAllow}
                onChange={updateDraftFromDate}
                onInput={updateDraftFromDate}
              />
              <s-date-field
                label={t("history.dateTo")}
                name="history-date-end-field"
                value={draftTo}
                view={toPickerView}
                allow={endDateAllow}
                onChange={updateDraftToDate}
                onInput={updateDraftToDate}
              />
            </s-grid>

            <s-grid gridTemplateColumns="1fr 1fr" gap="base" alignItems="start">
              <s-box padding="small" borderWidth="base" borderRadius="base" background="base">
                <s-date-picker
                  type="single"
                  name="history-date-start"
                  value={draftFrom}
                  view={pickerView}
                  allow={startDateAllow}
                  onChange={updateDraftFromDate}
                  onInput={updateDraftFromDate}
                  onViewChange={(event) => {
                    const nextView = getDatePickerView(event);
                    if (nextView) setPickerView(nextView);
                  }}
                />
              </s-box>
              <s-box padding="small" borderWidth="base" borderRadius="base" background="base">
                <s-date-picker
                  type="single"
                  name="history-date-end"
                  value={draftTo}
                  view={toPickerView}
                  allow={endDateAllow}
                  onChange={updateDraftToDate}
                  onInput={updateDraftToDate}
                  onViewChange={(event) => {
                    const nextView = getDatePickerView(event);
                    if (nextView) setToPickerView(nextView);
                  }}
                />
              </s-box>
            </s-grid>

            <s-stack direction="inline" gap="small-100" justifyContent="end">
              <s-button commandFor={POPOVER_ID} command="--hide">
                {t("common.cancel")}
              </s-button>
              {appliedFrom || appliedTo || draftFrom || draftTo ? (
                <s-button variant="secondary" onClick={clearDateRangeDraft}>
                  {t("history.clearDates")}
                </s-button>
              ) : null}
              <s-button
                variant="primary"
                commandFor={POPOVER_ID}
                command="--hide"
                onClick={applyDateRange}
              >
                {t("history.applyDateRange")}
              </s-button>
            </s-stack>
          </s-stack>
        </s-box>
      </s-popover>
    </s-stack>
  );
}
