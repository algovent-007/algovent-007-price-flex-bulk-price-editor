import prisma from "../db.server";
import { APP_NAME, SUPPORT_EMAIL } from "../constants/branding";
import { getShopSettings } from "../models/shop-settings.server";
import { sendEmail, getConfiguredMailProvider } from "./mail.server";

const TERMINAL_STATUSES = new Set(["completed", "failed"]);

function parseActionDetails(task) {
  try {
    return JSON.parse(task?.actionDetails || "{}");
  } catch {
    return {};
  }
}

function buildEmailContent({ task, actionData, appUrl }) {
  const statusLabel = task.status === "completed" ? "completed successfully" : "failed";
  const updatedVariants = Number(
    actionData.updatedVariantsCount ?? actionData.successCount ?? task.processedItems ?? 0,
  );
  const updatedProducts = Number(actionData.updatedProductsCount ?? 0);
  const historyUrl = appUrl ? `${appUrl}/app/history` : "";
  const errorMessage = actionData.error ? `\nError: ${actionData.error}` : "";

  const text = [
    `Your bulk price edit task "${task.name}" has ${statusLabel}.`,
    "",
    `Variants updated: ${updatedVariants}`,
    `Products updated: ${updatedProducts}`,
    errorMessage,
    historyUrl ? `\nView task history: ${historyUrl}` : "",
    "",
    `${APP_NAME}`,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <p>Your bulk price edit task <strong>${task.name}</strong> has ${statusLabel}.</p>
    <ul>
      <li>Variants updated: <strong>${updatedVariants}</strong></li>
      <li>Products updated: <strong>${updatedProducts}</strong></li>
    </ul>
    ${actionData.error ? `<p><strong>Error:</strong> ${actionData.error}</p>` : ""}
    ${historyUrl ? `<p><a href="${historyUrl}">View task history</a></p>` : ""}
    <p>${APP_NAME}</p>
  `;

  return {
    subject: `${APP_NAME}: ${task.name} ${task.status === "completed" ? "completed" : "failed"}`,
    text,
    html,
  };
}

export async function notifyTaskFinishedIfEnabled(taskId) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task?.shop || !TERMINAL_STATUSES.has(task.status)) {
    return;
  }

  const actionData = parseActionDetails(task);
  if (actionData.completionEmailSent) {
    return;
  }

  const settings = await getShopSettings(task.shop);
  if (!settings?.taskFinishedEmailEnabled) {
    return;
  }

  const recipient = String(settings.email || "").trim();
  if (!recipient) {
    console.warn(
      `[task-finished-email] Task ${taskId} finished but no account email is configured for ${task.shop}.`,
    );
    return;
  }

  const appUrl = process.env.SHOPIFY_APP_URL || "";
  const { subject, text, html } = buildEmailContent({ task, actionData, appUrl });

  try {
    await sendEmail({
      to: recipient,
      subject,
      text,
      html,
    });

    console.log(
      `[task-finished-email] Sent completion email for task ${taskId} via ${getConfiguredMailProvider()}.`,
    );
  } catch (error) {
    console.error(`[task-finished-email] Failed to send completion email for task ${taskId}:`, error);
    return;
  }

  await prisma.task.update({
    where: { id: taskId },
    data: {
      actionDetails: JSON.stringify({
        ...actionData,
        completionEmailSent: true,
        completionEmailSentAt: new Date().toISOString(),
        completionEmailRecipient: recipient,
      }),
    },
  });
}

export function getTaskFinishedEmailHelpText() {
  return `Emails are sent to the address on your Account page. Need help? Contact ${SUPPORT_EMAIL}.`;
}
