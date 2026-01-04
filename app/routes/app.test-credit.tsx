/**
 * Test Route for Store Credit Logic
 * 
 * This route allows you to manually test the store credit functionality
 * by simulating an order webhook with referral attributes.
 * 
 * Usage:
 * 1. Get a referrer customer ID (someone who has made a purchase)
 * 2. Get a referee customer ID (someone who will use the referral)
 * 3. Visit /app/test-credit?referrerId=...&refereeId=...
 * 
 * This will simulate the webhook and show you:
 * - Whether the credit was successfully added
 * - The referrer's current credit balance
 * - The referrer's referral count
 */

import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import {
  addReferralCredit,
  incrementReferralsMade,
  markCustomerUsedReferral,
  hasCustomerUsedReferral,
  getCustomerMetafield,
} from "../lib/shopify-queries";
import { loadDiscountConfig } from "../lib/discount-config";
import { getShopConfig } from "../lib/function-management";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  if (!admin || !session?.shop) {
    return {
      error: "Authentication failed",
      success: false,
    };
  }

  const url = new URL(request.url);
  const referrerId = url.searchParams.get("referrerId");
  const refereeId = url.searchParams.get("refereeId");
  const test = url.searchParams.get("test") === "true";
  const listCustomers = url.searchParams.get("list") === "true";

  // If test=true, actually run the credit logic
  if (test && referrerId && refereeId) {
    try {
      // Get discount config
      const shopConfig = await getShopConfig(session.shop);
      const discountId = shopConfig.discountId;
      
      let creditAmount = 5.0; // Default
      if (discountId) {
        const config = await loadDiscountConfig(admin, discountId);
        creditAmount = config.referrer_credit_amount;
      }

      // Check if referee has already used a referral
      const hasUsed = await hasCustomerUsedReferral(admin, refereeId);
      if (hasUsed) {
        return {
          error: "Referee has already used a referral",
          success: false,
          referrerId,
          refereeId,
        };
      }

      // Get referrer's current credits before
      const creditsBeforeStr = await getCustomerMetafield(
        admin,
        referrerId,
        "referral_credits",
      );
      const creditsBefore = parseFloat(creditsBeforeStr || "0");

      // Get referrer's referral count before
      const referralsBeforeStr = await getCustomerMetafield(
        admin,
        referrerId,
        "referrals_made",
      );
      const referralsBefore = parseInt(referralsBeforeStr || "0", 10);

      // Credit the referrer
      const creditSuccess = await addReferralCredit(admin, referrerId, creditAmount);
      if (!creditSuccess) {
        return {
          error: "Failed to credit referrer",
          success: false,
          referrerId,
          refereeId,
        };
      }

      // Increment referrer's referral count
      await incrementReferralsMade(admin, referrerId);

      // Mark referee as having used a referral
      await markCustomerUsedReferral(admin, refereeId, referrerId);

      // Get referrer's credits after
      const creditsAfterStr = await getCustomerMetafield(
        admin,
        referrerId,
        "referral_credits",
      );
      const creditsAfter = parseFloat(creditsAfterStr || "0");

      // Get referrer's referral count after
      const referralsAfterStr = await getCustomerMetafield(
        admin,
        referrerId,
        "referrals_made",
      );
      const referralsAfter = parseInt(referralsAfterStr || "0", 10);

      return {
        success: true,
        referrerId,
        refereeId,
        creditAmount,
        creditsBefore,
        creditsAfter,
        creditsAdded: creditsAfter - creditsBefore,
        referralsBefore,
        referralsAfter,
        referralsIncremented: referralsAfter - referralsBefore,
      };
    } catch (error) {
      console.error("Error testing credit:", error);
      return {
        error: error instanceof Error ? error.message : "Unknown error",
        success: false,
        referrerId,
        refereeId,
      };
    }
  }

  // List customers for testing
  if (listCustomers) {
    try {
      const query = `#graphql
        query GetCustomers($first: Int!) {
          customers(first: $first, sortKey: CREATED_AT, reverse: true) {
            edges {
              node {
                id
                displayName
                defaultEmailAddress {
                  emailAddress
                }
                numberOfOrders
                metafields(first: 10, namespace: "$app:daisychain") {
                  edges {
                    node {
                      key
                      value
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const response = await admin.graphql(query, {
        variables: { first: 20 },
      });

      const data: any = await response.json();
      const customers = data.data?.customers?.edges || [];

      return {
        success: true,
        customers: customers.map((edge: any) => {
          const metafields = edge.node.metafields?.edges || [];
          const creditsMetafield = metafields.find(
            (m: any) => m.node.key === "referral_credits"
          );
          const referralsMetafield = metafields.find(
            (m: any) => m.node.key === "referrals_made"
          );

          return {
            id: edge.node.id,
            name: edge.node.displayName,
            email: edge.node.defaultEmailAddress?.emailAddress || "",
            orders: edge.node.numberOfOrders,
            credits: parseFloat(creditsMetafield?.node?.value || "0"),
            referralsMade: parseInt(referralsMetafield?.node?.value || "0", 10),
          };
        }),
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unknown error",
        success: false,
      };
    }
  }

  // If not testing, just show current state
  if (referrerId) {
    try {
      const creditsStr = await getCustomerMetafield(
        admin,
        referrerId,
        "referral_credits",
      );
      const credits = parseFloat(creditsStr || "0");

      const referralsStr = await getCustomerMetafield(
        admin,
        referrerId,
        "referrals_made",
      );
      const referrals = parseInt(referralsStr || "0", 10);

      return {
        success: true,
        referrerId,
        currentCredits: credits,
        currentReferrals: referrals,
        test: false,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unknown error",
        success: false,
        referrerId,
      };
    }
  }

  return {
    success: false,
    message: "Provide referrerId and refereeId query params, and test=true to run test",
  };
};

export default function TestCredit() {
  const data = useLoaderData<typeof loader>();

  return (
    <s-page heading="Test Store Credit">
      <s-section heading="Store Credit Test">
        <s-stack direction="block" gap="base">
          {data.error && (
            <s-banner tone="critical">
              <s-text>
                <strong>Error:</strong> {data.error}
              </s-text>
            </s-banner>
          )}

          {data.success && "test" in data && data.test && (
            <s-banner tone="success">
              <s-text>
                <strong>Test Successful!</strong>
              </s-text>
            </s-banner>
          )}

          {data.success && "test" in data && data.test && (
            <s-box padding="base" borderWidth="base" borderRadius="base">
              <s-stack direction="block" gap="base">
                <s-heading>Test Results</s-heading>
                <s-stack direction="block" gap="small">
                  <div>
                    <s-text tone="neutral">Referrer ID:</s-text>
                    <div style={{ display: "block", fontFamily: "monospace", fontSize: "12px" }}>
                      {data.referrerId}
                    </div>
                  </div>
                  <div>
                    <s-text tone="neutral">Referee ID:</s-text>
                    <div style={{ display: "block", fontFamily: "monospace", fontSize: "12px" }}>
                      {data.refereeId}
                    </div>
                  </div>
                  <div>
                    <s-text tone="neutral">Credit Amount Added:</s-text>
                    <div style={{ display: "block", fontSize: "20px", fontWeight: "bold", color: "#008060" }}>
                      ${data.creditAmount?.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <s-text tone="neutral">Credits Before:</s-text>
                    <div style={{ display: "block" }}>
                      ${data.creditsBefore?.toFixed(2) || "0.00"}
                    </div>
                  </div>
                  <div>
                    <s-text tone="neutral">Credits After:</s-text>
                    <div style={{ display: "block", fontSize: "18px", fontWeight: "bold" }}>
                      ${data.creditsAfter?.toFixed(2) || "0.00"}
                    </div>
                  </div>
                  <div>
                    <s-text tone="neutral">Credits Added:</s-text>
                    <div style={{ display: "block", fontSize: "18px", fontWeight: "bold", color: "#008060" }}>
                      +${data.creditsAdded?.toFixed(2) || "0.00"}
                    </div>
                  </div>
                  <div>
                    <s-text tone="neutral">Referrals Before:</s-text>
                    <div style={{ display: "block" }}>
                      {data.referralsBefore || 0}
                    </div>
                  </div>
                  <div>
                    <s-text tone="neutral">Referrals After:</s-text>
                    <div style={{ display: "block", fontSize: "18px", fontWeight: "bold" }}>
                      {data.referralsAfter || 0}
                    </div>
                  </div>
                  <div>
                    <s-text tone="neutral">Referrals Incremented:</s-text>
                    <div style={{ display: "block", fontSize: "18px", fontWeight: "bold", color: "#008060" }}>
                      +{data.referralsIncremented || 0}
                    </div>
                  </div>
                </s-stack>
              </s-stack>
            </s-box>
          )}

          {data.success && "test" in data && !data.test && (
            <s-box padding="base" borderWidth="base" borderRadius="base">
              <s-stack direction="block" gap="base">
                <s-heading>Current Referrer Status</s-heading>
                <s-stack direction="block" gap="small">
                  <div>
                    <s-text tone="neutral">Referrer ID:</s-text>
                    <div style={{ display: "block", fontFamily: "monospace", fontSize: "12px" }}>
                      {data.referrerId}
                    </div>
                  </div>
                  <div>
                    <s-text tone="neutral">Current Credits:</s-text>
                    <div style={{ display: "block", fontSize: "20px", fontWeight: "bold" }}>
                      ${data.currentCredits?.toFixed(2) || "0.00"}
                    </div>
                  </div>
                  <div>
                    <s-text tone="neutral">Total Referrals Made:</s-text>
                    <div style={{ display: "block", fontSize: "18px", fontWeight: "bold" }}>
                      {data.currentReferrals || 0}
                    </div>
                  </div>
                </s-stack>
              </s-stack>
            </s-box>
          )}

          {"customers" in data && data.customers && (
            <s-box padding="base" borderWidth="base" borderRadius="base">
              <s-stack direction="block" gap="base">
                <s-heading>Customers (for testing)</s-heading>
                <s-paragraph>
                  <s-text>
                    Click on a customer ID to test with them as a referrer.
                  </s-text>
                </s-paragraph>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #e0e0e0" }}>
                        <th style={{ padding: "8px", textAlign: "left" }}>Name</th>
                        <th style={{ padding: "8px", textAlign: "left" }}>Email</th>
                        <th style={{ padding: "8px", textAlign: "left" }}>Orders</th>
                        <th style={{ padding: "8px", textAlign: "left" }}>Credits</th>
                        <th style={{ padding: "8px", textAlign: "left" }}>Referrals</th>
                        <th style={{ padding: "8px", textAlign: "left" }}>ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.customers.map((customer: any) => (
                        <tr key={customer.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                          <td style={{ padding: "8px" }}>{customer.name}</td>
                          <td style={{ padding: "8px" }}>{customer.email}</td>
                          <td style={{ padding: "8px" }}>{customer.orders}</td>
                          <td style={{ padding: "8px", fontWeight: "bold" }}>
                            ${customer.credits.toFixed(2)}
                          </td>
                          <td style={{ padding: "8px" }}>{customer.referralsMade}</td>
                          <td style={{ padding: "8px" }}>
                            <a
                              href={`/app/test-credit?referrerId=${encodeURIComponent(customer.id)}`}
                              style={{ fontFamily: "monospace", fontSize: "11px", color: "#0066cc" }}
                            >
                              {customer.id.split("/").pop()}
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </s-stack>
            </s-box>
          )}

          {!data.success && "message" in data && (
            <s-box padding="base" borderWidth="base" borderRadius="base">
              <s-stack direction="block" gap="base">
                <s-heading>How to Test</s-heading>
                <s-paragraph>
                  <s-text>
                    <strong>Step 1:</strong> List customers to find IDs
                  </s-text>
                </s-paragraph>
                <s-unordered-list>
                  <s-list-item>
                    <s-text>
                      Visit: <code>/app/test-credit?list=true</code>
                    </s-text>
                  </s-list-item>
                </s-unordered-list>
                <s-paragraph>
                  <s-text>
                    <strong>Step 2:</strong> Check a referrer's current status
                  </s-text>
                </s-paragraph>
                <s-unordered-list>
                  <s-list-item>
                    <s-text>
                      Visit: <code>/app/test-credit?referrerId=...</code>
                    </s-text>
                  </s-list-item>
                </s-unordered-list>
                <s-paragraph>
                  <s-text>
                    <strong>Step 3:</strong> Test the credit logic
                  </s-text>
                </s-paragraph>
                <s-unordered-list>
                  <s-list-item>
                    <s-text>
                      Visit: <code>/app/test-credit?referrerId=...&refereeId=...&test=true</code>
                    </s-text>
                  </s-list-item>
                </s-unordered-list>
                <s-paragraph>
                  <s-text tone="neutral">
                    This simulates what happens when a referee completes checkout with a referral.
                  </s-text>
                </s-paragraph>
              </s-stack>
            </s-box>
          )}
        </s-stack>
      </s-section>
    </s-page>
  );
}

