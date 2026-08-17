import LanguageSelector from "./LanguageSelector";
import styles from "./LanguageBar.module.css";

export default function LanguageBar() {
  return (
    <div className={styles.bar}>
      <div className={styles.selector}>
        <LanguageSelector />
      </div>
    </div>
  );
}
