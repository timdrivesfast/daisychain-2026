/**
 * App Proxy Route for Checking Referrer Status
 * 
 * Checks if a customer (by name) is already eligible to be a referrer
 * Path: /apps/daisychain/check-referrer-status
 */

import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { findCustomerByName } from "../lib/shopify-queries";
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
 * Handle GET requests for referrer status check
 * Query params: ?name=John%20Doe&shop={shop}.myshopify.com
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

    // Get customer name from query params
    const customerName = url.searchParams.get("name");

    if (!customerName || customerName.trim().length === 0) {
      return Response.json(
        { error: "missing_name", message: "Customer name is required" },
        { 
          status: 400,
          headers: {
            "x-proxy-shop-domain": shop,
          },
        },
      );
    }

    // Get discount config to check min_referrer_orders
    const shopConfig = await getShopConfig(session.shop);
    const discountId = shopConfig.discountId;
    let minReferrerOrders = 1; // Default

    if (discountId) {
      const config = await loadDiscountConfig(admin, discountId);
      minReferrerOrders = config.min_referrer_orders;
    }

    // Find customer by name (this already checks numberOfOrders > 0)
    // But we need to check if numberOfOrders >= minReferrerOrders
    // So we'll need to query the customer directly to get numberOfOrders
    const query = `#graphql
      query FindCustomerByName($query: String!) {
        customers(first: 10, query: $query) {
          edges {
            node {
              id
              displayName
              numberOfOrders
            }
          }
        }
      }
    `;

    // Build search query
    const nameParts = customerName.trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";
    let searchQuery = `first_name:'${firstName.replace(/'/g, "\\'")}'`;
    if (lastName) {
      searchQuery += ` AND last_name:'${lastName.replace(/'/g, "\\'")}'`;
    }

    const response = await admin.graphql(query, {
      variables: {
        query: searchQuery,
      },
    });

    const data: any = await response.json();

    if (data.errors) {
      console.error("GraphQL errors:", JSON.stringify(data.errors, null, 2));
      return Response.json(
        { 
          error: "query_failed", 
          message: "Failed to query customer" 
        },
        { 
          status: 500,
          headers: {
            "x-proxy-shop-domain": shop,
          },
        },
      );
    }

    const customers = data.data?.customers?.edges || [];
    const normalizedSearch = customerName.toLowerCase().trim();
    
    // Find exact match
    for (const edge of customers) {
      const customer = edge.node;
      const normalizedName = customer.displayName?.toLowerCase().trim();
      if (normalizedName === normalizedSearch) {
        const numberOfOrders = customer.numberOfOrders || 0;
        const isEligible = numberOfOrders >= minReferrerOrders;
        
        return Response.json(
          {
            success: true,
            is_eligible: isEligible,
            customer_name: customer.displayName,
            number_of_orders: numberOfOrders,
            min_required_orders: minReferrerOrders,
          },
          {
            headers: {
              "x-proxy-shop-domain": shop,
            },
          },
        );
      }
    }

    // Customer not found
    return Response.json(
      { 
        error: "customer_not_found", 
        message: "Customer not found. Make sure they've made a purchase." 
      },
      { 
        status: 404,
        headers: {
          "x-proxy-shop-domain": shop,
        },
      },
    );
  } catch (error) {
    console.error("Error in check-referrer-status loader:", error);
    
    return Response.json(
      { 
        error: "server_error", 
        message: "An error occurred while checking referrer status" 
      },
      { 
        status: 500,
        headers: {
          "x-proxy-shop-domain": shop || "",
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

