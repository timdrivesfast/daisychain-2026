/**
 * Mandatory Compliance Webhook: customers/redact
 * 
 * Required for GDPR compliance. Fired when a customer requests deletion of their data.
 * We must delete all customer data we've stored.
 * 
 * Route: /webhooks/customers/redact
 */

import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Payload structure for customers/redact:
  // {
  //   shop_id: number,
  //   shop_domain: string,
  //   customer: { id: number, email: string, phone: string },
  //   orders_requested: [number]
  // }

  try {
    const customerId = `gid://shopify/Customer/${payload.customer?.id}`;
    
    if (customerId) {
      // Delete customer-related data from our database
      // Note: We store referral data in Shopify metafields, not our DB
      // But we should clean up any local references if we have them
      
      // If we stored any customer data locally, delete it here
      // For now, we primarily use Shopify metafields, so this is mostly a no-op
      // but we must respond with 200 to acknowledge receipt
      
      console.log(`Customer data redaction requested for customer ${customerId} in shop ${shop}`);
    }

    // Always return 200 to acknowledge receipt
    // Shopify requires this webhook to respond successfully
    return new Response(null, { status: 200 });
  } catch (error) {
    console.error(`Error processing ${topic} webhook:`, error);
    // Still return 200 - we don't want Shopify to retry
    return new Response(null, { status: 200 });
  }
};

