/* eslint-disable react/prop-types -- this codebase does not use PropTypes */
import {
  SUPPORT_EMAIL,
  SUPPORT_FEATURE_REQUEST_URL,
  SUPPORT_KNOWLEDGE_BASE_URL,
  SUPPORT_LIVE_CHAT_URL,
  SUPPORT_UPCOMING_FEATURES_URL,
} from "../constants/branding";
import styles from "./app.support.module.css";

const SUPPORT_CHANNELS = [
  {
    icon: "email",
    title: "Email Support",
    body: "Get answers to all your account and technical questions.",
    actionLabel: "Send an email",
    href: `mailto:${SUPPORT_EMAIL}`,
  },
  {
    icon: "chat",
    title: "Live Chat",
    body: "Connect with our support team in real-time for immediate assistance.",
    actionLabel: "Start live chat",
    href: SUPPORT_LIVE_CHAT_URL,
  },
  {
    icon: "question-circle",
    title: "Knowledge Base",
    body: "Browse our comprehensive guides, tutorials, and frequently asked questions.",
    actionLabel: "Browse articles",
    href: SUPPORT_KNOWLEDGE_BASE_URL,
  },
];

function SupportChannelCard({ icon, title, body, actionLabel, href }) {
  return (
    <s-box padding="base" borderWidth="base" borderRadius="base" background="base">
      <s-stack direction="block" gap="base">
        <div className={styles.iconWrap}>
          <s-icon type={icon} />
        </div>
        <s-heading>{title}</s-heading>
        <s-text color="subdued">{body}</s-text>
        <s-button href={href} variant="secondary">
          {actionLabel}
        </s-button>
      </s-stack>
    </s-box>
  );
}

export default function Support() {
  return (
    <s-page heading="Support">
      <s-section>
        <s-stack direction="block" gap="large">
          <s-box padding="base" borderWidth="base" borderRadius="base" background="base">
            <s-stack direction="block" gap="small-100">
              <s-heading>Support Center</s-heading>
              <s-text color="subdued">We are here to help you succeed with our app</s-text>
            </s-stack>
          </s-box>

          <s-grid gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap="base">
            {SUPPORT_CHANNELS.map((channel) => (
              <SupportChannelCard key={channel.title} {...channel} />
            ))}
          </s-grid>

          <s-box
            id="upcoming-features"
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background="base"
          >
            <s-stack direction="block" gap="base">
              <s-heading>Have an idea to improve our app? Let us know!</s-heading>
              <s-stack direction="inline" gap="small">
                <s-button href={SUPPORT_FEATURE_REQUEST_URL} variant="secondary">
                  Request Feature
                </s-button>
                <s-button href={SUPPORT_UPCOMING_FEATURES_URL} variant="secondary">
                  View Upcoming Features
                </s-button>
              </s-stack>
            </s-stack>
          </s-box>

          <s-box
            id="knowledge-base"
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background="base"
          >
            <s-stack direction="block" gap="base">
              <s-heading>Knowledge Base</s-heading>
              <s-stack direction="block" gap="small">
                <s-text type="strong">Fair Usage Policy</s-text>
                <s-text color="subdued">
                  Bulk price edits should be used for genuine catalog updates. Very large or
                  repeated tasks may take longer to complete so other merchants can keep using
                  the app reliably.
                </s-text>
              </s-stack>
              <s-stack direction="block" gap="small">
                <s-text type="strong">Concurrent Tasks</s-text>
                <s-text color="subdued">
                  Only one bulk edit runs at a time per store. If a task is already running,
                  wait for it to finish before starting another one.
                </s-text>
              </s-stack>
            </s-stack>
          </s-box>
        </s-stack>
      </s-section>
    </s-page>
  );
}
