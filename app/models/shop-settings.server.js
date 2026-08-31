import prisma from "../db.server";

export async function getShopAccessGrants(shop) {
  const empty = { adminGrantedInstall: false, adminGrantedPayment: false, adminPlanName: "" };
  if (!shop) {
    return empty;
  }

  try {
    const rows = await prisma.$queryRaw`
      SELECT
        COALESCE("adminGrantedInstall", false) AS "adminGrantedInstall",
        COALESCE("adminGrantedPayment", false) AS "adminGrantedPayment",
        COALESCE("adminPlanName", '') AS "adminPlanName"
      FROM "ShopSettings"
      WHERE "shop" = ${shop}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) {
      return empty;
    }

    return {
      adminGrantedInstall: Boolean(row.adminGrantedInstall),
      adminGrantedPayment: Boolean(row.adminGrantedPayment),
      adminPlanName: row.adminPlanName || "",
    };
  } catch (error) {
    const message = String(error?.message || error?.code || "");
    if (
      message.includes("adminGranted") ||
      message.includes("adminPlanName") ||
      message.includes("does not exist") ||
      error?.code === "P2022" ||
      error?.code === "42703"
    ) {
      return empty;
    }

    throw error;
  }
}

export async function getShopSettings(shop) {
  if (prisma.shopSettings) {
    return prisma.shopSettings.findUnique({ where: { shop } });
  }

  const rows = await prisma.$queryRaw`
    SELECT "name", "email", "timezone", "taskFinishedEmailEnabled"
    FROM "ShopSettings"
    WHERE "shop" = ${shop}
    LIMIT 1
  `;

  return rows[0] || null;
}

export async function saveShopSettings({ shop, name, email, timezone }) {
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
        uninstalledAt: null,
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
      "uninstalledAt" = NULL,
      "updatedAt" = NOW()
  `;

  return { name, email, timezone };
}

export async function setTaskFinishedEmailEnabled(shop, enabled) {
  if (prisma.shopSettings) {
    return prisma.shopSettings.upsert({
      where: { shop },
      create: {
        shop,
        taskFinishedEmailEnabled: enabled,
      },
      update: {
        taskFinishedEmailEnabled: enabled,
      },
    });
  }

  await prisma.$executeRaw`
    INSERT INTO "ShopSettings" ("shop", "taskFinishedEmailEnabled", "updatedAt")
    VALUES (${shop}, ${enabled}, NOW())
    ON CONFLICT ("shop") DO UPDATE SET
      "taskFinishedEmailEnabled" = EXCLUDED."taskFinishedEmailEnabled",
      "updatedAt" = NOW()
  `;

  return { taskFinishedEmailEnabled: enabled };
}

export async function clearShopUninstalled(shop) {
  if (!shop) return null;

  if (prisma.shopSettings) {
    return prisma.shopSettings.updateMany({
      where: { shop },
      data: { uninstalledAt: null },
    });
  }

  await prisma.$executeRaw`
    UPDATE "ShopSettings"
    SET "uninstalledAt" = NULL, "updatedAt" = NOW()
    WHERE "shop" = ${shop}
  `;

  return { shop, uninstalledAt: null };
}

export async function markShopUninstalled(shop) {
  if (!shop) return null;

  if (prisma.shopSettings) {
    const existing = await prisma.shopSettings.findUnique({ where: { shop } });
    const uninstalledAt = existing?.uninstalledAt || new Date();
    return prisma.shopSettings.upsert({
      where: { shop },
      create: {
        shop,
        uninstalledAt,
      },
      update: {
        uninstalledAt,
        adminGrantedInstall: false,
        adminGrantedPayment: false,
        adminPlanName: null,
      },
    });
  }

  await prisma.$executeRaw`
    INSERT INTO "ShopSettings" ("shop", "uninstalledAt", "updatedAt")
    VALUES (${shop}, NOW(), NOW())
    ON CONFLICT ("shop") DO UPDATE SET
      "uninstalledAt" = NOW(),
      "adminGrantedInstall" = false,
      "adminGrantedPayment" = false,
      "adminPlanName" = NULL,
      "updatedAt" = NOW()
  `;

  return { shop, uninstalledAt: new Date() };
}
