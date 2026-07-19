import { SUPPORT_EMAIL } from "../constants/branding";
import styles from "./HomePage.module.css";

export default function HomePageFooter() {
  return (
    <div className={styles.footer}>
      Need help? Read the{" "}
      <s-link href="/app/support">FAQ</s-link> or email support at{" "}
      <s-link href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</s-link>
    </div>
  );
}
