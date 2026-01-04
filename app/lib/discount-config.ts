/**
 * Discount management logic for Daisychain
 * Handles creation, retrieval, and updates of the automatic discount
 */

import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { getDiscountConfig, updateDiscountConfig } from "./shopify-queries";

const METAFIELD_NAMESPACE = "$app:daisychain";

export interface DiscountConfig {
  referee_discount_percentage: number;
  referee_min_order: number;
  referrer_credit_amount: number;
  min_referrer_orders: number;
  // Referee offer settings
  referee_available_after_days: number; // 0 = immediate
  referee_redeemable_as_store_credit: boolean;
  referee_redeemable_before_referral: boolean;
  // Referrer offer settings
  referrer_available_after_days: number; // Days after order completion
  referrer_redeemable_as_store_credit: boolean;
  // Widget styling
  widget_primary_color: string; // Main button/badge color
  widget_secondary_color: string; // Hover state color
  widget_success_color: string; // Checkmark/validated state color
  widget_text_color: string; // Text color on colored backgrounds
  // Email settings
  email_notifications_enabled: boolean; // Enable/disable email notifications
}

export const DEFAULT_CONFIG: DiscountConfig = {
  referee_discount_percentage: 10,
  referee_min_order: 0,
  referrer_credit_amount: 5.0,
  min_referrer_orders: 1,
  // Referee defaults
  referee_available_after_days: 0, // Immediate
  referee_redeemable_as_store_credit: false,
  referee_redeemable_before_referral: false,
  // Referrer defaults
  referrer_available_after_days: 30,
  referrer_redeemable_as_store_credit: true,
  // Widget styling defaults (Daisychain red gradient)
  widget_primary_color: "#ff6b6b",
  widget_secondary_color: "#ee5a6f",
  widget_success_color: "#4caf50",
  widget_text_color: "#ffffff",
  // Email defaults
  email_notifications_enabled: true,
};

/**
 * Find the Daisychain discount by function ID
 * Returns discount ID if found, null otherwise
 */
export async function findDaisychainDiscount(
  admin: AdminApiContext,
  functionId: string,
  functionHandle?: string,
): Promise<string | null> {
  // Query for discounts and filter to only automatic app discounts
  const query = `#graphql
    query FindDaisychainDiscount($query: String!) {
      discountNodes(first: 10, query: $query) {
        edges {
          node {
            id
          }
        }
      }
    }
  `;

  // Try querying by functionHandle first (more reliable)
  let searchQuery = functionHandle 
    ? `function_handle:${functionHandle}` 
    : `function_id:${functionId}`;

  const response = await admin.graphql(query, {
    variables: {
      query: searchQuery,
    },
  });
  const data = await response.json();

  const discounts = data.data?.discountNodes?.edges || [];
  
  // Filter to only return DiscountAutomaticApp (NOT DiscountCodeNode)
  for (const edge of discounts) {
    const discount = edge.node;
    if (discount && discount.id) {
      // CRITICAL: Only return DiscountAutomaticApp, reject DiscountCodeNode
      if (discount.id.includes("DiscountAutomaticApp")) {
        console.log(`[findDaisychainDiscount] ✅ Found valid automatic app discount: ${discount.id}`);
        return discount.id;
      } else if (discount.id.includes("DiscountCodeNode")) {
        console.warn(`[findDaisychainDiscount] ⚠️ Skipping DiscountCodeNode: ${discount.id} (wrong type)`);
        continue; // Skip code discounts
      }
    }
  }

  console.log(`[findDaisychainDiscount] No valid automatic app discount found for functionId: ${functionId}, functionHandle: ${functionHandle || 'none'}`);
  return null;
}

/**
 * Create the automatic discount for Daisychain
 * Should be called during app installation
 */
export async function createDaisychainDiscount(
  admin: AdminApiContext,
  functionId: string,
  config: DiscountConfig = DEFAULT_CONFIG,
  functionHandle?: string,
): Promise<string | null> {
  const mutation = `#graphql
    mutation CreateDaisychainDiscount($input: DiscountAutomaticAppInput!) {
      discountAutomaticAppCreate(automaticAppDiscount: $input) {
        automaticAppDiscount {
          discountId
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const startsAt = new Date().toISOString();

  // Prefer functionHandle over functionId (more stable, recommended approach)
  const input: any = {
    title: "Daisychain Referral Rewards",
    startsAt,
    discountClasses: ["ORDER"], // CRITICAL: Must match what the function returns
    metafields: [
      {
        namespace: METAFIELD_NAMESPACE,
        key: "config",
        type: "json",
        value: JSON.stringify(config),
      },
    ],
  };

  // Use functionHandle if available (preferred), otherwise fall back to functionId
  if (functionHandle) {
    input.functionHandle = functionHandle;
    console.log(`[Discount Creation] Using functionHandle: ${functionHandle}`);
  } else {
    input.functionId = functionId;
    console.log(`[Discount Creation] Using functionId: ${functionId}`);
  }

  console.log(`[Discount Creation] Sending mutation with input:`, JSON.stringify(input, null, 2));
  
  const response = await admin.graphql(mutation, {
    variables: { input },
  });

  const data = await response.json();
  const errors = data.data?.discountAutomaticAppCreate?.userErrors || [];
  const discountId = data.data?.discountAutomaticAppCreate?.automaticAppDiscount?.discountId;

  console.log(`[Discount Creation] Mutation response:`, JSON.stringify(data, null, 2));

  if (errors.length > 0) {
    console.error("[Discount Creation] ❌ Errors:", JSON.stringify(errors, null, 2));
    return null;
  }

  // Return discount ID directly from mutation response if available
  if (discountId) {
    console.log(`[Discount Creation] ✅ Created discount with ID: ${discountId}`);
    return discountId;
  }

  // Fallback: Query the discount we just created to get its ID
  // There's a small delay, so we retry a few times
  console.log("[Discount Creation] Discount ID not in response, querying for it...");
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 500 * (i + 1)));
    const foundDiscountId = await findDaisychainDiscount(admin, functionId, functionHandle);
    if (foundDiscountId) {
      console.log(`[Discount Creation] Found discount ID: ${foundDiscountId}`);
      return foundDiscountId;
    }
  }

  console.error("Discount creation succeeded but could not find discount ID");
  return null;
}

/**
 * Create the store credit discount for referrers
 * This discount applies customer referral credits automatically at checkout
 */
export async function createStoreCreditDiscount(
  admin: AdminApiContext,
  functionId: string,
  functionHandle?: string,
): Promise<string | null> {
  const mutation = `#graphql
    mutation CreateStoreCreditDiscount($input: DiscountAutomaticAppInput!) {
      discountAutomaticAppCreate(automaticAppDiscount: $input) {
        automaticAppDiscount {
          discountId
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const startsAt = new Date().toISOString();

  // Create discount that applies to both one-time and subscription purchases
  const input: any = {
    title: "Daisychain Store Credits",
    startsAt,
    discountClasses: ["ORDER"],
    appliesOnOneTimePurchase: true,
    appliesOnSubscription: true, // CRITICAL: Enable for subscriptions
  };

  // Use functionHandle if available (preferred), otherwise fall back to functionId
  if (functionHandle) {
    input.functionHandle = functionHandle;
    console.log(`[Store Credit Discount] Using functionHandle: ${functionHandle}`);
  } else {
    input.functionId = functionId;
    console.log(`[Store Credit Discount] Using functionId: ${functionId}`);
  }

  // Note: We need to specify which target to use from the function
  // Since we have multiple targets, we need to use the specific export name
  // The function handle should work, but we may need to specify the target
  // For now, let's try with just the functionHandle and see if Shopify routes to the right target

  console.log(`[Store Credit Discount] Creating discount with input:`, JSON.stringify(input, null, 2));
  
  const response = await admin.graphql(mutation, {
    variables: { input },
  });

  const data = await response.json();
  const errors = data.data?.discountAutomaticAppCreate?.userErrors || [];
  const discountId = data.data?.discountAutomaticAppCreate?.automaticAppDiscount?.discountId;

  console.log(`[Store Credit Discount] Mutation response:`, JSON.stringify(data, null, 2));

  if (errors.length > 0) {
    console.error("[Store Credit Discount] ❌ Errors:", JSON.stringify(errors, null, 2));
    return null;
  }

  if (discountId) {
    console.log(`[Store Credit Discount] ✅ Created discount with ID: ${discountId}`);
    return discountId;
  }

  console.error("Store credit discount creation succeeded but discount ID not returned");
  return null;
}

/**
 * Find the store credit discount by function ID
 */
export async function findStoreCreditDiscount(
  admin: AdminApiContext,
  functionId: string,
  functionHandle?: string,
): Promise<string | null> {
  // Query for discounts with the store credit title
  const query = `#graphql
    query FindStoreCreditDiscount($query: String!) {
      discountNodes(first: 10, query: $query) {
        edges {
          node {
            id
            discount {
              ... on DiscountAutomaticApp {
                title
              }
            }
          }
        }
      }
    }
  `;

  // Try querying by functionHandle first (more reliable)
  let searchQuery = functionHandle 
    ? `function_handle:${functionHandle}` 
    : `function_id:${functionId}`;

  const response = await admin.graphql(query, {
    variables: { query: searchQuery },
  });
  const data = await response.json();

  const discounts = data.data?.discountNodes?.edges || [];
  
  // Filter to find the store credit discount by title
  for (const edge of discounts) {
    const discountNode = edge.node;
    if (discountNode && discountNode.id) {
      // Look for the store credit discount
      if (discountNode.id.includes("DiscountAutomaticApp")) {
        // Check the title if available (from discount.discount.title)
        const discount = (discountNode as any).discount;
        if (discount && discount.title === "Daisychain Store Credits") {
          console.log(`[findStoreCreditDiscount] ✅ Found store credit discount: ${discountNode.id}`);
          return discountNode.id;
        }
      }
    }
  }

  console.log(`[findStoreCreditDiscount] No store credit discount found`);
  return null;
}

/**
 * Get or create the Daisychain discount
 * Returns discount ID
 */
export async function getOrCreateDaisychainDiscount(
  admin: AdminApiContext,
  functionId: string,
  config: DiscountConfig = DEFAULT_CONFIG,
  functionHandle?: string,
): Promise<string | null> {
  // Try to find existing discount
  let discountId = await findDaisychainDiscount(admin, functionId);

  // Create if not found
  if (!discountId) {
    console.log(`[getOrCreateDiscount] No existing discount found, creating new one with functionId: ${functionId}, functionHandle: ${functionHandle || 'none'}`);
    discountId = await createDaisychainDiscount(admin, functionId, config, functionHandle);
    if (discountId) {
      console.log(`[getOrCreateDiscount] Successfully created discount: ${discountId}`);
    } else {
      console.error(`[getOrCreateDiscount] Failed to create discount`);
    }
  } else {
    console.log(`[getOrCreateDiscount] Found existing discount: ${discountId}`);
  }

  return discountId;
}

/**
 * Update discount configuration
 */
export async function saveDiscountConfig(
  admin: AdminApiContext,
  discountId: string,
  config: DiscountConfig,
): Promise<boolean> {
  return await updateDiscountConfig(admin, discountId, config);
}

/**
 * Verify and fix discount configuration (ensure discountClasses is set)
 * This should be called to fix existing discounts that might be missing discountClasses
 */
export async function verifyDiscountConfiguration(
  admin: AdminApiContext,
  discountId: string,
): Promise<{ isValid: boolean; errors: string[] }> {
  // Correct GraphQL query structure:
  // - discountNode returns DiscountNode (which implements HasMetafields)
  // - discountNode.discount is a union that can be DiscountAutomaticApp
  // - Fragment must be on discount, not discountNode
  // - metafields live on discountNode, not on DiscountAutomaticApp
  // - Use appDiscountType { functionId } instead of asyncAppDiscount
  const query = `#graphql
    query GetDiscountDetails($id: ID!) {
      discountNode(id: $id) {
        id
        # Metafields live on DiscountNode (HasMetafields), not on DiscountAutomaticApp
        metafields(first: 1, namespace: "$app:daisychain", keys: ["config"]) {
          edges {
            node {
              key
              value
            }
          }
        }
        discount {
          ... on DiscountAutomaticApp {
            title
            status
            discountClasses
            appDiscountType {
              functionId
            }
          }
        }
      }
    }
  `;

  try {
    const response = await admin.graphql(query, {
      variables: { id: discountId },
    });
    const data = await response.json();
    const discountNode = data.data?.discountNode;

    if (!discountNode) {
      return { isValid: false, errors: ["Discount not found"] };
    }

    const discount = discountNode.discount;

    // Verify it's a DiscountAutomaticApp
    if (!discount || discount.__typename !== "DiscountAutomaticApp") {
      return { isValid: false, errors: ["Discount is not an automatic app discount"] };
    }

    const errors: string[] = [];

    // Check if discount is active
    if (discount.status !== "ACTIVE") {
      errors.push(`Discount status is ${discount.status}, expected ACTIVE`);
    }

    // Check if discountClasses includes ORDER
    const discountClasses = discount.discountClasses || [];
    if (!discountClasses.includes("ORDER")) {
      errors.push(
        `Discount missing ORDER in discountClasses. Current: ${JSON.stringify(discountClasses)}`,
      );
    }

    // Check if metafield exists (metafields are on discountNode, not discount)
    const metafields = discountNode.metafields?.edges || [];
    const configMetafield = metafields.find((edge: any) => edge.node.key === "config");
    if (!configMetafield) {
      errors.push("Discount missing metafield configuration");
    }

    // Check if function is linked (now from appDiscountType)
    const functionId = discount.appDiscountType?.functionId;
    if (!functionId) {
      errors.push("Discount not linked to a function");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  } catch (error: any) {
    return {
      isValid: false,
      errors: [`Error querying discount: ${error.message}`],
    };
  }
}

/**
 * Load discount configuration with defaults
 */
export async function loadDiscountConfig(
  admin: AdminApiContext,
  discountId: string,
): Promise<DiscountConfig> {
  const config = await getDiscountConfig(admin, discountId);
  // Merge with defaults to ensure all fields are present (backward compatibility)
  return config ? { ...DEFAULT_CONFIG, ...config } : DEFAULT_CONFIG;
}

