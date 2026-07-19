import { authenticate } from "../shopify.server";
import { useEffect, useState } from "react";
import { useLoaderData, useNavigate, useRevalidator, useSearchParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import TaskProgressCard, { isTaskTerminal } from "../components/TaskProgressCard";
import HomeGetStartedBanner from "../components/HomeGetStartedBanner";
import HomeEmptyState from "../components/HomeEmptyState";
import HomePageFooter from "../components/HomePageFooter";
import { APP_NAME } from "../constants/branding";
import styles from "../components/HomePage.module.css";

const EXECUTING_TASK_STATUSES = ["running"];
const FINISHED_TASK_STATUSES = ["completed", "failed", "cancelled", "rolled_back"];
const GET_STARTED_DISMISSED_KEY = "price_flex_get_started_dismissed";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const taskId = url.searchParams.get("taskId");

  const activeTask = taskId
    ? await prisma.task.findFirst({
        where: {
          id: taskId,
          shop: session.shop,
          status: { in: EXECUTING_TASK_STATUSES },
        },
      })
    : await prisma.task.findFirst({
        where: {
          shop: session.shop,
          status: { in: EXECUTING_TASK_STATUSES },
        },
        orderBy: { createdAt: "desc" },
      });

  const lastCompletedTask = await prisma.task.findFirst({
    where: {
      shop: session.shop,
      status: { in: FINISHED_TASK_STATUSES },
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ activeTask, lastCompletedTask });
};

function readGetStartedDismissed() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(GET_STARTED_DISMISSED_KEY) === "true";
}

export default function Index() {
  const { activeTask, lastCompletedTask } = useLoaderData();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const [searchParams] = useSearchParams();
  const [getStartedDismissed, setGetStartedDismissed] = useState(readGetStartedDismissed);
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
    } else if (taskId) {
      localStorage.removeItem("price_flex_active_task_id");
      navigate("/app", { replace: true });
    }
  }, [activeTask?.id, navigate, taskId]);

  useEffect(() => {
    if (!shouldPoll) return undefined;

    const interval = setInterval(() => {
      revalidator.revalidate();
    }, 2000);

    return () => clearInterval(interval);
  }, [revalidator, shouldPoll]);

  const handleCreateJob = () => navigate("/app/new");

  const handleDismissGetStarted = () => {
    setGetStartedDismissed(true);
    localStorage.setItem(GET_STARTED_DISMISSED_KEY, "true");
  };

  return (
    <s-page heading={APP_NAME} inlineSize="base">
      <div className={styles.pageStack}>
        {!getStartedDismissed && (
          <s-section>
            <HomeGetStartedBanner
              onDismiss={handleDismissGetStarted}
              onCreateJob={handleCreateJob}
            />
          </s-section>
        )}

        <s-section>
          {activeTask ? <TaskProgressCard task={activeTask} /> : <HomeEmptyState onCreateJob={handleCreateJob} />}
        </s-section>

        {lastCompletedTask && !activeTask && (
          <s-section>
            <s-paragraph>
              Last completed task:{" "}
              <s-link href="/app/history">
                {lastCompletedTask.name} ({lastCompletedTask.processedItems} items)
              </s-link>
            </s-paragraph>
          </s-section>
        )}

        <HomePageFooter />
      </div>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
