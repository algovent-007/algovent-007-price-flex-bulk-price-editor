import { useI18n } from "../i18n/I18nProvider";

export default function HomeEmptyState() {
  const { t } = useI18n();

  return <s-text color="subdued">{t("home.noTaskRunning")}</s-text>;
}
