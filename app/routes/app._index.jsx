import { authenticate } from "../shopify.server";
import { useEffect, useState } from "react";
import { useFetcher, useLoaderData, useNavigate, useRevalidator, useSearchParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useAppBridge } from "@shopify/app-bridge-react";
import prisma from "../db.server";
import TaskProgressCard, { isTaskTerminal } from "../components/TaskProgressCard";
import HomeGetStartedBanner from "../components/HomeGetStartedBanner";
import HomeEmptyState from "../components/HomeEmptyState";
import HomePageFooter from "../components/HomePageFooter";
import HomeSidebar from "../components/HomeSidebar";
import { getShopSettings, setTaskFinishedEmailEnabled } from "../models/shop-settings.server";
import { translateError } from "../i18n/errors";
import { useI18n } from "../i18n/I18nProvider";
import AppPage from "../components/AppPage";
import styles from "../components/HomePage.module.css";

const EXECUTING_TASK_STATUSES = ["running"];
const FINISHED_TASK_STATUSES = ["completed", "failed", "cancelled", "rolled_back"];
const GET_STARTED_DISMISSED_KEY = "price_flex_get_started_dismissed";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const taskId = url.searchParams.get("taskId");
  const settings = await getShopSettings(session.shop);

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

  return Response.json({
    activeTask,
    lastCompletedTask,
    taskFinishedEmailEnabled: Boolean(settings?.taskFinishedEmailEnabled),
  });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "update_task_finished_email") {
    const enabled = formData.get("enabled") === "true";
    await setTaskFinishedEmailEnabled(session.shop, enabled);
    return Response.json({
      success: true,
      taskFinishedEmailEnabled: enabled,
    });
  }

  return Response.json({ success: false, error: "Unknown action." }, { status: 400 });
};

function readGetStartedDismissed() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(GET_STARTED_DISMISSED_KEY) === "true";
}

export default function Index() {
  const { activeTask, lastCompletedTask, taskFinishedEmailEnabled } = useLoaderData();
  const { t } = useI18n();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const appBridge = useAppBridge();
  const settingsFetcher = useFetcher();
  const [searchParams] = useSearchParams();
  const [getStartedDismissed, setGetStartedDismissed] = useState(readGetStartedDismissed);
  const [emailEnabled, setEmailEnabled] = useState(taskFinishedEmailEnabled);
  const taskId = searchParams.get("taskId");
  const shouldPoll = activeTask && !isTaskTerminal(activeTask.status);

  useEffect(() => {
    setEmailEnabled(taskFinishedEmailEnabled);
  }, [taskFinishedEmailEnabled]);

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

  useEffect(() => {
    if (settingsFetcher.state !== "idle" || !settingsFetcher.data) return;

    if (settingsFetcher.data.success) {
      setEmailEnabled(settingsFetcher.data.taskFinishedEmailEnabled);
      appBridge.toast.show(
        settingsFetcher.data.taskFinishedEmailEnabled
          ? t("home.taskFinishedEmailsEnabled")
          : t("home.taskFinishedEmailsDisabled"),
      );
      return;
    }

    if (settingsFetcher.data.error) {
      appBridge.toast.show(translateError(t, settingsFetcher.data.error), { isError: true });
    }
  }, [appBridge, settingsFetcher.data, settingsFetcher.state, t]);

  const handleCreateJob = () => navigate("/app/new");

  const handleDismissGetStarted = () => {
    setGetStartedDismissed(true);
    localStorage.setItem(GET_STARTED_DISMISSED_KEY, "true");
  };

  const handleTaskFinishedEmailChange = (event) => {
    const nextEnabled = Boolean(event.currentTarget?.checked ?? event.target?.checked);
    setEmailEnabled(nextEnabled);
    settingsFetcher.submit(
      {
        intent: "update_task_finished_email",
        enabled: String(nextEnabled),
      },
      { method: "POST" },
    );
  };

  return (
    <AppPage heading={t("home.heading")}>
      <div className={styles.pageLayout}>
        <div className={styles.mainColumn}>
          {!getStartedDismissed && (
            <s-section>
              <HomeGetStartedBanner
                onDismiss={handleDismissGetStarted}
                onCreateJob={handleCreateJob}
              />
            </s-section>
          )}

          <s-section>
            {activeTask ? (
              <TaskProgressCard task={activeTask} />
            ) : (
              <HomeEmptyState onCreateJob={handleCreateJob} />
            )}
          </s-section>

          {lastCompletedTask && !activeTask && (
            <s-section>
              <s-paragraph>
                {t("home.lastCompletedTask")}{" "}
                <s-link href="/app/history">
                  {t("home.lastCompletedTaskLink", {
                    name: lastCompletedTask.name,
                    count: lastCompletedTask.processedItems,
                  })}
                </s-link>
              </s-paragraph>
            </s-section>
          )}

          <HomePageFooter />
        </div>

        <HomeSidebar
          taskFinishedEmailEnabled={emailEnabled}
          onTaskFinishedEmailChange={handleTaskFinishedEmailChange}
          isSaving={settingsFetcher.state !== "idle"}
        />
      </div>
    </AppPage>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
