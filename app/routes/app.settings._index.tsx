/**
 * Settings Page for Daisychain Referral App
 * 
 * Allows merchants to configure:
 * - Referee discount percentage
 * - Minimum order amount for discount
 * - Referrer credit amount
 * - Minimum orders required to be a referrer
 */

import { useState, useEffect } from "react";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  HeadersFunction,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  getOrCreateDaisychainDiscount,
  loadDiscountConfig,
  saveDiscountConfig,
  type DiscountConfig,
} from "../lib/discount-config";
import {
  getShopConfig,
  storeDiscountId,
} from "../lib/function-management";
import { ensureAppSetup } from "../lib/app-setup";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  if (!admin || !session?.shop) {
    return {
      config: {
        referee_discount_percentage: 10,
        referee_min_order: 0,
        referrer_credit_amount: 5.0,
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
      },
      discountId: null,
      shop: session?.shop || "",
      emailFromAddress: process.env.RESEND_FROM_EMAIL || "noreply@resend.dev",
      emailFromName: process.env.RESEND_FROM_NAME || session?.shop || "Your Store",
      resendApiKeyConfigured: !!process.env.RESEND_API_KEY,
    };
  }

  // Ensure app is set up (this will create discount if needed)
  try {
    await ensureAppSetup(admin, session.shop);
  } catch (error) {
    console.error("Error during app setup:", error);
  }

  // Get stored IDs from database
  const shopConfig = await getShopConfig(session.shop);
  const functionId = shopConfig.functionId;
  let discountId = shopConfig.discountId;
  let config: DiscountConfig | null = null;

  // If we have a function ID but no discount ID, try to find or create the discount
  if (functionId && !discountId) {
    // Use functionHandle from shopify.extension.toml (more stable than functionId)
    const functionHandle = "daisychain-discount-function";
    discountId = await getOrCreateDaisychainDiscount(admin, functionId, undefined, functionHandle);
    if (discountId) {
      await storeDiscountId(session.shop, discountId);
    }
  }

  // Load config from discount metafield if discount exists
  if (discountId) {
    config = await loadDiscountConfig(admin, discountId);
  }

  return {
    config: config || {
      referee_discount_percentage: 10,
      referee_min_order: 0,
      referrer_credit_amount: 5.0,
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
    },
    discountId,
    shop: session.shop,
    emailFromAddress: process.env.RESEND_FROM_EMAIL || "noreply@resend.dev",
    emailFromName: process.env.RESEND_FROM_NAME || session.shop || "Your Store",
    resendApiKeyConfigured: !!process.env.RESEND_API_KEY,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  if (!admin || !session?.shop) {
    return { success: false, error: "Authentication failed" };
  }

  const formData = await request.formData();
  const config: DiscountConfig = {
    referee_discount_percentage: parseFloat(
      formData.get("referee_discount_percentage")?.toString() || "10",
    ),
    referee_min_order: parseFloat(
      formData.get("referee_min_order")?.toString() || "0",
    ),
    referrer_credit_amount: parseFloat(
      formData.get("referrer_credit_amount")?.toString() || "0",
    ),
    min_referrer_orders: parseInt(
      formData.get("min_referrer_orders")?.toString() || "1",
      10,
    ),
    // Referee offer settings
    referee_available_after_days: parseInt(
      formData.get("referee_available_after_days")?.toString() || "0",
      10,
    ),
    referee_redeemable_as_store_credit: formData.get("referee_redeemable_as_store_credit") === "true",
    referee_redeemable_before_referral: formData.get("referee_redeemable_before_referral") === "true",
    // Referrer offer settings
    referrer_available_after_days: parseInt(
      formData.get("referrer_available_after_days")?.toString() || "30",
      10,
    ),
    referrer_redeemable_as_store_credit: formData.get("referrer_redeemable_as_store_credit") === "true",
    // Widget styling
    widget_primary_color: formData.get("widget_primary_color")?.toString() || "#ff6b6b",
    widget_secondary_color: formData.get("widget_secondary_color")?.toString() || "#ee5a6f",
    widget_success_color: formData.get("widget_success_color")?.toString() || "#4caf50",
    widget_text_color: formData.get("widget_text_color")?.toString() || "#ffffff",
    // Email settings
    email_notifications_enabled: formData.get("email_notifications_enabled") === "true",
  };
  
  // Validate discount percentage
  if (config.referee_discount_percentage < 0 || config.referee_discount_percentage > 100) {
    return { 
      success: false, 
      error: "Discount percentage must be between 0 and 100" 
    };
  }
  
  // Validate minimum order
  if (config.referee_min_order < 0) {
    return { 
      success: false, 
      error: "Minimum order amount cannot be negative" 
    };
  }

  // Ensure app is set up
  try {
    await ensureAppSetup(admin, session.shop);
  } catch (error) {
    console.error("Error during app setup:", error);
  }

  const shopConfig = await getShopConfig(session.shop);
  const functionId = shopConfig.functionId;
  
  if (!functionId) {
    return {
      success: false,
      error: "Function ID not found. Make sure the discount function is deployed.",
    };
  }

  let discountId = shopConfig.discountId;
  if (!discountId) {
    console.log("[Settings Action] No discount ID found, creating discount...");
    // Use functionHandle from shopify.extension.toml (more stable than functionId)
    const functionHandle = "daisychain-discount-function";
    discountId = await getOrCreateDaisychainDiscount(admin, functionId, config, functionHandle);
    if (discountId) {
      await storeDiscountId(session.shop, discountId);
      console.log(`[Settings Action] Created and stored discount ID: ${discountId}`);
    } else {
      console.error("[Settings Action] Failed to create discount");
    }
  }

  if (!discountId) {
    return { 
      success: false, 
      error: "Failed to find or create discount. Check the console logs for details. Make sure 'shopify app dev' is running and the function is deployed." 
    };
  }

  // Verify discount configuration before saving
  const { verifyDiscountConfiguration } = await import("../lib/discount-config");
  const verification = await verifyDiscountConfiguration(admin, discountId);
  
  if (!verification.isValid) {
    console.warn("[Settings] Discount configuration issues:", verification.errors);
    // Log warnings but continue - we'll try to save anyway
  }

  const success = await saveDiscountConfig(admin, discountId, config);

  if (!success) {
    return { 
      success: false, 
      error: "Failed to save discount configuration. Please check the console for details." 
    };
  }

  return { success, config };
};

export default function Settings() {
  const { config: initialConfig, discountId, emailFromAddress, emailFromName, resendApiKeyConfigured } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const [config, setConfig] = useState(initialConfig);
  const [activeTab, setActiveTab] = useState<"rewards" | "styling" | "emails">("rewards");

  // Update local state when loader data changes
  useEffect(() => {
    setConfig(initialConfig);
  }, [initialConfig]);

  // Show toast on save
  useEffect(() => {
    if (fetcher.data?.success) {
      shopify.toast.show(`Settings saved! Discount is now ${fetcher.data.config?.referee_discount_percentage || config.referee_discount_percentage}% off.`);
      // Update local config with saved values
      if (fetcher.data.config) {
        setConfig(fetcher.data.config);
      }
    } else if (fetcher.data?.error) {
      shopify.toast.show(`Error: ${fetcher.data.error}`, { isError: true });
    }
  }, [fetcher.data, shopify, config.referee_discount_percentage]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    fetcher.submit(formData, { method: "POST" });
  };

  const isLoading = fetcher.state === "submitting" || fetcher.state === "loading";

  return (
    <s-page heading="Daisychain Settings">
      <s-section heading="Referral Configuration">
        <s-paragraph>
          Configure how your referral program works. Changes will apply to new
          orders.
        </s-paragraph>

        {!discountId && (
          <s-banner tone="warning">
            <s-text>
              Discount not found. Make sure you've deployed the Shopify Function
              and set the DAISYCHAIN_FUNCTION_ID environment variable.
            </s-text>
          </s-banner>
        )}

        {/* Tab Navigation */}
        <div style={{
          display: "flex",
          gap: "8px",
          borderBottom: "2px solid #e5e7eb",
          marginBottom: "24px",
        }}>
          <button
            type="button"
            onClick={() => setActiveTab("rewards")}
            style={{
              padding: "12px 24px",
              border: "none",
              background: "transparent",
              borderBottom: activeTab === "rewards" ? "2px solid #008060" : "2px solid transparent",
              color: activeTab === "rewards" ? "#008060" : "#6b7280",
              fontWeight: activeTab === "rewards" ? "600" : "400",
              cursor: "pointer",
              fontSize: "14px",
              marginBottom: "-2px",
              transition: "all 0.2s ease",
            }}
          >
            Rewards
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("styling")}
            style={{
              padding: "12px 24px",
              border: "none",
              background: "transparent",
              borderBottom: activeTab === "styling" ? "2px solid #008060" : "2px solid transparent",
              color: activeTab === "styling" ? "#008060" : "#6b7280",
              fontWeight: activeTab === "styling" ? "600" : "400",
              cursor: "pointer",
              fontSize: "14px",
              marginBottom: "-2px",
              transition: "all 0.2s ease",
            }}
          >
            Styling
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("emails")}
            style={{
              padding: "12px 24px",
              border: "none",
              background: "transparent",
              borderBottom: activeTab === "emails" ? "2px solid #008060" : "2px solid transparent",
              color: activeTab === "emails" ? "#008060" : "#6b7280",
              fontWeight: activeTab === "emails" ? "600" : "400",
              cursor: "pointer",
              fontSize: "14px",
              marginBottom: "-2px",
              transition: "all 0.2s ease",
            }}
          >
            Emails
          </button>
        </div>

        <fetcher.Form method="post" onSubmit={handleSubmit}>
          <s-stack direction="block" gap="base">
            {/* Rewards Tab */}
            {activeTab === "rewards" && (
              <>
                <s-box padding="base" borderWidth="base" borderRadius="base">
                  <s-stack direction="block" gap="base">
                    <s-heading>Referee Discount</s-heading>
                <s-stack direction="block" gap="small">
                  <label>
                    <s-text>
                      <strong>Discount Percentage</strong>
                    </s-text>
                    <div style={{ marginTop: "4px", marginBottom: "8px" }}>
                      <s-text tone="neutral">
                        Percentage off for customers who use a referral (e.g., 10 = 10% off)
                      </s-text>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <input
                        type="number"
                        name="referee_discount_percentage"
                        value={config.referee_discount_percentage}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            referee_discount_percentage: parseFloat(e.target.value) || 0,
                          })
                        }
                        min="0"
                        max="100"
                        step="0.1"
                        required
                        style={{
                          flex: 1,
                          padding: "8px",
                          marginTop: "4px",
                          borderRadius: "4px",
                          border: "1px solid #ccc",
                          fontSize: "16px",
                        }}
                      />
                      <div style={{ fontSize: "18px", fontWeight: "bold", marginTop: "4px" }}>
                        <s-text>%</s-text>
                      </div>
                    </div>
                    {/* Preview: Show example discount calculation */}
                    {config.referee_discount_percentage > 0 && (
                      <div style={{ 
                        marginTop: "8px", 
                        padding: "12px", 
                        backgroundColor: "#f5f5f5", 
                        borderRadius: "4px",
                        border: "1px solid #e0e0e0"
                      }}>
                        <div style={{ fontSize: "14px" }}>
                          <s-text tone="neutral">
                            <strong>Preview:</strong> A customer with a $100 order will receive{" "}
                            <strong style={{ color: "#008060" }}>
                              ${(100 * config.referee_discount_percentage / 100).toFixed(2)} off
                            </strong>
                            {" "}({config.referee_discount_percentage}% discount)
                          </s-text>
                        </div>
                      </div>
                    )}
                  </label>

                  <label>
                    <s-text>
                      <strong>Minimum Order Amount</strong>
                    </s-text>
                    <div style={{ marginTop: "4px", marginBottom: "8px" }}>
                      <s-text tone="neutral">
                        Minimum order total required to use referral discount (0 =
                        no minimum)
                      </s-text>
                    </div>
                    <input
                      type="number"
                      name="referee_min_order"
                      value={config.referee_min_order}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          referee_min_order: parseFloat(e.target.value) || 0,
                        })
                      }
                      min="0"
                      step="0.01"
                      required
                      style={{
                        width: "100%",
                        padding: "8px",
                        marginTop: "4px",
                        borderRadius: "4px",
                        border: "1px solid #ccc",
                      }}
                    />
                  </label>
                </s-stack>
              </s-stack>
            </s-box>

            <s-box padding="base" borderWidth="base" borderRadius="base">
              <s-stack direction="block" gap="base">
                <s-heading>Referrer Eligibility</s-heading>
                <s-stack direction="block" gap="small">
                  <label>
                    <s-text>
                      <strong>Minimum Orders to Be a Referrer</strong>
                    </s-text>
                    <div style={{ marginTop: "4px", marginBottom: "8px" }}>
                      <s-text tone="neutral">
                        Number of orders a customer must have before they can be used as a referrer (1 = any customer who has purchased)
                      </s-text>
                    </div>
                    <input
                      type="number"
                      name="min_referrer_orders"
                      value={config.min_referrer_orders}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          min_referrer_orders: parseInt(e.target.value, 10) || 1,
                        })
                      }
                      min="1"
                      step="1"
                      required
                      style={{
                        width: "100%",
                        padding: "8px",
                        marginTop: "4px",
                        borderRadius: "4px",
                        border: "1px solid #ccc",
                      }}
                    />
                  </label>
                </s-stack>
              </s-stack>
            </s-box>

            <s-box padding="base" borderWidth="base" borderRadius="base">
              <s-stack direction="block" gap="base">
                <s-heading>Referrer Rewards</s-heading>
                <s-stack direction="block" gap="small">
                  <label>
                    <s-text>
                      <strong>Store Credit Amount</strong>
                    </s-text>
                    <div style={{ marginTop: "4px", marginBottom: "8px" }}>
                      <s-text tone="neutral">
                        Amount of store credit given to the referrer when someone uses their referral (e.g., 5.00 = $5.00)
                      </s-text>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "18px", fontWeight: "bold" }}>$</span>
                      <input
                        type="number"
                        name="referrer_credit_amount"
                        value={config.referrer_credit_amount}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            referrer_credit_amount: parseFloat(e.target.value) || 0,
                          })
                        }
                        min="0"
                        step="0.01"
                        required
                        style={{
                          flex: 1,
                          padding: "8px",
                          marginTop: "4px",
                          borderRadius: "4px",
                          border: "1px solid #ccc",
                          fontSize: "16px",
                        }}
                      />
                    </div>
                    {/* Preview: Show referrer reward */}
                    {config.referrer_credit_amount > 0 && (
                      <div style={{ 
                        marginTop: "8px", 
                        padding: "12px", 
                        backgroundColor: "#f5f5f5", 
                        borderRadius: "4px",
                        border: "1px solid #e0e0e0"
                      }}>
                        <div style={{ fontSize: "14px" }}>
                          <s-text tone="neutral">
                            <strong>Preview:</strong> When someone uses their referral, the referrer will receive{" "}
                            <strong style={{ color: "#008060" }}>
                              ${config.referrer_credit_amount.toFixed(2)} in store credit
                            </strong>
                          </s-text>
                        </div>
                      </div>
                    )}
                  </label>
                </s-stack>
              </s-stack>
            </s-box>

                {/* Rewards Tab - Referee Offer Settings */}
                <s-box padding="base" borderWidth="base" borderRadius="base">
                  <s-stack direction="block" gap="base">
                    <s-heading>Referee Offer Settings</s-heading>
                    <s-stack direction="block" gap="small">
                      <label>
                        <s-text>
                          <strong>Available After (Days)</strong>
                        </s-text>
                        <div style={{ marginTop: "4px", marginBottom: "8px" }}>
                          <s-text tone="neutral">
                            Number of days after order before discount is available (0 = immediate)
                          </s-text>
                        </div>
                        <input
                          type="number"
                          name="referee_available_after_days"
                          value={config.referee_available_after_days}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              referee_available_after_days: parseInt(e.target.value, 10) || 0,
                            })
                          }
                          min="0"
                          step="1"
                          required
                          style={{
                            width: "100%",
                            padding: "8px",
                            marginTop: "4px",
                            borderRadius: "4px",
                            border: "1px solid #ccc",
                          }}
                        />
                      </label>

                      <label>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "16px" }}>
                          <input
                            type="checkbox"
                            name="referee_redeemable_as_store_credit"
                            checked={Boolean(config.referee_redeemable_as_store_credit ?? false)}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                referee_redeemable_as_store_credit: Boolean(e.target.checked),
                              } as DiscountConfig)
                            }
                            style={{ width: "18px", height: "18px" }}
                          />
                          <s-text>
                            <strong>Redeemable as store credit</strong>
                          </s-text>
                        </div>
                        <div style={{ marginTop: "4px", marginLeft: "26px" }}>
                          <s-text tone="neutral">
                            Allow customers to redeem discount as store credit instead of applying at checkout
                          </s-text>
                        </div>
                      </label>

                      <label>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "16px" }}>
                          <input
                            type="checkbox"
                            name="referee_redeemable_before_referral"
                            checked={Boolean(config.referee_redeemable_before_referral ?? false)}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                referee_redeemable_before_referral: Boolean(e.target.checked),
                              } as DiscountConfig)
                            }
                            style={{ width: "18px", height: "18px" }}
                          />
                          <s-text>
                            <strong>Redeemable before referral</strong>
                          </s-text>
                        </div>
                        <div style={{ marginTop: "4px", marginLeft: "26px" }}>
                          <s-text tone="neutral">
                            Allow customers to use discount before they've been referred
                          </s-text>
                        </div>
                      </label>
                    </s-stack>
                  </s-stack>
                </s-box>

                {/* Rewards Tab - Referrer Offer Settings */}
                <s-box padding="base" borderWidth="base" borderRadius="base">
                  <s-stack direction="block" gap="base">
                    <s-heading>Referrer Offer Settings</s-heading>
                    <s-stack direction="block" gap="small">
                      <label>
                        <s-text>
                          <strong>Available After (Days)</strong>
                        </s-text>
                        <div style={{ marginTop: "4px", marginBottom: "8px" }}>
                          <s-text tone="neutral">
                            Number of days after order completion before referrer receives credit
                          </s-text>
                        </div>
                        <input
                          type="number"
                          name="referrer_available_after_days"
                          value={config.referrer_available_after_days}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              referrer_available_after_days: parseInt(e.target.value, 10) || 30,
                            })
                          }
                          min="0"
                          step="1"
                          required
                          style={{
                            width: "100%",
                            padding: "8px",
                            marginTop: "4px",
                            borderRadius: "4px",
                            border: "1px solid #ccc",
                          }}
                        />
                      </label>

                      <label>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "16px" }}>
                          <input
                            type="checkbox"
                            name="referrer_redeemable_as_store_credit"
                            checked={Boolean(config.referrer_redeemable_as_store_credit ?? true)}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                referrer_redeemable_as_store_credit: Boolean(e.target.checked),
                              } as DiscountConfig)
                            }
                            style={{ width: "18px", height: "18px" }}
                          />
                          <s-text>
                            <strong>Redeemable as store credit</strong>
                          </s-text>
                        </div>
                        <div style={{ marginTop: "4px", marginLeft: "26px" }}>
                          <s-text tone="neutral">
                            Referrer reward is given as store credit (recommended)
                          </s-text>
                        </div>
                      </label>
                    </s-stack>
                  </s-stack>
                </s-box>
              </>
            )}

            {/* Styling Tab */}
            {activeTab === "styling" && (
              <s-box padding="base" borderWidth="base" borderRadius="base">
                <s-stack direction="block" gap="base">
                  <s-heading>Widget Styling</s-heading>
                  <div style={{ marginBottom: "12px" }}>
                    <s-text tone="neutral">
                      Customize the colors of the referral widget to match your brand
                    </s-text>
                  </div>
                  <s-stack direction="block" gap="small">
                  <label>
                    <s-text>
                      <strong>Primary Color</strong>
                    </s-text>
                    <div style={{ marginTop: "4px", marginBottom: "8px" }}>
                      <s-text tone="neutral">
                        Main color for the widget button and badge
                      </s-text>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <input
                        type="color"
                        name="widget_primary_color"
                        value={config.widget_primary_color || "#ff6b6b"}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            widget_primary_color: e.target.value,
                          })
                        }
                        style={{
                          width: "60px",
                          height: "40px",
                          border: "1px solid #ccc",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                      />
                      <input
                        type="text"
                        value={config.widget_primary_color || "#ff6b6b"}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            widget_primary_color: e.target.value,
                          })
                        }
                        placeholder="#ff6b6b"
                        style={{
                          flex: 1,
                          padding: "8px",
                          borderRadius: "4px",
                          border: "1px solid #ccc",
                          fontFamily: "monospace",
                        }}
                      />
                    </div>
                  </label>

                  <label>
                    <s-text>
                      <strong>Secondary Color</strong>
                    </s-text>
                    <div style={{ marginTop: "4px", marginBottom: "8px" }}>
                      <s-text tone="neutral">
                        Color for hover states and gradient end
                      </s-text>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <input
                        type="color"
                        name="widget_secondary_color"
                        value={config.widget_secondary_color || "#ee5a6f"}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            widget_secondary_color: e.target.value,
                          })
                        }
                        style={{
                          width: "60px",
                          height: "40px",
                          border: "1px solid #ccc",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                      />
                      <input
                        type="text"
                        value={config.widget_secondary_color || "#ee5a6f"}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            widget_secondary_color: e.target.value,
                          })
                        }
                        placeholder="#ee5a6f"
                        style={{
                          flex: 1,
                          padding: "8px",
                          borderRadius: "4px",
                          border: "1px solid #ccc",
                          fontFamily: "monospace",
                        }}
                      />
                    </div>
                  </label>

                  <label>
                    <s-text>
                      <strong>Success Color</strong>
                    </s-text>
                    <div style={{ marginTop: "4px", marginBottom: "8px" }}>
                      <s-text tone="neutral">
                        Color for the checkmark when referral is validated
                      </s-text>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <input
                        type="color"
                        name="widget_success_color"
                        value={config.widget_success_color || "#4caf50"}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            widget_success_color: e.target.value,
                          })
                        }
                        style={{
                          width: "60px",
                          height: "40px",
                          border: "1px solid #ccc",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                      />
                      <input
                        type="text"
                        value={config.widget_success_color || "#4caf50"}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            widget_success_color: e.target.value,
                          })
                        }
                        placeholder="#4caf50"
                        style={{
                          flex: 1,
                          padding: "8px",
                          borderRadius: "4px",
                          border: "1px solid #ccc",
                          fontFamily: "monospace",
                        }}
                      />
                    </div>
                  </label>

                  <label>
                    <s-text>
                      <strong>Text Color</strong>
                    </s-text>
                    <div style={{ marginTop: "4px", marginBottom: "8px" }}>
                      <s-text tone="neutral">
                        Text color on colored backgrounds (usually white or light)
                      </s-text>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <input
                        type="color"
                        name="widget_text_color"
                        value={config.widget_text_color || "#ffffff"}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            widget_text_color: e.target.value,
                          })
                        }
                        style={{
                          width: "60px",
                          height: "40px",
                          border: "1px solid #ccc",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                      />
                      <input
                        type="text"
                        value={config.widget_text_color || "#ffffff"}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            widget_text_color: e.target.value,
                          })
                        }
                        placeholder="#ffffff"
                        style={{
                          flex: 1,
                          padding: "8px",
                          borderRadius: "4px",
                          border: "1px solid #ccc",
                          fontFamily: "monospace",
                        }}
                      />
                    </div>
                  </label>
                </s-stack>
              </s-stack>
            </s-box>
            )}

            {/* Emails Tab */}
            {activeTab === "emails" && (
              <s-box padding="base" borderWidth="base" borderRadius="base">
                <s-stack direction="block" gap="base">
                  <s-heading>Email Notifications</s-heading>
                  <div style={{ marginBottom: "12px" }}>
                    <s-text tone="neutral">
                      Configure email notifications sent to referrers when their referral codes are used
                    </s-text>
                  </div>
                  <s-stack direction="block" gap="small">
                    <label>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "16px" }}>
                        <input
                          type="checkbox"
                          name="email_notifications_enabled"
                          checked={(config as any).email_notifications_enabled ?? true}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              email_notifications_enabled: e.target.checked as boolean,
                            } as DiscountConfig)
                          }
                          style={{ width: "18px", height: "18px" }}
                        />
                        <s-text>
                          <strong>Enable email notifications</strong>
                        </s-text>
                      </div>
                      <div style={{ marginTop: "4px", marginLeft: "26px" }}>
                        <s-text tone="neutral">
                          Send emails to referrers when someone uses their referral code
                        </s-text>
                      </div>
                    </label>

                    {((config as any).email_notifications_enabled ?? true) && (
                      <>
                        <label>
                          <s-text>
                            <strong>From Email Address</strong>
                          </s-text>
                          <div style={{ marginTop: "4px", marginBottom: "8px" }}>
                            <s-text tone="neutral">
                              Email address that notifications will be sent from (configured via RESEND_FROM_EMAIL environment variable)
                            </s-text>
                          </div>
                          <input
                            type="text"
                            name="email_from_address"
                            value={emailFromAddress}
                            disabled
                            style={{
                              width: "100%",
                              padding: "8px",
                              marginTop: "4px",
                              borderRadius: "4px",
                              border: "1px solid #ccc",
                              backgroundColor: "#f5f5f5",
                              color: "#6b7280",
                            }}
                          />
                          <div style={{ marginTop: "4px", fontSize: "12px", color: "#6b7280" }}>
                            <s-text tone="neutral">
                              Configure this via the RESEND_FROM_EMAIL environment variable in your app settings
                            </s-text>
                          </div>
                        </label>

                        <label>
                          <s-text>
                            <strong>From Name</strong>
                          </s-text>
                          <div style={{ marginTop: "4px", marginBottom: "8px" }}>
                            <s-text tone="neutral">
                              Display name for email sender (configured via RESEND_FROM_NAME environment variable, defaults to shop name)
                            </s-text>
                          </div>
                          <input
                            type="text"
                            name="email_from_name"
                            value={emailFromName}
                            disabled
                            style={{
                              width: "100%",
                              padding: "8px",
                              marginTop: "4px",
                              borderRadius: "4px",
                              border: "1px solid #ccc",
                              backgroundColor: "#f5f5f5",
                              color: "#6b7280",
                            }}
                          />
                          <div style={{ marginTop: "4px", fontSize: "12px", color: "#6b7280" }}>
                            <s-text tone="neutral">
                              Configure this via the RESEND_FROM_NAME environment variable in your app settings
                            </s-text>
                          </div>
                        </label>

                        {!resendApiKeyConfigured && (
                          <s-banner tone="warning">
                            <s-text>
                              <strong>Warning:</strong> Resend API key is not configured. Set the RESEND_API_KEY environment variable to enable email notifications.
                            </s-text>
                          </s-banner>
                        )}
                        {resendApiKeyConfigured && (
                          <s-banner tone="info">
                            <s-text>
                              <strong>Note:</strong> Email notifications are configured and will be sent automatically when referrals are used.
                            </s-text>
                          </s-banner>
                        )}
                      </>
                    )}
                  </s-stack>
                </s-stack>
              </s-box>
            )}

            <s-button
              type="submit"
              variant="primary"
              {...(isLoading ? { loading: true } : {})}
            >
              Save Settings
            </s-button>
          </s-stack>
        </fetcher.Form>
      </s-section>

      <s-section slot="aside" heading="How It Works">
        <div style={{ 
          padding: "16px 0",
        }}>
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}>
            <div style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
            }}>
              <div style={{
                fontSize: "24px",
                lineHeight: "1",
                flexShrink: 0,
              }}>🛍️</div>
              <div>
                <div style={{ 
                  fontSize: "15px", 
                  fontWeight: "600",
                  marginBottom: "4px",
                  color: "#1a1a1a",
                }}>
                  <s-text>Customer uses referral widget</s-text>
                </div>
                <div style={{ 
                  fontSize: "13px", 
                  color: "#6b7280",
                  lineHeight: "1.5",
                }}>
                  <s-text tone="neutral">They click the floating widget and enter their referrer's name</s-text>
                </div>
              </div>
            </div>

            <div style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
            }}>
              <div style={{
                fontSize: "24px",
                lineHeight: "1",
                flexShrink: 0,
              }}>✅</div>
              <div>
                <div style={{ 
                  fontSize: "15px", 
                  fontWeight: "600",
                  marginBottom: "4px",
                  color: "#1a1a1a",
                }}>
                  <s-text>We validate automatically</s-text>
                </div>
                <div style={{ 
                  fontSize: "13px", 
                  color: "#6b7280",
                  lineHeight: "1.5",
                }}>
                  <s-text tone="neutral">The app checks if the referrer has made purchases</s-text>
                </div>
              </div>
            </div>

            <div style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
            }}>
              <div style={{
                fontSize: "24px",
                lineHeight: "1",
                flexShrink: 0,
              }}>🎁</div>
              <div>
                <div style={{ 
                  fontSize: "15px", 
                  fontWeight: "600",
                  marginBottom: "4px",
                  color: "#1a1a1a",
                }}>
                  <s-text>Everyone wins!</s-text>
                </div>
                <div style={{ 
                  fontSize: "13px", 
                  color: "#6b7280",
                  lineHeight: "1.5",
                }}>
                  <s-text tone="neutral">
                    <strong style={{ color: "#008060" }}>Referee:</strong> Gets {config.referee_discount_percentage}% off at checkout
                    <br />
                    <strong style={{ color: "#008060" }}>Referrer:</strong> Gets ${config.referrer_credit_amount.toFixed(2)} store credit
                  </s-text>
                </div>
              </div>
            </div>
          </div>
        </div>
      </s-section>

      <s-section slot="aside" heading="Install Widget">
        <div style={{
          padding: "16px",
          backgroundColor: "#fef3c7",
          borderRadius: "8px",
          border: "1px solid #fde68a",
        }}>
          <div style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
            marginBottom: "12px",
          }}>
            <span style={{ fontSize: "24px", flexShrink: 0 }}>📦</span>
            <div style={{ flex: 1 }}>
              <div style={{ 
                fontSize: "15px", 
                fontWeight: "600",
                marginBottom: "4px",
                color: "#92400e",
              }}>
                <s-text>Add to Your Theme</s-text>
              </div>
              <div style={{ 
                fontSize: "13px", 
                color: "#78350f",
                lineHeight: "1.5",
                marginBottom: "12px",
              }}>
                <s-text>Add the referral widget to your theme so customers can use it:</s-text>
              </div>
              <div style={{
                padding: "12px",
                backgroundColor: "#fff",
                borderRadius: "6px",
                border: "1px solid #fde68a",
              }}>
                <ol style={{
                  margin: 0,
                  paddingLeft: "20px",
                  fontSize: "13px",
                  color: "#78350f",
                  lineHeight: "1.8",
                }}>
                  <li style={{ marginBottom: "8px" }}>
                    <s-text>Go to <strong>Online Store → Themes</strong></s-text>
                  </li>
                  <li style={{ marginBottom: "8px" }}>
                    <s-text>Click <strong>Customize</strong> on your active theme</s-text>
                  </li>
                  <li style={{ marginBottom: "8px" }}>
                    <s-text>Add the <strong>"Daisychain Referral"</strong> block to any page</s-text>
                  </li>
                  <li>
                    <s-text>Save and publish your theme</s-text>
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </s-section>

      <s-section slot="aside" heading="Current Settings">
        <div style={{
          padding: "16px 0",
        }}>
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}>
            <div style={{
              padding: "16px",
              backgroundColor: "#f0fdf4",
              borderRadius: "8px",
              border: "1px solid #bbf7d0",
            }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "8px",
              }}>
                <span style={{ fontSize: "20px" }}>🎯</span>
                <div style={{ fontSize: "12px", fontWeight: "600", color: "#166534", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  <s-text>Referee Reward</s-text>
                </div>
              </div>
              <div style={{ fontSize: "24px", fontWeight: "700", color: "#166534" }}>
                <s-text>{config.referee_discount_percentage}% OFF</s-text>
              </div>
              {config.referee_min_order > 0 && (
                <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                  <s-text tone="neutral">Min. order: ${config.referee_min_order.toFixed(2)}</s-text>
                </div>
              )}
            </div>

            <div style={{
              padding: "16px",
              backgroundColor: "#eff6ff",
              borderRadius: "8px",
              border: "1px solid #bfdbfe",
            }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "8px",
              }}>
                <span style={{ fontSize: "20px" }}>💰</span>
                <div style={{ fontSize: "12px", fontWeight: "600", color: "#1e40af", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  <s-text>Referrer Reward</s-text>
                </div>
              </div>
              <div style={{ fontSize: "24px", fontWeight: "700", color: "#1e40af" }}>
                <s-text>${config.referrer_credit_amount.toFixed(2)}</s-text>
              </div>
              <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                <s-text tone="neutral">Store credit per referral</s-text>
              </div>
            </div>

            <div style={{
              padding: "12px 16px",
              backgroundColor: "#f9fafb",
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
            }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}>
                <div style={{ fontSize: "13px", color: "#6b7280" }}>
                  <s-text tone="neutral">Referrer Eligibility</s-text>
                </div>
                <div style={{ fontSize: "15px", fontWeight: "600", color: "#1a1a1a" }}>
                  <s-text>{config.min_referrer_orders} order{config.min_referrer_orders !== 1 ? "s" : ""}</s-text>
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

