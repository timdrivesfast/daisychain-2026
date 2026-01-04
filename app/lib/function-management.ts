/**
 * Function management utilities
 * Handles querying for function IDs and storing them in the database
 */

import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";

/**
 * Query Shopify Functions API to get the function ID for our discount function
 * Filters by apiType: DISCOUNT and title matching our function name
 */
export async function getFunctionId(
  admin: AdminApiContext,
  functionHandle: string = "daisychain-discount-function",
): Promise<string | null> {
  const query = `#graphql
    query GetFunctions($first: Int!) {
      shopifyFunctions(first: $first) {
        edges {
          node {
            id
            title
            apiType
          }
        }
      }
    }
  `;

  try {
    const response = await admin.graphql(query, {
      variables: { first: 100 },
    });

    const data = await response.json();
    const functions = data.data?.shopifyFunctions?.edges || [];

    console.log(`[Function Query] Found ${functions.length} functions total`);
    
    // Log all functions for debugging
    for (const edge of functions) {
      const func = edge.node;
      console.log(`[Function Query] Function: id=${func.id}, title="${func.title}", apiType="${func.apiType}"`);
    }

    // Look for discount function by apiType "discount" or "discounts" and title containing the handle or "daisychain"
    for (const edge of functions) {
      const func = edge.node;
      if (
        (func.apiType === "discount" || func.apiType === "discounts") &&
        (func.title?.toLowerCase().includes(functionHandle.toLowerCase()) ||
          func.title?.toLowerCase().includes("daisychain"))
      ) {
        console.log(`[Function Query] Found function by title match: ${func.id} (title: ${func.title}, apiType: ${func.apiType})`);
        return func.id;
      }
    }

    // Last resort: Return first discount function (with warning)
    for (const edge of functions) {
      const func = edge.node;
      if (func.apiType === "discount" || func.apiType === "discounts") {
        console.warn(
          `[Function Query] Function ID found by type only (not by title): ${func.id}. Expected title to contain "${functionHandle}" but found title: ${func.title}, apiType: ${func.apiType}`,
        );
        return func.id;
      }
    }

    console.warn(
      `[Function Query] No discount functions found. Total functions: ${functions.length}. Check the logs above to see what functions were returned.`,
    );
    return null;
  } catch (error) {
    console.error("Error querying shopifyFunctions:", error);
    return null;
  }
}

/**
 * Get or create shop config in database
 */
export async function getShopConfig(shop: string) {
  let config = await db.shopConfig.findUnique({
    where: { shop },
  });

  if (!config) {
    config = await db.shopConfig.create({
      data: { shop },
    });
  }

  return config;
}

/**
 * Store function ID for a shop
 */
export async function storeFunctionId(
  shop: string,
  functionId: string,
): Promise<void> {
  await db.shopConfig.upsert({
    where: { shop },
    create: {
      shop,
      functionId,
    },
    update: {
      functionId,
      updatedAt: new Date(),
    },
  });
}

/**
 * Store discount ID for a shop
 */
export async function storeDiscountId(
  shop: string,
  discountId: string,
): Promise<void> {
  await db.shopConfig.upsert({
    where: { shop },
    create: {
      shop,
      discountId,
    },
    update: {
      discountId,
      updatedAt: new Date(),
    },
  });
}

/**
 * Store store credit discount ID for a shop
 */
export async function storeStoreCreditDiscountId(
  shop: string,
  storeCreditDiscountId: string,
): Promise<void> {
  await db.shopConfig.upsert({
    where: { shop },
    create: {
      shop,
      storeCreditDiscountId,
    } as any,
    update: {
      storeCreditDiscountId,
      updatedAt: new Date(),
    } as any,
  });
}

/**
 * Get stored store credit discount ID for a shop
 */
export async function getStoredStoreCreditDiscountId(shop: string): Promise<string | null> {
  const config = await db.shopConfig.findUnique({
    where: { shop },
    select: { storeCreditDiscountId: true } as any,
  });

  return (config as any)?.storeCreditDiscountId || null;
}

/**
 * Get stored function ID for a shop
 */
export async function getStoredFunctionId(shop: string): Promise<string | null> {
  const config = await db.shopConfig.findUnique({
    where: { shop },
    select: { functionId: true },
  });

  return config?.functionId || null;
}

/**
 * Get stored discount ID for a shop
 */
export async function getStoredDiscountId(shop: string): Promise<string | null> {
  const config = await db.shopConfig.findUnique({
    where: { shop },
    select: { discountId: true },
  });

  return config?.discountId || null;
}

