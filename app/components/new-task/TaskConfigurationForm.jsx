import ConditionsCard from "./ConditionsCard";
import CollectionCard from "./CollectionCard";
import CsvUploadCard from "./CsvUploadCard";
import ScheduleSettingsCard from "./ScheduleSettingsCard";
import AdvancedSettingsCard from "./AdvancedSettingsCard";
import RoundCentsFields from "./RoundCentsFields";
import PriceChangePreview from "./PriceChangePreview";
import { createNumericInputHandlers } from "../../utils/numeric-input";
import { EDIT_TYPE_OPTIONS, isCsvEditType } from "./constants";
import { translateError } from "../../i18n/errors";
import { useI18n } from "../../i18n/I18nProvider";
import styles from "./ProductSelectionSection.module.css";

export default function TaskConfigurationForm({
  readOnly = false,
  collections = [],
  locations = [],
  csvFileInputRef,
  values,
  handlers,
  isSearching = false,
  isRunning = false,
  productSearchError = "",
  fieldErrors = {},
  clearFieldError,
  previewVariants = [],
  showPricePreview = false,
  onClosePricePreview,
  pricingPlaceholders = {},
  timezoneStr = "",
  hasSavedTimezone = true,
  currentTimeStr = "",
}) {
  const { t } = useI18n();
  const {
    editType,
    matchType,
    conditions,
    selectedCollectionId,
    csvFileName,
    csvRowCount,
    changePrice,
    percentType,
    percentValue,
    fixedType,
    fixedValue,
    roundCents,
    roundCentsDigit,
    comparePriceType,
    costPriceType,
    fixedPriceAmount,
    priceFormula,
    comparePriceFormula,
    comparePercentType,
    comparePercentValue,
    compareFixedType,
    compareFixedValue,
    compareFixedPriceAmount,
    compareRoundCents,
    compareRoundCentsDigit,
    costPercentType,
    costPercentValue,
    costFixedType,
    costFixedValue,
    costFixedPriceAmount,
    costRoundCents,
    costRoundCentsDigit,
    addTagsActive,
    removeTagsActive,
    tagToAddInput,
    tagsToAdd,
    tagToRemoveInput,
    tagsToRemove,
    scheduleType,
    scheduleRecurrenceType,
    scheduleRecurrenceDayOfWeek,
    scheduleRecurrenceDayOfMonth,
    revertLater,
    revertRecurrenceType,
    revertRecurrenceDayOfWeek,
    revertRecurrenceDayOfMonth,
    startDateStr,
    startTimeStr,
    startDate,
    revertDateStr,
    revertTimeStr,
    revertDate,
    taskName,
  } = values;

  const {
    setEditType,
    setSelectedCollectionId,
    setMatchType,
    handleConditionChange,
    addCondition,
    removeCondition,
    handleSearch,
    handleCsvFileChange,
    setChangePrice,
    setPercentType,
    setPercentValue,
    setFixedType,
    setFixedValue,
    setRoundCents,
    setRoundCentsDigit,
    setComparePriceType,
    setCostPriceType,
    setFixedPriceAmount,
    setPriceFormula,
    setComparePriceFormula,
    setComparePercentType,
    setComparePercentValue,
    setCompareFixedType,
    setCompareFixedValue,
    setCompareFixedPriceAmount,
    setCompareRoundCents,
    setCompareRoundCentsDigit,
    setCostPercentType,
    setCostPercentValue,
    setCostFixedType,
    setCostFixedValue,
    setCostFixedPriceAmount,
    setCostRoundCents,
    setCostRoundCentsDigit,
    setAddTagsActive,
    setRemoveTagsActive,
    setTagToAddInput,
    handleTagToAddKeyDown,
    addTagToAddFromInput,
    removeTagToAdd,
    setTagToRemoveInput,
    handleTagToRemoveKeyDown,
    addTagToRemoveFromInput,
    removeTagToRemove,
    setScheduleType,
    setScheduleRecurrenceType,
    setScheduleRecurrenceDayOfWeek,
    setScheduleRecurrenceDayOfMonth,
    setRevertLater,
    setRevertRecurrenceType,
    setRevertRecurrenceDayOfWeek,
    setRevertRecurrenceDayOfMonth,
    setStartTimeStr,
    handleStartDateChange,
    handleStartDateSelect,
    setRevertTimeStr,
    handleRevertDateChange,
    handleRevertDateSelect,
    setTaskName,
    handleSavePricingRules,
    handleRunTask,
  } = handlers ?? {};

  const numericFieldProps = (setter, key, disabled = readOnly) =>
    createNumericInputHandlers((value) => {
      clearFieldError?.(key);
      setter(value);
    }, disabled);

  const fieldError = (key) => translateError(t, fieldErrors?.[key]);
  const isDirectCsvMode = editType === "csv-direct";
  const advancedStepNumber = isDirectCsvMode ? 2 : 4;
  const scheduleStepNumber = isDirectCsvMode ? 3 : 5;
  const percentPlaceholder = pricingPlaceholders.percentValue ?? "10";
  const fixedPlaceholder = pricingPlaceholders.fixedValue ?? "20.00";
  const fixedPricePlaceholder = pricingPlaceholders.fixedPriceAmount ?? "20.00";
  const comparePercentPlaceholder = pricingPlaceholders.comparePercentValue ?? "10";
  const compareFixedPlaceholder = pricingPlaceholders.compareFixedValue ?? "20.00";
  const compareFixedPricePlaceholder =
    pricingPlaceholders.compareFixedPriceAmount ?? "20.00";
  const costPercentPlaceholder = pricingPlaceholders.costPercentValue ?? "10";
  const costFixedPlaceholder = pricingPlaceholders.costFixedValue ?? "20.00";
  const costFixedPricePlaceholder = pricingPlaceholders.costFixedPriceAmount ?? "20.00";
  const compareFormulaPlaceholder = pricingPlaceholders.comparePriceFormula ?? "price * 1.2";

  const isPercentValueDisabled = (type) => readOnly || type === "3";
  const isFixedValueDisabled = (type) => readOnly || type === "3";

  return (
    <>
      {/* Section 1: Select Products */}
      <s-section heading={t("newTask.selectProducts")}>
        <s-stack direction="block" gap="loose">
          <div className={styles.productSelectionRow}>
            <div className={styles.productSelectionChoices}>
              <s-choice-list
                name="edit_type"
                label={t("newTask.selectProductsLabel")}
                labelAccessibilityVisibility="exclusive"
                variant="list"
                values={[editType || "all"]}
                disabled={readOnly}
                onInput={
                  readOnly
                    ? undefined
                    : (e) => {
                        const next = e.currentTarget?.values?.[0] ?? e.target?.value;
                        if (next && next !== editType) setEditType(next);
                      }
                }
              >
                {EDIT_TYPE_OPTIONS.map((option) => (
                  <s-choice key={option.value} value={option.value}>
                    {t(`newTask.editType.${option.value}`)}
                  </s-choice>
                ))}
              </s-choice-list>
            </div>

            {!readOnly && editType === "all" && (
              <div className={styles.productSelectionAction}>
                <s-button variant="primary" onClick={handleSearch} loading={isSearching}>
                  {t("newTask.searchForProducts")}
                </s-button>
              </div>
            )}
          </div>

          {!readOnly && productSearchError && (
            <s-banner tone="critical">{translateError(t, productSearchError)}</s-banner>
          )}

          {editType === "conditions" && (
            <ConditionsCard
              readOnly={readOnly}
              matchType={matchType}
              setMatchType={readOnly ? undefined : setMatchType}
              conditions={conditions}
              handleConditionChange={readOnly ? undefined : handleConditionChange}
              addCondition={readOnly ? undefined : addCondition}
              removeCondition={readOnly ? undefined : removeCondition}
              handleSearch={readOnly ? undefined : handleSearch}
              isSearching={isSearching}
              locations={locations}
              collections={collections}
              fieldErrors={fieldErrors}
              clearFieldError={clearFieldError}
            />
          )}

          {editType === "collection" && (
            <CollectionCard
              readOnly={readOnly}
              collections={collections}
              selectedCollectionId={selectedCollectionId}
              setSelectedCollectionId={readOnly ? undefined : setSelectedCollectionId}
              handleSearch={readOnly ? undefined : handleSearch}
              isSearching={isSearching}
              fieldErrors={fieldErrors}
              clearFieldError={clearFieldError}
            />
          )}

          {isCsvEditType(editType) && (
            <>
              <CsvUploadCard
                readOnly={readOnly}
                editType={editType}
                csvFileInputRef={csvFileInputRef}
                csvFileName={csvFileName}
                csvRowCount={csvRowCount}
                onFileChange={readOnly ? undefined : handleCsvFileChange}
                onUploadClick={
                  readOnly ? undefined : () => csvFileInputRef.current?.click()
                }
                error={fieldError("csvFile")}
              />
            </>
          )}

          <PriceChangePreview
            key={editType}
            previewVariants={previewVariants}
            visible={showPricePreview}
            onClose={readOnly ? undefined : onClosePricePreview}
          />
        </s-stack>
      </s-section>

      {/* Section 2: Configure Pricing Rules */}
      {!isDirectCsvMode && (
      <s-section heading={t("newTask.configurePricing")}>
        <s-stack direction="block" gap="loose">
          <s-select
            label={t("newTask.changePrice")}
            value={changePrice}
            disabled={readOnly}
            onInput={readOnly ? undefined : (e) => setChangePrice(e.currentTarget?.value ?? e.target?.value)}
          >
            <s-option value="1">{t("newTask.priceBasedOnCurrent")}</s-option>
            <s-option value="2">{t("newTask.priceBasedOnCompare")}</s-option>
            <s-option value="3">{t("newTask.priceBasedOnCost")}</s-option>
            <s-option value="5">{t("newTask.priceFixedAmount")}</s-option>
            <s-option value="6">{t("newTask.priceNoChange")}</s-option>
          </s-select>

          {(changePrice === "1" || changePrice === "2" || changePrice === "3") && (
            <>
              <s-box paddingBlockStart="large">
                <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                  <s-select
                    label={t("newTask.percent")}
                    value={percentType}
                    disabled={readOnly}
                    onInput={readOnly ? undefined : (e) => setPercentType(e.currentTarget?.value ?? e.target?.value)}
                  >
                    <s-option value="1">{t("newTask.increaseBy")}</s-option>
                    <s-option value="2">{t("newTask.decreaseBy")}</s-option>
                    <s-option value="3">{t("newTask.priceNoChange")}</s-option>
                    <s-option value="4">{t("newTask.fixedChange")}</s-option>
                  </s-select>
                  <s-grid gridTemplateColumns="1fr auto" gap="small" alignItems="end">
                    <s-text-field
                      label={t("newTask.value")}
                      value={percentValue}
                      placeholder={percentPlaceholder}
                      inputMode="decimal"
                      disabled={isPercentValueDisabled(percentType)}
                      {...numericFieldProps(
                        setPercentValue,
                        "percentValue",
                        isPercentValueDisabled(percentType)
                      )}
                      error={fieldError("percentValue")}
                    ></s-text-field>
                    <s-text color="subdued">{percentType === "4" ? t("newTask.usd") : t("newTask.percentSign")}</s-text>
                  </s-grid>
                </s-grid>
              </s-box>

              <s-box paddingBlockStart="large">
                <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                  <s-select
                    label={t("newTask.fixedAmount")}
                    value={fixedType}
                    disabled={readOnly}
                    onInput={readOnly ? undefined : (e) => setFixedType(e.currentTarget?.value ?? e.target?.value)}
                  >
                    <s-option value="1">{t("newTask.addAmount")}</s-option>
                    <s-option value="2">{t("newTask.subtractAmount")}</s-option>
                    <s-option value="3">{t("newTask.priceNoChange")}</s-option>
                    <s-option value="4">{t("newTask.multiply")}</s-option>
                  </s-select>
                  <s-grid gridTemplateColumns="1fr auto" gap="small" alignItems="end">
                    <s-text-field
                      label={t("newTask.value")}
                      value={fixedValue}
                      placeholder={fixedPlaceholder}
                      inputMode="decimal"
                      disabled={isFixedValueDisabled(fixedType)}
                      {...numericFieldProps(
                        setFixedValue,
                        "fixedValue",
                        isFixedValueDisabled(fixedType)
                      )}
                      error={fieldError("fixedValue")}
                    ></s-text-field>
                    <s-text color="subdued">{t("newTask.usd")}</s-text>
                  </s-grid>
                </s-grid>
              </s-box>
            </>
          )}

          {changePrice === "5" && (
            <s-box paddingBlockStart="large">
              <s-grid gridTemplateColumns="1fr auto" gap="small" alignItems="end">
                <s-text-field
                  label={t("newTask.fixedPriceAmount")}
                  value={fixedPriceAmount}
                  placeholder={fixedPricePlaceholder}
                  inputMode="decimal"
                  disabled={readOnly}
                  {...numericFieldProps(setFixedPriceAmount, "fixedPriceAmount")}
                  error={fieldError("fixedPriceAmount")}
                ></s-text-field>
                <s-text color="subdued">{t("newTask.usd")}</s-text>
              </s-grid>
            </s-box>
          )}

          {changePrice !== "6" && changePrice !== "9" && (
            <s-box paddingBlockStart="large">
              <RoundCentsFields
                roundCents={roundCents}
                roundCentsDigit={roundCentsDigit}
                setRoundCents={setRoundCents}
                setRoundCentsDigit={setRoundCentsDigit}
                readOnly={readOnly}
                fieldError={fieldError}
                clearFieldError={clearFieldError}
                errorKey="roundCentsDigit"
              />
            </s-box>
          )}

          <s-box paddingBlockStart="large">
            <s-select
              label={t("newTask.changeComparePrice")}
              value={comparePriceType}
              disabled={readOnly}
              onInput={readOnly ? undefined : (e) => setComparePriceType(e.currentTarget?.value ?? e.target?.value)}
            >
              <s-option value="1">{t("newTask.compareBasedOnCurrentCompare")}</s-option>
              <s-option value="2">{t("newTask.compareBasedOnNewPrice")}</s-option>
              <s-option value="3">{t("newTask.compareBasedOnCurrentPrice")}</s-option>
              <s-option value="4">{t("newTask.compareBasedOnCost")}</s-option>
              <s-option value="5">{t("newTask.compareFixed")}</s-option>
              <s-option value="7">{t("newTask.compareNull")}</s-option>
              <s-option value="8">{t("newTask.compareFormulaOption")}</s-option>
              <s-option value="9">{t("newTask.compareReset")}</s-option>
              <s-option value="6">{t("newTask.priceNoChange")}</s-option>
            </s-select>
          </s-box>

          {(comparePriceType === "1" ||
            comparePriceType === "2" ||
            comparePriceType === "3" ||
            comparePriceType === "4") && (
            <>
              <s-box paddingBlockStart="large">
                <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                  <s-select
                    label={t("newTask.percent")}
                    value={comparePercentType}
                    disabled={readOnly}
                    onInput={
                      readOnly ? undefined : (e) => setComparePercentType(e.currentTarget?.value ?? e.target?.value)
                    }
                  >
                    <s-option value="1">{t("newTask.increaseBy")}</s-option>
                    <s-option value="2">{t("newTask.decreaseBy")}</s-option>
                    <s-option value="3">{t("newTask.priceNoChange")}</s-option>
                    <s-option value="4">{t("newTask.fixedChange")}</s-option>
                  </s-select>
                  <s-grid gridTemplateColumns="1fr auto" gap="small" alignItems="end">
                    <s-text-field
                      label={t("newTask.value")}
                      value={comparePercentValue}
                      placeholder={comparePercentPlaceholder}
                      inputMode="decimal"
                      disabled={isPercentValueDisabled(comparePercentType)}
                      {...numericFieldProps(
                        setComparePercentValue,
                        "comparePercentValue",
                        isPercentValueDisabled(comparePercentType)
                      )}
                      error={fieldError("comparePercentValue")}
                    ></s-text-field>
                    <s-text color="subdued">
                      {comparePercentType === "4" ? t("newTask.usd") : t("newTask.percentSign")}
                    </s-text>
                  </s-grid>
                </s-grid>
              </s-box>

              <s-box paddingBlockStart="large">
                <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                  <s-select
                    label={t("newTask.fixedAmount")}
                    value={compareFixedType}
                    disabled={readOnly}
                    onInput={
                      readOnly ? undefined : (e) => setCompareFixedType(e.currentTarget?.value ?? e.target?.value)
                    }
                  >
                    <s-option value="1">{t("newTask.addAmount")}</s-option>
                    <s-option value="2">{t("newTask.subtractAmount")}</s-option>
                    <s-option value="3">{t("newTask.priceNoChange")}</s-option>
                    <s-option value="4">{t("newTask.multiply")}</s-option>
                  </s-select>
                  <s-grid gridTemplateColumns="1fr auto" gap="small" alignItems="end">
                    <s-text-field
                      label={t("newTask.value")}
                      value={compareFixedValue}
                      placeholder={compareFixedPlaceholder}
                      inputMode="decimal"
                      disabled={isFixedValueDisabled(compareFixedType)}
                      {...numericFieldProps(
                        setCompareFixedValue,
                        "compareFixedValue",
                        isFixedValueDisabled(compareFixedType)
                      )}
                      error={fieldError("compareFixedValue")}
                    ></s-text-field>
                    <s-text color="subdued">{t("newTask.usd")}</s-text>
                  </s-grid>
                </s-grid>
              </s-box>
            </>
          )}

          {comparePriceType === "5" && (
            <s-box paddingBlockStart="large">
              <s-grid gridTemplateColumns="1fr auto" gap="small" alignItems="end">
                <s-text-field
                  label={t("newTask.fixedCompareAmount")}
                  value={compareFixedPriceAmount}
                  placeholder={compareFixedPricePlaceholder}
                  inputMode="decimal"
                  disabled={readOnly}
                  {...numericFieldProps(setCompareFixedPriceAmount, "compareFixedPriceAmount")}
                  error={fieldError("compareFixedPriceAmount")}
                ></s-text-field>
                <s-text color="subdued">{t("newTask.usd")}</s-text>
              </s-grid>
            </s-box>
          )}

          {comparePriceType === "8" && (
            <s-box paddingBlockStart="large">
              <div>
                <s-text-field
                  label={t("newTask.compareFormula")}
                  value={comparePriceFormula}
                  disabled={readOnly}
                  onInput={
                    readOnly
                      ? undefined
                      : (e) => {
                          clearFieldError?.("comparePriceFormula");
                          setComparePriceFormula(e.target.value);
                        }
                  }
                  error={fieldError("comparePriceFormula")}
                  placeholder={compareFormulaPlaceholder}
                ></s-text-field>
                <s-text color="subdued">
                  {t("newTask.formulaHelpPrefix")} <strong>price</strong>, <strong>compare</strong>,{" "}
                  <strong>cost</strong>
                </s-text>
              </div>
            </s-box>
          )}

          {comparePriceType !== "6" &&
            comparePriceType !== "7" &&
            comparePriceType !== "9" && (
              <s-box paddingBlockStart="large">
                <RoundCentsFields
                  roundCents={compareRoundCents}
                  roundCentsDigit={compareRoundCentsDigit}
                  setRoundCents={setCompareRoundCents}
                  setRoundCentsDigit={setCompareRoundCentsDigit}
                  readOnly={readOnly}
                  fieldError={fieldError}
                  clearFieldError={clearFieldError}
                  errorKey="compareRoundCentsDigit"
                />
              </s-box>
            )}

          <s-box paddingBlockStart="large">
            <s-select
              label={t("newTask.changeCostPrice")}
              value={costPriceType}
              disabled={readOnly}
              onInput={readOnly ? undefined : (e) => setCostPriceType(e.currentTarget?.value ?? e.target?.value)}
            >
              <s-option value="1">{t("newTask.costBasedOnCurrentPrice")}</s-option>
              <s-option value="4">{t("newTask.costBasedOnNewPrice")}</s-option>
              <s-option value="2">{t("newTask.costBasedOnCompare")}</s-option>
              <s-option value="3">{t("newTask.costBasedOnCost")}</s-option>
              <s-option value="5">{t("newTask.priceFixedAmount")}</s-option>
              <s-option value="6">{t("newTask.priceNoChange")}</s-option>
            </s-select>
          </s-box>

          {(costPriceType === "1" ||
            costPriceType === "2" ||
            costPriceType === "3" ||
            costPriceType === "4") && (
            <>
              <s-box paddingBlockStart="large">
                <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                  <s-select
                    label={t("newTask.percent")}
                    value={costPercentType}
                    disabled={readOnly}
                    onInput={
                      readOnly ? undefined : (e) => setCostPercentType(e.currentTarget?.value ?? e.target?.value)
                    }
                  >
                    <s-option value="1">{t("newTask.increaseBy")}</s-option>
                    <s-option value="2">{t("newTask.decreaseBy")}</s-option>
                    <s-option value="3">{t("newTask.priceNoChange")}</s-option>
                    <s-option value="4">{t("newTask.fixedChange")}</s-option>
                  </s-select>
                  <s-grid gridTemplateColumns="1fr auto" gap="small" alignItems="end">
                    <s-text-field
                      label={t("newTask.value")}
                      value={costPercentValue}
                      placeholder={costPercentPlaceholder}
                      inputMode="decimal"
                      disabled={isPercentValueDisabled(costPercentType)}
                      {...numericFieldProps(
                        setCostPercentValue,
                        "costPercentValue",
                        isPercentValueDisabled(costPercentType)
                      )}
                      error={fieldError("costPercentValue")}
                    ></s-text-field>
                    <s-text color="subdued">{costPercentType === "4" ? t("newTask.usd") : t("newTask.percentSign")}</s-text>
                  </s-grid>
                </s-grid>
              </s-box>

              <s-box paddingBlockStart="large">
                <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                  <s-select
                    label={t("newTask.fixedAmount")}
                    value={costFixedType}
                    disabled={readOnly}
                    onInput={readOnly ? undefined : (e) => setCostFixedType(e.currentTarget?.value ?? e.target?.value)}
                  >
                    <s-option value="1">{t("newTask.addAmount")}</s-option>
                    <s-option value="2">{t("newTask.subtractAmount")}</s-option>
                    <s-option value="3">{t("newTask.priceNoChange")}</s-option>
                    <s-option value="4">{t("newTask.multiply")}</s-option>
                  </s-select>
                  <s-grid gridTemplateColumns="1fr auto" gap="small" alignItems="end">
                    <s-text-field
                      label={t("newTask.value")}
                      value={costFixedValue}
                      placeholder={costFixedPlaceholder}
                      inputMode="decimal"
                      disabled={isFixedValueDisabled(costFixedType)}
                      {...numericFieldProps(
                        setCostFixedValue,
                        "costFixedValue",
                        isFixedValueDisabled(costFixedType)
                      )}
                      error={fieldError("costFixedValue")}
                    ></s-text-field>
                    <s-text color="subdued">{t("newTask.usd")}</s-text>
                  </s-grid>
                </s-grid>
              </s-box>
            </>
          )}

          {costPriceType === "5" && (
            <s-box paddingBlockStart="large">
              <s-grid gridTemplateColumns="1fr auto" gap="small" alignItems="end">
                <s-text-field
                  label={t("newTask.fixedCostAmount")}
                  value={costFixedPriceAmount}
                  placeholder={costFixedPricePlaceholder}
                  inputMode="decimal"
                  disabled={readOnly}
                  {...numericFieldProps(setCostFixedPriceAmount, "costFixedPriceAmount")}
                  error={fieldError("costFixedPriceAmount")}
                ></s-text-field>
                <s-text color="subdued">{t("newTask.usd")}</s-text>
              </s-grid>
            </s-box>
          )}

          {costPriceType !== "6" && (
            <s-box paddingBlockStart="large">
              <RoundCentsFields
                roundCents={costRoundCents}
                roundCentsDigit={costRoundCentsDigit}
                setRoundCents={setCostRoundCents}
                setRoundCentsDigit={setCostRoundCentsDigit}
                readOnly={readOnly}
                fieldError={fieldError}
                clearFieldError={clearFieldError}
                errorKey="costRoundCentsDigit"
              />
            </s-box>
          )}

          {!readOnly && (
            <s-box paddingBlockStart="large">
              <s-button variant="primary" onClick={handleSavePricingRules}>
                {t("newTask.savePricingRules")}
              </s-button>
            </s-box>
          )}

          {!readOnly && fieldError("pricingRulesSave") && (
            <s-box paddingBlockStart="large">
              <s-banner tone="critical">{fieldError("pricingRulesSave")}</s-banner>
            </s-box>
          )}

          <s-box paddingBlockStart="large">
            <s-banner tone="warning">
              {t("newTask.nullPriceNote")}
            </s-banner>
          </s-box>
        </s-stack>
      </s-section>
      )}

      {/* Section 4 & 5: Advanced settings & Run/Schedule Task */}
      <s-section>
        <s-stack direction="block" gap="loose">
            <s-heading variant="headingMd">
              {t("newTask.advancedSettings", { step: advancedStepNumber })}
            </s-heading>

          <AdvancedSettingsCard
            readOnly={readOnly}
            addTagsActive={addTagsActive}
            setAddTagsActive={readOnly ? undefined : setAddTagsActive}
            removeTagsActive={removeTagsActive}
            setRemoveTagsActive={readOnly ? undefined : setRemoveTagsActive}
            tagToAddInput={tagToAddInput}
            setTagToAddInput={readOnly ? undefined : setTagToAddInput}
            handleTagToAddKeyDown={readOnly ? undefined : handleTagToAddKeyDown}
            addTagToAddFromInput={readOnly ? undefined : addTagToAddFromInput}
            tagsToAdd={tagsToAdd}
            removeTagToAdd={readOnly ? undefined : removeTagToAdd}
            tagToRemoveInput={tagToRemoveInput}
            setTagToRemoveInput={readOnly ? undefined : setTagToRemoveInput}
            handleTagToRemoveKeyDown={readOnly ? undefined : handleTagToRemoveKeyDown}
            addTagToRemoveFromInput={readOnly ? undefined : addTagToRemoveFromInput}
            tagsToRemove={tagsToRemove}
            removeTagToRemove={readOnly ? undefined : removeTagToRemove}
          />

          <s-divider />

          <s-box paddingBlockStart="large">
            <s-heading variant="headingMd">
              {t("newTask.whenPricesChange", { step: scheduleStepNumber })}
            </s-heading>
          </s-box>

          <ScheduleSettingsCard
            readOnly={readOnly}
            scheduleType={scheduleType}
            setScheduleType={readOnly ? undefined : setScheduleType}
            scheduleRecurrenceType={scheduleRecurrenceType}
            setScheduleRecurrenceType={readOnly ? undefined : setScheduleRecurrenceType}
            scheduleRecurrenceDayOfWeek={scheduleRecurrenceDayOfWeek}
            setScheduleRecurrenceDayOfWeek={
              readOnly ? undefined : setScheduleRecurrenceDayOfWeek
            }
            scheduleRecurrenceDayOfMonth={scheduleRecurrenceDayOfMonth}
            setScheduleRecurrenceDayOfMonth={
              readOnly ? undefined : setScheduleRecurrenceDayOfMonth
            }
            revertLater={revertLater}
            setRevertLater={readOnly ? undefined : setRevertLater}
            revertRecurrenceType={revertRecurrenceType}
            setRevertRecurrenceType={readOnly ? undefined : setRevertRecurrenceType}
            revertRecurrenceDayOfWeek={revertRecurrenceDayOfWeek}
            setRevertRecurrenceDayOfWeek={
              readOnly ? undefined : setRevertRecurrenceDayOfWeek
            }
            revertRecurrenceDayOfMonth={revertRecurrenceDayOfMonth}
            setRevertRecurrenceDayOfMonth={
              readOnly ? undefined : setRevertRecurrenceDayOfMonth
            }
            startDateStr={startDateStr}
            startTimeStr={startTimeStr}
            setStartTimeStr={readOnly ? undefined : setStartTimeStr}
            handleStartDateChange={readOnly ? undefined : handleStartDateChange}
            startDate={startDate}
            onStartDateSelect={readOnly ? undefined : handleStartDateSelect}
            revertDateStr={revertDateStr}
            revertTimeStr={revertTimeStr}
            setRevertTimeStr={readOnly ? undefined : setRevertTimeStr}
            handleRevertDateChange={readOnly ? undefined : handleRevertDateChange}
            revertDate={revertDate}
            onRevertDateSelect={readOnly ? undefined : handleRevertDateSelect}
            timezoneStr={timezoneStr}
            hasSavedTimezone={hasSavedTimezone}
            currentTimeStr={currentTimeStr}
            fieldErrors={fieldErrors}
            clearFieldError={clearFieldError}
          />

          <s-box paddingBlockStart="large">
            <s-text-field
              label={t("newTask.taskName")}
              required
              value={taskName}
              disabled={readOnly}
              onInput={
                readOnly
                  ? undefined
                  : (e) => {
                      clearFieldError?.("taskName");
                      setTaskName(e.target.value);
                    }
              }
              error={fieldError("taskName")}
            ></s-text-field>
          </s-box>

          {!readOnly && (
            <s-box paddingBlockStart="large">
              <s-button
                variant="primary"
                tone="success"
                onClick={handleRunTask}
                loading={isRunning}
              >
                {isRunning
                  ? scheduleType === "later"
                    ? t("newTask.schedulingTask")
                    : t("newTask.runningTask")
                  : scheduleType === "later"
                    ? t("newTask.scheduleTask")
                    : t("newTask.runTask")}
              </s-button>
            </s-box>
          )}
        </s-stack>
      </s-section>
    </>
  );
}
