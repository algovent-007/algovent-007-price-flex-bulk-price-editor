import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
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
  filterProductsByConditions,
} from "../services/task-runner.server";
import { createScheduledRevertTask } from "../services/scheduler.server";
import TaskConfigurationForm from "../components/new-task/TaskConfigurationForm";
import { PLACEHOLDER_IMAGE, buildVariantDisplayTitle } from "../components/new-task/constants";
import { applyStoredTaskCopy, readStoredTaskCopy } from "../utils/copy-task";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  try {
    const response = await admin.graphql(
      `#graphql
      query getCollections {
        collections(first: 250, sortKey: TITLE) {
          nodes {
            id
            title
          }
        }
      }`
    );
    const json = await response.json();
    if (json.errors) {
      throw new Error(json.errors[0].message);
    }
    return { collections: json.data?.collections?.nodes || [] };
  } catch (err) {
    console.error("Error fetching collections:", err);
    return { collections: [] };
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
    const queryStr = buildProductQuery(editType, matchType, conditionsStr, collectionId);

    if (editType === "collection" && !collectionId) {
      return Response.json({
        success: false,
        products: [],
        error: "Please select a collection",
      });
    }

    try {
      const data = await shopifyQuery(
        `#graphql
        query getProducts($query: String) {
          products(first: 50, query: $query) {
            nodes {
              id
              title
              featuredImage {
                url
              }
              variants(first: 100) {
                nodes {
                  id
                  title
                  price
                  compareAtPrice
                  image {
                    url
                  }
                  inventoryItem {
                    unitCost {
                      amount
                    }
                  }
                }
              }
            }
          }
        }`,
        {
          query: queryStr || null,
        }
      );

      const products = filterProductsByConditions(
        data.products?.nodes || [],
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
    const priceFormula = formData.get("priceFormula") || "";

    const comparePriceType = formData.get("comparePriceType");
    const comparePercentType = formData.get("comparePercentType");
    const comparePercentValue = formData.get("comparePercentValue");
    const compareFixedType = formData.get("compareFixedType");
    const compareFixedValue = formData.get("compareFixedValue");
    const compareFixedPriceAmount = formData.get("compareFixedPriceAmount");
    const compareRoundCents = formData.get("compareRoundCents");
    const comparePriceFormula = formData.get("comparePriceFormula") || "";

    const costPriceType = formData.get("costPriceType");
    const costPercentType = formData.get("costPercentType");
    const costPercentValue = formData.get("costPercentValue");
    const costFixedType = formData.get("costFixedType");
    const costFixedValue = formData.get("costFixedValue");
    const costFixedPriceAmount = formData.get("costFixedPriceAmount");
    const costRoundCents = formData.get("costRoundCents");

    const addTagsActive = formData.get("addTagsActive") === "true";
    const removeTagsActive = formData.get("removeTagsActive") === "true";
    const tagsToAddStr = formData.get("tagsToAdd");
    const tagsToRemoveStr = formData.get("tagsToRemove");
    const taskName = formData.get("taskName") || "sale-" + Math.floor(1000000000 + Math.random() * 9000000000);

    const changePricesSchedule = formData.get("changePricesSchedule") || "now";
    const changePricesAtDate = formData.get("changePricesAtDate");
    const changePricesAtTime = formData.get("changePricesAtTime");
    const revertPrices = formData.get("revertPrices") === "true";
    const revertPricesAtDate = formData.get("revertPricesAtDate");
    const revertPricesAtTime = formData.get("revertPricesAtTime");

    const pricingErrors = validatePricingConfig({
      changePrice,
      fixedPriceAmount,
      priceFormula,
      comparePriceType,
      compareFixedPriceAmount,
      comparePriceFormula,
      costPriceType,
      costFixedPriceAmount,
    });
    if (pricingErrors.length > 0) {
      return Response.json({ success: false, error: pricingErrors.join(" ") });
    }

    const scheduleValidation = validateScheduleConfig({
      changePricesSchedule,
      changePricesAtDate,
      changePricesAtTime,
      revertPrices,
      revertPricesAtDate,
      revertPricesAtTime,
    });
    if (scheduleValidation.errors.length > 0) {
      return Response.json({ success: false, error: scheduleValidation.errors.join(" ") });
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
      priceFormula,
      comparePriceType,
      comparePercentType,
      comparePercentValue,
      compareFixedType,
      compareFixedValue,
      compareFixedPriceAmount,
      compareRoundCents,
      comparePriceFormula,
      costPriceType,
      costPercentType,
      costPercentValue,
      costFixedType,
      costFixedValue,
      costFixedPriceAmount,
      costRoundCents,
      addTagsActive,
      removeTagsActive,
      tagsToAddList,
      tagsToRemoveList,
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
              runPayload,
              revertEnabled: revertPrices,
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
          });
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

function createInitialScheduleState() {
  const start = getDefaultScheduleDateTime(60);
  const revert = getDefaultRevertDateTime(start, 24);
  return {
    startDate: start,
    startDateStr: formatDateMDY(start),
    startTimeStr: formatTime12Hour(start),
    revertDate: revert,
    revertDateStr: formatDateMDY(revert),
    revertTimeStr: formatTime12Hour(revert),
  };
}

export default function NewTask() {
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const { collections } = useLoaderData();

  // Section 1 States
  const [editType, setEditType] = useState("all");
  const [matchType, setMatchType] = useState("all");
  const [conditions, setConditions] = useState([
    { field: "title", operator: "equals", value: "" }
  ]);
  const [searchResults, setSearchResults] = useState(null);
  const [productsList, setProductsList] = useState([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [csvFileName, setCsvFileName] = useState(null);
  const [productSearchError, setProductSearchError] = useState("");
  const csvFileInputRef = useRef(null);

  // Section 2 States
  const [changePrice, setChangePrice] = useState("1");
  const [percentType, setPercentType] = useState("1");
  const [percentValue, setPercentValue] = useState("");
  const [fixedType, setFixedType] = useState("3");
  const [fixedValue, setFixedValue] = useState("");
  const [roundCents, setRoundCents] = useState("1");
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

  const [costPercentType, setCostPercentType] = useState("1");
  const [costPercentValue, setCostPercentValue] = useState("");
  const [costFixedType, setCostFixedType] = useState("3");
  const [costFixedValue, setCostFixedValue] = useState("");
  const [costFixedPriceAmount, setCostFixedPriceAmount] = useState("");
  const [costRoundCents, setCostRoundCents] = useState("1");

  const [pricingValidationError, setPricingValidationError] = useState("");

  // Section 4 States
  const [addTagsActive, setAddTagsActive] = useState(true);
  const [removeTagsActive, setRemoveTagsActive] = useState(true);
  const [tagToAddInput, setTagToAddInput] = useState("");
  const [tagsToAdd, setTagsToAdd] = useState([]);
  const [tagToRemoveInput, setTagToRemoveInput] = useState("");
  const [tagsToRemove, setTagsToRemove] = useState([]);

  const initialSchedule = useMemo(() => createInitialScheduleState(), []);

  // Section 5 States
  const [scheduleType, setScheduleType] = useState("now"); // "now" or "later"
  const [revertLater, setRevertLater] = useState(false);
  
  // Left Column States (Start pricing schedule)
  const [startDate, setStartDate] = useState(initialSchedule.startDate);
  const [startDateStr, setStartDateStr] = useState(initialSchedule.startDateStr);
  const [startTimeStr, setStartTimeStr] = useState(initialSchedule.startTimeStr);

  const [revertDate, setRevertDate] = useState(initialSchedule.revertDate);
  const [revertDateStr, setRevertDateStr] = useState(initialSchedule.revertDateStr);
  const [revertTimeStr, setRevertTimeStr] = useState(initialSchedule.revertTimeStr);

  // Timezone and live clock states
  const [currentTimeStr, setCurrentTimeStr] = useState("");
  const [timezoneStr, setTimezoneStr] = useState("Asia/Calcutta");

  const [taskName, setTaskName] = useState(() => "sale-" + Math.floor(1000000000 + Math.random() * 9000000000));

  useEffect(() => {
    const copyData = readStoredTaskCopy();
    if (!copyData) return;

    applyStoredTaskCopy(copyData, {
      setEditType,
      setMatchType,
      setConditions,
      setSelectedCollectionId,
      setChangePrice,
      setPercentType,
      setPercentValue,
      setFixedType,
      setFixedValue,
      setFixedPriceAmount,
      setRoundCents,
      setPriceFormula,
      setComparePriceType,
      setComparePercentType,
      setComparePercentValue,
      setCompareFixedType,
      setCompareFixedValue,
      setCompareFixedPriceAmount,
      setCompareRoundCents,
      setComparePriceFormula,
      setCostPriceType,
      setCostPercentType,
      setCostPercentValue,
      setCostFixedType,
      setCostFixedValue,
      setCostFixedPriceAmount,
      setCostRoundCents,
      setTagsToAdd,
      setTagsToRemove,
      setAddTagsActive,
      setRemoveTagsActive,
      setTaskName,
      setRevertLater,
    });
  }, []);

  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setTimezoneStr(tz);
    } catch (e) {
      setTimezoneStr("Asia/Calcutta");
    }

    const updateTime = () => {
      const now = new Date();
      const hrs = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      setCurrentTimeStr(`${hrs}:${mins}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleStartDateChange = (val) => {
    setStartDateStr(val);
    const parsed = parseDateString(val);
    if (parsed) setStartDate(parsed);
  };

  const handleRevertDateChange = (val) => {
    setRevertDateStr(val);
    const parsed = parseDateString(val);
    if (parsed) setRevertDate(parsed);
  };

  const handleStartDateSelect = (date) => {
    setStartDate(date);
    setStartDateStr(formatDateMDY(date));
  };

  const handleRevertDateSelect = (date) => {
    setRevertDate(date);
    setRevertDateStr(formatDateMDY(date));
  };

  useEffect(() => {
    if (fetcher.data && fetcher.data.success) {
      setProductsList(fetcher.data.products || []);
      setSearchResults(`Found ${fetcher.data.products?.length || 0} products matching your criteria.`);
    } else if (fetcher.data && !fetcher.data.success) {
      setProductsList([]);
      setSearchResults(`Found 0 products matching your criteria.`);
    }
  }, [fetcher.data]);

  useEffect(() => {
    if (collections.length > 0 && !selectedCollectionId) {
      setSelectedCollectionId(collections[0].id);
    }
  }, [collections, selectedCollectionId]);

  const runFetcher = useFetcher();

  useEffect(() => {
    if (!runFetcher.data?.success || !runFetcher.data.taskId) return;

    localStorage.setItem("price_flex_active_task_id", runFetcher.data.taskId);
    navigate(`/app?taskId=${encodeURIComponent(runFetcher.data.taskId)}`);
  }, [navigate, runFetcher.data]);

  const handleRunTask = () => {
    const withPendingTag = (tags, input) => {
      const pendingTag = input.trim();
      if (!pendingTag || tags.includes(pendingTag)) return tags;
      return [...tags, pendingTag];
    };
    const effectiveTagsToAdd = withPendingTag(tagsToAdd, tagToAddInput);
    const effectiveTagsToRemove = withPendingTag(tagsToRemove, tagToRemoveInput);

    const errors = validatePricingConfig({
      changePrice,
      fixedPriceAmount,
      priceFormula,
      comparePriceType,
      compareFixedPriceAmount,
      comparePriceFormula,
      costPriceType,
      costFixedPriceAmount,
    });
    if (errors.length > 0) {
      setPricingValidationError(errors.join(" "));
      return;
    }

    const scheduleValidation = validateScheduleConfig({
      changePricesSchedule: scheduleType,
      changePricesAtDate: startDateStr,
      changePricesAtTime: startTimeStr,
      revertPrices: revertLater,
      revertPricesAtDate: revertDateStr,
      revertPricesAtTime: revertTimeStr,
    });
    if (scheduleValidation.errors.length > 0) {
      setPricingValidationError(scheduleValidation.errors.join(" "));
      return;
    }

    setPricingValidationError("");

    const payload = {
      intent: "run_task",
      editType,
      matchType,
      conditions: JSON.stringify(conditions),
      collectionId: selectedCollectionId,
      changePrice,
      percentType,
      percentValue,
      fixedType,
      fixedValue,
      fixedPriceAmount,
      roundCents,
      priceFormula,
      comparePriceType,
      comparePercentType,
      comparePercentValue,
      compareFixedType,
      compareFixedValue,
      compareFixedPriceAmount,
      compareRoundCents,
      comparePriceFormula,
      costPriceType,
      costPercentType,
      costPercentValue,
      costFixedType,
      costFixedValue,
      costFixedPriceAmount,
      costRoundCents,
      addTagsActive: addTagsActive ? "true" : "false",
      removeTagsActive: removeTagsActive ? "true" : "false",
      tagsToAdd: JSON.stringify(effectiveTagsToAdd),
      tagsToRemove: JSON.stringify(effectiveTagsToRemove),
      taskName,
      changePricesSchedule: scheduleType,
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
    setConditions(updated);
    if (productSearchError) setProductSearchError("");
  };

  const handleEditTypeChange = (nextEditType) => {
    setEditType(nextEditType);
    setProductSearchError("");
  };

  const handleCollectionChange = (collectionId) => {
    setSelectedCollectionId(collectionId);
    if (productSearchError) setProductSearchError("");
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

    return "";
  };

  const handleSearch = () => {
    const validationError = validateProductSearch();
    if (validationError) {
      setProductsList([]);
      setSearchResults(null);
      setProductSearchError(validationError);
      return;
    }

    setProductSearchError("");
    const payload = {
      intent: "search",
      editType,
      matchType,
      conditions: JSON.stringify(conditions),
      collectionId: selectedCollectionId,
    };
    fetcher.submit(payload, { method: "POST" });
  };

  const previewVariants = useMemo(() => {
    if (!productsList.length) return [];

    const pricingParams = {
      changePrice,
      percentType,
      percentValue,
      fixedType,
      fixedValue,
      fixedPriceAmount,
      roundCents,
      priceFormula,
      comparePriceType,
      comparePercentType,
      comparePercentValue,
      compareFixedType,
      compareFixedValue,
      compareFixedPriceAmount,
      compareRoundCents,
      comparePriceFormula,
      costPriceType,
      costPercentType,
      costPercentValue,
      costFixedType,
      costFixedValue,
      costFixedPriceAmount,
      costRoundCents,
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
    changePrice,
    percentType,
    percentValue,
    fixedType,
    fixedValue,
    fixedPriceAmount,
    roundCents,
    priceFormula,
    comparePriceType,
    comparePercentType,
    comparePercentValue,
    compareFixedType,
    compareFixedValue,
    compareFixedPriceAmount,
    compareRoundCents,
    comparePriceFormula,
    costPriceType,
    costPercentType,
    costPercentValue,
    costFixedType,
    costFixedValue,
    costFixedPriceAmount,
    costRoundCents,
  ]);

  const handleCsvFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFileName(file.name);
    }
  };

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
          Task "{runFetcher.data.taskName}" scheduled for {new Date(runFetcher.data.scheduledAt).toLocaleString()}
          {runFetcher.data.revertAt
            ? ` with automatic revert at ${new Date(runFetcher.data.revertAt).toLocaleString()}.`
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
        csvFileInputRef={csvFileInputRef}
        values={{
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
        }}
        handlers={{
          setEditType: handleEditTypeChange,
          setSearchResults,
          setCsvFileName,
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
        }}
        isSearching={fetcher.state === "submitting" || fetcher.state === "loading"}
        isRunning={runFetcher.state === "submitting" || runFetcher.state === "loading"}
        productSearchError={productSearchError}
        pricingValidationError={pricingValidationError}
        previewVariants={previewVariants}
        timezoneStr={timezoneStr}
        currentTimeStr={currentTimeStr}
      />
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
