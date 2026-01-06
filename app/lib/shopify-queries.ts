/**
 * GraphQL query helpers for Daisychain referral app
 * Contains reusable queries and mutations for customer lookup,
 * metafield management, and discount operations
 */

import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";

const METAFIELD_NAMESPACE = "$app:daisychain";

/**
 * Search for a customer by name (first name + last name)
 * Returns customer ID, email, and display name if found
 * 
 * NOTE: This requires Protected Customer Data (PCD) approval.
 * For development: Request PCD access in Partner Dashboard (no review needed for dev stores).
 * For production: Full PCD approval required.
 * 
 * Uses customers query with search syntax for better performance.
 */
export async function findCustomerByName(
  admin: AdminApiContext,
  name: string,
): Promise<{
  id: string;
  email: string;
  displayName: string;
} | null> {
  // Split name into first and last (simple approach)
  const nameParts = name.trim().split(/\s+/);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  // Build query string for customer search
  // Using search syntax for better performance than fetching all orders
  // Try multiple search strategies for better matching
  let searchQuery = `first_name:'${firstName.replace(/'/g, "\\'")}'`;
  if (lastName) {
    searchQuery += ` AND last_name:'${lastName.replace(/'/g, "\\'")}'`;
  }
  
  console.log(`[findCustomerByName] Search query: "${searchQuery}" (firstName: "${firstName}", lastName: "${lastName}")`);

  const query = `#graphql
    query FindCustomerByName($query: String!) {
      customers(first: 10, query: $query) {
        edges {
          node {
            id
            defaultEmailAddress {
              emailAddress
            }
            displayName
            numberOfOrders
            orders(first: 1) {
              edges {
                node {
                  id
                  name
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response = await admin.graphql(query, {
      variables: {
        query: searchQuery,
      },
    });

    const data = await response.json() as any;
    
    // Log errors for debugging
    if (data.errors) {
      console.error("GraphQL errors in findCustomerByName:", JSON.stringify(data.errors, null, 2));
      console.error("Full GraphQL response:", JSON.stringify(data, null, 2));
      
      // Check for Protected Customer Data errors
      const errorMessage = data.errors[0]?.message || "";
      if (errorMessage.includes("Protected Customer Data") || errorMessage.includes("not approved")) {
        throw new Error("Protected Customer Data access not enabled. Please enable PCD access in Partner Dashboard for development stores.");
      }
      
      throw new Error(`GraphQL error: ${errorMessage}`);
    }
    
    if (!data.data) {
      console.error("No data in GraphQL response:", JSON.stringify(data, null, 2));
      throw new Error("No data returned from GraphQL query");
    }
    
    const customers = data.data?.customers?.edges || [];

    console.log(`[findCustomerByName] Searching for: "${name}"`);
    console.log(`[findCustomerByName] Found ${customers.length} customers matching query`);

    // Find exact match (case-insensitive) or partial match
    const normalizedSearch = name.toLowerCase().trim();
    const searchParts = normalizedSearch.split(/\s+/);
    
    for (const edge of customers) {
      const customer = edge.node;
      const normalizedName = customer.displayName?.toLowerCase().trim() || "";
      const numberOfOrders = customer.numberOfOrders || 0;
      // Check actual orders (more reliable than numberOfOrders which may be stale)
      const hasOrders = (customer.orders?.edges?.length || 0) > 0;
      const orderCount = customer.orders?.edges?.length || 0;
      
      console.log(`[findCustomerByName] Checking customer: "${customer.displayName}" (numberOfOrders: ${numberOfOrders}, actual orders: ${orderCount})`);
      
      // Try exact match first
      if (normalizedName === normalizedSearch) {
        // Only return customers who have made at least one purchase
        // Use actual orders check (more reliable) with numberOfOrders as fallback
        if (hasOrders || numberOfOrders > 0) {
          console.log(`[findCustomerByName] ✅ Found exact match: "${customer.displayName}" (${hasOrders ? orderCount : numberOfOrders} orders)`);
          return {
            id: customer.id,
            email: customer.defaultEmailAddress?.emailAddress || "",
            displayName: customer.displayName || name,
          };
        } else {
          console.log(`[findCustomerByName] ⚠️ Found match but customer has no orders: "${customer.displayName}"`);
        }
      }
      
      // Try partial match (all search parts must be in the name)
      // This handles cases where displayName might be formatted differently
      const allPartsMatch = searchParts.every(part => normalizedName.includes(part));
      if (allPartsMatch && normalizedName !== normalizedSearch) {
        // Only return customers who have made at least one purchase
        // Use actual orders check (more reliable) with numberOfOrders as fallback
        if (hasOrders || numberOfOrders > 0) {
          console.log(`[findCustomerByName] ✅ Found partial match: "${customer.displayName}" (${hasOrders ? orderCount : numberOfOrders} orders)`);
          return {
            id: customer.id,
            email: customer.defaultEmailAddress?.emailAddress || "",
            displayName: customer.displayName || name,
          };
        }
      }
    }
    
    console.log(`[findCustomerByName] ❌ No matching customer found with orders > 0`);
  } catch (error) {
    // Re-throw with more context
    if (error instanceof Error) {
      console.error("Error in findCustomerByName GraphQL call:", error.message);
      console.error("Error stack:", error.stack);
    }
    throw error;
  }

  return null;
}

/**
 * Find all customers matching a name (for duplicate detection)
 * Returns array of all matching customers with orders
 */
export async function findCustomersByName(
  admin: AdminApiContext,
  name: string,
): Promise<Array<{
  id: string;
  email: string;
  displayName: string;
}>> {
  // Split name into first and last (simple approach)
  const nameParts = name.trim().split(/\s+/);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  // Build query string for customer search
  let searchQuery = `first_name:'${firstName.replace(/'/g, "\\'")}'`;
  if (lastName) {
    searchQuery += ` AND last_name:'${lastName.replace(/'/g, "\\'")}'`;
  }
  
  console.log(`[findCustomersByName] Search query: "${searchQuery}" (firstName: "${firstName}", lastName: "${lastName}")`);

  const query = `#graphql
    query FindCustomersByName($query: String!) {
      customers(first: 10, query: $query) {
        edges {
          node {
            id
            defaultEmailAddress {
              emailAddress
            }
            displayName
            numberOfOrders
            orders(first: 1) {
              edges {
                node {
                  id
                  name
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response = await admin.graphql(query, {
      variables: {
        query: searchQuery,
      },
    });

    const data = await response.json() as any;
    
    if (data.errors) {
      console.error("GraphQL errors in findCustomersByName:", JSON.stringify(data.errors, null, 2));
      const errorMessage = data.errors[0]?.message || "";
      if (errorMessage.includes("Protected Customer Data") || errorMessage.includes("not approved")) {
        throw new Error("Protected Customer Data access not enabled.");
      }
      throw new Error(`GraphQL error: ${errorMessage}`);
    }
    
    if (!data.data) {
      console.error("No data in GraphQL response:", JSON.stringify(data, null, 2));
      throw new Error("No data returned from GraphQL query");
    }
    
    const customers = data.data?.customers?.edges || [];
    const normalizedSearch = name.toLowerCase().trim();
    const searchParts = normalizedSearch.split(/\s+/);
    const matchingCustomers: Array<{
      id: string;
      email: string;
      displayName: string;
    }> = [];
    
    console.log(`[findCustomersByName] Searching for: "${name}"`);
    console.log(`[findCustomersByName] Found ${customers.length} customers matching query`);

    for (const edge of customers) {
      const customer = edge.node;
      const normalizedName = customer.displayName?.toLowerCase().trim() || "";
      const numberOfOrders = customer.numberOfOrders || 0;
      const hasOrders = (customer.orders?.edges?.length || 0) > 0;
      
      // Only include customers who have made at least one purchase
      if (!hasOrders && numberOfOrders === 0) {
        continue;
      }
      
      // Check for exact or partial match
      const isExactMatch = normalizedName === normalizedSearch;
      const allPartsMatch = searchParts.every(part => normalizedName.includes(part));
      
      if (isExactMatch || allPartsMatch) {
        matchingCustomers.push({
          id: customer.id,
          email: customer.defaultEmailAddress?.emailAddress || "",
          displayName: customer.displayName || name,
        });
      }
    }
    
    console.log(`[findCustomersByName] Found ${matchingCustomers.length} matching customers with orders`);
    return matchingCustomers;
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error in findCustomersByName GraphQL call:", error.message);
      console.error("Error stack:", error.stack);
    }
    throw error;
  }
}

/**
 * Anonymize email address for display (e.g., "j***@example.com")
 */
export function anonymizeEmail(email: string): string {
  if (!email || !email.includes("@")) {
    return "***@***.***";
  }
  
  const [localPart, domain] = email.split("@");
  if (localPart.length <= 2) {
    return `${localPart[0]}***@${domain}`;
  }
  
  // Show first character, then stars, then last character before @
  const firstChar = localPart[0];
  const lastChar = localPart[localPart.length - 1];
  const middleStars = "***";
  
  return `${firstChar}${middleStars}${lastChar}@${domain}`;
}

/**
 * Get customer by ID (for email notifications)
 */
export async function getCustomerById(
  admin: AdminApiContext,
  customerId: string,
): Promise<{
  id: string;
  email: string;
  displayName: string;
} | null> {
  const query = `#graphql
    query GetCustomerById($id: ID!) {
      customer(id: $id) {
        id
        displayName
        defaultEmailAddress {
          emailAddress
        }
      }
    }
  `;

  try {
    const response = await admin.graphql(query, {
      variables: {
        id: customerId,
      },
    });

    const data: { errors?: any[]; data?: any } = await response.json();
    
    if (data.errors) {
      console.error("GraphQL errors in getCustomerById:", JSON.stringify(data.errors, null, 2));
      return null;
    }

    const customer = data.data?.customer;
    if (!customer) {
      return null;
    }

    return {
      id: customer.id,
      email: customer.defaultEmailAddress?.emailAddress || "",
      displayName: customer.displayName || "",
    };
  } catch (error) {
    console.error("Error in getCustomerById:", error);
    return null;
  }
}

/**
 * Get customer metafield value
 */
export async function getCustomerMetafield(
  admin: AdminApiContext,
  customerId: string,
  key: string,
): Promise<string | null> {
  const query = `#graphql
    query GetCustomerMetafield($id: ID!, $namespace: String!, $key: String!) {
      customer(id: $id) {
        metafield(namespace: $namespace, key: $key) {
          value
        }
      }
    }
  `;

  const response = await admin.graphql(query, {
    variables: {
      id: customerId,
      namespace: METAFIELD_NAMESPACE,
      key,
    },
  });

  const data = await response.json();
  return data.data?.customer?.metafield?.value || null;
}

/**
 * Set customer metafield value
 */
export async function setCustomerMetafield(
  admin: AdminApiContext,
  customerId: string,
  key: string,
  value: string,
  type: string,
): Promise<boolean> {
  const mutation = `#graphql
    mutation SetCustomerMetafield($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        userErrors {
          field
          message
        }
      }
    }
  `;

  const response = await admin.graphql(mutation, {
    variables: {
      metafields: [
        {
          ownerId: customerId,
          namespace: METAFIELD_NAMESPACE,
          key,
          type,
          value,
        },
      ],
    },
  });

  const data = await response.json();
  const errors = data.data?.metafieldsSet?.userErrors || [];

  if (errors.length > 0) {
    console.error("Metafield set errors:", errors);
    return false;
  }

  return true;
}

/**
 * Set order metafield value
 * Used to store referral data on orders for faster analytics queries
 */
export async function setOrderMetafield(
  admin: AdminApiContext,
  orderId: string,
  key: string,
  value: string,
  type: string,
): Promise<boolean> {
  const mutation = `#graphql
    mutation SetOrderMetafield($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        userErrors {
          field
          message
        }
      }
    }
  `;

  const response = await admin.graphql(mutation, {
    variables: {
      metafields: [
        {
          ownerId: orderId,
          namespace: METAFIELD_NAMESPACE,
          key,
          type,
          value,
        },
      ],
    },
  });

  const data = await response.json();
  const errors = data.data?.metafieldsSet?.userErrors || [];

  if (errors.length > 0) {
    console.error("Order metafield set errors:", errors);
    return false;
  }

  return true;
}

/**
 * Increment customer referral credits
 */
export async function addReferralCredit(
  admin: AdminApiContext,
  customerId: string,
  amount: number,
): Promise<boolean> {
  // Get current credits
  const currentCreditsStr = await getCustomerMetafield(
    admin,
    customerId,
    "referral_credits",
  );
  const currentCredits = parseFloat(currentCreditsStr || "0");

  // Add new amount
  const newCredits = currentCredits + amount;

  // Update metafield
  return await setCustomerMetafield(
    admin,
    customerId,
    "referral_credits",
    newCredits.toFixed(2),
    "number_decimal",
  );
}

/**
 * Deduct customer referral credits (used after order completion)
 */
export async function deductReferralCredit(
  admin: AdminApiContext,
  customerId: string,
  amount: number,
): Promise<boolean> {
  // Get current credits
  const currentCreditsStr = await getCustomerMetafield(
    admin,
    customerId,
    "referral_credits",
  );
  const currentCredits = parseFloat(currentCreditsStr || "0");

  // Deduct amount (don't go below 0)
  const newCredits = Math.max(0, currentCredits - amount);

  // Update metafield
  return await setCustomerMetafield(
    admin,
    customerId,
    "referral_credits",
    newCredits.toFixed(2),
    "number_decimal",
  );
}

/**
 * Increment customer referrals_made count
 */
export async function incrementReferralsMade(
  admin: AdminApiContext,
  customerId: string,
): Promise<boolean> {
  const currentCountStr = await getCustomerMetafield(
    admin,
    customerId,
    "referrals_made",
  );
  const currentCount = parseInt(currentCountStr || "0", 10);

  return await setCustomerMetafield(
    admin,
    customerId,
    "referrals_made",
    (currentCount + 1).toString(),
    "number_integer",
  );
}

/**
 * Mark customer as having used a referral
 */
export async function markCustomerUsedReferral(
  admin: AdminApiContext,
  customerId: string,
  referrerId: string,
): Promise<boolean> {
  const usedData = {
    used: true,
    referrerId,
    usedAt: new Date().toISOString(),
  };

  return await setCustomerMetafield(
    admin,
    customerId,
    "used_referral",
    JSON.stringify(usedData),
    "json",
  );
}

/**
 * Check if customer has already used a referral
 */
export async function hasCustomerUsedReferral(
  admin: AdminApiContext,
  customerId: string,
): Promise<boolean> {
  const usedDataStr = await getCustomerMetafield(
    admin,
    customerId,
    "used_referral",
  );

  if (!usedDataStr) {
    return false;
  }

  try {
    const usedData = JSON.parse(usedDataStr);
    return usedData?.used === true;
  } catch {
    return false;
  }
}

/**
 * Get discount configuration from discount metafield
 * Returns partial config (may be missing new fields for backward compatibility)
 */
export async function getDiscountConfig(
  admin: AdminApiContext,
  discountId: string,
): Promise<Partial<{
  referee_discount_percentage: number;
  referee_min_order: number;
  referrer_credit_amount: number;
  min_referrer_orders: number;
  referee_available_after_days: number;
  referee_redeemable_as_store_credit: boolean;
  referee_redeemable_before_referral: boolean;
  referrer_available_after_days: number;
  referrer_redeemable_as_store_credit: boolean;
}> | null> {
  const query = `#graphql
    query GetDiscountConfig($id: ID!, $namespace: String!, $key: String!) {
      discountNode(id: $id) {
        id
        metafield(namespace: $namespace, key: $key) {
          value
        }
      }
    }
  `;

  const response = await admin.graphql(query, {
    variables: {
      id: discountId,
      namespace: METAFIELD_NAMESPACE,
      key: "config",
    },
  });

  const data = await response.json();
  const configStr = data.data?.discountNode?.metafield?.value;

  if (!configStr) {
    return null;
  }

  try {
    return JSON.parse(configStr);
  } catch {
    return null;
  }
}

/**
 * Update discount configuration
 */
export async function updateDiscountConfig(
  admin: AdminApiContext,
  discountId: string,
  config: {
    referee_discount_percentage: number;
    referee_min_order: number;
    referrer_credit_amount: number;
    min_referrer_orders: number;
    referee_available_after_days?: number;
    referee_redeemable_as_store_credit?: boolean;
    referee_redeemable_before_referral?: boolean;
    referrer_available_after_days?: number;
    referrer_redeemable_as_store_credit?: boolean;
  },
): Promise<boolean> {
  const mutation = `#graphql
    mutation UpdateDiscountConfig($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        userErrors {
          field
          message
        }
      }
    }
  `;

  const response = await admin.graphql(mutation, {
    variables: {
      metafields: [
        {
          ownerId: discountId,
          namespace: METAFIELD_NAMESPACE,
          key: "config",
          type: "json",
          value: JSON.stringify(config),
        },
      ],
    },
  });

  const data = await response.json();
  const errors = data.data?.metafieldsSet?.userErrors || [];

  if (errors.length > 0) {
    console.error("Discount config update errors:", errors);
    return false;
  }

  return true;
}

