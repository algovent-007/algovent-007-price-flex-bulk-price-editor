import { authenticate } from "../shopify.server";
import { loadTaskProgressForShop } from "../utils/task-progress.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const taskId = url.searchParams.get("taskId");
  const progress = await loadTaskProgressForShop(session.shop, taskId);

  return Response.json(progress, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
};
