import { APP_NAME } from "../constants/branding";
import { useI18n } from "../i18n/I18nProvider";

export default function HomeHowToCard() {
  const { t } = useI18n();

  return (
    <s-section>
      <s-box padding="base" background="subdued" borderRadius="base">
        <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
          <s-stack direction="block" gap="small-100">
            <s-heading>{t("home.howToTitle")}</s-heading>
            <s-text color="subdued">{t("home.howToBody", { appName: APP_NAME })}</s-text>
          </s-stack>
          <s-button href="/app/support" variant="secondary">
            {t("home.readMore")}
          </s-button>
        </s-grid>
      </s-box>
    </s-section>
  );
}
