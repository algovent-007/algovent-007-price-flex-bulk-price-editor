/* eslint-disable react/prop-types -- this codebase does not use PropTypes */
import LanguageBar from "./LanguageBar";

export default function AppPage({ children, heading, ...pageProps }) {
  return (
    <s-page heading={heading} {...pageProps}>
      <s-box paddingBlockEnd="large">
        <s-stack direction="block" alignItems="end">
          <LanguageBar />
        </s-stack>
      </s-box>
      {children}
    </s-page>
  );
}
