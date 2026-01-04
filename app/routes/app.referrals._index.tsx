/**
 * Referrals Page
 * 
 * Displays a table of successful referrals with details about referrers, referees, orders, and rewards
 */

import type { LoaderFunctionArgs, HeadersFunction } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { getReferralRecords, type ReferralRecord } from "../lib/referrals";
import { loadDiscountConfig } from "../lib/discount-config";
import { getShopConfig } from "../lib/function-management";
import { getReferralAnalytics, type TopReferrer } from "../lib/analytics";
// Note: Using Shopify's s-* components instead of Polaris for consistency

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  if (!admin || !session?.shop) {
    return {
      referrals: [],
      topReferrers: [],
      error: "Authentication failed",
    };
  }

  try {
    // Get discount config to determine referrer reward amount
    const shopConfig = await getShopConfig(session.shop);
    const discountId = shopConfig.discountId;
    let defaultReward = 5.0;
    
    if (discountId) {
      try {
        const config = await loadDiscountConfig(admin, discountId);
        defaultReward = config.referrer_credit_amount;
      } catch (error) {
        console.warn("Could not load discount config for reward amount:", error);
      }
    }

    // Fetch referral records with reward amount
    const referrals = await getReferralRecords(
      admin,
      session.shop,
      session.accessToken,
      100, // Limit to 100 most recent
      defaultReward,
    );

    // Fetch top referrers for leaderboard
    const analytics = await getReferralAnalytics(
      admin,
      session.shop,
      session.accessToken,
      "all_time", // Get all-time top referrers
      1, // min_referrer_orders
    );

    return {
      referrals,
      topReferrers: analytics.topReferrers || [],
      error: null,
    };
  } catch (error) {
    console.error("Error loading referrals:", error);
    return {
      referrals: [],
      topReferrers: [],
      error: error instanceof Error ? error.message : "Failed to load referrals",
    };
  }
};

export default function Referrals() {
  const { referrals, topReferrers, error } = useLoaderData<typeof loader>();

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };


  return (
    <s-page heading="Referrals">
      {/* Top Referrers Leaderboard */}
      <s-section heading="Top Referrers">
        <div style={{
          backgroundColor: "#fff",
          borderRadius: "8px",
          padding: "24px",
          border: "1px solid #e5e7eb",
        }}>
          {topReferrers && topReferrers.length > 0 ? (
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}>
              {topReferrers.map((referrer, index) => (
                <div
                  key={referrer.referrerId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px",
                    backgroundColor: index === 0 ? "#fef3c7" : index < 3 ? "#f5f5f5" : "transparent",
                    borderRadius: "8px",
                    border: index === 0 ? "2px solid #fbbf24" : "1px solid #e5e7eb",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "16px", flex: 1 }}>
                    <div style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      backgroundColor: index === 0 ? "#fbbf24" : index < 3 ? "#6b7280" : "#d1d5db",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontWeight: "700",
                      fontSize: "14px",
                    }}>
                      {index + 1}
                    </div>
                    <div>
                      <div style={{ fontSize: "16px", fontWeight: "600", color: "#1a1a1a" }}>
                        <s-text>{referrer.referrerName}</s-text>
                      </div>
                      <div style={{ fontSize: "13px", color: "#6b7280", marginTop: "2px" }}>
                        <s-text tone="neutral">{referrer.referralCount} referral{referrer.referralCount !== 1 ? "s" : ""}</s-text>
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "18px", fontWeight: "700", color: "#10b981" }}>
                      <s-text>${referrer.totalRevenue.toFixed(2)}</s-text>
                    </div>
                    <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>
                      <s-text tone="neutral">revenue</s-text>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#6b7280" }}>
              <s-text tone="neutral">No referrers yet. Encourage your customers to refer others!</s-text>
            </div>
          )}
        </div>
      </s-section>

      <s-section heading="Successful Referrals">
        <s-stack direction="block" gap="base">
          {error && (
            <s-banner tone="critical">
              <s-text>Error: {error}</s-text>
            </s-banner>
          )}
          {referrals.length === 0 && !error && (
            <s-box padding="base" borderWidth="base" borderRadius="base">
              <div style={{ padding: "32px", textAlign: "center" }}>
                <s-text tone="subdued">
                  No referrals found yet. Referrals will appear here once customers start using referral codes.
                </s-text>
              </div>
            </s-box>
          )}
          {referrals.length > 0 && (
            <s-box padding="base" borderWidth="base" borderRadius="base">
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                      <th style={{ textAlign: "left", padding: "12px", fontSize: "14px", fontWeight: "600", color: "#202223" }}>Order</th>
                      <th style={{ textAlign: "left", padding: "12px", fontSize: "14px", fontWeight: "600", color: "#202223" }}>Date</th>
                      <th style={{ textAlign: "left", padding: "12px", fontSize: "14px", fontWeight: "600", color: "#202223" }}>Referrer</th>
                      <th style={{ textAlign: "left", padding: "12px", fontSize: "14px", fontWeight: "600", color: "#202223" }}>Referee</th>
                      <th style={{ textAlign: "right", padding: "12px", fontSize: "14px", fontWeight: "600", color: "#202223" }}>Order Total</th>
                      <th style={{ textAlign: "right", padding: "12px", fontSize: "14px", fontWeight: "600", color: "#202223" }}>Reward</th>
                      <th style={{ textAlign: "left", padding: "12px", fontSize: "14px", fontWeight: "600", color: "#202223" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referrals.map((referral, index) => (
                      <tr key={referral.orderId} style={{ borderBottom: index < referrals.length - 1 ? "1px solid #e5e7eb" : "none" }}>
                        <td style={{ padding: "12px", fontSize: "14px" }}>
                          <s-text fontWeight="medium">{referral.orderName}</s-text>
                        </td>
                        <td style={{ padding: "12px", fontSize: "14px" }}>
                          <s-text>{formatDate(referral.orderDate)}</s-text>
                        </td>
                        <td style={{ padding: "12px", fontSize: "14px" }}>
                          <div>
                            <s-text>{referral.referrerName}</s-text>
                            {referral.referrerEmail && (
                              <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>
                                {referral.referrerEmail}
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "12px", fontSize: "14px" }}>
                          <div>
                            <s-text>{referral.refereeName}</s-text>
                            {referral.refereeEmail && (
                              <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>
                                {referral.refereeEmail}
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "12px", fontSize: "14px", textAlign: "right" }}>
                          <s-text fontWeight="medium">${referral.orderTotal.toFixed(2)}</s-text>
                        </td>
                        <td style={{ padding: "12px", fontSize: "14px", textAlign: "right" }}>
                          <s-text fontWeight="medium" tone="success">${referral.referrerReward.toFixed(2)}</s-text>
                        </td>
                        <td style={{ padding: "12px", fontSize: "14px" }}>
                          <span style={{
                            display: "inline-block",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            backgroundColor: "#e6ffed",
                            color: "#008060",
                            fontSize: "12px",
                            fontWeight: "500",
                          }}>
                            Completed
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </s-box>
          )}
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

