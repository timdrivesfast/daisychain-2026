/**
 * Referrals data functions
 * 
 * Provides detailed referral information for the referrals table
 */

import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { apiVersion } from "../shopify.server";
import { getCustomerById } from "./shopify-queries";
import { loadDiscountConfig } from "./discount-config";
import { getShopConfig } from "./function-management";

export interface ReferralRecord {
  orderId: string;
  orderName: string;
  orderDate: string;
  orderTotal: number;
  referrerId: string;
  referrerName: string;
  referrerEmail: string;
  refereeId: string;
  refereeName: string;
  refereeEmail: string;
  referrerReward: number;
  status: "completed" | "pending";
}

/**
 * Get detailed referral records
 * Fetches orders with referral attributes and enriches with customer data
 */
export async function getReferralRecords(
  admin: AdminApiContext,
  shop: string,
  accessToken: string,
  limit: number = 100,
  referrerRewardAmount: number = 5.0,
): Promise<ReferralRecord[]> {
  const query = `#graphql
    query GetOrders($first: Int!, $after: String) {
      orders(first: $first, after: $after, sortKey: CREATED_AT, reverse: true) {
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
            customer {
              id
              displayName
              defaultEmailAddress {
                emailAddress
              }
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

  const records: ReferralRecord[] = [];
  let hasNextPage = true;
  let cursor: string | null = null;

  // Paginate through orders
  while (hasNextPage && records.length < limit) {
    try {
      const response = await admin.graphql(query, {
        variables: {
          first: 50,
          after: cursor,
        },
      });

      const data: any = await response.json();

      if (data.errors) {
        console.error("GraphQL errors in getReferralRecords:", JSON.stringify(data.errors, null, 2));
        break;
      }

      const orders = data.data?.orders?.edges || [];

      // Fetch note_attributes via REST API for each order
      const orderIds = orders.map((edge: any) => edge.node.legacyResourceId);

      // Process in batches
      const batchSize = 10;
      for (let i = 0; i < orderIds.length && records.length < limit; i += batchSize) {
        const batch = orderIds.slice(i, i + batchSize);

        const batchPromises = batch.map(async (orderId: number) => {
          try {
            const restUrl = `https://${shop}/admin/api/${apiVersion}/orders/${orderId}.json`;
            const restResponse = await fetch(restUrl, {
              headers: {
                'X-Shopify-Access-Token': accessToken,
                'Content-Type': 'application/json',
              },
            });

            if (!restResponse.ok) {
              return null;
            }

            const restData = await restResponse.json();
            const order = restData?.order;

            if (!order?.note_attributes) {
              return null;
            }

            // Find referral attributes
            const referrerIdAttr = order.note_attributes.find(
              (attr: { name: string; value: string }) =>
                attr.name === "referrer_customer_id" && attr.value,
            );

            if (!referrerIdAttr?.value) {
              return null;
            }

            const referrerId = referrerIdAttr.value;
            const referrerNameAttr = order.note_attributes.find(
              (attr: { name: string; value: string }) =>
                attr.name === "referrer_name",
            );

            // Find corresponding GraphQL order node
            const graphqlOrder = orders.find(
              (edge: any) => edge.node.legacyResourceId === orderId
            );

            if (!graphqlOrder?.node) {
              return null;
            }

            const orderNode = graphqlOrder.node;
            const refereeId = orderNode.customer?.id;
            const refereeName = orderNode.customer?.displayName || "Guest";
            const refereeEmail = orderNode.customer?.defaultEmailAddress?.emailAddress || "";

            // Get referrer details
            let referrerName = referrerNameAttr?.value || "Unknown";
            let referrerEmail = "";

            try {
              const referrer = await getCustomerById(admin, referrerId);
              if (referrer) {
                referrerName = referrer.displayName;
                referrerEmail = referrer.email;
              }
            } catch (error) {
              console.warn(`Failed to fetch referrer ${referrerId}:`, error);
            }

            // Use the reward amount passed from the loader (fetched from discount config)
            const referrerReward = referrerRewardAmount;

            return {
              orderId: orderNode.id,
              orderName: orderNode.name,
              orderDate: orderNode.createdAt,
              orderTotal: parseFloat(orderNode.totalPriceSet?.shopMoney?.amount || "0"),
              referrerId,
              referrerName,
              referrerEmail,
              refereeId: refereeId || "",
              refereeName,
              refereeEmail,
              referrerReward,
              status: "completed" as const,
            };
          } catch (error) {
            console.warn(`Failed to process order ${orderId}:`, error);
            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        const validRecords = batchResults.filter((r): r is ReferralRecord => r !== null);
        records.push(...validRecords);

        // Small delay between batches
        if (i + batchSize < orderIds.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      hasNextPage = data.data?.orders?.pageInfo?.hasNextPage || false;
      cursor = data.data?.orders?.pageInfo?.endCursor || null;

      // Stop if we've reached the limit
      if (records.length >= limit) {
        break;
      }
    } catch (error) {
      console.error("Error fetching referral records:", error);
      break;
    }
  }

  return records;
}

