import { useI18n } from "../i18n/I18nProvider";
import AppPage from "../components/AppPage";

export default function AdditionalPage() {
  const { t } = useI18n();
  return (
    <AppPage heading={t("additional.heading")}>
      <s-section heading={t("additional.multiplePages")}>
        <s-paragraph>
          {t("additional.intro")}{" "}
          <s-link
            href="https://shopify.dev/docs/apps/tools/app-bridge"
            target="_blank"
          >
            App Bridge
          </s-link>
          .
        </s-paragraph>
        <s-paragraph>
          {t("additional.createPage")}
        </s-paragraph>
      </s-section>
      <s-section slot="aside" heading={t("additional.resources")}>
        <s-unordered-list>
          <s-list-item>
            <s-link
              href="https://shopify.dev/docs/apps/design-guidelines/navigation#app-nav"
              target="_blank"
            >
              {t("additional.appNav")}
            </s-link>
          </s-list-item>
        </s-unordered-list>
      </s-section>
    </AppPage>
  );
}
