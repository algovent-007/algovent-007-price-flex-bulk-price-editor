import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function run() {
  try {
    const session = await prisma.session.findFirst();
    if (!session) {
      console.log("No active Shopify sessions found in the Prisma database.");
      return;
    }

    console.log(`Active session found for shop: ${session.shop}`);

    const graphqlUrl = `https://${session.shop}/admin/api/2025-10/graphql.json`;
    const response = await fetch(graphqlUrl, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": session.accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `{
          products(first: 10) {
            nodes {
              id
              title
              variants(first: 5) {
                nodes {
                  id
                  title
                  price
                  compareAtPrice
                }
              }
            }
          }
        }`
      }),
    });

    const json = await response.json();
    console.log("Shopify API Response Status:", response.status);
    console.log("Shopify Products Query Output:", JSON.stringify(json, null, 2));
  } catch (error) {
    console.error("Diagnostic script error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
