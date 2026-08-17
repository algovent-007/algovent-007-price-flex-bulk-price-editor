/* eslint-disable react/prop-types -- this codebase does not use PropTypes */
import LanguageBar from "./LanguageBar";
import styles from "./AppPage.module.css";

export default function AppPage({ children, heading, ...pageProps }) {
  return (
    <s-page {...pageProps}>
      <div className={styles.header}>
        {heading ? <h1 className={styles.title}>{heading}</h1> : null}
        <LanguageBar />
      </div>
      {children}
    </s-page>
  );
}
