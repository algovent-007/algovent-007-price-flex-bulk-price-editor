import { APP_GET_STARTED_CTA } from "../constants/branding";
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
  return (
    <div className={styles.emptyStateContent}>
      <div className={styles.illustration}>
        <DocumentIllustration />
      </div>
      <p className={styles.emptyStateHeading}>{APP_GET_STARTED_CTA}</p>
      <s-button variant="primary" onClick={onCreateJob}>
        New Bulk Price Update
      </s-button>
    </div>
  );
}
