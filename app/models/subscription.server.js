import prisma from "../db.server";

export async function getSubscriptionByShop(shop) {
  return prisma.subscription.findUnique({
    where: { shop },
  });
}

export async function upsertSubscription({
  shop,
  planName,
  status,
  chargeId = null,
}) {
  return prisma.subscription.upsert({
    where: { shop },
    create: {
      shop,
      planName,
      status,
      chargeId,
    },
    update: {
      planName,
      status,
      chargeId,
    },
  });
}

export async function updateSubscriptionByShop(shop, data) {
  return prisma.subscription.update({
    where: { shop },
    data,
  });
}

export async function deleteSubscriptionByShop(shop) {
  return prisma.subscription.deleteMany({
    where: { shop },
  });
}

export async function listSubscriptionsByStatus(status) {
  return prisma.subscription.findMany({
    where: { status },
    orderBy: { updatedAt: "desc" },
  });
}
