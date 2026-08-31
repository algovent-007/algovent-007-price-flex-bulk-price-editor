import { useI18n } from "../i18n/I18nProvider";

export default function HomeCompletedTasksCard({
  completedTaskCount = 0,
  currentPlan = null,
}) {
  const { t } = useI18n();

  return (
    <s-grid gridTemplateColumns="1fr 1fr" gap="base">
      <s-stack direction="inline" gap="small" alignItems="center">
        <s-text>{t("home.totalCompletedTasks")}</s-text>
        <s-badge tone="info">{String(completedTaskCount)}</s-badge>
      </s-stack>
      <s-stack direction="inline" gap="small" alignItems="center">
        <s-text>{t("home.plan")}</s-text>
        <s-badge tone="success">{currentPlan || t("plans.noActivePlan")}</s-badge>
      </s-stack>
    </s-grid>
  );
}
