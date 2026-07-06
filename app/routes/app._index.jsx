import { authenticate } from "../shopify.server";
import { useEffect } from "react";
import { useLoaderData, useNavigate, useRevalidator, useSearchParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import TaskProgressCard, { isTaskTerminal } from "../components/TaskProgressCard";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const taskId = url.searchParams.get("taskId");

  const activeTask = taskId
    ? await prisma.task.findFirst({
        where: { id: taskId, shop: session.shop },
      })
    : await prisma.task.findFirst({
        where: {
          shop: session.shop,
          status: { in: ["running", "scheduled"] },
        },
        orderBy: { createdAt: "desc" },
      });

  const lastCompletedTask = await prisma.task.findFirst({
    where: {
      shop: session.shop,
      status: { in: ["completed", "failed", "cancelled"] },
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ activeTask, lastCompletedTask });
};

export default function Index() {
  const { activeTask, lastCompletedTask } = useLoaderData();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const [searchParams] = useSearchParams();
  const taskId = searchParams.get("taskId");
  const shouldPoll = activeTask && !isTaskTerminal(activeTask.status);

  useEffect(() => {
    const storedTaskId = localStorage.getItem("price_flex_active_task_id");
    if (!taskId && storedTaskId) {
      navigate(`/app?taskId=${encodeURIComponent(storedTaskId)}`, { replace: true });
    }
  }, [navigate, taskId]);

  useEffect(() => {
    if (activeTask?.id) {
      localStorage.setItem("price_flex_active_task_id", activeTask.id);
    }
  }, [activeTask?.id]);

  useEffect(() => {
    if (!shouldPoll) return undefined;

    const interval = setInterval(() => {
      revalidator.revalidate();
    }, 2000);

    return () => clearInterval(interval);
  }, [revalidator, shouldPoll]);

  return (
    <s-page heading="Current">
      <s-section heading="Current Task">
        {activeTask ? (
          <TaskProgressCard task={activeTask} />
        ) : (
          <>
            <s-paragraph>No task running</s-paragraph>
            <s-box
              padding="base"
              borderWidth="base"
              borderRadius="base"
              background="subdued"
            >
              <s-stack direction="block" gap="base">
                <s-paragraph>
                  Save time by bulk editing product prices in just a few clicks.
                </s-paragraph>
                <s-button onClick={() => navigate("/app/new")}>
                  Create a price edit task
                </s-button>
              </s-stack>
            </s-box>
          </>
        )}
      </s-section>

      {lastCompletedTask && (
        <s-section>
          <s-paragraph>
            Last completed task:{" "}
            <s-link href="/app/history">
              {lastCompletedTask.name} ({lastCompletedTask.processedItems} items)
            </s-link>
          </s-paragraph>
        </s-section>
      )}

      <s-section slot="aside" heading="Task finished email">
        <s-paragraph>
          <s-switch label="Get an email when the bulk edit is complete."></s-switch>
        </s-paragraph>
      </s-section>

      <s-section slot="aside" heading="Notes">
        <s-paragraph>
          <s-link href="#" target="_blank">
            Fair Usage Policy
          </s-link>
        </s-paragraph>
        <s-paragraph>
          <s-link href="#" target="_blank">
            Concurrent Tasks
          </s-link>
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
