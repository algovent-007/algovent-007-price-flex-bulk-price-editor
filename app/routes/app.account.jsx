import { SaveBar, useAppBridge } from "@shopify/app-bridge-react";
import { useEffect, useMemo, useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";

async function getShopSettings(shop) {
  if (prisma.shopSettings) {
    return prisma.shopSettings.findUnique({ where: { shop } });
  }

  const rows = await prisma.$queryRaw`
    SELECT "name", "email", "timezone"
    FROM "ShopSettings"
    WHERE "shop" = ${shop}
    LIMIT 1
  `;

  return rows[0] || null;
}

async function saveShopSettings({ shop, name, email, timezone }) {
  if (prisma.shopSettings) {
    return prisma.shopSettings.upsert({
      where: { shop },
      create: {
        shop,
        name,
        email,
        timezone,
      },
      update: {
        name,
        email,
        timezone,
      },
    });
  }

  await prisma.$executeRaw`
    INSERT INTO "ShopSettings" ("shop", "name", "email", "timezone", "updatedAt")
    VALUES (${shop}, ${name}, ${email}, ${timezone}, NOW())
    ON CONFLICT ("shop") DO UPDATE SET
      "name" = EXCLUDED."name",
      "email" = EXCLUDED."email",
      "timezone" = EXCLUDED."timezone",
      "updatedAt" = NOW()
  `;

  return { name, email, timezone };
}

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

    const settings = await getShopSettings(session.shop);

    return {
      shopName: settings?.name || shopData?.name || "",
      shopEmail: settings?.email || shopData?.email || "",
      shopDomain: session.shop,
      timezone: settings?.timezone || shopData?.ianaTimezone || "Asia/Kolkata",
    };
  } catch (error) {
    console.error("Failed to query shop details:", error);
    const settings = await getShopSettings(session.shop);

    return {
      shopName: settings?.name || "Prathamesh-Production",
      shopEmail: settings?.email || "prathamesh@thaliatechnologies.com",
      shopDomain: session.shop || "prathamesh-production.myshopify.com",
      timezone: settings?.timezone || "Asia/Kolkata",
    };
  }
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const timezone = String(formData.get("timezone") || "").trim();

  if (!name || !email || !timezone) {
    return Response.json({
      success: false,
      error: "Name, email, and timezone are required.",
    });
  }

  const settings = await saveShopSettings({
    shop: session.shop,
    name,
    email,
    timezone,
  });

  return Response.json({
    success: true,
    settings: {
      name: settings.name,
      email: settings.email,
      timezone: settings.timezone,
    },
  });
};

const ACCOUNT_SAVE_BAR_ID = "account-save-bar";

const SHOPIFY_TIMEZONE_OPTIONS = [
  ["Pacific/Midway", "(GMT-11:00) Midway Island"],
  ["Pacific/Pago_Pago", "(GMT-11:00) American Samoa"],
  ["Pacific/Honolulu", "(GMT-10:00) Hawaii"],
  ["America/Juneau", "(GMT-09:00) Alaska"],
  ["America/Los_Angeles", "(GMT-08:00) Pacific Time (US & Canada)"],
  ["America/Tijuana", "(GMT-08:00) Tijuana"],
  ["America/Denver", "(GMT-07:00) Mountain Time (US & Canada)"],
  ["America/Phoenix", "(GMT-07:00) Arizona"],
  ["America/Chihuahua", "(GMT-07:00) Chihuahua"],
  ["America/Mazatlan", "(GMT-07:00) Mazatlan"],
  ["America/Chicago", "(GMT-06:00) Central Time (US & Canada)"],
  ["America/Regina", "(GMT-06:00) Saskatchewan"],
  ["America/Mexico_City", "(GMT-06:00) Mexico City"],
  ["America/Monterrey", "(GMT-06:00) Monterrey"],
  ["America/Guatemala", "(GMT-06:00) Central America"],
  ["America/New_York", "(GMT-05:00) Eastern Time (US & Canada)"],
  ["America/Indiana/Indianapolis", "(GMT-05:00) Indiana (East)"],
  ["America/Bogota", "(GMT-05:00) Bogota"],
  ["America/Lima", "(GMT-05:00) Lima"],
  ["America/Halifax", "(GMT-04:00) Atlantic Time (Canada)"],
  ["America/Caracas", "(GMT-04:00) Caracas"],
  ["America/La_Paz", "(GMT-04:00) La Paz"],
  ["America/Santiago", "(GMT-04:00) Santiago"],
  ["America/St_Johns", "(GMT-03:30) Newfoundland"],
  ["America/Sao_Paulo", "(GMT-03:00) Brasilia"],
  ["America/Argentina/Buenos_Aires", "(GMT-03:00) Buenos Aires"],
  ["America/Guyana", "(GMT-03:00) Georgetown"],
  ["America/Godthab", "(GMT-03:00) Greenland"],
  ["Atlantic/South_Georgia", "(GMT-02:00) Mid-Atlantic"],
  ["Atlantic/Azores", "(GMT-01:00) Azores"],
  ["Atlantic/Cape_Verde", "(GMT-01:00) Cape Verde Is."],
  ["Europe/London", "(GMT+00:00) London"],
  ["UTC", "(GMT+00:00) UTC"],
  ["Europe/Dublin", "(GMT+00:00) Dublin"],
  ["Europe/Lisbon", "(GMT+00:00) Lisbon"],
  ["Africa/Casablanca", "(GMT+00:00) Casablanca"],
  ["Africa/Monrovia", "(GMT+00:00) Monrovia"],
  ["Europe/Belgrade", "(GMT+01:00) Belgrade"],
  ["Europe/Bratislava", "(GMT+01:00) Bratislava"],
  ["Europe/Budapest", "(GMT+01:00) Budapest"],
  ["Europe/Ljubljana", "(GMT+01:00) Ljubljana"],
  ["Europe/Prague", "(GMT+01:00) Prague"],
  ["Europe/Sarajevo", "(GMT+01:00) Sarajevo"],
  ["Europe/Skopje", "(GMT+01:00) Skopje"],
  ["Europe/Warsaw", "(GMT+01:00) Warsaw"],
  ["Europe/Zagreb", "(GMT+01:00) Zagreb"],
  ["Europe/Brussels", "(GMT+01:00) Brussels"],
  ["Europe/Copenhagen", "(GMT+01:00) Copenhagen"],
  ["Europe/Madrid", "(GMT+01:00) Madrid"],
  ["Europe/Paris", "(GMT+01:00) Paris"],
  ["Europe/Amsterdam", "(GMT+01:00) Amsterdam"],
  ["Europe/Berlin", "(GMT+01:00) Berlin"],
  ["Europe/Rome", "(GMT+01:00) Rome"],
  ["Europe/Stockholm", "(GMT+01:00) Stockholm"],
  ["Europe/Vienna", "(GMT+01:00) Vienna"],
  ["Africa/Algiers", "(GMT+01:00) West Central Africa"],
  ["Europe/Bucharest", "(GMT+02:00) Bucharest"],
  ["Africa/Cairo", "(GMT+02:00) Cairo"],
  ["Europe/Helsinki", "(GMT+02:00) Helsinki"],
  ["Europe/Kyiv", "(GMT+02:00) Kyiv"],
  ["Europe/Riga", "(GMT+02:00) Riga"],
  ["Europe/Sofia", "(GMT+02:00) Sofia"],
  ["Europe/Tallinn", "(GMT+02:00) Tallinn"],
  ["Europe/Vilnius", "(GMT+02:00) Vilnius"],
  ["Europe/Athens", "(GMT+02:00) Athens"],
  ["Europe/Istanbul", "(GMT+03:00) Istanbul"],
  ["Europe/Minsk", "(GMT+03:00) Minsk"],
  ["Asia/Jerusalem", "(GMT+02:00) Jerusalem"],
  ["Africa/Harare", "(GMT+02:00) Harare"],
  ["Africa/Johannesburg", "(GMT+02:00) Pretoria"],
  ["Europe/Moscow", "(GMT+03:00) Moscow"],
  ["Asia/Kuwait", "(GMT+03:00) Kuwait"],
  ["Asia/Riyadh", "(GMT+03:00) Riyadh"],
  ["Africa/Nairobi", "(GMT+03:00) Nairobi"],
  ["Asia/Baghdad", "(GMT+03:00) Baghdad"],
  ["Asia/Tehran", "(GMT+03:30) Tehran"],
  ["Asia/Muscat", "(GMT+04:00) Abu Dhabi"],
  ["Asia/Dubai", "(GMT+04:00) Dubai"],
  ["Asia/Baku", "(GMT+04:00) Baku"],
  ["Asia/Tbilisi", "(GMT+04:00) Tbilisi"],
  ["Asia/Yerevan", "(GMT+04:00) Yerevan"],
  ["Asia/Kabul", "(GMT+04:30) Kabul"],
  ["Asia/Yekaterinburg", "(GMT+05:00) Ekaterinburg"],
  ["Asia/Karachi", "(GMT+05:00) Karachi"],
  ["Asia/Tashkent", "(GMT+05:00) Tashkent"],
  ["Asia/Kolkata", "(GMT+05:30) New Delhi"],
  ["Asia/Colombo", "(GMT+05:30) Sri Jayawardenepura"],
  ["Asia/Kathmandu", "(GMT+05:45) Kathmandu"],
  ["Asia/Dhaka", "(GMT+06:00) Dhaka"],
  ["Asia/Almaty", "(GMT+06:00) Almaty"],
  ["Asia/Novosibirsk", "(GMT+07:00) Novosibirsk"],
  ["Asia/Bangkok", "(GMT+07:00) Bangkok"],
  ["Asia/Jakarta", "(GMT+07:00) Jakarta"],
  ["Asia/Krasnoyarsk", "(GMT+07:00) Krasnoyarsk"],
  ["Asia/Shanghai", "(GMT+08:00) Beijing"],
  ["Asia/Chongqing", "(GMT+08:00) Chongqing"],
  ["Asia/Hong_Kong", "(GMT+08:00) Hong Kong"],
  ["Asia/Urumqi", "(GMT+08:00) Urumqi"],
  ["Asia/Kuala_Lumpur", "(GMT+08:00) Kuala Lumpur"],
  ["Asia/Singapore", "(GMT+08:00) Singapore"],
  ["Asia/Taipei", "(GMT+08:00) Taipei"],
  ["Australia/Perth", "(GMT+08:00) Perth"],
  ["Asia/Irkutsk", "(GMT+08:00) Irkutsk"],
  ["Asia/Ulaanbaatar", "(GMT+08:00) Ulaan Bataar"],
  ["Asia/Seoul", "(GMT+09:00) Seoul"],
  ["Asia/Tokyo", "(GMT+09:00) Tokyo"],
  ["Asia/Yakutsk", "(GMT+09:00) Yakutsk"],
  ["Australia/Darwin", "(GMT+09:30) Darwin"],
  ["Australia/Adelaide", "(GMT+09:30) Adelaide"],
  ["Australia/Canberra", "(GMT+10:00) Canberra"],
  ["Australia/Melbourne", "(GMT+10:00) Melbourne"],
  ["Australia/Sydney", "(GMT+10:00) Sydney"],
  ["Australia/Brisbane", "(GMT+10:00) Brisbane"],
  ["Australia/Hobart", "(GMT+10:00) Hobart"],
  ["Asia/Vladivostok", "(GMT+10:00) Vladivostok"],
  ["Pacific/Guam", "(GMT+10:00) Guam"],
  ["Pacific/Port_Moresby", "(GMT+10:00) Port Moresby"],
  ["Asia/Magadan", "(GMT+11:00) Magadan"],
  ["Pacific/Noumea", "(GMT+11:00) New Caledonia"],
  ["Pacific/Fiji", "(GMT+12:00) Fiji"],
  ["Asia/Kamchatka", "(GMT+12:00) Kamchatka"],
  ["Pacific/Majuro", "(GMT+12:00) Marshall Is."],
  ["Pacific/Auckland", "(GMT+12:00) Auckland"],
  ["Pacific/Tongatapu", "(GMT+13:00) Nuku'alofa"],
];

function getTimezoneOptions(currentTimezone) {
  if (
    !currentTimezone ||
    SHOPIFY_TIMEZONE_OPTIONS.some(([value]) => value === currentTimezone)
  ) {
    return SHOPIFY_TIMEZONE_OPTIONS;
  }

  return [
    ...SHOPIFY_TIMEZONE_OPTIONS,
    [currentTimezone, currentTimezone],
  ];
}

export default function Account() {
  const { shopName, shopEmail, shopDomain, timezone } = useLoaderData();
  const appBridge = useAppBridge();
  const fetcher = useFetcher();
  const [savedAccount, setSavedAccount] = useState({
    name: shopName,
    email: shopEmail,
    timezone,
  });
  const [name, setName] = useState(shopName);
  const [email, setEmail] = useState(shopEmail);
  const [selectedTimezone, setSelectedTimezone] = useState(timezone);
  const timezoneOptions = useMemo(
    () => getTimezoneOptions(selectedTimezone),
    [selectedTimezone]
  );

  const isDirty = useMemo(
    () =>
      name !== savedAccount.name ||
      email !== savedAccount.email ||
      selectedTimezone !== savedAccount.timezone,
    [email, name, savedAccount, selectedTimezone]
  );

  useEffect(() => {
    if (isDirty) {
      appBridge.saveBar.show(ACCOUNT_SAVE_BAR_ID);
    } else {
      appBridge.saveBar.hide(ACCOUNT_SAVE_BAR_ID);
    }
  }, [appBridge, isDirty]);

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;

    if (fetcher.data.success) {
      const settings = fetcher.data.settings;
      setSavedAccount(settings);
      setName(settings.name);
      setEmail(settings.email);
      setSelectedTimezone(settings.timezone);
      appBridge.saveBar.hide(ACCOUNT_SAVE_BAR_ID);
      appBridge.toast.show("Account settings saved");
    } else if (fetcher.data.error) {
      appBridge.toast.show(fetcher.data.error, { isError: true });
    }
  }, [appBridge, fetcher.data, fetcher.state]);

  const handleSave = () => {
    fetcher.submit(
      {
        name,
        email,
        timezone: selectedTimezone,
      },
      { method: "POST" }
    );
  };

  const handleDiscard = () => {
    setName(savedAccount.name);
    setEmail(savedAccount.email);
    setSelectedTimezone(savedAccount.timezone);
    appBridge.saveBar.hide(ACCOUNT_SAVE_BAR_ID);
  };

  return (
    <s-page heading="Account">
      <SaveBar id={ACCOUNT_SAVE_BAR_ID} discardConfirmation>
        <button
          variant="primary"
          onClick={handleSave}
          loading={fetcher.state !== "idle" ? "" : undefined}
        >
          Save
        </button>
        <button onClick={handleDiscard}>Discard</button>
      </SaveBar>

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

          <s-select
            label="Timezone"
            value={selectedTimezone}
            onInput={(e) => setSelectedTimezone(e.target.value)}
          >
            {timezoneOptions.map(([value, label]) => (
              <s-option key={value} value={value}>
                {label}
              </s-option>
            ))}
          </s-select>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
