import { SUPPORT_EMAIL } from "../constants/branding";
import { useI18n } from "../i18n/I18nProvider";
import styles from "./HomePage.module.css";

export default function HomePageFooter() {
  const { t } = useI18n();

  return (
    <div className={styles.footer}>
      {t("home.needHelp")}{" "}
      <s-link href="/app/support">{t("home.faq")}</s-link> {t("home.orEmailSupport")}{" "}
      <s-link href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</s-link>
    </div>
  );
}
