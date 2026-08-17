import { useI18n } from "../i18n/I18nProvider";
import styles from "./HomePage.module.css";

export default function HomeSidebar({
  taskFinishedEmailEnabled,
  onTaskFinishedEmailChange,
  isSaving = false,
}) {
  const { t } = useI18n();

  return (
    <aside className={styles.sidebar}>
      <s-box padding="base" borderWidth="base" borderRadius="base" background="base">
        <s-stack direction="block" gap="base">
          <s-text type="strong">{t("home.taskFinishedEmail")}</s-text>
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
          <s-text type="strong">{t("home.notes")}</s-text>
          <s-link href="/app/support">{t("home.fairUsagePolicy")}</s-link>
          <s-link href="/app/support">{t("home.concurrentTasks")}</s-link>
        </s-stack>
      </s-box>
    </aside>
  );
}
