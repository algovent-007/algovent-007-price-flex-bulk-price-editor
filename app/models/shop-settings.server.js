import prisma from "../db.server";

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
