/**
 * Analytics functions for Daisychain referral program
 * 
 * Provides metrics:
 * - Total referrers (customers who have made at least one referral)
 * - Total referrals (successful referral orders)
 * - Referred revenue (total revenue from referred orders)
 */

import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";

export interface TopReferrer {
  referrerId: string;
  referrerName: string;
  referralCount: number;
  totalRevenue: number;
}

export interface RecentActivity {
  referrerName: string;
  refereeName: string;
  orderAmount: number;
  orderName: string;
  timestamp: string; // ISO date string
  timeAgo: string; // Human-readable like "2 hours ago"
}

export interface ReferralAnalytics {
  referrals: number; // Total orders placed using a referral
  referrers: number; // Total customers who have made a purchase (eligible to be referrers)
  purchases: number; // Total purchases (same as referrals for now, but could be different)
  revenue: number; // Total revenue from referred orders
  // Quick stats
  averageOrderValueReferred: number; // AOV for referred orders
  averageOrderValueRegular: number; // AOV for regular orders
  referralRate: number; // referrals / total orders (as percentage)
  activeReferrers: number; // Customers who have made at least one referral
  pendingReferrals: number; // Referrals with pending fulfillment
  completedReferrals: number; // Referrals with completed fulfillment
  totalOrders: number; // Total orders in the period
  totalRevenue: number; // Total revenue in the period
  // New sections
  topReferrers: TopReferrer[]; // Top 10 referrers by referral count
  recentActivity: RecentActivity[]; // Recent 10 referral activities
  conversionRate: number; // % of active referrers who resulted in successful referrals (referrals / activeReferrers)
  activeReferrersConversionRate: number; // % of eligible referrers who became active (activeReferrers / referrers)
  engagementRate: number; // % of customers who used the widget (placeholder for now)
  // Previous period for comparison
  previousReferrals?: number;
  previousReferrers?: number;
  previousPurchases?: number;
  previousRevenue?: number;
}

export type TimePeriod = "this_week" | "this_month" | "ytd" | "all_time";

/**
 * Get date range for a time period
 */
function getDateRange(period: TimePeriod): { start: Date | null; end: Date | null } {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  
  switch (period) {
    case "this_week": {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
      startOfWeek.setHours(0, 0, 0, 0);
      return { start: startOfWeek, end };
    }
    case "this_month": {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: startOfMonth, end };
    }
    case "ytd": {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      return { start: startOfYear, end };
    }
    case "all_time":
      return { start: null, end: null };
  }
}

/**
 * Get previous period date range for comparison
 */
function getPreviousPeriodRange(period: TimePeriod): { start: Date | null; end: Date | null } {
  const now = new Date();
  
  switch (period) {
    case "this_week": {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay() - 7); // Previous Sunday
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);
      return { start: startOfWeek, end: endOfWeek };
    }
    case "this_month": {
      const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { start: startOfPrevMonth, end: endOfPrevMonth };
    }
    case "ytd": {
      const startOfPrevYear = new Date(now.getFullYear() - 1, 0, 1);
      const endOfPrevYear = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
      return { start: startOfPrevYear, end: endOfPrevYear };
    }
    case "all_time":
      return { start: null, end: null };
  }
}

/**
 * Get referral analytics for the shop with time period filtering
 * 
 * Metrics:
 * - Referrals: Count of orders that used a referral
 * - Referrers: Total customers who have made a purchase (eligible to be referrers)
 * - Purchases: Same as referrals (total referral purchases)
 * - Revenue: Sum of total price of all referred orders
 */
export async function getReferralAnalytics(
  admin: AdminApiContext,
  shop: string,
  accessToken: string,
  period: TimePeriod = "all_time",
  minReferrerOrders: number = 1,
): Promise<ReferralAnalytics> {
  // Get date range for current period
  const { start: periodStart, end: periodEnd } = getDateRange(period);
  
  // Build query filter for date range
  let dateQuery = "";
  if (periodStart && periodEnd) {
    const startStr = periodStart.toISOString();
    const endStr = periodEnd.toISOString();
    dateQuery = `created_at:>='${startStr}' AND created_at:<='${endStr}'`;
  } else if (periodStart) {
    // Only start date (for "this_week", "this_month", "ytd")
    const startStr = periodStart.toISOString();
    dateQuery = `created_at:>='${startStr}'`;
  }

  // Query orders with metafields for referral data
  // Order metafields are set by the webhook and are queryable via GraphQL (much faster than REST API)
  const query = `#graphql
    query GetOrders($first: Int!, $after: String, $query: String) {
      orders(first: $first, after: $after, sortKey: CREATED_AT, reverse: true, query: $query) {
        edges {
          node {
            id
            name
            legacyResourceId
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            createdAt
            displayFulfillmentStatus
            customer {
              id
              displayName
              defaultEmailAddress {
                emailAddress
              }
            }
            metafield(namespace: "$app:daisychain", key: "is_referral") {
              value
            }
            referrerCustomerId: metafield(namespace: "$app:daisychain", key: "referrer_customer_id") {
              value
            }
            referrerName: metafield(namespace: "$app:daisychain", key: "referrer_name") {
              value
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  let allReferredOrders: any[] = [];
  let allOrders: any[] = []; // Track all orders for total metrics
  let referrerIds = new Set<string>(); // Track unique referrer IDs
  // Track referrer data for leaderboard and activity feed
  let referrerDataMap = new Map<string, { name: string; referralCount: number; totalRevenue: number }>();
  let recentActivityList: Array<{ referrerName: string; refereeName: string; orderAmount: number; orderName: string; timestamp: string }> = [];
  let hasNextPage = true;
  let cursor: string | null = null;
  let totalOrdersProcessed = 0;
  const maxOrdersToProcess = 1000; // Limit for performance

  // Paginate through orders with referral attributes
  while (hasNextPage && totalOrdersProcessed < maxOrdersToProcess) {
    const response = await admin.graphql(query, {
      variables: {
        first: 50,
        after: cursor,
        query: dateQuery || null,
      },
    });

    const data: any = await response.json();
    
    // Check for GraphQL errors
    if (data.errors) {
      console.error("GraphQL errors in getReferralAnalytics (orders):", JSON.stringify(data.errors, null, 2));
      break; // Stop pagination on error
    }
    
    const orders = data.data?.orders?.edges || [];
    allOrders = allOrders.concat(orders.map((edge: any) => edge.node));
    totalOrdersProcessed += orders.length;
    
    // Process orders - check metafields first (fast), fallback to REST API for note_attributes (for older orders)
    const orderIds = orders.map((edge: any) => edge.node.legacyResourceId);
    
    // Batch fetch note_attributes via REST API for orders without metafields
    const apiVersion = "2024-10";
    const batchSize = 10;
    
    for (let i = 0; i < orderIds.length; i += batchSize) {
      const batch = orderIds.slice(i, i + batchSize);
      
      try {
        const batchPromises = batch.map(async (orderId: number) => {
          try {
            const graphqlOrder = orders.find(
              (edge: any) => edge.node.legacyResourceId === orderId
            )?.node;
            
            if (!graphqlOrder) return null;
            
            // First check metafields (newer orders)
            let isReferral = graphqlOrder.metafield?.value === "true";
            let referrerId = graphqlOrder.referrerCustomerId?.value;
            let referrerName = graphqlOrder.referrerName?.value || "Unknown";
            
            // If no metafields, fallback to REST API for note_attributes (older orders)
            if (!isReferral || !referrerId) {
              try {
                const restUrl = `https://${shop}/admin/api/${apiVersion}/orders/${orderId}.json`;
                const restResponse = await fetch(restUrl, {
                  headers: {
                    'X-Shopify-Access-Token': accessToken,
                    'Content-Type': 'application/json',
                  },
                });
                
                if (restResponse.ok) {
                  const restData = await restResponse.json();
                  const noteAttributes = restData?.order?.note_attributes || [];
                  
                  const referrerIdAttr = noteAttributes.find(
                    (attr: { name: string; value: string }) =>
                      attr.name === "referrer_customer_id" && attr.value,
                  );
                  
                  if (referrerIdAttr) {
                    referrerId = referrerIdAttr.value;
                    const referrerNameAttr = noteAttributes.find(
                      (attr: { name: string; value: string }) =>
                        attr.name === "referrer_name",
                    );
                    referrerName = referrerNameAttr?.value || "Unknown";
                    isReferral = true;
                  }
                }
              } catch (restError) {
                // Ignore REST API errors, continue with metafield data only
              }
            }
            
            if (isReferral && referrerId && graphqlOrder) {
              // Track referrer ID
              referrerIds.add(referrerId);
              
              // Track referrer data for leaderboard
              const orderAmount = parseFloat(graphqlOrder.totalPriceSet?.shopMoney?.amount || "0");
              const existing = referrerDataMap.get(referrerId);
              if (existing) {
                existing.referralCount++;
                existing.totalRevenue += orderAmount;
              } else {
                referrerDataMap.set(referrerId, {
                  name: referrerName,
                  referralCount: 1,
                  totalRevenue: orderAmount,
                });
              }
              
              // Track for recent activity
              const refereeName = graphqlOrder.customer?.displayName || 
                graphqlOrder.customer?.defaultEmailAddress?.emailAddress || 
                "Guest";
              
              recentActivityList.push({
                referrerName,
                refereeName,
                orderAmount,
                orderName: graphqlOrder.name || `#${orderId}`,
                timestamp: graphqlOrder.createdAt || new Date().toISOString(),
              });
              
              // Add to referred orders list
              allReferredOrders.push(graphqlOrder);
            }
            
            return null;
          } catch (error) {
            console.warn(`Failed to process order ${orderId}:`, error);
            return null;
          }
        });
        
        await Promise.all(batchPromises);
        
        // Small delay between batches to avoid rate limits
        if (i + batchSize < orderIds.length) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      } catch (error) {
        console.error("Error processing order batch:", error);
      }
    }

    hasNextPage = data.data?.orders?.pageInfo?.hasNextPage || false;
    cursor = data.data?.orders?.pageInfo?.endCursor || null;

    // Limit to recent orders for performance
    if (allReferredOrders.length >= 500 || !hasNextPage) {
      break;
    }
  }

  // Calculate current period metrics
  const referrals = allReferredOrders.length;
  const purchases = referrals; // Same as referrals for now

  // Calculate total revenue from referred orders
  let revenue = 0;
  allReferredOrders.forEach((order) => {
    const amount = parseFloat(
      order.totalPriceSet?.shopMoney?.amount || "0",
    );
    revenue += amount;
  });

  // Calculate total orders and total revenue (all orders in period)
  const totalOrders = allOrders.length;
  let totalRevenue = 0;
  allOrders.forEach((order) => {
    const amount = parseFloat(
      order.totalPriceSet?.shopMoney?.amount || "0",
    );
    totalRevenue += amount;
  });

  // Calculate AOV for referred orders
  const averageOrderValueReferred = referrals > 0 ? revenue / referrals : 0;

  // Calculate AOV for regular orders (non-referred)
  const regularOrdersCount = totalOrders - referrals;
  const regularRevenue = totalRevenue - revenue;
  const averageOrderValueRegular = regularOrdersCount > 0 ? regularRevenue / regularOrdersCount : 0;

  // Calculate referral rate (as percentage)
  const referralRate = totalOrders > 0 ? (referrals / totalOrders) * 100 : 0;

  // Count active referrers (customers who have made at least one referral)
  const activeReferrers = referrerIds.size;

  // Count pending vs completed referrals based on fulfillment status
  let pendingReferrals = 0;
  let completedReferrals = 0;
  
  allReferredOrders.forEach((order: any) => {
    // Check fulfillment status from GraphQL or REST data
    const fulfillmentStatus = order.displayFulfillmentStatus || order.restData?.fulfillment_status;
    
    if (fulfillmentStatus === "FULFILLED" || fulfillmentStatus === "fulfilled") {
      completedReferrals++;
    } else if (fulfillmentStatus === "UNFULFILLED" || fulfillmentStatus === "unfulfilled" || fulfillmentStatus === "partial") {
      pendingReferrals++;
    } else {
      // Default to completed if status is unknown (most orders are fulfilled)
      completedReferrals++;
    }
  });

  // Count eligible referrers: ALL customers who have made at least minReferrerOrders purchases
  // This includes BOTH referrers AND referees (anyone who makes a purchase becomes eligible)
  // We query all customers (not filtered by period) because eligible referrers = all customers with orders
  let referrers = await getTotalCustomersWithOrders(admin, minReferrerOrders);
  
  // Fallback: Count unique customers from orders we've fetched
  // This ensures we count both referrers AND referees who made purchases
  // Use the higher count to ensure we don't miss anyone
  const customerOrderCounts = new Map<string, number>();
  allOrders.forEach((order: any) => {
    const customerId = order.customer?.id;
    if (customerId) {
      const currentCount = customerOrderCounts.get(customerId) || 0;
      customerOrderCounts.set(customerId, currentCount + 1);
    }
  });
  
  const uniqueCustomersFromOrders = customerOrderCounts.size;
  const eligibleFromOrders = Array.from(customerOrderCounts.values()).filter(
    (count) => count >= minReferrerOrders
  ).length;
  
  // Use the higher count (query result or orders-based count) to ensure we don't miss anyone
  // This ensures both referrers AND referees are counted as eligible
  if (eligibleFromOrders > referrers) {
    console.log(`[Analytics] Using orders-based count: ${eligibleFromOrders} eligible referrers (query found ${referrers}, but we have ${uniqueCustomersFromOrders} unique customers in orders)`);
    referrers = eligibleFromOrders;
  } else {
    console.log(`[Analytics] Using customer query count: ${referrers} eligible referrers (${uniqueCustomersFromOrders} unique customers in current period orders)`);
  }

  // Build top referrers leaderboard (top 10 by referral count)
  const topReferrers: TopReferrer[] = Array.from(referrerDataMap.entries())
    .map(([referrerId, data]) => ({
      referrerId,
      referrerName: data.name,
      referralCount: data.referralCount,
      totalRevenue: data.totalRevenue,
    }))
    .sort((a, b) => b.referralCount - a.referralCount)
    .slice(0, 10);

  // Build recent activity feed (most recent 10, sorted by timestamp)
  const recentActivity: RecentActivity[] = recentActivityList
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10)
    .map((activity) => ({
      ...activity,
      timeAgo: getTimeAgo(activity.timestamp),
    }));

  // Calculate conversion rate (% of active referrers who resulted in successful referrals)
  // This shows: successful referrals / active referrers
  const conversionRate = activeReferrers > 0 ? (referrals / activeReferrers) * 100 : 0;
  
  // Calculate active referrers conversion rate (% of eligible referrers who became active)
  // This shows: active referrers / eligible referrers
  const activeReferrersConversionRate = referrers > 0 ? (activeReferrers / referrers) * 100 : 0;

  // Engagement rate - placeholder for now (would need widget usage tracking)
  // For now, we'll estimate based on referrals vs eligible referrers
  const engagementRate = referrers > 0 ? (activeReferrers / referrers) * 100 : 0;

  // Skip previous period calculation for now - it's too slow with REST API calls
  // We can optimize this later by storing referral data in a more queryable format
  // For now, just return current period metrics without comparison
  const previousReferrals = undefined;
  const previousPurchases = undefined;
  const previousRevenue = undefined;
  const previousReferrers = undefined;
  
  // TODO: Optimize previous period calculation
  // Options:
  // 1. Store referral order IDs in a database table for faster queries
  // 2. Use order metafields instead of note_attributes (queryable via GraphQL)
  // 3. Cache previous period results
  // 4. Make it async/optional (show current metrics first, load comparison later)

  return {
    referrals,
    referrers,
    purchases,
    revenue,
    averageOrderValueReferred,
    averageOrderValueRegular,
    referralRate,
    activeReferrers,
    pendingReferrals,
    completedReferrals,
    totalOrders,
    totalRevenue,
    topReferrers,
    recentActivity,
    conversionRate,
    activeReferrersConversionRate,
    engagementRate,
    previousReferrals,
    previousReferrers,
    previousPurchases,
    previousRevenue,
  };
}

/**
 * Convert ISO timestamp to human-readable "time ago" string
 */
function getTimeAgo(timestamp: string): string {
  const now = new Date();
  const time = new Date(timestamp);
  const diffMs = now.getTime() - time.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
  if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks !== 1 ? "s" : ""} ago`;
  if (diffMonths < 12) return `${diffMonths} month${diffMonths !== 1 ? "s" : ""} ago`;
  return `${Math.floor(diffDays / 365)} year${Math.floor(diffDays / 365) !== 1 ? "s" : ""} ago`;
}

/**
 * Get count of all customers who have made at least minOrders purchases
 * These are all eligible to be referrers based on the configured minimum
 */
async function getTotalCustomersWithOrders(
  admin: AdminApiContext,
  minOrders: number = 1,
): Promise<number> {
  // Use orders_count filter to only get customers with at least minOrders orders
  // Shopify's query syntax: orders_count:>N means orders_count > N, so we use minOrders-1
  // For minOrders = 1, we use orders_count:>=1 (at least 1 order)
  const minOrdersQuery = minOrders > 1 ? `orders_count:>${minOrders - 1}` : "orders_count:>=1";
  const query = `#graphql
    query GetCustomersWithOrders($first: Int!, $after: String) {
      customers(first: $first, after: $after, query: "${minOrdersQuery}") {
        edges {
          node {
            id
            numberOfOrders
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  let count = 0;
  let hasNextPage = true;
  let cursor: string | null = null;

  while (hasNextPage) {
    const response = await admin.graphql(query, {
      variables: {
        first: 250,
        after: cursor,
      },
    });

    const data: any = await response.json();
    
    // Check for GraphQL errors
    if (data.errors) {
      console.error("GraphQL errors in getTotalCustomersWithOrders:", JSON.stringify(data.errors, null, 2));
      // Try fallback: query all customers and filter manually
      console.log("Falling back to querying all customers...");
      return await getTotalCustomersWithOrdersFallback(admin, minOrders);
    }
    
    const customers = data.data?.customers?.edges || [];
    
    // Filter customers to ensure they meet the minimum order requirement
    // (in case the query filter doesn't work perfectly)
    customers.forEach((edge: any) => {
      const numberOfOrders = edge.node.numberOfOrders || 0;
      if (numberOfOrders >= minOrders) {
        count++;
      }
    });

    hasNextPage = data.data?.customers?.pageInfo?.hasNextPage || false;
    cursor = data.data?.customers?.pageInfo?.endCursor || null;
  }

  console.log(`[getTotalCustomersWithOrders] Found ${count} eligible referrers (minOrders: ${minOrders})`);
  return count;
}

/**
 * Fallback: Query all customers and filter manually
 * Used when the orders_count query filter doesn't work
 */
async function getTotalCustomersWithOrdersFallback(
  admin: AdminApiContext,
  minOrders: number = 1,
): Promise<number> {
  const query = `#graphql
    query GetAllCustomers($first: Int!, $after: String) {
      customers(first: $first, after: $after) {
        edges {
          node {
            id
            numberOfOrders
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  let count = 0;
  let hasNextPage = true;
  let cursor: string | null = null;

  while (hasNextPage) {
    const response = await admin.graphql(query, {
      variables: {
        first: 250,
        after: cursor,
      },
    });

    const data: any = await response.json();
    
    if (data.errors) {
      console.error("GraphQL errors in fallback:", JSON.stringify(data.errors, null, 2));
      break;
    }
    
    const customers = data.data?.customers?.edges || [];
    
    customers.forEach((edge: any) => {
      const numberOfOrders = edge.node.numberOfOrders || 0;
      if (numberOfOrders >= minOrders) {
        count++;
      }
    });

    hasNextPage = data.data?.customers?.pageInfo?.hasNextPage || false;
    cursor = data.data?.customers?.pageInfo?.endCursor || null;
  }

  console.log(`[getTotalCustomersWithOrdersFallback] Found ${count} eligible referrers (minOrders: ${minOrders})`);
  return count;
}

/**
 * Get count of customers who have made referrals
 * This queries customers with referrals_made metafield > 0
 */
export async function getReferrerCount(
  admin: AdminApiContext,
): Promise<number> {
  const query = `#graphql
    query GetReferrers($first: Int!, $after: String) {
      customers(first: $first, after: $after, query: "referrals_made:>0") {
        edges {
          node {
            id
            metafield(namespace: "$app:daisychain", key: "referrals_made") {
              value
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  let count = 0;
  let hasNextPage = true;
  let cursor: string | null = null;

  while (hasNextPage) {
    const response = await admin.graphql(query, {
      variables: {
        first: 250,
        after: cursor,
      },
    });

    const data: any = await response.json();
    const customers = data.data?.customers?.edges || [];
    
    // Count customers with referrals_made > 0
    customers.forEach((edge: any) => {
      const referralsMade = parseInt(
        edge.node.metafield?.value || "0",
        10,
      );
      if (referralsMade > 0) {
        count++;
      }
    });

    hasNextPage = data.data?.customers?.pageInfo?.hasNextPage || false;
    cursor = data.data?.customers?.pageInfo?.endCursor || null;
  }

  return count;
}

