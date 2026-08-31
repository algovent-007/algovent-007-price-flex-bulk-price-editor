import { SUPPORT_EMAIL } from "../constants/branding";
import { useI18n } from "../i18n/I18nProvider";

export default function HomePageFooter() {
  const { t } = useI18n();

  return (
    <s-stack direction="block" alignItems="center">
      <s-paragraph>
        <s-text color="subdued">
          {t("home.needHelp")}{" "}
          <s-link href="/app/support">{t("home.faq")}</s-link> {t("home.orEmailSupport")}{" "}
          <s-link href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</s-link>
        </s-text>
      </s-paragraph>
    </s-stack>
  );
}
