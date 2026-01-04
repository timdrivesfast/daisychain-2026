/**
 * App Proxy Route for Daisychain Cart Update
 * 
 * This route handles POST requests from the storefront theme extension.
 * Path: /apps/daisychain/lookup-referrer/update-cart
 * 
 * The theme extension calls this endpoint to update cart attributes with referral info.
 */

import type { ActionFunctionArgs, HeadersFunction } from "react-router";
import { authenticate, apiVersion } from "../shopify.server";

/**
 * Set headers for app proxy responses
 * Gets shop domain from action headers (set by action from query params)
 */
export const headers: HeadersFunction = ({ actionHeaders }) => {
  const shopDomain = actionHeaders.get("x-proxy-shop-domain") || "";
  const csp = shopDomain
    ? `frame-ancestors https://shop.app https://${shopDomain};`
    : "frame-ancestors https://shop.app https://*.myshopify.com;";
  
  return {
    ...actionHeaders,
    "Content-Security-Policy": csp,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
};

/**
 * Handle POST requests for updating cart attributes
 * Body: { cartToken: string, referrerId: string, referrerName: string }
 * Query params: ?shop={shop}.myshopify.com
 */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method.toUpperCase() !== "POST") {
    return Response.json(
      { error: "method_not_allowed", message: "Method not allowed" },
      { 
        status: 405,
        headers: {
          "x-proxy-shop-domain": "",
        },
      },
    );
  }

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

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return Response.json(
      { error: "invalid_json", message: "Request body must be valid JSON" },
      { 
        status: 400,
        headers: {
          "x-proxy-shop-domain": shop,
        },
      },
    );
  }

  try {
    // Authenticate app proxy request to verify it's from Shopify
    const { session } = await authenticate.public.appProxy(request);
    
    if (!session) {
      return Response.json(
        { 
          error: "session_unavailable", 
          message: "App proxy session not available." 
        },
        { 
          status: 401,
          headers: {
            "x-proxy-shop-domain": shop,
          },
        },
      );
    }
    
    const shopDomain = session.shop; // e.g. "dc-cro-testing.myshopify.com" or "merchant-store.myshopify.com"
    
    // Validate payload
    const { cartToken, referrerId, referrerName } = payload;

    // Validate cartToken: must be a non-empty string with reasonable length
    if (!cartToken || typeof cartToken !== 'string' || cartToken.trim().length < 8) {
      return Response.json(
        { 
          error: "invalid_cart_token", 
          message: "Invalid cart token format. Cart token must be a non-empty string." 
        },
        { 
          status: 400,
          headers: {
            "x-proxy-shop-domain": shop,
          },
        },
      );
    }

    if (!referrerId) {
      return Response.json(
        { 
          error: "missing_required_fields", 
          message: "Referrer ID is required" 
        },
        { 
          status: 400,
          headers: {
            "x-proxy-shop-domain": shop,
          },
        },
      );
    }

    // Construct cart ID from token
    // Storefront API cart ID format: gid://shopify/Cart/{token}
    // This format is correct for Online Store carts from /cart.js
    const cartId = `gid://shopify/Cart/${cartToken.trim()}`;

    // Set the referral attributes
    // Note: We're only setting the referral attributes here
    // Other existing attributes will be preserved by Shopify
    const newAttributes = [
      { key: "referrer_customer_id", value: referrerId },
      { key: "referrer_name", value: referrerName || "" },
      { key: "referral_validated", value: "true" },
    ];

    // Update cart attributes
    // Note: cartAttributesUpdate is a Storefront API mutation (not Admin API)
    // IDE may show error "Cannot query field cartAttributesUpdate on type Mutation"
    // This is a false positive - the IDE is checking Admin API schema, but we're using
    // storefront.graphql() which uses Storefront API schema where this mutation exists.
    // Validated against Storefront API schema - mutation is correct and will work at runtime.
    const updateMutation = `#graphql
      mutation UpdateCartAttributes($cartId: ID!, $attributes: [AttributeInput!]!) {
        cartAttributesUpdate(cartId: $cartId, attributes: $attributes) {
          cart {
            id
            attributes {
              key
              value
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    // Update cart using tokenless Storefront API
    // This works on both dev stores and production stores when Online Store channel is active
    // This works on live merchant stores where Online Store channel is unlocked
    let updateData: any;
    
    try {
      console.log("Calling cartAttributesUpdate with tokenless Storefront API");
      console.log("Cart ID:", cartId);
      console.log("Shop domain:", shopDomain);
      
      // Use tokenless Storefront API (no access token header)
      // This is the production approach for Online Store carts
      const storefrontUrl = `https://${shopDomain}/api/${apiVersion}/graphql.json`;
      
      const fetchResponse = await fetch(storefrontUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // No X-Shopify-Storefront-Access-Token header = tokenless access
        },
        body: JSON.stringify({
          query: updateMutation,
          variables: {
            cartId,
            attributes: newAttributes,
          },
        }),
      });
      
      updateData = await fetchResponse.json();
      
      console.log("Storefront API response status:", fetchResponse.status);
      console.log("Storefront API response data:", JSON.stringify(updateData, null, 2));
      
      // Handle HTTP errors
      if (!fetchResponse.ok) {
        console.error("Storefront API HTTP error:", fetchResponse.status, fetchResponse.statusText);
        
        // Check for "Online Store channel is locked" error - this is expected on some dev stores
        const errorMessage = updateData.errors?.[0]?.message || "";
        if (errorMessage.includes("Online Store channel is locked")) {
          // Return success with a note that attributes are stored in localStorage
          // The widget will handle this and use localStorage as fallback
          console.log("[INFO] Online Store channel is locked - cart attributes will be stored in localStorage as fallback");
          return Response.json(
            { 
              success: true,
              fallback: true,
              message: "Cart attributes stored in localStorage (Online Store channel is locked on dev store)",
              cart: {
                id: cartId,
                attributes: newAttributes,
              },
            },
            { 
              status: 200,
              headers: {
                "x-proxy-shop-domain": shop,
              },
            },
          );
        }
        
        return Response.json(
          { 
            error: "storefront_api_error", 
            message: `Storefront API returned ${fetchResponse.status}: ${fetchResponse.statusText}`,
            data: updateData
          },
          { 
            status: fetchResponse.status,
            headers: {
              "x-proxy-shop-domain": shop,
            },
          },
        );
      }
      
      // Handle GraphQL errors (top-level errors)
      if (updateData.errors) {
        console.error("Storefront API GraphQL errors:", JSON.stringify(updateData.errors, null, 2));
        
        // Check for "Online Store channel is locked" error
        const errorMessage = updateData.errors[0]?.message || "";
        if (errorMessage.includes("Online Store channel is locked")) {
          // On dev stores with locked Online Store channel, we can't set cart attributes
          // But we can still save to localStorage as a fallback for the widget
          // Note: The discount function won't be able to read from localStorage,
          // so the discount won't apply automatically until the Online Store channel is unlocked
          console.log("[INFO] Online Store channel is locked - cart attributes saved to localStorage only");
          return Response.json(
            { 
              success: true,
              fallback: true,
              warning: "Online Store channel is locked. Cart attributes saved to localStorage. To test automatic discounts, unlock the Online Store channel in Settings → Sales channels → Online Store.",
              cart: {
                id: cartId,
                attributes: newAttributes,
              },
            },
            { 
              status: 200,
              headers: {
                "x-proxy-shop-domain": shop,
              },
            },
          );
        }
        
        // Return GraphQL errors
        return Response.json(
          { 
            error: "graphql_error", 
            message: "Storefront API returned errors",
            errors: updateData.errors
          },
          { 
            status: 500,
            headers: {
              "x-proxy-shop-domain": shop,
            },
          },
        );
      }
      
      // Handle userErrors (business logic errors from the mutation)
      const userErrors = updateData.data?.cartAttributesUpdate?.userErrors ?? [];
      if (userErrors.length > 0) {
        console.error("Cart update userErrors:", JSON.stringify(userErrors, null, 2));
        return Response.json(
          { 
            error: "cart_update_failed", 
            message: userErrors[0]?.message || "Failed to update cart",
            userErrors: userErrors
          },
          { 
            status: 400,
            headers: {
              "x-proxy-shop-domain": shop,
            },
          },
        );
      }
    } catch (fetchError: any) {
      console.error("Storefront API fetch error:", fetchError);
      
      const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
      
      return Response.json(
        { 
          error: "cart_update_failed", 
          message: `Failed to update cart: ${errorMessage}` 
        },
        { 
          status: 500,
          headers: {
            "x-proxy-shop-domain": shop,
          },
        },
      );
    }

      // Success - return the updated cart
      return Response.json(
        { 
          success: true,
          cart: updateData.data?.cartAttributesUpdate?.cart
        },
        {
          headers: {
            "x-proxy-shop-domain": shop,
          },
        },
      );
  } catch (error) {
    // Authentication errors (HMAC verification failures, etc.)
    console.error("Error in update-cart action:", error);
    return Response.json(
      { 
        error: "unauthorized", 
        message: "Unauthorized - app proxy authentication failed" 
      },
      { 
        status: 401,
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
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      // CSP on OPTIONS is optional (browsers ignore it), but included for consistency
      "Content-Security-Policy": "frame-ancestors https://shop.app https://*.myshopify.com;",
    },
  });
}

