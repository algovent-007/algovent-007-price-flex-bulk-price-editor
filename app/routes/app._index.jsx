import { useEffect, useState } from "react";
import { useLoaderData, useNavigate, useSearchParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import HomeGetStartedBanner from "../components/HomeGetStartedBanner";
import HomeHowToCard from "../components/HomeHowToCard";
import HomeCreateTaskCard from "../components/HomeCreateTaskCard";
import HomeCompletedTasksCard from "../components/HomeCompletedTasksCard";
import HomePageFooter from "../components/HomePageFooter";
import { getSubscriptionByShop } from "../models/subscription.server";
import { getPlanDefinition } from "../constants/billing";
import { APP_NAME } from "../constants/branding";
import AppPage from "../components/AppPage";
import { clearActiveTaskId, readActiveTaskId } from "../utils/active-task-storage";

const GET_STARTED_DISMISSED_KEY = "price_flex_get_started_dismissed";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  const [completedTaskCount, performedTaskCount, subscription, runningTasks] = await Promise.all([
    prisma.task.count({
      where: { shop: session.shop, status: "completed" },
    }),
    prisma.task.count({
      where: { shop: session.shop },
    }),
    getSubscriptionByShop(session.shop),
    prisma.task.findMany({
      where: { shop: session.shop, status: "running" },
      select: { id: true },
    }),
  ]);

  return Response.json({
    completedTaskCount,
    hasPerformedTask: performedTaskCount > 0,
    currentPlan: getPlanDefinition(subscription?.planName)?.name || subscription?.planName || null,
    runningTaskIds: runningTasks.map((task) => task.id),
  });
};

function readGetStartedDismissed() {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(GET_STARTED_DISMISSED_KEY) === "true";
  } catch {
    return false;
  }
}

function writeGetStartedDismissed() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(GET_STARTED_DISMISSED_KEY, "true");
  } catch {
    // Ignore storage failures in private browsing.
  }
}

export default function Index() {
  const { completedTaskCount, hasPerformedTask, currentPlan, runningTaskIds = [] } = useLoaderData();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [getStartedDismissed, setGetStartedDismissed] = useState(readGetStartedDismissed);
  const showGetStarted = !hasPerformedTask && !getStartedDismissed;

  useEffect(() => {
    if (!hasPerformedTask) return;
    writeGetStartedDismissed();
    setGetStartedDismissed(true);
  }, [hasPerformedTask]);

  useEffect(() => {
    const queryTaskId = searchParams.get("taskId");
    const storedTaskId = readActiveTaskId();
    const runningIds = new Set(runningTaskIds);

    if (storedTaskId && !runningIds.has(storedTaskId)) {
      clearActiveTaskId(storedTaskId);
    }

    const nextTaskId = [queryTaskId, storedTaskId].find((id) => id && runningIds.has(id));
    if (!nextTaskId) return;

    navigate(`/app/current?taskId=${encodeURIComponent(nextTaskId)}`, { replace: true });
  }, [navigate, runningTaskIds, searchParams]);

  const handleCreateJob = () => navigate("/app/new");

  const handleDismissGetStarted = () => {
    setGetStartedDismissed(true);
    writeGetStartedDismissed();
  };

  return (
    <AppPage heading={APP_NAME}>
      <HomeHowToCard />
      <HomeCreateTaskCard />

      {showGetStarted ? (
        <HomeGetStartedBanner
          onDismiss={handleDismissGetStarted}
          onCreateJob={handleCreateJob}
        />
      ) : null}

      <s-section>
        <HomeCompletedTasksCard
          completedTaskCount={completedTaskCount}
          currentPlan={currentPlan}
        />
      </s-section>

      <s-section>
        <HomePageFooter />
      </s-section>
    </AppPage>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
