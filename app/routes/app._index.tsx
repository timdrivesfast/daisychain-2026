import { useState } from "react";
import type {
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useLoaderData, useFetcher, Link } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { getReferralAnalytics, type TimePeriod, type ReferralAnalytics } from "../lib/analytics";
import { getShopConfig } from "../lib/function-management";
import { loadDiscountConfig, type DiscountConfig } from "../lib/discount-config";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const period = (url.searchParams.get("period") || "this_week") as TimePeriod;

  // Ensure app is set up (function ID and discount created)
  if (admin && session?.shop) {
    try {
      const { ensureAppSetup } = await import("../lib/app-setup");
      await ensureAppSetup(admin, session.shop);
    } catch (error) {
      console.error("Error during app setup:", error);
      // Don't fail the request, just log the error
    }
  }

  // Get analytics data
  let analytics: ReferralAnalytics = {
    referrals: 0,
    referrers: 0,
    purchases: 0,
    revenue: 0,
    averageOrderValueReferred: 0,
    averageOrderValueRegular: 0,
    referralRate: 0,
    activeReferrers: 0,
    pendingReferrals: 0,
    completedReferrals: 0,
    totalOrders: 0,
    totalRevenue: 0,
    topReferrers: [],
    recentActivity: [],
    conversionRate: 0,
    activeReferrersConversionRate: 0,
    engagementRate: 0,
  };

  // Get discount config first (needed for analytics)
  let config: DiscountConfig = {
    referee_discount_percentage: 10,
    referrer_credit_amount: 5.0,
    referee_min_order: 0,
    min_referrer_orders: 1,
    referee_available_after_days: 0,
    referee_redeemable_as_store_credit: false,
    referee_redeemable_before_referral: false,
    referrer_available_after_days: 30,
    referrer_redeemable_as_store_credit: true,
    widget_primary_color: "#ff6b6b",
    widget_secondary_color: "#ee5a6f",
    widget_success_color: "#4caf50",
    widget_text_color: "#ffffff",
    email_notifications_enabled: true,
  };

  if (admin && session?.shop) {
    try {
      const shopConfig = await getShopConfig(session.shop);
      const discountId = shopConfig.discountId;
      if (discountId) {
        const loadedConfig = await loadDiscountConfig(admin, discountId);
        if (loadedConfig) {
          config = loadedConfig;
        }
      }
    } catch (error) {
      console.error("Error loading discount config:", error);
    }
  }

  // Get analytics data (pass min_referrer_orders from config)
  if (admin && session?.shop && session?.accessToken) {
    try {
      analytics = await getReferralAnalytics(
        admin, 
        session.shop, 
        session.accessToken, 
        period,
        config.min_referrer_orders
      );
      console.log("Analytics fetched:", analytics);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }
      // Return defaults on error
    }
  }

  return { analytics, period, config };
};

export default function Index() {
  const { analytics, period: initialPeriod, config } = useLoaderData<typeof loader>();
  const [period, setPeriod] = useState<TimePeriod>(initialPeriod);
  const fetcher = useFetcher<typeof loader>();

  // Use fetcher data if available (after period change), otherwise use loader data
  const data = fetcher.data?.analytics || analytics;
  const currentPeriod = fetcher.data?.period || period;
  const currentConfig = fetcher.data?.config || config;

  const handlePeriodChange = (newPeriod: TimePeriod) => {
    setPeriod(newPeriod);
    fetcher.load(`/app?period=${newPeriod}`);
  };

  const periodLabels: Record<TimePeriod, string> = {
    this_week: "This week",
    this_month: "This month",
    ytd: "YTD",
    all_time: "All time",
  };

  return (
    <s-page heading="Welcome to Daisychain!">
      <s-section heading="Performance Analytics">
        {/* Main Card Container */}
        <div style={{
          backgroundColor: "#fff",
          borderRadius: "8px",
          padding: "16px",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
        }}>
          {/* Header with Time Selector */}
          <div style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            marginBottom: "16px",
          }}>
            <select
              value={currentPeriod}
              onChange={(e) => handlePeriodChange(e.target.value as TimePeriod)}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #d1d5db",
                fontSize: "14px",
                cursor: "pointer",
                backgroundColor: "#fff",
                color: "#202223",
                fontWeight: "500",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#FB3F46";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#d1d5db";
              }}
            >
              <option value="this_week">This week</option>
              <option value="this_month">This month</option>
              <option value="ytd">YTD</option>
              <option value="all_time">All time</option>
            </select>
          </div>

          {/* Metrics Grid - Combined Performance and Quick Stats */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "12px",
          }}>
            {/* Referrals */}
            <div style={{
              backgroundColor: "#fff",
              borderRadius: "8px",
              padding: "14px",
              border: "1px solid #e5e7eb",
              borderTop: "3px solid #FB3F46",
            }}>
              <div style={{
                fontSize: "12px",
                color: "#6b7280",
                marginBottom: "8px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}>
                Referrals
                <span style={{ fontSize: "12px", color: "#9ca3af", cursor: "help" }} title="Total orders placed using a referral">?</span>
              </div>
              <div style={{
                fontSize: "28px",
                fontWeight: "700",
                color: "#202223",
                lineHeight: "1.2",
              }}>
                {data.referrals}
              </div>
            </div>

            {/* Referrers */}
            <div style={{
              backgroundColor: "#fff",
              borderRadius: "8px",
              padding: "14px",
              border: "1px solid #e5e7eb",
              borderTop: "3px solid #FB3F46",
            }}>
              <div style={{
                fontSize: "12px",
                color: "#6b7280",
                marginBottom: "8px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}>
                Eligible Referrers
                <span style={{ fontSize: "12px", color: "#9ca3af", cursor: "help" }} title={`Customers who have made at least ${currentConfig.min_referrer_orders} order${currentConfig.min_referrer_orders !== 1 ? "s" : ""} (based on your settings)`}>?</span>
              </div>
              <div style={{
                fontSize: "28px",
                fontWeight: "700",
                color: "#202223",
                lineHeight: "1.2",
              }}>
                {data.referrers}
              </div>
            </div>

            {/* Purchases */}
            <div style={{
              backgroundColor: "#fff",
              borderRadius: "8px",
              padding: "14px",
              border: "1px solid #e5e7eb",
              borderTop: "3px solid #FB3F46",
            }}>
              <div style={{
                fontSize: "12px",
                color: "#6b7280",
                marginBottom: "8px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}>
                Purchases
                <span style={{ fontSize: "12px", color: "#9ca3af", cursor: "help" }} title="Total referral purchases completed">?</span>
              </div>
              <div style={{
                fontSize: "28px",
                fontWeight: "700",
                color: "#202223",
                lineHeight: "1.2",
              }}>
                {data.purchases}
              </div>
            </div>

            {/* Revenue */}
            <div style={{
              backgroundColor: "#fff",
              borderRadius: "8px",
              padding: "14px",
              border: "1px solid #e5e7eb",
              borderTop: "3px solid #FB3F46",
            }}>
              <div style={{
                fontSize: "12px",
                color: "#6b7280",
                marginBottom: "8px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}>
                Revenue
                <span style={{ fontSize: "12px", color: "#9ca3af", cursor: "help" }} title="Total revenue from referred orders">?</span>
              </div>
              <div style={{
                fontSize: "28px",
                fontWeight: "700",
                color: "#202223",
                lineHeight: "1.2",
              }}>
                ${data.revenue.toFixed(2)}
              </div>
            </div>

            {/* Average Order Value - Referred */}
            <div style={{
              backgroundColor: "#fff",
              borderRadius: "8px",
              padding: "14px",
              border: "1px solid #e5e7eb",
              borderTop: "3px solid #FB3F46",
            }}>
              <div style={{
                fontSize: "12px",
                color: "#6b7280",
                marginBottom: "8px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}>
                AOV (Referred)
                <span style={{ fontSize: "12px", color: "#9ca3af", cursor: "help" }} title="Average order value for referred orders">?</span>
              </div>
              <div style={{
                fontSize: "28px",
                fontWeight: "700",
                color: "#202223",
                lineHeight: "1.2",
              }}>
                ${(data.averageOrderValueReferred ?? 0).toFixed(2)}
              </div>
            </div>

            {/* Average Order Value - Regular */}
            <div style={{
              backgroundColor: "#fff",
              borderRadius: "8px",
              padding: "14px",
              border: "1px solid #e5e7eb",
              borderTop: "3px solid #FB3F46",
            }}>
              <div style={{
                fontSize: "12px",
                color: "#6b7280",
                marginBottom: "8px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}>
                AOV (Regular)
                <span style={{ fontSize: "12px", color: "#9ca3af", cursor: "help" }} title="Average order value for regular (non-referred) orders">?</span>
              </div>
              <div style={{
                fontSize: "28px",
                fontWeight: "700",
                color: "#202223",
                lineHeight: "1.2",
              }}>
                ${(data.averageOrderValueRegular ?? 0).toFixed(2)}
              </div>
            </div>

            {/* Referral Rate */}
            <div style={{
              backgroundColor: "#fff",
              borderRadius: "8px",
              padding: "14px",
              border: "1px solid #e5e7eb",
              borderTop: "3px solid #FB3F46",
            }}>
              <div style={{
                fontSize: "12px",
                color: "#6b7280",
                marginBottom: "8px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}>
                Referral Rate
                <span style={{ fontSize: "12px", color: "#9ca3af", cursor: "help" }} title="Percentage of orders that used a referral">?</span>
              </div>
              <div style={{
                fontSize: "28px",
                fontWeight: "700",
                color: "#202223",
                lineHeight: "1.2",
              }}>
                {(data.referralRate ?? 0).toFixed(1)}%
              </div>
            </div>

            {/* Active Referrers */}
            <div style={{
              backgroundColor: "#fff",
              borderRadius: "8px",
              padding: "14px",
              border: "1px solid #e5e7eb",
              borderTop: "3px solid #FB3F46",
            }}>
              <div style={{
                fontSize: "12px",
                color: "#6b7280",
                marginBottom: "8px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}>
                Active Referrers
                <span style={{ fontSize: "12px", color: "#9ca3af", cursor: "help" }} title="Customers who have made at least one referral">?</span>
              </div>
              <div style={{
                fontSize: "28px",
                fontWeight: "700",
                color: "#202223",
                lineHeight: "1.2",
              }}>
                {data.activeReferrers ?? 0}
              </div>
            </div>
          </div>
        </div>
      </s-section>

      {/* Offer Cards Section */}
      <s-section heading="Referral Offers">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            <s-text tone="neutral">
              Configure the rewards for both the referrer and referee. We recommend keeping both offers the same amount for simplicity.
            </s-text>
          </s-paragraph>
          
          <div style={{ 
            display: "flex", 
            gap: "16px", 
            flexWrap: "wrap",
            justifyContent: "center",
            maxWidth: "800px",
            margin: "0 auto"
          }}>
            {/* Referral Offer Card (Referee) */}
            <s-box padding="base" borderWidth="base" borderRadius="base">
              <div style={{ width: "300px", maxWidth: "100%", backgroundColor: "#fff" }}>
                <s-stack direction="block" gap="base">
                  {/* Title */}
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <s-text>
                      <strong>Referral offer</strong>
                    </s-text>
                    <span style={{ fontSize: "12px", color: "#666", cursor: "help" }} title="Discount given to customers who use a referral">?</span>
                  </div>

                  {/* Cash Back Amount */}
                  <div style={{ fontSize: "28px", fontWeight: "bold", marginTop: "8px" }}>
                    {currentConfig.referee_discount_percentage}% off
                  </div>

                  {/* Conditions */}
                  <div style={{ marginTop: "16px" }}>
                    <s-stack direction="block" gap="small">
                  <div style={{
                    display: "inline-block",
                    padding: "4px 12px",
                    borderRadius: "20px",
                    backgroundColor: "#f5f5f5",
                    fontSize: "13px",
                  }}>
                    Available after: <strong>{currentConfig.referee_available_after_days === 0 ? "IMMEDIATE" : `${currentConfig.referee_available_after_days} DAYS`}</strong>
                  </div>
                  <div style={{
                    display: "inline-block",
                    padding: "4px 12px",
                    borderRadius: "20px",
                    backgroundColor: "#f5f5f5",
                    fontSize: "13px",
                  }}>
                    Redeemable as store credit?: <strong>{currentConfig.referee_redeemable_as_store_credit ? "YES" : "NO"}</strong>
                  </div>
                  <div style={{
                    display: "inline-block",
                    padding: "4px 12px",
                    borderRadius: "20px",
                    backgroundColor: "#f5f5f5",
                    fontSize: "13px",
                  }}>
                    Redeemable before referral: <strong>{currentConfig.referee_redeemable_before_referral ? "YES" : "NO"}</strong>
                  </div>
                    </s-stack>
                  </div>

                  {/* Edit Button */}
                  <Link
                    to="/app/settings"
                    style={{
                      marginTop: "16px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 16px",
                      backgroundColor: "#d72c0d",
                      color: "#fff",
                      borderRadius: "4px",
                      textDecoration: "none",
                      fontSize: "14px",
                      fontWeight: "500",
                      cursor: "pointer",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M11.5 1.5L12.5 2.5L4.5 10.5H3.5V9.5L11.5 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Edit
                  </Link>
                </s-stack>
              </div>
            </s-box>

            {/* Reward Offer Card (Referrer) */}
            <s-box padding="base" borderWidth="base" borderRadius="base">
              <div style={{ width: "300px", maxWidth: "100%", backgroundColor: "#fff" }}>
                <s-stack direction="block" gap="base">
                  {/* Title */}
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <s-text>
                      <strong>Reward offer</strong>
                    </s-text>
                    <span style={{ fontSize: "12px", color: "#666", cursor: "help" }} title="Store credit given to referrers when someone uses their referral">?</span>
                  </div>

                  {/* Cash Back Amount */}
                  <div style={{ fontSize: "28px", fontWeight: "bold", marginTop: "8px" }}>
                    ${currentConfig.referrer_credit_amount.toFixed(2)} Cash Back
                  </div>

                  {/* Conditions */}
                  <div style={{ marginTop: "16px" }}>
                    <s-stack direction="block" gap="small">
                  <div style={{
                    display: "inline-block",
                    padding: "4px 12px",
                    borderRadius: "20px",
                    backgroundColor: "#f5f5f5",
                    fontSize: "13px",
                  }}>
                    Available after: <strong>{currentConfig.referrer_available_after_days === 0 ? "IMMEDIATE" : `${currentConfig.referrer_available_after_days} DAYS`}</strong>
                  </div>
                  <div style={{
                    display: "inline-block",
                    padding: "4px 12px",
                    borderRadius: "20px",
                    backgroundColor: "#f5f5f5",
                    fontSize: "13px",
                  }}>
                    Redeemable as store credit?: <strong>{currentConfig.referrer_redeemable_as_store_credit ? "YES" : "NO"}</strong>
                  </div>
                  <div style={{
                    display: "inline-block",
                    padding: "4px 12px",
                    borderRadius: "20px",
                    backgroundColor: "#f5f5f5",
                    fontSize: "13px",
                  }}>
                    Redeemable before referral: <strong>-</strong>
                  </div>
                    </s-stack>
                  </div>

                  {/* Edit Button */}
                  <Link
                    to="/app/settings"
                    style={{
                      marginTop: "16px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 16px",
                      backgroundColor: "#d72c0d",
                      color: "#fff",
                      borderRadius: "4px",
                      textDecoration: "none",
                      fontSize: "14px",
                      fontWeight: "500",
                      cursor: "pointer",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M11.5 1.5L12.5 2.5L4.5 10.5H3.5V9.5L11.5 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Edit
                  </Link>
                </s-stack>
              </div>
            </s-box>
          </div>
        </s-stack>
      </s-section>

      {/* Recent Activity Feed */}
      <s-section heading="Recent Activity">
        <div style={{
          backgroundColor: "#fff",
          borderRadius: "8px",
          padding: "24px",
          border: "1px solid #e5e7eb",
        }}>
          {data.recentActivity && data.recentActivity.length > 0 ? (
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}>
              {data.recentActivity.map((activity, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    padding: "16px",
                    backgroundColor: "#f9fafb",
                    borderRadius: "8px",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <div style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    backgroundColor: "#e0e7ff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "20px",
                    flexShrink: 0,
                  }}>
                    🎉
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "15px", fontWeight: "600", color: "#1a1a1a", lineHeight: "1.4" }}>
                      <s-text>
                        <strong>{activity.referrerName}</strong> referred <strong>{activity.refereeName}</strong>
                      </s-text>
                    </div>
                    <div style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>
                      <s-text tone="neutral">
                        {activity.orderName} • ${activity.orderAmount.toFixed(2)} • {activity.timeAgo}
                      </s-text>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#6b7280" }}>
              <s-text tone="neutral">No recent activity. Referrals will appear here as they happen!</s-text>
            </div>
          )}
        </div>
      </s-section>

      {/* Referral Funnel */}
      <s-section heading="Referral Funnel">
        <div style={{
          backgroundColor: "#fff",
          borderRadius: "8px",
          padding: "24px",
          border: "1px solid #e5e7eb",
        }}>
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "24px",
          }}>
            {/* Funnel Steps */}
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}>
              {/* Step 1: Eligible Referrers */}
              <div style={{
                padding: "20px",
                backgroundColor: "#eff6ff",
                borderRadius: "8px",
                border: "2px solid #3b82f6",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: "600", color: "#1e40af", marginBottom: "4px" }}>
                      <s-text>Eligible Referrers</s-text>
                    </div>
                    <div style={{ fontSize: "32px", fontWeight: "700", color: "#1e40af" }}>
                      {data.referrers}
                    </div>
                    <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                      <s-text tone="neutral">Customers with {currentConfig.min_referrer_orders}+ order{currentConfig.min_referrer_orders !== 1 ? "s" : ""}</s-text>
                    </div>
                  </div>
                  <div style={{ fontSize: "32px" }}>👥</div>
                </div>
              </div>

              {/* Arrow */}
              <div style={{ textAlign: "center", color: "#6b7280", fontSize: "20px" }}>↓</div>

              {/* Step 2: Active Referrers */}
              <div style={{
                padding: "20px",
                backgroundColor: "#f0fdf4",
                borderRadius: "8px",
                border: "2px solid #10b981",
                position: "relative",
              }}>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: "#166534", marginBottom: "4px" }}>
                    <s-text>Active Referrers</s-text>
                  </div>
                  <div style={{ fontSize: "32px", fontWeight: "700", color: "#166534" }}>
                    {data.activeReferrers}
                  </div>
                  <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                    <s-text tone="neutral">Who have made at least one referral</s-text>
                  </div>
                </div>
                {/* Conversion Rate Badge */}
                <div style={{
                  position: "absolute",
                  top: "12px",
                  right: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 14px",
                  backgroundColor: "#ffffff",
                  color: "#166534",
                  borderRadius: "16px",
                  fontSize: "12px",
                  fontWeight: "600",
                  border: "1.5px solid #10b981",
                  boxShadow: "0 2px 4px rgba(16, 185, 129, 0.15)",
                }}>
                  <div style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    backgroundColor: "#10b981",
                  }}></div>
                  <span>{(data.activeReferrersConversionRate ?? 0).toFixed(1)}% conversion</span>
                </div>
              </div>

              {/* Arrow */}
              <div style={{ textAlign: "center", color: "#6b7280", fontSize: "20px" }}>↓</div>

              {/* Step 3: Successful Referrals */}
              <div style={{
                padding: "20px",
                backgroundColor: "#fef3c7",
                borderRadius: "8px",
                border: "2px solid #f59e0b",
                position: "relative",
              }}>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: "#92400e", marginBottom: "4px" }}>
                    <s-text>Successful Referrals</s-text>
                  </div>
                  <div style={{ fontSize: "32px", fontWeight: "700", color: "#92400e" }}>
                    {data.referrals}
                  </div>
                  <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                    <s-text tone="neutral">Orders placed using referrals</s-text>
                  </div>
                </div>
                {/* Conversion Rate Badge */}
                <div style={{
                  position: "absolute",
                  top: "12px",
                  right: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 14px",
                  backgroundColor: "#ffffff",
                  color: "#92400e",
                  borderRadius: "16px",
                  fontSize: "12px",
                  fontWeight: "600",
                  border: "1.5px solid #f59e0b",
                  boxShadow: "0 2px 4px rgba(245, 158, 11, 0.15)",
                }}>
                  <div style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    backgroundColor: "#f59e0b",
                  }}></div>
                  <span>{(data.conversionRate ?? 0).toFixed(1)}% conversion</span>
                </div>
              </div>
            </div>

            {/* Conversion Metrics */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "16px",
              marginTop: "16px",
            }}>
              <div style={{
                padding: "16px",
                backgroundColor: "#f9fafb",
                borderRadius: "8px",
                border: "1px solid #e5e7eb",
              }}>
                <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>
                  <s-text tone="neutral">Conversion Rate</s-text>
                </div>
                <div style={{ fontSize: "24px", fontWeight: "700", color: "#1a1a1a" }}>
                  {(data.conversionRate ?? 0).toFixed(1)}%
                </div>
                <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "4px" }}>
                  <s-text tone="neutral">Eligible → Active</s-text>
                </div>
              </div>

              <div style={{
                padding: "16px",
                backgroundColor: "#f9fafb",
                borderRadius: "8px",
                border: "1px solid #e5e7eb",
              }}>
                <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>
                  <s-text tone="neutral">Engagement Rate</s-text>
                </div>
                <div style={{ fontSize: "24px", fontWeight: "700", color: "#1a1a1a" }}>
                  {(data.engagementRate ?? 0).toFixed(1)}%
                </div>
                <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "4px" }}>
                  <s-text tone="neutral">Widget usage</s-text>
                </div>
              </div>
            </div>
          </div>
        </div>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
