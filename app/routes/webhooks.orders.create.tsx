/**
 * Webhook Handler for Order Creation
 * 
 * This webhook fires when a customer completes checkout.
 * It extracts the referrer ID from order attributes and credits the referrer.
 * 
 * Route: /webhooks/orders/create
 */

import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import {
  addReferralCredit,
  deductReferralCredit,
  incrementReferralsMade,
  markCustomerUsedReferral,
  hasCustomerUsedReferral,
  getCustomerMetafield,
  getCustomerById,
} from "../lib/shopify-queries";
import { loadDiscountConfig } from "../lib/discount-config";
import { sendReferralUsedEmail } from "../lib/email";

/**
 * Process order webhook asynchronously
 * This function runs after we return a response to Shopify
 */
async function processOrderWebhook(
  admin: any,
  order: any,
  discountId: string | null,
  shop: string,
): Promise<void> {
  try {
    // Extract referrer info from order note_attributes
    // Cart attributes become note_attributes after purchase
    const noteAttributes = order.note_attributes || [];
    const referrerIdAttr = noteAttributes.find(
      (attr: { name: string; value: string }) =>
        attr.name === "referrer_customer_id",
    );

    if (!referrerIdAttr || !referrerIdAttr.value) {
      console.log("No referrer found in order attributes");
      return;
    }

    const referrerId = referrerIdAttr.value;
    const referrerNameAttr = noteAttributes.find(
      (attr: { name: string; value: string }) =>
        attr.name === "referrer_name",
    );
    const referrerName = referrerNameAttr?.value || "Unknown";
    const customerId = order.customer?.id;
    const orderId = order.id || order.admin_graphql_api_id;

    // Store referral data as order metafields for faster analytics queries
    // This allows us to query via GraphQL instead of slow REST API calls
    if (orderId) {
      try {
        const { setOrderMetafield } = await import("../lib/shopify-queries");
        await setOrderMetafield(admin, orderId, "referrer_customer_id", referrerId, "single_line_text_field");
        await setOrderMetafield(admin, orderId, "referrer_name", referrerName, "single_line_text_field");
        await setOrderMetafield(admin, orderId, "is_referral", "true", "boolean");
        console.log(`[Webhook] Stored referral metafields on order ${orderId}`);
      } catch (metafieldError) {
        console.warn("Failed to set order metafields (non-critical):", metafieldError);
        // Continue processing even if metafield setting fails
      }
    }

    if (!customerId) {
      console.log("Order has no customer ID (guest checkout?)");
      return;
    }

    // Check if customer has already used a referral
    const hasUsedReferral = await hasCustomerUsedReferral(admin, customerId);

    if (hasUsedReferral) {
      console.log("Customer has already used a referral, skipping");
      return;
    }

    // Get discount config to determine credit amount
    let creditAmount = 5.0; // Default
    if (discountId) {
      const config = await loadDiscountConfig(admin, discountId);
      creditAmount = config.referrer_credit_amount;
    }

    // Credit the referrer
    const creditSuccess = await addReferralCredit(admin, referrerId, creditAmount);
    if (!creditSuccess) {
      console.error("Failed to credit referrer:", referrerId);
      return;
    }

    // Increment referrer's referral count
    await incrementReferralsMade(admin, referrerId);

    // Mark customer as having used a referral
    await markCustomerUsedReferral(admin, customerId, referrerId);

    console.log(
      `Successfully credited referrer ${referrerId} with $${creditAmount} for order ${order.id}`,
    );

    // Deduct store credit if it was used in this order
    // Query order's discountApplications via GraphQL to accurately detect store credit usage
    if (customerId && orderId) {
      try {
        // Get store credit discount ID from database
        const { getStoredStoreCreditDiscountId } = await import("../lib/function-management");
        const storeCreditDiscountId = await getStoredStoreCreditDiscountId(shop);

        if (storeCreditDiscountId) {
          // Query order with discountApplications to find store credit discount
          const query = `#graphql
            query OrderDiscounts($id: ID!) {
              order(id: $id) {
                id
                discountApplications(first: 50) {
                  edges {
                    node {
                      __typename
                      targetType
                      value {
                        ... on MoneyV2 {
                          amount
                          currencyCode
                        }
                        ... on PricingPercentageValue {
                          percentage
                        }
                      }
                      ... on AutomaticDiscountApplication {
                        title
                        value {
                          ... on MoneyV2 {
                            amount
                            currencyCode
                          }
                          ... on PricingPercentageValue {
                            percentage
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          `;

          const response = await admin.graphql(query, {
            variables: { id: orderId },
          });
          const data = await response.json();
          const discountApplications = data.data?.order?.discountApplications?.edges || [];

          // Find store credit discount application by title
          let storeCreditAmount = 0;
          for (const edge of discountApplications) {
            const discountApp = edge.node;
            // Check if this is the store credit discount (AutomaticDiscountApplication)
            // Only automatic app discounts have a title field
            if (
              discountApp.__typename === "AutomaticDiscountApplication" &&
              discountApp.title === "Daisychain Store Credits" &&
              discountApp.targetType === "ORDER"
            ) {
              // Extract the discount amount from value
              if (discountApp.value && discountApp.value.amount) {
                storeCreditAmount = parseFloat(discountApp.value.amount);
                break;
              }
            }
          }

          // Deduct the store credit amount if it was used
          if (storeCreditAmount > 0) {
            await deductReferralCredit(admin, customerId, storeCreditAmount);
            console.log(
              `Deducted $${storeCreditAmount} store credit from customer ${customerId} for order ${order.id}`,
            );
          }
        }
      } catch (error) {
        // Don't fail the webhook if credit deduction fails - log and continue
        console.error("Error deducting store credit:", error);
      }
    }

    // Send email notification to referrer (if enabled and email available)
    try {
      // Check if referrer has opted in to referral emails
      const emailOptIn = await getCustomerMetafield(
        admin,
        referrerId,
        "referral_email_opt_in",
      );
      
      // Default to true if not set (opt-in by default for referral program)
      const shouldSendEmail = emailOptIn !== "false";

      if (shouldSendEmail) {
        // Get referrer customer details
        const referrer = await getCustomerById(admin, referrerId);
        
        if (referrer && referrer.email) {
          // Get current total credits for the email
          const totalCreditsStr = await getCustomerMetafield(
            admin,
            referrerId,
            "referral_credits",
          );
          const totalCredits = parseFloat(totalCreditsStr || "0");

          // Send email notification
          await sendReferralUsedEmail({
            referrerName: referrer.displayName || referrer.email.split("@")[0],
            referrerEmail: referrer.email,
            creditAmount,
            orderNumber: order.name || undefined,
            shopName: shop,
          });

          console.log(`Referral notification email sent to ${referrer.email}`);
        } else {
          console.log(`Referrer ${referrerId} has no email address, skipping notification`);
        }
      } else {
        console.log(`Referrer ${referrerId} has opted out of referral emails`);
      }
    } catch (emailError) {
      // Don't fail the webhook if email fails - log and continue
      console.error("Error sending referral notification email:", emailError);
    }
  } catch (error) {
    console.error("Error processing order webhook:", error);
    // Don't throw - we don't want to retry the webhook
  }
}

/**
 * Handle orders/create webhook
 */
export async function action({ request }: ActionFunctionArgs) {
  const { payload, shop, admin } = await authenticate.webhook(request);

  console.log(`Received orders/create webhook for ${shop}`);

  // Respond immediately to Shopify (webhooks must respond quickly)
  const response = new Response(null, { status: 200 });

  // Process webhook asynchronously (don't await)
  if (admin) {
    // Get stored discount ID from database
    const { getStoredDiscountId } = await import("../lib/function-management");
    const discountId = await getStoredDiscountId(shop);

    if (!discountId) {
      console.warn(
        `[Webhook] No discount ID found for shop ${shop}. App may not be fully set up.`,
      );
    }

    // Process asynchronously
    processOrderWebhook(admin, payload, discountId, shop).catch((error) => {
      console.error("Error in async webhook processing:", error);
    });
  } else {
    console.log("No admin context available (CLI test?)");
  }

  return response;
}

