import { APP_NAME } from "../constants/branding";
import { useI18n } from "../i18n/I18nProvider";
import styles from "./HomePage.module.css";

export default function HomeGetStartedBanner({ onDismiss, onCreateJob }) {
  const { t } = useI18n();

  return (
    <>
      <div className={styles.getStartedHeader}>
        <p className={styles.cardTitle}>{t("home.getStartedTitle", { appName: APP_NAME })}</p>
        <button
          type="button"
          className={styles.dismissButton}
          aria-label={t("home.dismissBanner")}
          onClick={onDismiss}
        >
          ×
        </button>
      </div>
      <div className={styles.getStartedBody}>
        <div className={styles.getStartedText}>
          <p className={styles.cardBody}>
            {t("branding.description")} {t("branding.getStartedCta")}
          </p>
        </div>
        <s-button variant="primary" onClick={onCreateJob}>
          {t("home.createBulkPriceUpdate")}
        </s-button>
      </div>
    </>
  );
}
