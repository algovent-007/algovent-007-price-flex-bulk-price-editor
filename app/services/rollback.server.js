import prisma from "../db.server";
import { attachProductTagChanges } from "../utils/task-log-display";
import {
  buildRollbackVariantUpdate,
  bulkUpdateProductVariants,
  shouldRollbackCost,
} from "../utils/shopify-variants";
import {
  findTaskForShop,
  requireTaskUpdateForShop,
  TASK_NOT_FOUND_FOR_SHOP_ERROR,
} from "../utils/task-record";

function parseActionData(task) {
  try {
    return JSON.parse(task.actionDetails || "{}");
  } catch {
    return {};
  }
}

function validateRollbackTask(task) {
  const actionData = parseActionData(task);

  if (actionData.rolledBackByTaskId) {
    return { valid: false, error: "This task has already been rolled back" };
  }

  const logs = actionData.logs || [];
  if (logs.length === 0) {
    return { valid: false, error: "No changes to roll back" };
  }

  if (!logs[0].variantId) {
    return {
      valid: false,
      error:
        "This task cannot be rolled back because it was created before rollback support was added.",
    };
  }

  return { valid: true, actionData, logs };
}

async function syncSourceTaskAsRolledBack(task, actionData, rollbackTaskId, { preserveStatus = false } = {}) {
  await requireTaskUpdateForShop(prisma, {
    id: task.id,
    shop: task.shop,
    data: {
      ...(preserveStatus ? {} : { status: "rolled_back" }),
      actionDetails: JSON.stringify({
        ...actionData,
        rolledBackByTaskId: rollbackTaskId,
      }),
    },
  });
}

async function prepareRollbackTask(task, { rollbackTaskId } = {}) {
  if (!task?.shop) {
    return { success: false, error: TASK_NOT_FOUND_FOR_SHOP_ERROR };
  }

  const validation = validateRollbackTask(task);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const { actionData, logs } = validation;
  const resolvedRollbackTaskId = rollbackTaskId || `rollback-${task.id}`;
  const productIds = actionData.productIds || [...new Set(logs.map((log) => log.productId))];
  const productCount = productIds.length;

  const existingRollbackTask = await prisma.task.findUnique({
    where: { id: resolvedRollbackTaskId },
  });

  if (existingRollbackTask) {
    if (existingRollbackTask.shop && existingRollbackTask.shop !== task.shop) {
      return { success: false, error: TASK_NOT_FOUND_FOR_SHOP_ERROR };
    }

    if (existingRollbackTask.status === "running") {
      return {
        success: true,
        rollbackTaskId: resolvedRollbackTaskId,
        alreadyRunning: true,
      };
    }

    await syncSourceTaskAsRolledBack(task, actionData, resolvedRollbackTaskId);

    return {
      success: true,
      rollbackTaskId: resolvedRollbackTaskId,
      alreadyRolledBack: true,
    };
  }

  try {
    await prisma.task.create({
      data: {
        id: resolvedRollbackTaskId,
        name: `Rollback: ${task.name}`,
        status: "running",
        shop: task.shop,
        processedItems: 0,
        totalItems: productCount,
        actionDetails: JSON.stringify({
          taskType: "rollback",
          sourceTaskId: task.id,
          sourceTaskName: task.name,
          processedProductsCount: 0,
          updatedProductsCount: 0,
          updatedVariantsCount: 0,
          successCount: 0,
          failureCount: 0,
          logs: [],
        }),
      },
    });
  } catch (error) {
    if (error?.code !== "P2002") {
      throw error;
    }

    const concurrentTask = await findTaskForShop(prisma, {
      id: resolvedRollbackTaskId,
      shop: task.shop,
    });

    if (!concurrentTask) {
      return { success: false, error: TASK_NOT_FOUND_FOR_SHOP_ERROR };
    }

    if (concurrentTask.status === "running") {
      return {
        success: true,
        rollbackTaskId: resolvedRollbackTaskId,
        alreadyRunning: true,
      };
    }

    await syncSourceTaskAsRolledBack(task, actionData, resolvedRollbackTaskId);

    return {
      success: true,
      rollbackTaskId: resolvedRollbackTaskId,
      alreadyRolledBack: true,
    };
  }

  return {
    success: true,
    rollbackTaskId: resolvedRollbackTaskId,
    actionData,
    logs,
    productIds,
    productCount,
  };
}

async function executeRollbackWork({
  admin,
  task,
  rollbackTaskId,
  actionData,
  logs,
  productIds,
  preserveSourceSchedule = false,
}) {
  const shopifyQuery = async (query, variables = {}) => {
    const response = await admin.graphql(query, { variables });
    const json = await response.json();
    if (json.errors) {
      throw new Error(json.errors[0].message);
    }
    return json.data;
  };

  const tagsToAdd = actionData.tagsToRemove || [];
  const tagsToRemove = actionData.tagsToAdd || [];
  const productCount = productIds.length;
  const logsByProduct = {};

  for (const log of logs) {
    if (!logsByProduct[log.productId]) {
      logsByProduct[log.productId] = [];
    }
    logsByProduct[log.productId].push(log);
  }

  const rollbackLogs = [];
  let processedProductsCount = 0;
  let updatedProductsCount = 0;
  let successCount = 0;

  const buildActionDetails = (extra = {}) =>
    JSON.stringify({
      taskType: "rollback",
      sourceTaskId: task.id,
      sourceTaskName: task.name,
      tagsToAdd,
      tagsToRemove,
      productIds,
      logs: rollbackLogs,
      processedProductsCount,
      updatedProductsCount,
      updatedVariantsCount: successCount,
      successCount,
      failureCount: 0,
      ...extra,
    });

  const updateRollbackTask = async (status, extra = {}) => {
    await requireTaskUpdateForShop(prisma, {
      id: rollbackTaskId,
      shop: task.shop,
      data: {
        status,
        processedItems: successCount,
        totalItems: productCount,
        actionDetails: buildActionDetails(extra),
      },
    });
  };

  try {
    for (const productId of productIds) {
      const productLogs = logsByProduct[productId] || [];
      let productUpdated = false;

      const variants = productLogs
        .map((log) => buildRollbackVariantUpdate(log))
        .filter(Boolean);

      if (variants.length > 0) {
        const bulkResult = await bulkUpdateProductVariants(shopifyQuery, productId, variants);
        if (bulkResult.failed.length > 0) {
          throw new Error(bulkResult.failed[0].message);
        }
        productUpdated = true;
        successCount += bulkResult.updatedIds.length;
      }

      for (const log of productLogs) {
        const rolledBackPrice = Boolean(buildRollbackVariantUpdate(log));
        const rolledBackCost = shouldRollbackCost(log);

        if (rolledBackCost) {
          const invData = await shopifyQuery(
            `#graphql
            mutation inventoryItemUpdate($id: ID!, $input: InventoryItemInput!) {
              inventoryItemUpdate(id: $id, input: $input) {
                inventoryItem { id }
                userErrors { field message }
              }
            }`,
            {
              id: log.inventoryItemId,
              input: { cost: log.oldCost },
            }
          );

          const invErrors = invData.inventoryItemUpdate?.userErrors || [];
          if (invErrors.length > 0) {
            throw new Error(invErrors[0].message);
          }

          productUpdated = true;
          if (!rolledBackPrice) {
            successCount += 1;
          }
        }

        if (!rolledBackPrice && !rolledBackCost) {
          if (tagsToAdd.length === 0 && tagsToRemove.length === 0) {
            continue;
          }
        }

        rollbackLogs.push({
          productId: log.productId,
          variantId: log.variantId,
          inventoryItemId: log.inventoryItemId,
          productTitle: log.productTitle,
          variantTitle: log.variantTitle,
          oldPrice: log.newPrice,
          newPrice: log.oldPrice,
          oldCompare: log.newCompare,
          newCompare: log.oldCompare,
          oldCost: log.newCost,
          newCost: log.oldCost,
        });
      }

      if (tagsToAdd.length > 0 || tagsToRemove.length > 0) {
        if (tagsToRemove.length > 0) {
          const tagData = await shopifyQuery(
            `#graphql
            mutation tagsRemove($id: ID!, $tags: [String!]!) {
              tagsRemove(id: $id, tags: $tags) {
                userErrors { field message }
              }
            }`,
            { id: productId, tags: tagsToRemove }
          );

          const tagErrors = tagData.tagsRemove?.userErrors || [];
          if (tagErrors.length > 0) {
            throw new Error(tagErrors[0].message);
          }

          productUpdated = true;
        }

        if (tagsToAdd.length > 0) {
          const tagData = await shopifyQuery(
            `#graphql
            mutation tagsAdd($id: ID!, $tags: [String!]!) {
              tagsAdd(id: $id, tags: $tags) {
                userErrors { field message }
              }
            }`,
            { id: productId, tags: tagsToAdd }
          );

          const tagErrors = tagData.tagsAdd?.userErrors || [];
          if (tagErrors.length > 0) {
            throw new Error(tagErrors[0].message);
          }

          productUpdated = true;
        }
      }

      if (tagsToAdd.length > 0 || tagsToRemove.length > 0) {
        attachProductTagChanges(rollbackLogs, productId, tagsToAdd, tagsToRemove);
      }

      if (productUpdated) {
        updatedProductsCount++;
      }

      processedProductsCount++;
      await updateRollbackTask("running");
    }

    await syncSourceTaskAsRolledBack(task, actionData, rollbackTaskId, {
      preserveStatus: preserveSourceSchedule,
    });
    processedProductsCount = productCount;
    await updateRollbackTask("completed", {
      processedProductsCount: productCount,
      failureCount: 0,
    });

    return {
      success: true,
      taskId: task.id,
      rollbackTaskId,
    };
  } catch (error) {
    await updateRollbackTask("failed", {
      error: error.message,
      failureCount: 1,
    });
    return { success: false, error: error.message };
  }
}

export async function startRollbackForTask({ admin, task }) {
  const prepared = await prepareRollbackTask(task);

  if (!prepared.success) {
    return prepared;
  }

  if (prepared.alreadyRolledBack) {
    return {
      success: true,
      taskId: task.id,
      rollbackTaskId: prepared.rollbackTaskId,
      alreadyRolledBack: true,
    };
  }

  if (prepared.alreadyRunning) {
    return {
      success: true,
      taskStarted: true,
      taskId: prepared.rollbackTaskId,
      rollbackTaskId: prepared.rollbackTaskId,
      alreadyRunning: true,
    };
  }

  executeRollbackWork({
    admin,
    task,
    rollbackTaskId: prepared.rollbackTaskId,
    actionData: prepared.actionData,
    logs: prepared.logs,
    productIds: prepared.productIds,
  }).catch((error) => {
    console.error("Failed to execute background rollback task:", error);
  });

  return {
    success: true,
    taskStarted: true,
    taskId: prepared.rollbackTaskId,
    rollbackTaskId: prepared.rollbackTaskId,
  };
}

export async function executeRollbackForTask({
  admin,
  task,
  preserveSourceSchedule = false,
}) {
  const prepared = await prepareRollbackTask(task, {
    rollbackTaskId: preserveSourceSchedule
      ? `rollback-${task.id}-${Date.now()}`
      : undefined,
  });

  if (!prepared.success) {
    return prepared;
  }

  if (prepared.alreadyRolledBack) {
    return {
      success: true,
      taskId: task.id,
      rollbackTaskId: prepared.rollbackTaskId,
      alreadyRolledBack: true,
    };
  }

  if (prepared.alreadyRunning) {
    return {
      success: true,
      taskId: task.id,
      rollbackTaskId: prepared.rollbackTaskId,
      alreadyRunning: true,
    };
  }

  return executeRollbackWork({
    admin,
    task,
    rollbackTaskId: prepared.rollbackTaskId,
    actionData: prepared.actionData,
    logs: prepared.logs,
    productIds: prepared.productIds,
    preserveSourceSchedule,
  });
}
