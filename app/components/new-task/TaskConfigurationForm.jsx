import ConditionsCard from "./ConditionsCard";
import CollectionCard from "./CollectionCard";
import CsvUploadCard from "./CsvUploadCard";
import ScheduleSettingsCard from "./ScheduleSettingsCard";
import AdvancedSettingsCard from "./AdvancedSettingsCard";
import PriceChangePreview from "./PriceChangePreview";

export default function TaskConfigurationForm({
  readOnly = false,
  collections = [],
  csvFileInputRef,
  values,
  handlers,
  isSearching = false,
  isRunning = false,
  pricingValidationError = "",
  previewVariants = [],
  timezoneStr = "",
  currentTimeStr = "",
}) {
  const {
    editType,
    matchType,
    conditions,
    searchResults,
    selectedCollectionId,
    csvFileName,
    changePrice,
    percentType,
    percentValue,
    fixedType,
    fixedValue,
    roundCents,
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
    costPercentType,
    costPercentValue,
    costFixedType,
    costFixedValue,
    costFixedPriceAmount,
    costRoundCents,
    examplePrice,
    exampleCompare,
    exampleCost,
    calcPrice,
    calcCompare,
    calcCost,
    calcWarnings,
    addTagsActive,
    removeTagsActive,
    tagToAddInput,
    tagsToAdd,
    tagToRemoveInput,
    tagsToRemove,
    scheduleType,
    revertLater,
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
    setSearchResults,
    setCsvFileName,
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
    setCostPercentType,
    setCostPercentValue,
    setCostFixedType,
    setCostFixedValue,
    setCostFixedPriceAmount,
    setCostRoundCents,
    setExamplePrice,
    setExampleCompare,
    setExampleCost,
    runCalculations,
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
    setRevertLater,
    setStartTimeStr,
    handleStartDateChange,
    handleStartDateSelect,
    setRevertTimeStr,
    handleRevertDateChange,
    handleRevertDateSelect,
    setTaskName,
    handleRunTask,
  } = handlers ?? {};

  return (
    <>
      {/* Section 1: Select Products */}
      <s-section heading="1. Select the products that you want to edit">
        <s-stack direction="block" gap="loose">
          <s-choice-list
            name="edit-type"
            value={editType}
            disabled={readOnly}
            onInput={
              readOnly
                ? undefined
                : (e) => {
                    const next = e.currentTarget?.values?.[0] ?? e.target?.value;
                    if (next) {
                      setEditType(next);
                      setSearchResults(null);
                      setCsvFileName(null);
                      if (next === "collection" && collections.length > 0) {
                        setSelectedCollectionId(collections[0].id);
                      }
                    }
                  }
            }
            label="Select the products that you want to edit"
            labelAccessibilityVisibility="exclusive"
          >
            <s-choice value="all">All products</s-choice>
            <s-choice value="conditions">Products based on condition(s)</s-choice>
            <s-choice value="collection">All products in a collection</s-choice>
            <s-choice value="csv-all">All products in a CSV</s-choice>
            <s-choice value="csv-direct">Direct Edit with CSV</s-choice>
          </s-choice-list>

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
              searchResults={searchResults}
              previewVariants={previewVariants}
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
              searchResults={searchResults}
              previewVariants={previewVariants}
            />
          )}

          {(editType === "csv-all" || editType === "csv-direct") && (
            <CsvUploadCard
              readOnly={readOnly}
              csvFileInputRef={csvFileInputRef}
              csvFileName={csvFileName}
              onFileChange={readOnly ? undefined : handleCsvFileChange}
              onUploadClick={
                readOnly ? undefined : () => csvFileInputRef.current?.click()
              }
            />
          )}

          {editType !== "conditions" &&
            editType !== "csv-all" &&
            editType !== "csv-direct" &&
            editType !== "collection" && (
              <s-stack direction="block" gap="base">
                {!readOnly && (
                  <s-stack direction="inline" justifyContent="end">
                    <s-button variant="primary" onClick={handleSearch} loading={isSearching}>
                      Search For Products
                    </s-button>
                  </s-stack>
                )}
                {searchResults && (
                  <PriceChangePreview previewVariants={previewVariants} visible />
                )}
              </s-stack>
            )}
        </s-stack>
      </s-section>

      {/* Section 2: Configure Pricing Rules */}
      <s-section heading="2. Configure pricing rules">
        <s-stack direction="block">
          <s-select
            label="Change Price"
            value={changePrice}
            disabled={readOnly}
            onInput={readOnly ? undefined : (e) => setChangePrice(e.target.value)}
          >
            <s-option value="1">Based on Current Price</s-option>
            <s-option value="2">Based on Current Compare Price</s-option>
            <s-option value="3">Based on Cost per Item</s-option>
            <s-option value="5">With Fixed Amount</s-option>
            <s-option value="6">No Change</s-option>
          </s-select>

          {(changePrice === "1" || changePrice === "2" || changePrice === "3") && (
            <>
              <s-box paddingBlockStart="large">
                <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                  <s-select
                    label="Percent"
                    value={percentType}
                    disabled={readOnly}
                    onInput={readOnly ? undefined : (e) => setPercentType(e.target.value)}
                  >
                    <s-option value="1">increase by</s-option>
                    <s-option value="2">decrease by</s-option>
                    <s-option value="3">No Change</s-option>
                    <s-option value="4">fixed change</s-option>
                  </s-select>
                  <s-grid gridTemplateColumns="1fr auto" gap="small" alignItems="end">
                    <s-text-field
                      label="Value"
                      type="number"
                      value={percentValue}
                      placeholder="Enter value"
                      disabled={readOnly}
                      onInput={readOnly ? undefined : (e) => setPercentValue(e.target.value)}
                    ></s-text-field>
                    <s-text color="subdued">%</s-text>
                  </s-grid>
                </s-grid>
              </s-box>

              <s-box paddingBlockStart="large">
                <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                  <s-select
                    label="Fixed Amount"
                    value={fixedType}
                    disabled={readOnly}
                    onInput={readOnly ? undefined : (e) => setFixedType(e.target.value)}
                  >
                    <s-option value="1">add</s-option>
                    <s-option value="2">subtract</s-option>
                    <s-option value="3">No Change</s-option>
                    <s-option value="4">multiply</s-option>
                  </s-select>
                  <s-grid gridTemplateColumns="1fr auto" gap="small" alignItems="end">
                    <s-text-field
                      label="Value"
                      type="number"
                      value={fixedValue}
                      placeholder="Enter value"
                      disabled={readOnly}
                      onInput={readOnly ? undefined : (e) => setFixedValue(e.target.value)}
                    ></s-text-field>
                    <s-text color="subdued">USD</s-text>
                  </s-grid>
                </s-grid>
              </s-box>
            </>
          )}

          {changePrice === "5" && (
            <s-box paddingBlockStart="large">
              <s-grid gridTemplateColumns="1fr auto" gap="small" alignItems="end">
                <s-text-field
                  label="Fixed price amount"
                  type="number"
                  value={fixedPriceAmount}
                  placeholder="Enter amount"
                  disabled={readOnly}
                  onInput={readOnly ? undefined : (e) => setFixedPriceAmount(e.target.value)}
                ></s-text-field>
                <s-text color="subdued">USD</s-text>
              </s-grid>
            </s-box>
          )}

          {changePrice !== "6" && changePrice !== "9" && (
            <s-box paddingBlockStart="large">
              <s-select
                label="Round off cents"
                value={roundCents}
                disabled={readOnly}
                onInput={readOnly ? undefined : (e) => setRoundCents(e.target.value)}
              >
                <s-option value="1">No</s-option>
                <s-option value="2">Fixed Round Off</s-option>
                <s-option value="3">Nearest Integer</s-option>
                <s-option value="4">Nearest Integer Up</s-option>
                <s-option value="5">Nearest Integer Down</s-option>
                <s-option value="6">Nearest 5 Cent</s-option>
                <s-option value="7">Nearest 5 Cent Up</s-option>
                <s-option value="8">Nearest 5 Cent Down</s-option>
                <s-option value="9">End prices in a certain number</s-option>
              </s-select>
            </s-box>
          )}

          <s-box paddingBlockStart="large">
            <s-select
              label="Change Compare Price"
              value={comparePriceType}
              disabled={readOnly}
              onInput={readOnly ? undefined : (e) => setComparePriceType(e.target.value)}
            >
              <s-option value="1">Based on Current Compare Price</s-option>
              <s-option value="2">Based on New Product Price</s-option>
              <s-option value="3">Based on Current Product Price</s-option>
              <s-option value="4">Based on Cost per Item</s-option>
              <s-option value="5">With Fixed Amount</s-option>
              <s-option value="7">Make it NULL (Blank)</s-option>
              <s-option value="8">Based On Formula</s-option>
              <s-option value="9">Reset Fixed Compare Price</s-option>
              <s-option value="6">No Change</s-option>
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
                    label="Percent"
                    value={comparePercentType}
                    disabled={readOnly}
                    onInput={
                      readOnly ? undefined : (e) => setComparePercentType(e.target.value)
                    }
                  >
                    <s-option value="1">increase by</s-option>
                    <s-option value="2">decrease by</s-option>
                    <s-option value="3">No Change</s-option>
                    <s-option value="4">fixed change</s-option>
                  </s-select>
                  <s-grid gridTemplateColumns="1fr auto" gap="small" alignItems="end">
                    <s-text-field
                      label="Value"
                      type="number"
                      value={comparePercentValue}
                      placeholder="Enter value"
                      disabled={readOnly}
                      onInput={
                        readOnly ? undefined : (e) => setComparePercentValue(e.target.value)
                      }
                    ></s-text-field>
                    <s-text color="subdued">%</s-text>
                  </s-grid>
                </s-grid>
              </s-box>

              <s-box paddingBlockStart="large">
                <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                  <s-select
                    label="Fixed Amount"
                    value={compareFixedType}
                    disabled={readOnly}
                    onInput={
                      readOnly ? undefined : (e) => setCompareFixedType(e.target.value)
                    }
                  >
                    <s-option value="1">add</s-option>
                    <s-option value="2">subtract</s-option>
                    <s-option value="3">No Change</s-option>
                    <s-option value="4">multiply</s-option>
                  </s-select>
                  <s-grid gridTemplateColumns="1fr auto" gap="small" alignItems="end">
                    <s-text-field
                      label="Value"
                      type="number"
                      value={compareFixedValue}
                      placeholder="Enter value"
                      disabled={readOnly}
                      onInput={
                        readOnly ? undefined : (e) => setCompareFixedValue(e.target.value)
                      }
                    ></s-text-field>
                    <s-text color="subdued">USD</s-text>
                  </s-grid>
                </s-grid>
              </s-box>
            </>
          )}

          {comparePriceType === "5" && (
            <s-box paddingBlockStart="large">
              <s-grid gridTemplateColumns="1fr auto" gap="small" alignItems="end">
                <s-text-field
                  label="Fixed compare price amount"
                  type="number"
                  value={compareFixedPriceAmount}
                  placeholder="Enter amount"
                  disabled={readOnly}
                  onInput={
                    readOnly ? undefined : (e) => setCompareFixedPriceAmount(e.target.value)
                  }
                ></s-text-field>
                <s-text color="subdued">USD</s-text>
              </s-grid>
            </s-box>
          )}

          {comparePriceType === "8" && (
            <s-box paddingBlockStart="large">
              <div>
                <s-text-field
                  label="Compare-at price formula"
                  value={comparePriceFormula}
                  disabled={readOnly}
                  onInput={
                    readOnly ? undefined : (e) => setComparePriceFormula(e.target.value)
                  }
                  placeholder="price * 1.2"
                ></s-text-field>
                <s-text color="subdued">
                  Use variables: <strong>price</strong>, <strong>compare</strong>,{" "}
                  <strong>cost</strong>
                </s-text>
              </div>
            </s-box>
          )}

          {comparePriceType !== "6" &&
            comparePriceType !== "7" &&
            comparePriceType !== "9" && (
              <s-box paddingBlockStart="large">
                <s-select
                  label="Round off cents"
                  value={compareRoundCents}
                  disabled={readOnly}
                  onInput={
                    readOnly ? undefined : (e) => setCompareRoundCents(e.target.value)
                  }
                >
                  <s-option value="1">No</s-option>
                  <s-option value="2">Fixed Round Off</s-option>
                  <s-option value="3">Nearest Integer</s-option>
                  <s-option value="4">Nearest Integer Up</s-option>
                  <s-option value="5">Nearest Integer Down</s-option>
                  <s-option value="6">Nearest 5 Cent</s-option>
                  <s-option value="7">Nearest 5 Cent Up</s-option>
                  <s-option value="8">Nearest 5 Cent Down</s-option>
                  <s-option value="9">End prices in a certain number</s-option>
                </s-select>
              </s-box>
            )}

          <s-box paddingBlockStart="large">
            <s-select
              label="Change Cost Price"
              value={costPriceType}
              disabled={readOnly}
              onInput={readOnly ? undefined : (e) => setCostPriceType(e.target.value)}
            >
              <s-option value="1">Based on Current Product Price</s-option>
              <s-option value="4">Based on New Product Price</s-option>
              <s-option value="2">Based on Current Compare Price</s-option>
              <s-option value="3">Based on Cost per Item</s-option>
              <s-option value="5">With Fixed Amount</s-option>
              <s-option value="6">No Change</s-option>
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
                    label="Percent"
                    value={costPercentType}
                    disabled={readOnly}
                    onInput={
                      readOnly ? undefined : (e) => setCostPercentType(e.target.value)
                    }
                  >
                    <s-option value="1">increase by</s-option>
                    <s-option value="2">decrease by</s-option>
                    <s-option value="3">No Change</s-option>
                    <s-option value="4">fixed change</s-option>
                  </s-select>
                  <s-grid gridTemplateColumns="1fr auto" gap="small" alignItems="end">
                    <s-text-field
                      label="Value"
                      type="number"
                      value={costPercentValue}
                      placeholder="Enter value"
                      disabled={readOnly}
                      onInput={
                        readOnly ? undefined : (e) => setCostPercentValue(e.target.value)
                      }
                    ></s-text-field>
                    <s-text color="subdued">%</s-text>
                  </s-grid>
                </s-grid>
              </s-box>

              <s-box paddingBlockStart="large">
                <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                  <s-select
                    label="Fixed Amount"
                    value={costFixedType}
                    disabled={readOnly}
                    onInput={readOnly ? undefined : (e) => setCostFixedType(e.target.value)}
                  >
                    <s-option value="1">add</s-option>
                    <s-option value="2">subtract</s-option>
                    <s-option value="3">No Change</s-option>
                    <s-option value="4">multiply</s-option>
                  </s-select>
                  <s-grid gridTemplateColumns="1fr auto" gap="small" alignItems="end">
                    <s-text-field
                      label="Value"
                      type="number"
                      value={costFixedValue}
                      placeholder="Enter value"
                      disabled={readOnly}
                      onInput={
                        readOnly ? undefined : (e) => setCostFixedValue(e.target.value)
                      }
                    ></s-text-field>
                    <s-text color="subdued">USD</s-text>
                  </s-grid>
                </s-grid>
              </s-box>
            </>
          )}

          {costPriceType === "5" && (
            <s-box paddingBlockStart="large">
              <s-grid gridTemplateColumns="1fr auto" gap="small" alignItems="end">
                <s-text-field
                  label="Fixed cost price amount"
                  type="number"
                  value={costFixedPriceAmount}
                  placeholder="Enter amount"
                  disabled={readOnly}
                  onInput={
                    readOnly ? undefined : (e) => setCostFixedPriceAmount(e.target.value)
                  }
                ></s-text-field>
                <s-text color="subdued">USD</s-text>
              </s-grid>
            </s-box>
          )}

          {costPriceType !== "6" && (
            <s-box paddingBlockStart="large">
              <s-select
                label="Round off cents"
                value={costRoundCents}
                disabled={readOnly}
                onInput={readOnly ? undefined : (e) => setCostRoundCents(e.target.value)}
              >
                <s-option value="1">No</s-option>
                <s-option value="2">Fixed Round Off</s-option>
                <s-option value="3">Nearest Integer</s-option>
                <s-option value="4">Nearest Integer Up</s-option>
                <s-option value="5">Nearest Integer Down</s-option>
                <s-option value="6">Nearest 5 Cent</s-option>
                <s-option value="7">Nearest 5 Cent Up</s-option>
                <s-option value="8">Nearest 5 Cent Down</s-option>
                <s-option value="9">End prices in a certain number</s-option>
              </s-select>
            </s-box>
          )}

          <s-box paddingBlockStart="large">
            <s-banner tone="warning">
              Note: Price / compare price is set to NULL (Blank). Prices / compare prices will
              be set to 0 when the edit task is executed.
            </s-banner>
          </s-box>
        </s-stack>
      </s-section>

      {/* Section 3: Check Example Calculations */}
      <s-section heading="3. Check example calculations">
        <s-stack direction="block" gap="base">
          <s-table variant="auto">
            <s-table-header-row>
              <s-table-header listSlot="primary">Field</s-table-header>
              <s-table-header listSlot="labeled">Current Value</s-table-header>
              <s-table-header listSlot="labeled">New Value</s-table-header>
              <s-table-header listSlot="labeled">Calculated Result</s-table-header>
            </s-table-header-row>

            <s-table-body>
              <s-table-row>
                <s-table-cell>Product Price</s-table-cell>
                <s-table-cell>
                  <s-text-field
                    type="number"
                    value={examplePrice}
                    disabled={readOnly}
                    onInput={readOnly ? undefined : (e) => setExamplePrice(e.target.value)}
                    label="Current Product Price"
                    labelAccessibilityVisibility="exclusive"
                  ></s-text-field>
                </s-table-cell>
                <s-table-cell>New Product Price</s-table-cell>
                <s-table-cell>{calcPrice}</s-table-cell>
              </s-table-row>

              <s-table-row>
                <s-table-cell>Compare-at Price</s-table-cell>
                <s-table-cell>
                  <s-text-field
                    type="number"
                    value={exampleCompare}
                    disabled={readOnly}
                    onInput={readOnly ? undefined : (e) => setExampleCompare(e.target.value)}
                    label="Current Compare-at Price"
                    labelAccessibilityVisibility="exclusive"
                  ></s-text-field>
                </s-table-cell>
                <s-table-cell>New Compare-at Price</s-table-cell>
                <s-table-cell>{calcCompare}</s-table-cell>
              </s-table-row>

              <s-table-row>
                <s-table-cell>Cost per Item</s-table-cell>
                <s-table-cell>
                  <s-text-field
                    type="number"
                    value={exampleCost}
                    disabled={readOnly}
                    onInput={readOnly ? undefined : (e) => setExampleCost(e.target.value)}
                    label="Current Cost per Item"
                    labelAccessibilityVisibility="exclusive"
                  ></s-text-field>
                </s-table-cell>
                <s-table-cell>New Cost per Item</s-table-cell>
                <s-table-cell>{calcCost}</s-table-cell>
              </s-table-row>
            </s-table-body>
          </s-table>

          {calcWarnings.length > 0 && (
            <s-banner tone="warning">{calcWarnings.join(" ")}</s-banner>
          )}

          {!readOnly && <s-button onClick={runCalculations}>Check Calculations</s-button>}
        </s-stack>
      </s-section>

      {/* Section 4 & 5: Advanced settings & Run/Schedule Task */}
      <s-section>
        <s-stack direction="block" gap="loose">
          <s-heading variant="headingMd">Step 4. Advanced settings (optional)</s-heading>

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
            <s-heading variant="headingMd">Step 5. Select when the prices should change</s-heading>
          </s-box>

          <ScheduleSettingsCard
            readOnly={readOnly}
            scheduleType={scheduleType}
            setScheduleType={readOnly ? undefined : setScheduleType}
            revertLater={revertLater}
            setRevertLater={readOnly ? undefined : setRevertLater}
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
            currentTimeStr={currentTimeStr}
          />

          <s-box paddingBlockStart="large">
            <s-text-field
              label="Task Name"
              required
              value={taskName}
              disabled={readOnly}
              onInput={readOnly ? undefined : (e) => setTaskName(e.target.value)}
            ></s-text-field>
          </s-box>

          {!readOnly && pricingValidationError && (
            <s-banner tone="critical">{pricingValidationError}</s-banner>
          )}

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
                    ? "Scheduling Task..."
                    : "Running Task..."
                  : scheduleType === "later"
                    ? "Schedule Task"
                    : "Run Task"}
              </s-button>
            </s-box>
          )}
        </s-stack>
      </s-section>
    </>
  );
}
