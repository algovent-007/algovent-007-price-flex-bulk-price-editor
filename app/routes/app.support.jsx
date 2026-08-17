/* eslint-disable react/prop-types -- this codebase does not use PropTypes */
import { SUPPORT_EMAIL } from "../constants/branding";
import { useI18n } from "../i18n/I18nProvider";
import AppPage from "../components/AppPage";

export default function Support() {
  const { t } = useI18n();
  const supportMailto = `mailto:${SUPPORT_EMAIL}`;
  const supportMessageMailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(t("support.emailSubject"))}`;

  const channels = [
    {
      icon: "email",
      title: t("support.emailTitle"),
      body: t("support.emailBody"),
      actionLabel: t("support.emailAction"),
      href: supportMailto,
    },
    {
      icon: "chat",
      title: t("support.chatTitle"),
      body: t("support.chatBody"),
      actionLabel: t("support.chatAction"),
      href: supportMessageMailto,
    },
    {
      icon: "question-circle",
      title: t("support.knowledgeTitle"),
      body: t("support.knowledgeBody"),
      actionLabel: t("support.knowledgeAction"),
    },
  ];

  return (
    <AppPage heading={t("support.heading")}>
      <s-section>
        <s-stack direction="block" gap="large">
          <s-box padding="base" borderWidth="base" borderRadius="base" background="base">
            <s-stack direction="block" gap="small-100">
              <s-heading>{t("support.centerTitle")}</s-heading>
              <s-text color="subdued">{t("support.centerSubtitle")}</s-text>
            </s-stack>
          </s-box>

          <s-grid gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap="base">
            {channels.map((channel) => (
              <s-box
                key={channel.title}
                padding="base"
                borderWidth="base"
                borderRadius="base"
                background="base"
              >
                <s-stack direction="block" gap="base">
                  <s-stack direction="inline" gap="small" alignItems="center">
                    <s-box
                      padding="small-100"
                      background="subdued"
                      borderRadius="small"
                      inlineSize="auto"
                    >
                      <s-icon type={channel.icon} />
                    </s-box>
                    <s-heading>{channel.title}</s-heading>
                  </s-stack>
                  <s-text color="subdued">{channel.body}</s-text>
                  {channel.href ? (
                    <s-button href={channel.href} variant="secondary" target="_blank">
                      {channel.actionLabel}
                    </s-button>
                  ) : (
                    <s-button variant="secondary">{channel.actionLabel}</s-button>
                  )}
                </s-stack>
              </s-box>
            ))}
          </s-grid>
        </s-stack>
      </s-section>
    </AppPage>
  );
}
