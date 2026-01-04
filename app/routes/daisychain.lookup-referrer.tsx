/**
 * App Proxy Route for Daisychain Referral Lookup
 * 
 * This route handles GET requests from the storefront theme extension.
 * Path: /apps/daisychain/lookup-referrer
 * 
 * The theme extension calls this endpoint to validate a referrer name
 * and get the referrer's customer ID for cart attributes.
 */

import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { findCustomerByName } from "../lib/shopify-queries";

/**
 * Set headers for app proxy responses
 * Gets shop domain from loader headers (set by loader from query params)
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
 * Handle GET requests for referrer lookup
 * Query params: ?name=Sarah%20Johnson&shop={shop}.myshopify.com
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  
  // Missing shop parameter - not a valid app proxy request
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
    // Authenticate app proxy request (verifies HMAC automatically)
    const context = await authenticate.public.appProxy(request);

    // Log context for debugging
    console.log("App proxy context keys:", Object.keys(context));
    console.log("Has session:", !!context.session);
    console.log("Has admin:", !!context.admin);
    if (context.session) {
      console.log("Session shop:", context.session.shop);
      console.log("Session scope:", context.session.scope);
      console.log("Session isActive:", context.session.isActive);
    }

    // If no session/admin available, return error
    if (!context.admin) {
      console.error("Admin context not available - app may not be installed or session missing");
      return Response.json(
        { 
          error: "admin_session_unavailable", 
          message: "Admin session not available for this shop. Make sure the app is installed and you've completed OAuth." 
        },
        { 
          status: 401,
          headers: {
            "x-proxy-shop-domain": shop,
          },
        },
      );
    }

    const { admin } = context;

    // Test admin client with a simple query to verify it works
    // This helps identify if the issue is with the admin client itself
    try {
      const testResponse = await admin.graphql(
        `#graphql
        query TestAdminAccess {
          currentAppInstallation {
            accessScopes {
              handle
            }
          }
        }`
      );
      const testData = await testResponse.json();
      console.log("Admin client test successful. Available scopes:", testData.data?.currentAppInstallation?.accessScopes?.map((s: any) => s.handle));
      
      // Check if read_customers scope is available
      const scopes = testData.data?.currentAppInstallation?.accessScopes?.map((s: any) => s.handle) || [];
      if (!scopes.includes("read_customers")) {
        console.error("read_customers scope not found in app installation");
        return Response.json(
          { 
            error: "missing_scope", 
            message: "App does not have read_customers scope. Please reinstall the app or update scopes." 
          },
          { 
            status: 403,
            headers: {
              "x-proxy-shop-domain": shop,
            },
          },
        );
      }
    } catch (testError) {
      console.error("Admin client test failed:", testError);
      // If the test query fails, the admin client itself is broken
      // This is likely a session token issue
      const errorMessage = testError instanceof Error ? testError.message : String(testError);
      return Response.json(
        { 
          error: "admin_api_failed", 
          message: `Admin API test failed: ${errorMessage}. This usually means the session token is invalid or expired. Try reinstalling the app.` 
        },
        { 
          status: 401,
          headers: {
            "x-proxy-shop-domain": shop,
          },
        },
      );
    }

    // Get referrer name from query params
    const referrerName = url.searchParams.get("name");

    if (!referrerName || referrerName.trim().length === 0) {
      return Response.json(
        { error: "missing_name", message: "Referrer name is required" },
        { 
          status: 400,
          headers: {
            "x-proxy-shop-domain": shop,
          },
        },
      );
    }

    // Search for customer by name
    const customer = await findCustomerByName(admin, referrerName.trim());

    if (!customer) {
      return Response.json(
        { 
          error: "referrer_not_found", 
          message: "Referrer not found. Make sure they've made a purchase before." 
        },
        { 
          status: 404,
          headers: {
            "x-proxy-shop-domain": shop,
          },
        },
      );
    }

    // Return customer info for cart attributes
    // Pass shop domain via header for CSP in headers function
    return Response.json(
      {
        success: true,
        customer: {
          id: customer.id,
          displayName: customer.displayName,
          email: customer.email,
        },
      },
      {
        headers: {
          "x-proxy-shop-domain": shop,
        },
      },
    );
  } catch (error) {
    // Authentication errors (HMAC verification failures, etc.)
    console.error("Error in lookup-referrer loader:", error);
    const errorDetails = error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name,
    } : { error: String(error) };
    
    // Log full error details for debugging
    console.error("Full error details:", JSON.stringify(errorDetails, null, 2));
    console.error("Request URL:", request.url);
    console.error("Request headers:", Object.fromEntries(request.headers.entries()));
    
    // Get shop from URL (defined at top of function)
    const shopDomain = shop || "";
    return Response.json(
      { 
        error: "unauthorized", 
        message: "Unauthorized - app proxy authentication failed",
        // Include error details in development (remove in production)
        ...(process.env.NODE_ENV === "development" ? { details: errorDetails } : {}),
      },
      { 
        status: 401,
        headers: {
          "x-proxy-shop-domain": shopDomain,
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
      // CSP on OPTIONS is optional (browsers ignore it), but included for consistency
      "Content-Security-Policy": "frame-ancestors https://shop.app https://*.myshopify.com;",
    },
  });
}

