import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Helper functions matching backend action solver
const roundValue = (p, roundCentsVal) => {
  let val = p;
  if (roundCentsVal === "2") {
    val = Math.round(val * 100) / 100;
  } else if (roundCentsVal === "3") {
    val = Math.round(val);
  } else if (roundCentsVal === "4") {
    val = Math.ceil(val);
  } else if (roundCentsVal === "5") {
    val = Math.floor(val);
  } else if (roundCentsVal === "6") {
    val = Math.round(val * 20) / 20;
  } else if (roundCentsVal === "7") {
    val = Math.ceil(val * 20) / 20;
  } else if (roundCentsVal === "8") {
    val = Math.floor(val * 20) / 20;
  } else if (roundCentsVal === "9") {
    val = Math.floor(val) + 0.99;
  }
  return val;
};

const calculateNewValue = (
  currentVal,
  baseType,
  currentPrice,
  currentCompare,
  currentCost,
  percentType,
  percentVal,
  fixedType,
  fixedVal,
  fixedPriceAmt,
  roundCentsVal
) => {
  let base = currentVal;
  if (baseType === "1") {
    base = currentPrice;
  } else if (baseType === "2") {
    base = currentCompare;
  } else if (baseType === "3") {
    base = currentCost;
  } else if (baseType === "4") {
    base = currentPrice;
  } else if (baseType === "5") {
    return roundValue(parseFloat(fixedPriceAmt) || 0, roundCentsVal);
  } else if (baseType === "6") {
    return currentVal;
  } else if (baseType === "7" || baseType === "9") {
    return 0;
  }

  let p = base;
  let pct = parseFloat(percentVal) || 0;
  let fix = parseFloat(fixedVal) || 0;

  if (percentType === "1") {
    p = p + (p * pct / 100);
  } else if (percentType === "2") {
    p = p - (p * pct / 100);
  }

  if (fixedType === "1") {
    p = p + fix;
  } else if (fixedType === "2") {
    p = p - fix;
  } else if (fixedType === "4") {
    p = p * fix;
  }

  return roundValue(p, roundCentsVal);
};

async function run() {
  try {
    const session = await prisma.session.findFirst();
    if (!session) {
      console.log("No active sessions.");
      return;
    }

    console.log(`Executing test run_task for shop: ${session.shop}`);

    // Simulation settings:
    // Let's increase price by 10% on "all" products, with no change to compare and cost, round cents to Nearest Integer.
    const editType = "all";
    const changePrice = "1"; // based on current price
    const percentType = "1"; // increase by
    const percentValue = "10"; // 10%
    const fixedType = "3"; // no change
    const fixedValue = "0";
    const fixedPriceAmount = "0";
    const roundCents = "3"; // Nearest Integer

    const comparePriceType = "6"; // no change
    const costPriceType = "6"; // no change

    const queryStr = ""; // fetch all

    const graphqlUrl = `https://${session.shop}/admin/api/2025-10/graphql.json`;

    // Helper fetch function
    const shopifyQuery = async (query, variables = {}) => {
      const response = await fetch(graphqlUrl, {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": session.accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, variables }),
      });
      return response.json();
    };

    console.log("Fetching products and variants...");
    const productsRes = await shopifyQuery(`
      query getProducts($query: String) {
        products(first: 10, query: $query) {
          nodes {
            id
            title
            tags
            variants(first: 20) {
              nodes {
                id
                price
                compareAtPrice
                inventoryItem {
                  id
                  unitCost {
                    amount
                  }
                }
              }
            }
          }
        }
      }
    `, { query: queryStr || null });

    if (productsRes.errors) {
      console.error("GraphQL Fetch Error:", JSON.stringify(productsRes.errors, null, 2));
      return;
    }

    const products = productsRes.data?.products?.nodes || [];
    console.log(`Found ${products.length} products to process.`);

    let updatedProductsCount = 0;
    let updatedVariantsCount = 0;

    for (const prod of products) {
      console.log(`Processing product: "${prod.title}" (ID: ${prod.id})`);
      let productUpdated = false;

      const variants = prod.variants?.nodes || [];
      const variantsToUpdate = [];

      for (const variant of variants) {
        const currentPrice = parseFloat(variant.price) || 0;
        const currentCompare = parseFloat(variant.compareAtPrice) || 0;
        const currentCost = parseFloat(variant.inventoryItem?.unitCost?.amount) || 0;

        // Calculate new price
        let newPrice = currentPrice;
        if (changePrice !== "6") {
          newPrice = calculateNewValue(
            currentPrice,
            changePrice,
            currentPrice,
            currentCompare,
            currentCost,
            percentType,
            percentValue,
            fixedType,
            fixedValue,
            fixedPriceAmount,
            roundCents
          );
          if (isNaN(newPrice)) {
            newPrice = currentPrice;
          }
        }

        console.log(`  Variant ID: ${variant.id}`);
        console.log(`    Current Price: ${currentPrice} => New Price: ${newPrice}`);

        if (changePrice !== "6" || comparePriceType !== "6") {
          variantsToUpdate.push({
            id: variant.id,
            price: newPrice.toFixed(2),
          });
        }
      }

      if (variantsToUpdate.length > 0) {
        console.log(`  Executing bulk update for ${variantsToUpdate.length} variant(s)...`);
        const bulkRes = await shopifyQuery(`
          mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
            productVariantsBulkUpdate(productId: $productId, variants: $variants) {
              productVariants {
                id
                price
              }
              userErrors {
                field
                message
              }
            }
          }
        `, {
          productId: prod.id,
          variants: variantsToUpdate,
        });

        if (bulkRes.errors) {
          console.error("  Bulk mutation HTTP/GraphQL errors:", JSON.stringify(bulkRes.errors, null, 2));
        } else {
          const bulkErrors = bulkRes.data?.productVariantsBulkUpdate?.userErrors || [];
          if (bulkErrors.length > 0) {
            console.error("  Bulk mutation userErrors:", JSON.stringify(bulkErrors, null, 2));
          } else {
            console.log("  Successfully updated variants.");
            productUpdated = true;
            updatedVariantsCount += variantsToUpdate.length;
          }
        }
      }

      if (productUpdated) {
        updatedProductsCount++;
      }
    }

    console.log(`Summary: Updated ${updatedProductsCount} product(s) and ${updatedVariantsCount} variant(s).`);
  } catch (err) {
    console.error("Execution error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
