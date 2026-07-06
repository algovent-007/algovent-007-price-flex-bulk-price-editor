import prisma from "../db.server";

export async function executeRollbackForTask({ admin, task, createRollbackRecord = true }) {
  let actionData = {};
  try {
    actionData = JSON.parse(task.actionDetails || "{}");
  } catch (e) {
    return { success: false, error: "Invalid task data" };
  }

  if (actionData.rolledBackByTaskId) {
    return { success: false, error: "This task has already been rolled back" };
  }

  const logs = actionData.logs || [];
  if (logs.length === 0) {
    return { success: false, error: "No changes to roll back" };
  }

  if (!logs[0].variantId) {
    return {
      success: false,
      error: "This task cannot be rolled back because it was created before rollback support was added.",
    };
  }

  const shopifyQuery = async (query, variables = {}) => {
    const response = await admin.graphql(query, { variables });
    const json = await response.json();
    if (json.errors) {
      throw new Error(json.errors[0].message);
    }
    return json.data;
  };

  const productVariants = {};
  for (const log of logs) {
    if (!productVariants[log.productId]) {
      productVariants[log.productId] = [];
    }
    productVariants[log.productId].push({
      id: log.variantId,
      price: log.oldPrice,
      compareAtPrice: log.oldCompare === "-" ? null : log.oldCompare,
    });
  }

  for (const [productId, variants] of Object.entries(productVariants)) {
    const bulkData = await shopifyQuery(
      `#graphql
      mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkUpdate(productId: $productId, variants: $variants) {
          productVariants { id }
          userErrors { field message }
        }
      }`,
      { productId, variants }
    );

    const bulkErrors = bulkData.productVariantsBulkUpdate?.userErrors || [];
    if (bulkErrors.length > 0) {
      return { success: false, error: bulkErrors[0].message };
    }
  }

  for (const log of logs) {
    if (log.inventoryItemId && log.oldCost !== "-") {
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
        return { success: false, error: invErrors[0].message };
      }
    }
  }

  const tagsToAdd = actionData.tagsToRemove || [];
  const tagsToRemove = actionData.tagsToAdd || [];
  const productIds = actionData.productIds || [...new Set(logs.map((l) => l.productId))];

  if (tagsToAdd.length > 0 || tagsToRemove.length > 0) {
    for (const productId of productIds) {
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
          return { success: false, error: tagErrors[0].message };
        }
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
          return { success: false, error: tagErrors[0].message };
        }
      }
    }
  }

  const rollbackLogs = logs.map((log) => ({
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
  }));

  const rollbackTaskId = createRollbackRecord ? `rollback-${task.id}` : null;
  const productCount = actionData.productIds?.length || new Set(logs.map((l) => l.productId)).size;

  if (createRollbackRecord) {
    await prisma.task.create({
      data: {
        id: rollbackTaskId,
        name: `Rollback: ${task.name}`,
        status: "completed",
        shop: task.shop,
        processedItems: rollbackLogs.length,
        totalItems: productCount,
        actionDetails: JSON.stringify({
          taskType: "rollback",
          sourceTaskId: task.id,
          sourceTaskName: task.name,
          tagsToAdd,
          tagsToRemove,
          productIds,
          logs: rollbackLogs,
        }),
      },
    });

    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: "rolled_back",
        actionDetails: JSON.stringify({
          ...actionData,
          rolledBackByTaskId: rollbackTaskId,
        }),
      },
    });
  }

  return {
    success: true,
    taskId: task.id,
    rollbackTaskId,
  };
}
