import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { useState } from "react";
import { Form, useActionData, useLoaderData } from "react-router";
import { login } from "../../shopify.server";
import { loginErrorMessage } from "./error.server";
import AppPage from "../../components/AppPage";
import { translateError } from "../../i18n/errors";
import { useI18n } from "../../i18n/I18nProvider";

export const loader = async ({ request }) => {
  const errors = loginErrorMessage(await login(request));

  return { errors };
};

export const action = async ({ request }) => {
  const errors = loginErrorMessage(await login(request));

  return {
    errors,
  };
};

export default function Auth() {
  const loaderData = useLoaderData();
  const actionData = useActionData();
  const [shop, setShop] = useState("");
  const { errors } = actionData || loaderData;
  const { t } = useI18n();

  return (
    <AppProvider embedded={false}>
      <AppPage>
        <Form method="post">
          <s-section heading={t("auth.heading")}>
            <s-text-field
              name="shop"
              label={t("auth.shopDomain")}
              details={t("auth.shopDomainDetails")}
              value={shop}
              onChange={(e) => setShop(e.currentTarget.value)}
              autocomplete="on"
              error={translateError(t, errors.shop)}
            ></s-text-field>
            <s-button type="submit">{t("auth.logIn")}</s-button>
          </s-section>
        </Form>
      </AppPage>
    </AppProvider>
  );
}
