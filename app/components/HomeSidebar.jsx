import styles from "./HomePage.module.css";

export default function HomeSidebar({
  taskFinishedEmailEnabled,
  onTaskFinishedEmailChange,
  isSaving = false,
}) {
  return (
    <aside className={styles.sidebar}>
      <s-box padding="base" borderWidth="base" borderRadius="base" background="base">
        <s-stack direction="block" gap="base">
          <s-text type="strong">Task finished email</s-text>
          <s-switch
            label="Get an email when the bulk edit is complete."
            checked={taskFinishedEmailEnabled}
            disabled={isSaving || undefined}
            onChange={onTaskFinishedEmailChange}
          />
          <s-text color="subdued">
            Emails are sent to the address on your{" "}
            <s-link href="/app/account">Account</s-link> page.
          </s-text>
        </s-stack>
      </s-box>

      <s-box padding="base" borderWidth="base" borderRadius="base" background="base">
        <s-stack direction="block" gap="small">
          <s-text type="strong">Notes</s-text>
          <s-link href="/app/support">Fair Usage Policy</s-link>
          <s-link href="/app/support">Concurrent Tasks</s-link>
        </s-stack>
      </s-box>
    </aside>
  );
}
