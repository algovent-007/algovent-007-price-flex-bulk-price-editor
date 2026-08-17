import { useEffect, useMemo, useState } from "react";
import { Form, useLoaderData, useNavigation, useSearchParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { comparePlans, PLANS, SUBSCRIPTION_STATUS } from "../constants/billing";
import { getPlansPageData } from "../services/subscription.server";
import { handleBillingAction } from "../services/billing-action.server";
import { translateError } from "../i18n/errors";
import { useI18n } from "../i18n/I18nProvider";
import AppPage from "../components/AppPage";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  return getPlansPageData(admin, session);
};

export const action = handleBillingAction;

function getPlanButtonLabel(t, currentPlan, targetPlan) {
  if (!currentPlan) {
    return t("plans.select");
  }

  if (currentPlan === targetPlan) {
    return t("plans.currentPlanButton");
  }

  const comparison = comparePlans(currentPlan, targetPlan);
  if (comparison > 0) {
    return t("plans.upgrade");
  }

  if (comparison < 0) {
    return t("plans.downgrade");
  }

  return t("plans.select");
}

function getBillingStatusTone(status) {
  if (status === SUBSCRIPTION_STATUS.ACTIVE) {
    return "success";
  }

  if (
    status === SUBSCRIPTION_STATUS.PENDING ||
    status === SUBSCRIPTION_STATUS.FROZEN
  ) {
    return "warning";
  }

  if (
    status === SUBSCRIPTION_STATUS.DECLINED ||
    status === SUBSCRIPTION_STATUS.EXPIRED ||
    status === SUBSCRIPTION_STATUS.CANCELLED
  ) {
    return "critical";
  }

  return "info";
}

export default function Plans() {
  const loaderData = useLoaderData();
  const { t, formatDateTime } = useI18n();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const [bannerMessage, setBannerMessage] = useState("");
  const [bannerTone, setBannerTone] = useState("success");

  const currentPlan = loaderData.currentPlan;
  const isSubmitting = navigation.state !== "idle";

  const plans = useMemo(
    () =>
      Object.values(PLANS).map((plan) => ({
        name: plan.name,
        price: plan.displayPrice,
        frequency: t("plans.perYear"),
        features: [
          { label: t("plans.unlimitedProducts"), included: true },
          { label: t("plans.unlimitedEdits"), included: true },
          { label: t("plans.unlimitedRollbacks"), included: true },
          { label: t("plans.recurringTask"), included: plan.features.recurring_tasks },
          { label: t("plans.markets"), included: plan.features.markets },
        ],
      })),
    [t],
  );

  useEffect(() => {
    const billingState = searchParams.get("billing");
    const billingRequired = searchParams.get("billing_required");

    if (billingRequired === "1") {
      setBannerTone("info");
      setBannerMessage(
        loaderData.isDevelopmentStore ? t("plans.welcomeDev") : t("plans.welcome"),
      );
    } else if (billingState === "success") {
      setBannerTone("success");
      setBannerMessage(t("plans.activeWelcome"));
    } else if (billingState === "pending") {
      setBannerTone("warning");
      setBannerMessage(t("plans.pending"));
    } else if (billingState === "error") {
      setBannerTone("critical");
      setBannerMessage(
        translateError(t, searchParams.get("error")) || t("plans.confirmError"),
      );
    }
  }, [searchParams, loaderData.isDevelopmentStore, t]);

  return (
    <AppPage heading={t("plans.heading")}>
      {bannerMessage && (
        <s-box paddingBlockEnd="base">
          <s-banner tone={bannerTone} onDismiss={() => setBannerMessage("")}>
            {bannerMessage}
          </s-banner>
        </s-box>
      )}

      <s-box paddingBlockEnd="base">
        <s-section heading={t("plans.currentSubscription")}>
          <s-stack direction="block" gap="base">
            <s-stack direction="inline" gap="base">
              <s-text>
                {t("plans.currentPlan")}{" "}
                <strong>{currentPlan || t("plans.noActivePlan")}</strong>
              </s-text>
              {currentPlan && (
                <s-badge tone={getBillingStatusTone(loaderData.billingStatus)}>
                  {loaderData.billingStatus || loaderData.subscriptionStatus || "UNKNOWN"}
                </s-badge>
              )}
            </s-stack>
            <s-text color="subdued">
              {t("plans.renewalDate", {
                date:
                  formatDateTime(loaderData.renewalDate, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  }) || t("common.emDash"),
              })}
            </s-text>
            {loaderData.isDevelopmentStore && (
              <s-text color="subdued">
                {t("plans.developmentStore")}
              </s-text>
            )}
            {loaderData.requiresShopifyApproval && !loaderData.currentPlan && (
              <s-text color="subdued">
                {t("plans.approvalHint")}
              </s-text>
            )}
          </s-stack>
        </s-section>
      </s-box>

      <s-section padding="none">
        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(280px, 1fr))" gap="none">
          {plans.map((plan) => {
            const isActive = currentPlan === plan.name;
            const buttonLabel = getPlanButtonLabel(t, currentPlan, plan.name);

            return (
              <s-box
                key={plan.name}
                padding="large"
                borderWidth="base"
                borderColor="base"
                background="base"
              >
                <s-stack direction="block" gap="base">
                  <s-stack direction="block" gap="small-100">
                    <s-text color="subdued">{plan.name}</s-text>
                    <s-heading>{plan.price}</s-heading>
                    <s-text color="subdued">{plan.frequency}</s-text>
                  </s-stack>

                  {isActive ? (
                    <s-button disabled>{buttonLabel}</s-button>
                  ) : (
                    <Form method="post">
                      <input type="hidden" name="intent" value="select" />
                      <input type="hidden" name="planName" value={plan.name} />
                      <s-button variant="primary" type="submit" disabled={isSubmitting}>
                        {buttonLabel}
                      </s-button>
                    </Form>
                  )}

                  <s-divider />

                  <s-stack direction="block" gap="base">
                    {plan.features.map((feature) => (
                      <s-stack key={feature.label} direction="inline" gap="base">
                        <s-text tone={feature.included ? "success" : "neutral"}>
                          {feature.included ? "✓" : "✕"}
                        </s-text>
                        <s-text color={feature.included ? "base" : "subdued"}>
                          {feature.label}
                        </s-text>
                      </s-stack>
                    ))}
                  </s-stack>
                </s-stack>
              </s-box>
            );
          })}
        </s-grid>
      </s-section>
    </AppPage>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
