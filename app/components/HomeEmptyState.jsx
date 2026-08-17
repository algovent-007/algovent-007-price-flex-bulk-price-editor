import { useI18n } from "../i18n/I18nProvider";
import styles from "./HomePage.module.css";

function DocumentIllustration() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect x="18" y="10" width="28" height="36" rx="2" fill="#ffffff" stroke="#c9cccf" />
      <rect x="14" y="14" width="28" height="36" rx="2" fill="#ffffff" stroke="#c9cccf" />
      <rect x="10" y="18" width="28" height="36" rx="2" fill="#ffffff" stroke="#c9cccf" />
      <rect x="18" y="28" width="12" height="12" rx="1" fill="#f8c654" />
    </svg>
  );
}

export default function HomeEmptyState({ onCreateJob }) {
  const { t } = useI18n();

  return (
    <div className={styles.emptyStateContent}>
      <div className={styles.illustration}>
        <DocumentIllustration />
      </div>
      <p className={styles.emptyStateHeading}>{t("branding.getStartedCta")}</p>
      <s-button variant="primary" onClick={onCreateJob}>
        {t("home.newBulkPriceUpdate")}
      </s-button>
    </div>
  );
}
