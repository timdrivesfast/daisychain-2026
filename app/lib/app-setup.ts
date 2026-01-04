/**
 * App setup and initialization
 * Handles discount creation and function ID discovery on first app access
 */

import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import {
  getFunctionId,
  getShopConfig,
  storeFunctionId,
  storeDiscountId,
  storeStoreCreditDiscountId,
  getStoredFunctionId,
  getStoredDiscountId,
  getStoredStoreCreditDiscountId,
} from "./function-management";
import {
  getOrCreateDaisychainDiscount,
  findDaisychainDiscount,
  createStoreCreditDiscount,
  findStoreCreditDiscount,
  DEFAULT_CONFIG,
} from "./discount-config";

/**
 * Validate that a discount ID is actually an automatic app discount
 */
async function validateDiscountType(
  admin: AdminApiContext,
  discountId: string,
): Promise<boolean> {
  // Check if it's a DiscountCodeNode (wrong type) - this is the key issue!
  if (discountId.includes("DiscountCodeNode")) {
    console.warn(`[Setup] ⚠️ Discount ID is a DiscountCodeNode, not DiscountAutomaticApp: ${discountId}`);
    return false;
  }
  
  // If it doesn't contain "DiscountAutomaticApp", it might still be valid (just the ID)
  // But we should check by querying
  try {
    const query = `#graphql
      query ValidateDiscountType($id: ID!) {
        discountNode(id: $id) {
          id
        }
      }
    `;
    
    const response = await admin.graphql(query, {
      variables: { id: discountId },
    });
    const data = await response.json();
    const discount = data.data?.discountNode;
    
    // If discount exists and ID matches, check if it's the right type by looking at the ID format
    // Automatic app discounts have format: gid://shopify/DiscountAutomaticApp/...
    if (discount && discount.id) {
      const isValidType = discount.id.includes("DiscountAutomaticApp") || 
                         (!discount.id.includes("DiscountCodeNode") && !discount.id.includes("DiscountBasic"));
      return isValidType;
    }
    
    return false;
  } catch (error) {
    console.warn(`[Setup] Error validating discount type:`, error);
    return false;
  }
}

/**
 * Ensure the app is set up for a shop
 * This should be called on first admin route access after OAuth
 * 
 * Steps:
 * 1. Query for function ID if not stored
 * 2. Create discount if it doesn't exist
 * 3. Store IDs in database
 */
export async function ensureAppSetup(
  admin: AdminApiContext,
  shop: string,
): Promise<{ functionId: string | null; discountId: string | null; storeCreditDiscountId: string | null }> {
  const config = await getShopConfig(shop);

  // Step 1: Get function ID (query if not stored)
  let functionId = config.functionId;
  if (!functionId) {
    console.log(`[Setup] Querying for function ID for shop: ${shop}`);
    functionId = await getFunctionId(admin);
    
    if (functionId) {
      await storeFunctionId(shop, functionId);
      console.log(`[Setup] Stored function ID: ${functionId}`);
    } else {
      console.warn(
        `[Setup] Could not find function ID. Make sure the discount function is deployed.`,
      );
      return { functionId: null, discountId: null, storeCreditDiscountId: null };
    }
  }

  // Step 2: Get or create discount
  let discountId = config.discountId;
  const functionHandle = "daisychain-discount-function";
  
  // Validate existing discount ID - make sure it's an automatic app discount, not a code discount
  if (discountId) {
    console.log(`[Setup] Found discount ID in config: ${discountId}`);
    // Check if it's actually an automatic app discount
    const isValid = await validateDiscountType(admin, discountId);
    if (!isValid) {
      console.warn(`[Setup] ⚠️ Stored discount ID is not an automatic app discount (might be a code discount). Clearing and recreating...`);
      discountId = null; // Clear invalid discount ID
      // Clear from database by storing empty string (database will handle null)
      const { storeDiscountId } = await import("./function-management");
      await storeDiscountId(shop, "");
    }
  }
  
  if (!discountId && functionId) {
    console.log(`[Setup] No valid discount ID found, searching for existing automatic app discount...`);
    // Try to find existing automatic app discount first (will skip code discounts)
    discountId = await findDaisychainDiscount(admin, functionId, functionHandle);
    
    if (!discountId) {
      console.log(`[Setup] No existing automatic app discount found, creating new one for shop: ${shop}`);
      console.log(`[Setup] Using functionId: ${functionId}, functionHandle: ${functionHandle}`);
      discountId = await getOrCreateDaisychainDiscount(
        admin,
        functionId,
        DEFAULT_CONFIG,
        functionHandle,
      );
      
      if (discountId) {
        console.log(`[Setup] ✅ Successfully created automatic app discount: ${discountId}`);
        // Verify it's the right type before storing
        if (discountId.includes("DiscountCodeNode")) {
          console.error(`[Setup] ❌ CRITICAL: Created discount is still a DiscountCodeNode! This should not happen.`);
          discountId = null;
        }
      } else {
        console.error(`[Setup] ❌ Failed to create discount for shop: ${shop}`);
        console.error(`[Setup] Check GraphQL errors in logs above`);
      }
    } else {
      console.log(`[Setup] ✅ Found existing automatic app discount: ${discountId}`);
      // Double-check it's not a code discount
      if (discountId.includes("DiscountCodeNode")) {
        console.error(`[Setup] ❌ CRITICAL: findDaisychainDiscount returned a DiscountCodeNode! Skipping...`);
        discountId = null;
      }
    }

    if (discountId) {
      await storeDiscountId(shop, discountId);
      console.log(`[Setup] ✅ Stored valid automatic app discount ID in database: ${discountId}`);
    } else {
      console.error(`[Setup] ❌ No valid discount ID available to store for shop: ${shop}`);
    }
  } else if (discountId) {
    console.log(`[Setup] ✅ Valid discount ID already exists: ${discountId}`);
  } else {
    console.warn(`[Setup] ⚠️ No function ID available, cannot create discount`);
  }

  // Step 3: Get or create store credit discount
  let storeCreditDiscountId = (config as any).storeCreditDiscountId;
  
  if (!storeCreditDiscountId && functionId) {
    console.log(`[Setup] No store credit discount ID found, searching for existing...`);
    storeCreditDiscountId = await findStoreCreditDiscount(admin, functionId, functionHandle);
    
    if (!storeCreditDiscountId) {
      console.log(`[Setup] Creating store credit discount for shop: ${shop}`);
      storeCreditDiscountId = await createStoreCreditDiscount(admin, functionId, functionHandle);
      
      if (storeCreditDiscountId) {
        console.log(`[Setup] ✅ Successfully created store credit discount: ${storeCreditDiscountId}`);
        await storeStoreCreditDiscountId(shop, storeCreditDiscountId);
      } else {
        console.error(`[Setup] ❌ Failed to create store credit discount`);
      }
    } else {
      console.log(`[Setup] ✅ Found existing store credit discount: ${storeCreditDiscountId}`);
      await storeStoreCreditDiscountId(shop, storeCreditDiscountId);
    }
  } else if (storeCreditDiscountId) {
    console.log(`[Setup] ✅ Store credit discount ID already exists: ${storeCreditDiscountId}`);
  }

  return { functionId, discountId, storeCreditDiscountId };
}

/**
 * Check if app is set up (has both function ID and discount ID)
 */
export async function isAppSetup(shop: string): Promise<boolean> {
  const config = await getShopConfig(shop);
  return !!(config.functionId && config.discountId);
}

