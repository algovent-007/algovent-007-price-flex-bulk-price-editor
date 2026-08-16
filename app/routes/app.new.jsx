import { useState, useEffect, useMemo, useRef } from "react";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import {
  calculateVariantPricing,
  validatePricingConfig,
} from "../utils/pricing";
import {
  validateScheduleConfig,
  getDefaultScheduleDateTime,
  getDefaultRevertDateTime,
  formatDateMDY,
  formatTime12Hour,
  parseDateString,
} from "../utils/schedule";
import {
  buildProductQuery,
  executePriceEditTask,
  fetchProductsByQuery,
  filterProductsByConditions,
  getProductSearchQueryConfig,
} from "../services/task-runner.server";
import { createScheduledRevertTask } from "../services/scheduler.server";
import TaskConfigurationForm from "../components/new-task/TaskConfigurationForm";
import PriceChangePreview from "../components/new-task/PriceChangePreview";
import {
  getDefaultOperatorForField,
  getDefaultValueForField,
  isOperatorAllowedForField,
  isValueAllowedForField,
  PLACEHOLDER_IMAGE,
  buildVariantDisplayTitle,
} from "../components/new-task/constants";
import { applyStoredTaskCopy, readStoredTaskCopy } from "../utils/copy-task";
import {
  applySavedPricingRules,
  buildPricingRulesSnapshot,
  loadSavedPricingRules,
  savePricingRules,
} from "../utils/saved-pricing-rules";
import { validateRunTaskForm } from "../utils/validate-run-task";
import { isOneTimeScheduleRecurrence } from "../utils/schedule";
import { assertPlanFeature } from "../services/subscription.server";
import { BILLING_FEATURES } from "../constants/billing";
import { parseCsvAllRows, parseCsvDirectRows, validateCsvRowsForRun } from "../utils/csv-bulk-edit";
import { getShopTimezoneContext, resolveScheduleTimezone, ensureShopTimezoneSaved } from "../utils/shop-timezone.server";
import { resolveClientScheduleTimezone, getBrowserTimezone } from "../utils/shop-timezone";
import {
  formatScheduleDateTime,
  formatCurrentTimeInTimezone,
} from "../utils/schedule";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  try {
    const response = await admin.graphql(
      `#graphql
      query getCollectionsAndLocations {
        collections(first: 250, sortKey: TITLE) {
          nodes {
            id
            title
          }
        }
        locations(first: 250) {
          nodes {
            id
            name
          }
        }
      }`
    );
    const json = await response.json();
    if (json.errors) {
      throw new Error(json.errors[0].message);
    }
    return {
      collections: json.data?.collections?.nodes || [],
      locations: json.data?.locations?.nodes || [],
      shop: session.shop,
      ...(await getShopTimezoneContext({ shop: session.shop, admin })),
    };
  } catch (err) {
    console.error("Error fetching collections:", err);
    return {
      collections: [],
      locations: [],
      shop: session.shop,
      ...(await getShopTimezoneContext({ shop: session.shop, admin })),
    };
  }
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  const shopifyQuery = async (query, variables = {}) => {
    const response = await admin.graphql(query, { variables });
    const json = await response.json();
    if (json.errors) {
      throw new Error(json.errors[0].message);
    }
    return json.data;
  };

  if (intent === "search") {
    const editType = formData.get("editType");
    const matchType = formData.get("matchType");
    const conditionsStr = formData.get("conditions");
    const collectionId = formData.get("collectionId");

    if (editType === "csv-all" || editType === "csv-direct") {
      let csvRows = [];
      try {
        csvRows = JSON.parse(formData.get("csvRows") || "[]");
      } catch (e) {
        return Response.json({
          success: false,
          products: [],
          error: "Invalid CSV data submitted.",
        });
      }

      const csvValidation = validateCsvRowsForRun(csvRows, editType);
      if (!csvValidation.valid) {
        return Response.json({
          success: false,
          products: [],
          error: csvValidation.errors[0],
        });
      }

      try {
        const { resolveCsvRowsToProducts } = await import("../services/csv-bulk-edit.server");
        const { products, warnings } = await resolveCsvRowsToProducts(shopifyQuery, csvRows);
        return Response.json({
          success: true,
          products,
          warnings,
        });
      } catch (err) {
        console.error("Error loading CSV products from Shopify:", err);
        return Response.json({ success: false, products: [], error: err.message });
      }
    }

    const queryStr = buildProductQuery(editType, matchType, conditionsStr, collectionId);

    if (editType === "collection" && !collectionId) {
      return Response.json({
        success: false,
        products: [],
        error: "Please select a collection",
      });
    }

    try {
      const { fields, pageSize } = getProductSearchQueryConfig(editType);
      const fetchedProducts = await fetchProductsByQuery(
        shopifyQuery,
        queryStr,
        fields,
        { pageSize }
      );

      const products = filterProductsByConditions(
        fetchedProducts,
        editType,
        matchType,
        conditionsStr
      );
      return Response.json({ success: true, products });
    } catch (err) {
      console.error("Error fetching products from Shopify:", err);
      return Response.json({ success: false, products: [], error: err.message });
    }
  }

  if (intent === "run_task") {
    const { admin, session } = await authenticate.admin(request);
    const shop = session.shop;
    const browserTimezone = formData.get("browserTimezone");
    const formScheduleTimezone = formData.get("scheduleTimezone");
    const timezone = await resolveScheduleTimezone({
      shop,
      admin,
      browserTimezone: formScheduleTimezone || browserTimezone,
    });

    const editType = formData.get("editType");
    const matchType = formData.get("matchType");
    const conditionsStr = formData.get("conditions");
    const collectionId = formData.get("collectionId");

    const changePrice = formData.get("changePrice");
    const percentType = formData.get("percentType");
    const percentValue = formData.get("percentValue");
    const fixedType = formData.get("fixedType");
    const fixedValue = formData.get("fixedValue");
    const fixedPriceAmount = formData.get("fixedPriceAmount");
    const roundCents = formData.get("roundCents");
    const roundCentsDigit = formData.get("roundCentsDigit");
    const priceFormula = formData.get("priceFormula") || "";

    const comparePriceType = formData.get("comparePriceType");
    const comparePercentType = formData.get("comparePercentType");
    const comparePercentValue = formData.get("comparePercentValue");
    const compareFixedType = formData.get("compareFixedType");
    const compareFixedValue = formData.get("compareFixedValue");
    const compareFixedPriceAmount = formData.get("compareFixedPriceAmount");
    const compareRoundCents = formData.get("compareRoundCents");
    const compareRoundCentsDigit = formData.get("compareRoundCentsDigit");
    const comparePriceFormula = formData.get("comparePriceFormula") || "";

    const costPriceType = formData.get("costPriceType");
    const costPercentType = formData.get("costPercentType");
    const costPercentValue = formData.get("costPercentValue");
    const costFixedType = formData.get("costFixedType");
    const costFixedValue = formData.get("costFixedValue");
    const costFixedPriceAmount = formData.get("costFixedPriceAmount");
    const costRoundCents = formData.get("costRoundCents");
    const costRoundCentsDigit = formData.get("costRoundCentsDigit");

    const addTagsActive = formData.get("addTagsActive") === "true";
    const removeTagsActive = formData.get("removeTagsActive") === "true";
    const tagsToAddStr = formData.get("tagsToAdd");
    const tagsToRemoveStr = formData.get("tagsToRemove");
    const taskName = formData.get("taskName") || "sale-" + Math.floor(1000000000 + Math.random() * 9000000000);

    const changePricesSchedule = formData.get("changePricesSchedule") || "now";
    const scheduleRecurrenceType = formData.get("scheduleRecurrenceType") || "one_time";
    const scheduleRecurrenceDayOfWeek = formData.get("scheduleRecurrenceDayOfWeek") || "1";
    const scheduleRecurrenceDayOfMonth = formData.get("scheduleRecurrenceDayOfMonth") || "1";
    const changePricesAtDate = formData.get("changePricesAtDate");
    const changePricesAtTime = formData.get("changePricesAtTime");
    const revertPrices = formData.get("revertPrices") === "true";
    const revertPricesAtDate = formData.get("revertPricesAtDate");
    const revertPricesAtTime = formData.get("revertPricesAtTime");
    const csvFileName = formData.get("csvFileName") || null;

    let csvRows = [];
    if (editType === "csv-all" || editType === "csv-direct") {
      try {
        csvRows = JSON.parse(formData.get("csvRows") || "[]");
      } catch (e) {
        return Response.json({ success: false, error: "Invalid CSV data submitted." });
      }

      const csvValidation = validateCsvRowsForRun(csvRows, editType);
      if (!csvValidation.valid) {
        return Response.json({ success: false, error: csvValidation.errors[0] });
      }
    }

    if (editType !== "csv-direct") {
      const pricingErrors = validatePricingConfig({
        changePrice,
        percentType,
        percentValue,
        fixedType,
        fixedValue,
        fixedPriceAmount,
        priceFormula,
        comparePriceType,
        comparePercentType,
        comparePercentValue,
        compareFixedType,
        compareFixedValue,
        compareFixedPriceAmount,
        comparePriceFormula,
        costPriceType,
        costPercentType,
        costPercentValue,
        costFixedType,
        costFixedValue,
        costFixedPriceAmount,
      });
      if (pricingErrors.errors.length > 0) {
        return Response.json({ success: false, error: pricingErrors.errors.join(" ") });
      }
    }

    const scheduleValidation = validateScheduleConfig({
      changePricesSchedule,
      scheduleRecurrenceType,
      scheduleRecurrenceDayOfWeek,
      scheduleRecurrenceDayOfMonth,
      changePricesAtDate,
      changePricesAtTime,
      revertPrices,
      revertPricesAtDate,
      revertPricesAtTime,
      timeZone: timezone,
    });
    if (scheduleValidation.errors.length > 0) {
      return Response.json({ success: false, error: scheduleValidation.errors.join(" ") });
    }

    if (
      changePricesSchedule === "later" &&
      !isOneTimeScheduleRecurrence(scheduleRecurrenceType)
    ) {
      await assertPlanFeature(admin, session, BILLING_FEATURES.RECURRING_TASKS);
    }

    let tagsToAddList = [];
    if (addTagsActive && tagsToAddStr) {
      try {
        tagsToAddList = JSON.parse(tagsToAddStr);
      } catch (e) {
        console.error("Error parsing tagsToAdd:", e);
      }
    }

    let tagsToRemoveList = [];
    if (removeTagsActive && tagsToRemoveStr) {
      try {
        tagsToRemoveList = JSON.parse(tagsToRemoveStr);
      } catch (e) {
        console.error("Error parsing tagsToRemove:", e);
      }
    }

    const runPayload = {
      editType,
      matchType,
      conditionsStr,
      collectionId,
      changePrice,
      percentType,
      percentValue,
      fixedType,
      fixedValue,
      fixedPriceAmount,
      roundCents,
      roundCentsDigit,
      priceFormula,
      comparePriceType,
      comparePercentType,
      comparePercentValue,
      compareFixedType,
      compareFixedValue,
      compareFixedPriceAmount,
      compareRoundCents,
      compareRoundCentsDigit,
      comparePriceFormula,
      costPriceType,
      costPercentType,
      costPercentValue,
      costFixedType,
      costFixedValue,
      costFixedPriceAmount,
      costRoundCents,
      costRoundCentsDigit,
      addTagsActive,
      removeTagsActive,
      tagsToAddList,
      tagsToRemoveList,
      csvFileName,
      csvRows,
    };

    const scheduledAt = scheduleValidation.scheduledAt;
    const revertAt = scheduleValidation.revertAt;

    if (changePricesSchedule === "later") {
      try {
        await prisma.task.create({
          data: {
            id: taskName,
            name: taskName,
            status: "scheduled",
            shop,
            scheduledAt,
            revertAt: revertPrices ? revertAt : null,
            processedItems: 0,
            totalItems: 0,
            actionDetails: JSON.stringify({
              taskType: "scheduled_edit",
              scheduleRecurrenceType,
              scheduleRecurrenceDayOfWeek,
              scheduleRecurrenceDayOfMonth,
              changePricesAtDate,
              changePricesAtTime,
              scheduleTimezone: timezone,
              runPayload,
              revertEnabled: revertPrices,
              revertPricesAtDate,
              revertPricesAtTime,
              scheduledAt: scheduledAt.toISOString(),
              revertAt: revertAt?.toISOString() || null,
            }),
          },
        });

        if (revertPrices && revertAt) {
          await createScheduledRevertTask({
            shop,
            sourceTaskId: taskName,
            sourceTaskName: taskName,
            revertAt,
            revertPricesAtDate,
            revertPricesAtTime,
            scheduleTimezone: timezone,
          });
        }

        if (changePricesSchedule === "later") {
          await ensureShopTimezoneSaved({ shop, timezone, admin });
        }
      } catch (e) {
        console.error("Failed to create scheduled task:", e);
        return Response.json({ success: false, error: "Failed to schedule task" });
      }

      return Response.json({
        success: true,
        scheduled: true,
        taskId: taskName,
        taskName,
        scheduledAt: scheduledAt.toISOString(),
        revertAt: revertAt?.toISOString() || null,
      });
    }

    try {
      await prisma.task.create({
        data: {
          id: taskName,
          name: taskName,
          status: "running",
          shop,
          scheduledAt,
          revertAt: revertPrices ? revertAt : null,
          processedItems: 0,
          totalItems: 0,
          actionDetails: JSON.stringify({
            taskType: "price_edit",
            runPayload,
            revertEnabled: revertPrices,
            scheduledAt: scheduledAt.toISOString(),
            revertAt: revertAt?.toISOString() || null,
          }),
        },
      });
    } catch (e) {
      console.error("Failed to create task log in database:", e);
    }

    executePriceEditTask({
      admin,
      taskId: taskName,
      runPayload,
    })
      .then(async (result) => {
        if (result.success && revertPrices && revertAt) {
          await createScheduledRevertTask({
            shop,
            sourceTaskId: taskName,
            sourceTaskName: taskName,
            revertAt,
            revertPricesAtDate,
            revertPricesAtTime,
            scheduleTimezone: timezone,
          });
        }
      })
      .catch((err) => {
        console.error("Failed to execute background task:", err);
      });

    return Response.json({
      success: true,
      taskStarted: true,
      taskId: taskName,
      taskName,
    });
  }

  return Response.json({ success: false, products: [] });
};

function createInitialScheduleState(timezone) {
  const start = getDefaultScheduleDateTime(60, timezone);
  const revert = getDefaultRevertDateTime(start, 24, timezone);
  return {
    startDate: start,
    startDateStr: formatDateMDY(start, timezone),
    startTimeStr: formatTime12Hour(start, timezone),
    revertDate: revert,
    revertDateStr: formatDateMDY(revert, timezone),
    revertTimeStr: formatTime12Hour(revert, timezone),
  };
}

export default function NewTask() {
  const fetcher = useFetcher();
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const navigate = useNavigate();
  const appBridge = useAppBridge();
  const { collections, locations, shop, timezone, hasSavedTimezone } = useLoaderData();
  const scheduleTimezone = useMemo(
    () => resolveClientScheduleTimezone({ loaderTimezone: timezone, hasSavedTimezone }),
    [timezone, hasSavedTimezone]
  );

  const initialSchedule = useMemo(
    () => createInitialScheduleState(scheduleTimezone),
    [scheduleTimezone]
  );
  const [matchType, setMatchType] = useState("all");
  const [conditions, setConditions] = useState([
    { field: "title", operator: "equals", value: "" }
  ]);
  const [showPricePreview, setShowPricePreview] = useState(false);
  const [productsList, setProductsList] = useState([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [csvFileName, setCsvFileName] = useState(null);
  const [csvRows, setCsvRows] = useState([]);
  const [productSearchError, setProductSearchError] = useState("");
  const csvFileInputRef = useRef(null);

  // Section 2 States
  const [changePrice, setChangePrice] = useState("1");
  const [percentType, setPercentType] = useState("1");
  const [percentValue, setPercentValue] = useState("");
  const [fixedType, setFixedType] = useState("3");
  const [fixedValue, setFixedValue] = useState("");
  const [roundCents, setRoundCents] = useState("1");
  const [roundCentsDigit, setRoundCentsDigit] = useState("");
  const [comparePriceType, setComparePriceType] = useState("6");
  const [costPriceType, setCostPriceType] = useState("6");
  const [fixedPriceAmount, setFixedPriceAmount] = useState("");
  const [priceFormula, setPriceFormula] = useState("price * 1.1");
  const [comparePriceFormula, setComparePriceFormula] = useState("price * 1.2");

  const [comparePercentType, setComparePercentType] = useState("1");
  const [comparePercentValue, setComparePercentValue] = useState("");
  const [compareFixedType, setCompareFixedType] = useState("3");
  const [compareFixedValue, setCompareFixedValue] = useState("");
  const [compareFixedPriceAmount, setCompareFixedPriceAmount] = useState("");
  const [compareRoundCents, setCompareRoundCents] = useState("1");
  const [compareRoundCentsDigit, setCompareRoundCentsDigit] = useState("");

  const [costPercentType, setCostPercentType] = useState("1");
  const [costPercentValue, setCostPercentValue] = useState("");
  const [costFixedType, setCostFixedType] = useState("3");
  const [costFixedValue, setCostFixedValue] = useState("");
  const [costFixedPriceAmount, setCostFixedPriceAmount] = useState("");
  const [costRoundCents, setCostRoundCents] = useState("1");
  const [costRoundCentsDigit, setCostRoundCentsDigit] = useState("");

  const [fieldErrors, setFieldErrors] = useState({});

  // Section 4 States
  const [addTagsActive, setAddTagsActive] = useState(true);
  const [removeTagsActive, setRemoveTagsActive] = useState(true);
  const [tagToAddInput, setTagToAddInput] = useState("");
  const [tagsToAdd, setTagsToAdd] = useState([]);
  const [tagToRemoveInput, setTagToRemoveInput] = useState("");
  const [tagsToRemove, setTagsToRemove] = useState([]);

  // Section 1 States
  const [editType, setEditType] = useState("all");
  const [scheduleType, setScheduleType] = useState("now"); // "now" or "later"
  const [scheduleRecurrenceType, setScheduleRecurrenceType] = useState("one_time");
  const [scheduleRecurrenceDayOfWeek, setScheduleRecurrenceDayOfWeek] = useState("1");
  const [scheduleRecurrenceDayOfMonth, setScheduleRecurrenceDayOfMonth] = useState("1");
  const [revertLater, setRevertLater] = useState(false);
  
  // Left Column States (Start pricing schedule)
  const [startDate, setStartDate] = useState(initialSchedule.startDate);
  const [startDateStr, setStartDateStr] = useState(initialSchedule.startDateStr);
  const [startTimeStr, setStartTimeStr] = useState(initialSchedule.startTimeStr);

  const [revertDate, setRevertDate] = useState(initialSchedule.revertDate);
  const [revertDateStr, setRevertDateStr] = useState(initialSchedule.revertDateStr);
  const [revertTimeStr, setRevertTimeStr] = useState(initialSchedule.revertTimeStr);

  // Timezone and live clock states
  const [currentTimeStr, setCurrentTimeStr] = useState(() =>
    formatCurrentTimeInTimezone(scheduleTimezone)
  );
  const timezoneStr = scheduleTimezone;

  const [taskName, setTaskName] = useState(() => "sale-" + Math.floor(1000000000 + Math.random() * 9000000000));

  useEffect(() => {
    const copyData = readStoredTaskCopy();
    if (copyData) {
      applyStoredTaskCopy(copyData, {
        setEditType,
        setMatchType,
        setConditions,
        setSelectedCollectionId,
        setCsvFileName,
        setCsvRows,
        setChangePrice,
        setPercentType,
        setPercentValue,
        setFixedType,
        setFixedValue,
        setFixedPriceAmount,
        setRoundCents,
        setRoundCentsDigit,
        setPriceFormula,
        setComparePriceType,
        setComparePercentType,
        setComparePercentValue,
        setCompareFixedType,
        setCompareFixedValue,
        setCompareFixedPriceAmount,
        setCompareRoundCents,
        setCompareRoundCentsDigit,
        setComparePriceFormula,
        setCostPriceType,
        setCostPercentType,
        setCostPercentValue,
        setCostFixedType,
        setCostFixedValue,
        setCostFixedPriceAmount,
        setCostRoundCents,
        setCostRoundCentsDigit,
        setTagsToAdd,
        setTagsToRemove,
        setAddTagsActive,
        setRemoveTagsActive,
        setTaskName,
        setRevertLater,
      });

      const payload = copyData.runPayload;
      if (
        (payload?.editType === "csv-all" || payload?.editType === "csv-direct") &&
        Array.isArray(payload.csvRows) &&
        payload.csvRows.length > 0
      ) {
        fetcherRef.current.submit(
          {
            intent: "search",
            editType: payload.editType,
            matchType: payload.matchType || "all",
            conditions: payload.conditionsStr || "[]",
            collectionId: payload.collectionId || "",
            csvRows: JSON.stringify(payload.csvRows),
          },
          { method: "POST" },
        );
      }
      return;
    }

    const savedPricingRules = loadSavedPricingRules(shop);
    if (savedPricingRules) {
      applySavedPricingRules(savedPricingRules, {
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
      });
    }
  }, [shop]);

  useEffect(() => {
    const updateTime = () => {
      setCurrentTimeStr(formatCurrentTimeInTimezone(scheduleTimezone));
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, [scheduleTimezone]);

  const handleStartDateChange = (val) => {
    setStartDateStr(val);
    const parsed = parseDateString(val, scheduleTimezone);
    if (parsed) setStartDate(parsed);
  };

  const handleRevertDateChange = (val) => {
    setRevertDateStr(val);
    const parsed = parseDateString(val, scheduleTimezone);
    if (parsed) setRevertDate(parsed);
  };

  const handleStartDateSelect = (date) => {
    setStartDate(date);
    setStartDateStr(formatDateMDY(date, scheduleTimezone));
  };

  const handleRevertDateSelect = (date) => {
    setRevertDate(date);
    setRevertDateStr(formatDateMDY(date, scheduleTimezone));
  };

  useEffect(() => {
    if (!fetcher.data) return;

    if (fetcher.data.success) {
      const products = fetcher.data.products || [];
      setProductsList(products);
      setProductSearchError("");
      setShowPricePreview(true);
      if (fetcher.data.warnings?.length) {
        const warningCount = fetcher.data.warnings.length;
        const firstWarning = fetcher.data.warnings[0];
        appBridge.toast.show(
          warningCount === 1
            ? firstWarning
            : `${firstWarning} (+${warningCount - 1} more warning${warningCount - 1 === 1 ? "" : "s"})`,
        );
      }
      return;
    }

    setProductsList([]);
    setShowPricePreview(false);
    setProductSearchError(
      fetcher.data.error || "No products found matching your criteria."
    );
  }, [fetcher.data, appBridge]);

  useEffect(() => {
    if (collections.length > 0 && !selectedCollectionId) {
      setSelectedCollectionId(collections[0].id);
    }
  }, [collections, selectedCollectionId]);

  const runFetcher = useFetcher();

  useEffect(() => {
    if (!runFetcher.data?.success || !runFetcher.data.taskId) return;

    if (runFetcher.data.taskStarted) {
      localStorage.setItem("price_flex_active_task_id", runFetcher.data.taskId);
      navigate(`/app?taskId=${encodeURIComponent(runFetcher.data.taskId)}`);
      return;
    }

    if (runFetcher.data.scheduled) {
      navigate("/app/scheduled");
    }
  }, [navigate, runFetcher.data]);

  const clearFieldError = (key) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSavePricingRules = () => {
    const validation = validatePricingConfig({
      changePrice,
      percentType,
      percentValue,
      fixedType,
      fixedValue,
      fixedPriceAmount,
      priceFormula,
      comparePriceType,
      comparePercentType,
      comparePercentValue,
      compareFixedType,
      compareFixedValue,
      compareFixedPriceAmount,
      comparePriceFormula,
      costPriceType,
      costPercentType,
      costPercentValue,
      costFixedType,
      costFixedValue,
      costFixedPriceAmount,
    });

    if (validation.errors.length > 0) {
      setFieldErrors(validation.fieldErrors);
      appBridge.toast.show(validation.errors[0], { isError: true });
      return;
    }

    setFieldErrors({});
    savePricingRules(
      shop,
      buildPricingRulesSnapshot({
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
      })
    );
    appBridge.toast.show("Pricing rules saved");
  };

  const handleRunTask = () => {
    const withPendingTag = (tags, input) => {
      const pendingTag = input.trim();
      if (!pendingTag || tags.includes(pendingTag)) return tags;
      return [...tags, pendingTag];
    };
    const effectiveTagsToAdd = withPendingTag(tagsToAdd, tagToAddInput);
    const effectiveTagsToRemove = withPendingTag(tagsToRemove, tagToRemoveInput);

    const { fieldErrors: nextFieldErrors, messages } = validateRunTaskForm({
      shop,
      timezone: scheduleTimezone,
      editType,
      matchType,
      conditions,
      productsList,
      csvFileName,
      csvRows,
      selectedCollectionId,
      changePrice,
      percentType,
      percentValue,
      fixedType,
      fixedValue,
      fixedPriceAmount,
      roundCents,
      roundCentsDigit,
      priceFormula,
      comparePriceType,
      comparePercentType,
      comparePercentValue,
      compareFixedType,
      compareFixedValue,
      compareFixedPriceAmount,
      compareRoundCents,
      compareRoundCentsDigit,
      comparePriceFormula,
      costPriceType,
      costPercentType,
      costPercentValue,
      costFixedType,
      costFixedValue,
      costFixedPriceAmount,
      costRoundCents,
      costRoundCentsDigit,
      taskName,
      scheduleType,
      scheduleRecurrenceType,
      scheduleRecurrenceDayOfWeek,
      scheduleRecurrenceDayOfMonth,
      startDateStr,
      startTimeStr,
      revertLater,
      revertDateStr,
      revertTimeStr,
      addTagsActive,
      removeTagsActive,
      tagsToAdd: effectiveTagsToAdd,
      tagsToRemove: effectiveTagsToRemove,
      tagToAddInput,
      tagToRemoveInput,
    });

    if (messages.length > 0) {
      setFieldErrors(nextFieldErrors);
      appBridge.toast.show(messages[0], { isError: true });
      return;
    }

    setFieldErrors({});

    const payload = {
      intent: "run_task",
      editType,
      matchType,
      conditions: JSON.stringify(conditions),
      collectionId: selectedCollectionId,
      csvFileName: csvFileName || "",
      csvRows: JSON.stringify(csvRows),
      changePrice,
      percentType,
      percentValue,
      fixedType,
      fixedValue,
      fixedPriceAmount,
      roundCents,
      roundCentsDigit,
      priceFormula,
      comparePriceType,
      comparePercentType,
      comparePercentValue,
      compareFixedType,
      compareFixedValue,
      compareFixedPriceAmount,
      compareRoundCents,
      compareRoundCentsDigit,
      comparePriceFormula,
      costPriceType,
      costPercentType,
      costPercentValue,
      costFixedType,
      costFixedValue,
      costFixedPriceAmount,
      costRoundCents,
      costRoundCentsDigit,
      addTagsActive: addTagsActive ? "true" : "false",
      removeTagsActive: removeTagsActive ? "true" : "false",
      tagsToAdd: JSON.stringify(effectiveTagsToAdd),
      tagsToRemove: JSON.stringify(effectiveTagsToRemove),
      taskName,
      browserTimezone: getBrowserTimezone(),
      scheduleTimezone,
      changePricesSchedule: scheduleType,
      scheduleRecurrenceType,
      scheduleRecurrenceDayOfWeek,
      scheduleRecurrenceDayOfMonth,
      changePricesAtDate: startDateStr,
      changePricesAtTime: startTimeStr,
      revertPrices: revertLater ? "true" : "false",
      revertPricesAtDate: revertDateStr,
      revertPricesAtTime: revertTimeStr,
    };
    runFetcher.submit(payload, { method: "POST" });
  };

  const addCondition = () => {
    setConditions([...conditions, { field: "title", operator: "equals", value: "" }]);
  };

  const removeCondition = (index) => {
    if (conditions.length > 1) {
      setConditions(conditions.filter((_, i) => i !== index));
    } else {
      setConditions([{ field: "title", operator: "equals", value: "" }]);
    }
  };

  const handleConditionChange = (index, key, val) => {
    const updated = [...conditions];
    updated[index][key] = val;

    if (key === "field") {
      if (!isOperatorAllowedForField(val, updated[index].operator)) {
        updated[index].operator = getDefaultOperatorForField(val);
      }
      if (!isValueAllowedForField(val, updated[index].value, collections)) {
        updated[index].value = getDefaultValueForField(val, collections);
      }
    }

    setConditions(updated);
    if (productSearchError) setProductSearchError("");
  };

  const handleEditTypeChange = (nextEditType) => {
    setEditType(nextEditType);
    setProductSearchError("");
    setCsvFileName(null);
    setCsvRows([]);
    setProductsList([]);
    setShowPricePreview(false);
    if (nextEditType === "collection" && collections.length > 0 && !selectedCollectionId) {
      setSelectedCollectionId(collections[0].id);
    }
  };

  const handleCollectionChange = (collectionId) => {
    setSelectedCollectionId(collectionId);
    if (productSearchError) setProductSearchError("");
  };

  const handleScheduleRecurrenceTypeChange = (nextType) => {
    setScheduleRecurrenceType(nextType);
    clearFieldError("scheduleRecurrenceDay");
    clearFieldError("scheduleRecurrenceDate");
    clearFieldError("startTimeStr");
    clearFieldError("startDateStr");
  };

  const validateProductSearch = () => {
    if (editType === "conditions") {
      const hasIncompleteCondition = conditions.some(
        (condition) =>
          !condition.field ||
          !condition.operator ||
          !String(condition.value ?? "").trim()
      );

      if (hasIncompleteCondition) {
        return "Please complete all product condition fields before searching.";
      }
    }

    if (editType === "collection" && !selectedCollectionId) {
      return "Please select a collection before searching.";
    }

    if ((editType === "csv-all" || editType === "csv-direct") && !csvRows.length) {
      return "Please upload a CSV file before loading products.";
    }

    return "";
  };

  const handleCsvFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    clearFieldError("csvFile");
    setProductSearchError("");
    setProductsList([]);
    setShowPricePreview(false);

    try {
      const text = await file.text();
      const parsed =
        editType === "csv-direct" ? parseCsvDirectRows(text) : parseCsvAllRows(text);

      if (parsed.errors.length > 0) {
        setCsvFileName(null);
        setCsvRows([]);
        setFieldErrors((current) => ({ ...current, csvFile: parsed.errors[0] }));
        appBridge.toast.show(parsed.errors[0], { isError: true });
        return;
      }

      setCsvFileName(file.name);
      setCsvRows(parsed.rows);
      setFieldErrors((current) => {
        const next = { ...current };
        delete next.csvFile;
        delete next.productSearch;
        return next;
      });
      setProductSearchError("");
      setShowPricePreview(false);
      fetcher.submit(
        {
          intent: "search",
          editType,
          matchType,
          conditions: JSON.stringify(conditions),
          collectionId: selectedCollectionId,
          csvRows: JSON.stringify(parsed.rows),
        },
        { method: "POST" },
      );
    } catch (error) {
      setCsvFileName(null);
      setCsvRows([]);
      appBridge.toast.show(error.message || "Failed to read CSV file.", { isError: true });
    } finally {
      e.target.value = "";
    }
  };

  const handleSearch = () => {
    const validationError = validateProductSearch();
    if (validationError) {
      setProductsList([]);
      setShowPricePreview(false);
      setProductSearchError(validationError);
      return;
    }

    setProductSearchError("");
    setShowPricePreview(false);
    const payload = {
      intent: "search",
      editType,
      matchType,
      conditions: JSON.stringify(conditions),
      collectionId: selectedCollectionId,
      csvRows: JSON.stringify(csvRows),
    };
    fetcher.submit(payload, { method: "POST" });
  };

  const previewVariants = useMemo(() => {
    if (!productsList.length) return [];

    const findCsvRow = (variant) =>
      csvRows.find((row) => {
        if (row.variantId && row.variantId === variant.id) return true;
        return (
          row.sku &&
          String(row.sku).toLowerCase() === String(variant.sku || "").toLowerCase()
        );
      });

    const pricingParams = {
      changePrice,
      percentType,
      percentValue,
      fixedType,
      fixedValue,
      fixedPriceAmount,
      roundCents,
      roundCentsDigit,
      priceFormula,
      comparePriceType,
      comparePercentType,
      comparePercentValue,
      compareFixedType,
      compareFixedValue,
      compareFixedPriceAmount,
      compareRoundCents,
      compareRoundCentsDigit,
      comparePriceFormula,
      costPriceType,
      costPercentType,
      costPercentValue,
      costFixedType,
      costFixedValue,
      costFixedPriceAmount,
      costRoundCents,
      costRoundCentsDigit,
    };

    const items = [];
    for (const product of productsList) {
      const variants = product.variants?.nodes || product.variants || [];
      for (const variant of variants) {
        const originalPrice = parseFloat(variant.price) || 0;
        const hasCompare = variant.compareAtPrice != null && variant.compareAtPrice !== "";
        const hasCost =
          variant.inventoryItem?.unitCost?.amount != null &&
          variant.inventoryItem.unitCost.amount !== "";
        const originalCompare = hasCompare ? parseFloat(variant.compareAtPrice) : 0;
        const originalCost = hasCost ? parseFloat(variant.inventoryItem.unitCost.amount) : 0;
        const csvRow = editType === "csv-direct" ? findCsvRow(variant) : null;

        if (csvRow) {
          items.push({
            id: variant.id,
            title: buildVariantDisplayTitle(product.title, variant.title),
            imageUrl: variant.image?.url || product.featuredImage?.url || PLACEHOLDER_IMAGE,
            currentPrice: originalPrice,
            newPrice: csvRow.newPrice !== undefined ? csvRow.newPrice : originalPrice,
            hasCompare: csvRow.newCompare !== undefined ? true : hasCompare,
            currentCompare: originalCompare,
            newCompare:
              csvRow.newCompare !== undefined ? csvRow.newCompare : hasCompare ? originalCompare : null,
            hasCost: csvRow.newCost !== undefined ? true : hasCost,
            currentCost: originalCost,
            newCost: csvRow.newCost !== undefined ? csvRow.newCost ?? 0 : originalCost,
          });
          continue;
        }

        const result = calculateVariantPricing({
          ...pricingParams,
          originalPrice,
          originalCompare,
          originalCost,
          hasCompare,
          hasCost,
        });

        items.push({
          id: variant.id,
          title: buildVariantDisplayTitle(product.title, variant.title),
          imageUrl: variant.image?.url || product.featuredImage?.url || PLACEHOLDER_IMAGE,
          currentPrice: originalPrice,
          newPrice: result.newPrice,
          hasCompare,
          currentCompare: originalCompare,
          newCompare: result.newCompare,
          hasCost,
          currentCost: originalCost,
          newCost: result.newCost,
        });
      }
    }

    return items;
  }, [
    productsList,
    csvRows,
    editType,
    changePrice,
    percentType,
    percentValue,
    fixedType,
    fixedValue,
    fixedPriceAmount,
    roundCents,
    roundCentsDigit,
    priceFormula,
    comparePriceType,
    comparePercentType,
    comparePercentValue,
    compareFixedType,
    compareFixedValue,
    compareFixedPriceAmount,
    compareRoundCents,
    compareRoundCentsDigit,
    comparePriceFormula,
    costPriceType,
    costPercentType,
    costPercentValue,
    costFixedType,
    costFixedValue,
    costFixedPriceAmount,
    costRoundCents,
    costRoundCentsDigit,
  ]);

  const handleTagToAddKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTagToAddFromInput();
    }
  };

  const addTagToAddFromInput = () => {
    const val = tagToAddInput.trim();
    if (val && !tagsToAdd.includes(val)) {
      setTagsToAdd([...tagsToAdd, val]);
    }
    setTagToAddInput("");
  };

  const removeTagToAdd = (tagToRemove) => {
    setTagsToAdd(tagsToAdd.filter((t) => t !== tagToRemove));
  };

  const handleTagToRemoveKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTagToRemoveFromInput();
    }
  };

  const addTagToRemoveFromInput = () => {
    const val = tagToRemoveInput.trim();
    if (val && !tagsToRemove.includes(val)) {
      setTagsToRemove([...tagsToRemove, val]);
    }
    setTagToRemoveInput("");
  };

  const removeTagToRemove = (tagToRemove) => {
    setTagsToRemove(tagsToRemove.filter((t) => t !== tagToRemove));
  };

  return (
    <s-page heading="New Task">
      {runFetcher.data && runFetcher.data.success && runFetcher.data.scheduled && (
        <s-banner tone="success">
          Task "{runFetcher.data.taskName}" scheduled for{" "}
          {formatScheduleDateTime(runFetcher.data.scheduledAt, scheduleTimezone)}
          {runFetcher.data.revertAt
            ? ` with automatic revert at ${formatScheduleDateTime(runFetcher.data.revertAt, scheduleTimezone)}.`
            : "."}
        </s-banner>
      )}
      {runFetcher.data && runFetcher.data.success && !runFetcher.data.scheduled && (
        <s-banner tone="success">
          Successfully executed task "{taskName}". Updated {runFetcher.data.updatedProductsCount} product(s) and {runFetcher.data.updatedVariantsCount} variant(s).
        </s-banner>
      )}
      {runFetcher.data && !runFetcher.data.success && (
        <s-banner tone="critical">
          Failed to execute task: {runFetcher.data.error || "Unknown error occurred"}
        </s-banner>
      )}
      <TaskConfigurationForm
        collections={collections}
        locations={locations}
        csvFileInputRef={csvFileInputRef}
        values={{
          editType,
          matchType,
          conditions,
          selectedCollectionId,
          csvFileName,
          csvRowCount: csvRows.length,
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
          startDateStr,
          startTimeStr,
          startDate,
          revertDateStr,
          revertTimeStr,
          revertDate,
          taskName,
        }}
        handlers={{
          setEditType: handleEditTypeChange,
          setSelectedCollectionId: handleCollectionChange,
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
          setScheduleRecurrenceType: handleScheduleRecurrenceTypeChange,
          setScheduleRecurrenceDayOfWeek,
          setScheduleRecurrenceDayOfMonth,
          setRevertLater,
          setStartTimeStr,
          handleStartDateChange,
          handleStartDateSelect,
          setRevertTimeStr,
          handleRevertDateChange,
          handleRevertDateSelect,
          setTaskName,
          handleSavePricingRules,
          handleRunTask,
        }}
        isSearching={fetcher.state === "submitting" || fetcher.state === "loading"}
        isRunning={runFetcher.state === "submitting" || runFetcher.state === "loading"}
        productSearchError={productSearchError}
        fieldErrors={fieldErrors}
        clearFieldError={clearFieldError}
        timezoneStr={timezoneStr}
        hasSavedTimezone={hasSavedTimezone}
        currentTimeStr={currentTimeStr}
      />
      <PriceChangePreview
        key={editType}
        previewVariants={previewVariants}
        open={showPricePreview}
        onClose={() => setShowPricePreview(false)}
      />
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
