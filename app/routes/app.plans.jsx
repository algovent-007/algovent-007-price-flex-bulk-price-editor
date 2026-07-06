import { authenticate } from "../shopify.server";
import { useState, useEffect } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export default function Plans() {
  const [currentPlan, setCurrentPlan] = useState("Pro");
  const [bannerMessage, setBannerMessage] = useState("");

  useEffect(() => {
    const savedPlan = localStorage.getItem("price_flex_selected_plan");
    if (savedPlan) {
      setCurrentPlan(savedPlan);
    }
  }, []);

  const handleSelectPlan = (planName) => {
    const prev = currentPlan;
    setCurrentPlan(planName);
    localStorage.setItem("price_flex_selected_plan", planName);
    setBannerMessage(`Successfully switched to the ${planName} plan (previously ${prev}).`);
    setTimeout(() => setBannerMessage(""), 5000);
  };

  const plans = [
    {
      name: "Basic",
      price: "$20",
      frequency: "per year",
      features: [
        { label: "Unlimited Products", included: true },
        { label: "Unlimited Edits", included: true },
        { label: "Unlimited Rollbacks", included: true },
        { label: "Recurring Task", included: false },
        { label: "Markets", included: false },
      ],
    },
    {
      name: "Pro",
      price: "$40",
      frequency: "per year",
      features: [
        { label: "Unlimited Products", included: true },
        { label: "Unlimited Edits", included: true },
        { label: "Unlimited Rollbacks", included: true },
        { label: "Recurring Task", included: true },
        { label: "Markets", included: false },
      ],
    },
    {
      name: "Super",
      price: "$60",
      frequency: "per year",
      features: [
        { label: "Unlimited Products", included: true },
        { label: "Unlimited Edits", included: true },
        { label: "Unlimited Rollbacks", included: true },
        { label: "Recurring Task", included: true },
        { label: "Markets", included: true },
      ],
    },
  ];

  return (
    <s-page heading="Plans">
      {bannerMessage && (
        <s-box paddingBlockEnd="base">
          <s-banner tone="success" onDismiss={() => setBannerMessage("")}>
            {bannerMessage}
          </s-banner>
        </s-box>
      )}

      <s-section padding="none">
        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(280px, 1fr))" gap="none">
          {plans.map((plan) => {
            const isActive = currentPlan === plan.name;

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
                    <s-button disabled>Current Plan</s-button>
                  ) : (
                    <s-button variant="primary" onClick={() => handleSelectPlan(plan.name)}>
                      Select
                    </s-button>
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
