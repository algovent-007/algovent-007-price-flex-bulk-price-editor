import { processAllDueTasksForCron } from "../services/scheduler-cron.server";

function isAuthorizedCronRequest(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }

  const authorization = request.headers.get("Authorization") || "";
  return authorization === `Bearer ${secret}`;
}

/** Secured cron endpoint for background scheduled task processing. */
export const loader = async ({ request }) => {
  if (!process.env.CRON_SECRET) {
    return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }

  if (!isAuthorizedCronRequest(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processAllDueTasksForCron();
  return Response.json({
    ok: true,
    ...result,
  });
};

export const action = loader;
