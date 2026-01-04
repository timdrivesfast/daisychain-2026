/**
 * App Proxy Route for Daisychain Config
 * 
 * Returns the current discount configuration for the widget to display
 * Path: /apps/daisychain/config
 */

import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { loadDiscountConfig } from "../lib/discount-config";
import { getShopConfig } from "../lib/function-management";

/**
 * Set headers for app proxy responses
 */
export const headers: HeadersFunction = ({ loaderHeaders }) => {
  const shopDomain = loaderHeaders.get("x-proxy-shop-domain") || "";
  const csp = shopDomain
    ? `frame-ancestors https://shop.app https://${shopDomain};`
    : "frame-ancestors https://shop.app https://*.myshopify.com;";
  
  return {
    ...loaderHeaders,
    "Content-Security-Policy": csp,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
};

/**
 * Handle GET requests for discount config
 * Query params: ?shop={shop}.myshopify.com
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  
  // Missing shop parameter
  if (!shop || shop.trim().length === 0) {
    return Response.json(
      { error: "missing_shop", message: "Missing shop parameter" },
      { 
        status: 400,
        headers: {
          "x-proxy-shop-domain": "",
        },
      },
    );
  }

  try {
    // Authenticate app proxy request
    const context = await authenticate.public.appProxy(request);

    if (!context.admin) {
      return Response.json(
        { 
          error: "admin_session_unavailable", 
          message: "Admin session not available" 
        },
        { 
          status: 401,
          headers: {
            "x-proxy-shop-domain": shop,
          },
        },
      );
    }

    const { admin, session } = context;

    // Get discount ID from database
    const shopConfig = await getShopConfig(session.shop);
    const discountId = shopConfig.discountId;

    if (!discountId) {
      // Return default if no discount configured yet
      return Response.json(
        {
          success: true,
          discount_percentage: 10, // Default
          referrer_credit_amount: 5.0, // Default
          min_referrer_orders: 1, // Default
          widget_primary_color: "#ff6b6b",
          widget_secondary_color: "#ee5a6f",
          widget_success_color: "#4caf50",
          widget_text_color: "#ffffff",
        },
        {
          headers: {
            "x-proxy-shop-domain": shop,
          },
        },
      );
    }

    // Load config from discount metafield
    const config = await loadDiscountConfig(admin, discountId);

    // Return discount percentage, referrer credit amount, min referrer orders, and widget colors for the widget
    return Response.json(
      {
        success: true,
        discount_percentage: config.referee_discount_percentage,
        referrer_credit_amount: config.referrer_credit_amount,
        min_referrer_orders: config.min_referrer_orders,
        widget_primary_color: config.widget_primary_color || "#ff6b6b",
        widget_secondary_color: config.widget_secondary_color || "#ee5a6f",
        widget_success_color: config.widget_success_color || "#4caf50",
        widget_text_color: config.widget_text_color || "#ffffff",
      },
      {
        headers: {
          "x-proxy-shop-domain": shop,
        },
      },
    );
  } catch (error) {
    console.error("Error in config loader:", error);
    
    // Return default on error so widget still works
    return Response.json(
      {
        success: true,
        discount_percentage: 10, // Default fallback
        referrer_credit_amount: 5.0, // Default fallback
        min_referrer_orders: 1, // Default fallback
        widget_primary_color: "#ff6b6b",
        widget_secondary_color: "#ee5a6f",
        widget_success_color: "#4caf50",
        widget_text_color: "#ffffff",
      },
      {
        status: 200,
        headers: {
          "x-proxy-shop-domain": shop,
        },
      },
    );
  }
}

/**
 * Handle OPTIONS requests for CORS preflight
 */
export async function options() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Security-Policy": "frame-ancestors https://shop.app https://*.myshopify.com;",
    },
  });
}

