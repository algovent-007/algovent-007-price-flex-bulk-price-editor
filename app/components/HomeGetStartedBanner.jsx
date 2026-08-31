import { APP_NAME } from "../constants/branding";
import { useI18n } from "../i18n/I18nProvider";

export default function HomeGetStartedBanner({ onDismiss, onCreateJob }) {
  const { t } = useI18n();

  return (
    <s-banner
      heading={t("home.getStartedTitle", { appName: APP_NAME })}
      tone="info"
      dismissible
      onDismiss={onDismiss}
    >
      {t("branding.description")} {t("branding.getStartedCta")}
      <s-button slot="secondary-actions" variant="secondary" onClick={onCreateJob}>
        {t("home.createBulkPriceUpdate")}
      </s-button>
    </s-banner>
  );
}
