import { APP_DESCRIPTION, APP_GET_STARTED_CTA, APP_NAME } from "../constants/branding";
import styles from "./HomePage.module.css";

export default function HomeGetStartedBanner({ onDismiss, onCreateJob }) {
  return (
    <>
      <div className={styles.getStartedHeader}>
        <p className={styles.cardTitle}>Get started with {APP_NAME}</p>
        <button
          type="button"
          className={styles.dismissButton}
          aria-label="Dismiss get started banner"
          onClick={onDismiss}
        >
          ×
        </button>
      </div>
      <div className={styles.getStartedBody}>
        <div className={styles.getStartedText}>
          <p className={styles.cardBody}>
            {APP_DESCRIPTION} {APP_GET_STARTED_CTA}
          </p>
        </div>
        <s-button variant="primary" onClick={onCreateJob}>
          Create Bulk Price Update
        </s-button>
      </div>
    </>
  );
}
