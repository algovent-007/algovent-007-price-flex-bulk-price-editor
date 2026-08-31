import { useI18n } from "../i18n/I18nProvider";

export default function HomeSidebar({
  taskFinishedEmailEnabled,
  onTaskFinishedEmailChange,
  isSaving = false,
}) {
  const { t } = useI18n();

  return (
    <s-section slot="aside">
      <s-stack direction="block" gap="base">
        <s-box padding="base" borderWidth="base" borderRadius="base" background="base">
          <s-stack direction="block" gap="base">
            <s-heading>{t("home.taskFinishedEmail")}</s-heading>
            <s-switch
              label={t("home.taskFinishedEmailSwitch")}
              checked={taskFinishedEmailEnabled}
              disabled={isSaving || undefined}
              onChange={onTaskFinishedEmailChange}
            />
            <s-text color="subdued">
              {t("home.emailsSentTo")}{" "}
              <s-link href="/app/account">{t("home.accountPage")}</s-link>{" "}
              {t("home.accountPageSuffix")}
            </s-text>
          </s-stack>
        </s-box>

        <s-box padding="base" borderWidth="base" borderRadius="base" background="base">
          <s-stack direction="block" gap="small">
            <s-heading>{t("home.notes")}</s-heading>
            <s-link href="/app/support">{t("home.fairUsagePolicy")}</s-link>
            <s-link href="/app/support">{t("home.concurrentTasks")}</s-link>
          </s-stack>
        </s-box>
      </s-stack>
    </s-section>
  );
}
