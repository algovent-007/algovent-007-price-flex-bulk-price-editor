import { useState } from "react";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  try {
    const response = await admin.graphql(
      `#graphql
      query getShopDetails {
        shop {
          name
          email
          ianaTimezone
        }
      }`
    );

    const responseJson = await response.json();
    const shopData = responseJson.data.shop;

    return {
      shopName: shopData?.name || "",
      shopEmail: shopData?.email || "",
      shopDomain: session.shop,
      timezone: shopData?.ianaTimezone || "Asia/Kolkata",
    };
  } catch (error) {
    console.error("Failed to query shop details:", error);
    return {
      shopName: "Prathamesh-Production",
      shopEmail: "prathamesh@thaliatechnologies.com",
      shopDomain: session.shop || "prathamesh-production.myshopify.com",
      timezone: "Asia/Kolkata",
    };
  }
};

export default function Account() {
  const { shopName, shopEmail, shopDomain, timezone } = useLoaderData();
  const [name, setName] = useState(shopName);
  const [email, setEmail] = useState(shopEmail);

  return (
    <s-page heading="Account">
      <s-section heading="Account Details">
        <s-stack direction="block" gap="base">
          <s-text-field
            label="Name"
            required
            value={name}
            onInput={(e) => setName(e.target.value)}
            maxLength={70}
            details={`${name.length}/70`}
          />

          <s-text-field
            label="Email"
            required
            value={email}
            onInput={(e) => setEmail(e.target.value)}
          />

          <s-text-field label="Store" disabled value={shopDomain} />

          <s-select label="Timezone" value={timezone}>
            <s-option value="Asia/Kolkata">(GMT+05:30) New Delhi</s-option>
            <s-option value="America/New_York">(GMT-05:00) Eastern Time (US & Canada)</s-option>
            <s-option value="UTC">(GMT+00:00) Coordinated Universal Time</s-option>
            {timezone !== "Asia/Kolkata" &&
              timezone !== "America/New_York" &&
              timezone !== "UTC" && <s-option value={timezone}>{timezone}</s-option>}
          </s-select>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
