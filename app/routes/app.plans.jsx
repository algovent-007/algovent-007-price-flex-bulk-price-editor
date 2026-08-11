import { useEffect, useMemo, useState } from "react";
import { Form, useFetcher, useLoaderData, useNavigation, useSearchParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { comparePlans, PLANS, SUBSCRIPTION_STATUS } from "../constants/billing";
import { getPlansPageData } from "../services/subscription.server";
import { handleBillingAction } from "../services/billing-action.server";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  return getPlansPageData(admin, session);
};

export const action = handleBillingAction;

function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getPlanButtonLabel(currentPlan, targetPlan) {
  if (!currentPlan) {
    return "Select";
  }

  if (currentPlan === targetPlan) {
    return "Current Plan";
  }

  const comparison = comparePlans(currentPlan, targetPlan);
  if (comparison > 0) {
    return "Upgrade";
  }

  if (comparison < 0) {
    return "Downgrade";
  }

  return "Select";
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
  const fetcher = useFetcher();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const [bannerMessage, setBannerMessage] = useState("");
  const [bannerTone, setBannerTone] = useState("success");

  const currentPlan = loaderData.currentPlan;
  const isSubmitting = navigation.state !== "idle" || fetcher.state !== "idle";

  const plans = useMemo(
    () =>
      Object.values(PLANS).map((plan) => ({
        name: plan.name,
        price: plan.displayPrice,
        frequency: "per year",
        features: [
          { label: "Unlimited Products", included: true },
          { label: "Unlimited Edits", included: true },
          { label: "Unlimited Rollbacks", included: true },
          { label: "Recurring Task", included: plan.features.recurring_tasks },
          { label: "Markets", included: plan.features.markets },
        ],
      })),
    [],
  );

  useEffect(() => {
    const billingState = searchParams.get("billing");
    const billingRequired = searchParams.get("billing_required");

    if (billingRequired === "1") {
      setBannerTone("info");
      setBannerMessage(
        loaderData.isDevelopmentStore
          ? "Welcome! Select a plan to continue. You'll be redirected to Shopify to approve or decline a test charge (no real billing on development stores)."
          : "Welcome! Select a plan to continue. You'll be redirected to Shopify to approve or decline the charge.",
      );
    } else if (billingState === "success") {
      setBannerTone("success");
      setBannerMessage("Your subscription is active. Welcome back to the dashboard.");
    } else if (billingState === "pending") {
      setBannerTone("warning");
      setBannerMessage("Your billing request is pending approval in Shopify.");
    } else if (billingState === "error") {
      setBannerTone("critical");
      setBannerMessage(
        searchParams.get("error") ||
          "We could not confirm your subscription. Please try again.",
      );
    }
  }, [searchParams, loaderData.isDevelopmentStore]);

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) {
      return;
    }

    if (fetcher.data.error) {
      setBannerTone("critical");
      setBannerMessage(fetcher.data.error);
      return;
    }

    if (fetcher.data.success) {
      setBannerTone("success");
      setBannerMessage("Your plan was updated successfully.");
    }
  }, [fetcher.data, fetcher.state]);

  const handleCancelSubscription = () => {
    fetcher.submit({ intent: "cancel" }, { method: "post" });
  };

  return (
    <s-page heading="Plans">
      {bannerMessage && (
        <s-box paddingBlockEnd="base">
          <s-banner tone={bannerTone} onDismiss={() => setBannerMessage("")}>
            {bannerMessage}
          </s-banner>
        </s-box>
      )}

      <s-box paddingBlockEnd="base">
        <s-section heading="Current subscription">
          <s-stack direction="block" gap="base">
            <s-stack direction="inline" gap="base">
              <s-text>
                Current plan:{" "}
                <strong>{currentPlan || "No active plan"}</strong>
              </s-text>
              {currentPlan && (
                <s-badge tone={getBillingStatusTone(loaderData.billingStatus)}>
                  {loaderData.billingStatus || loaderData.subscriptionStatus || "UNKNOWN"}
                </s-badge>
              )}
            </s-stack>
            <s-text color="subdued">
              Renewal date: {formatDateTime(loaderData.renewalDate)}
            </s-text>
            {loaderData.isDevelopmentStore && (
              <s-text color="subdued">
                Development store: Shopify shows an approve/decline page with test charges only. No real payment is collected.
              </s-text>
            )}
            {loaderData.requiresShopifyApproval && !loaderData.currentPlan && (
              <s-text color="subdued">
                After you select a plan, Shopify opens the charge approval page where you can approve or cancel.
              </s-text>
            )}
            {currentPlan &&
              loaderData.subscriptionStatus === SUBSCRIPTION_STATUS.ACTIVE && (
                <s-button
                  tone="critical"
                  onClick={handleCancelSubscription}
                  disabled={isSubmitting}
                >
                  Cancel subscription
                </s-button>
              )}
          </s-stack>
        </s-section>
      </s-box>

      <s-section padding="none">
        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(280px, 1fr))" gap="none">
          {plans.map((plan) => {
            const isActive = currentPlan === plan.name;
            const buttonLabel = getPlanButtonLabel(currentPlan, plan.name);

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
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
