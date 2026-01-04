/**
 * Mandatory Compliance Webhook: customers/data_request
 * 
 * Required for GDPR compliance. Fired when a customer requests their data.
 * We must provide all customer data we've stored.
 * 
 * Route: /webhooks/customers/data_request
 */

import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Payload structure for customers/data_request:
  // {
  //   shop_id: number,
  //   shop_domain: string,
  //   customer: { id: number, email: string, phone: string },
  //   orders_requested: [number]
  // }

  try {
    const customerId = `gid://shopify/Customer/${payload.customer?.id}`;
    
    if (customerId) {
      // For GDPR compliance, we should provide all customer data we've stored
      // Since we primarily use Shopify metafields, the data is already accessible to the customer
      // But we should log this request for compliance purposes
      
      console.log(`Customer data request received for customer ${customerId} in shop ${shop}`);
      console.log(`Orders requested: ${payload.orders_requested?.join(", ") || "none"}`);
      
      // If we stored any customer data locally, we would export it here
      // For now, we primarily use Shopify metafields, so this is mostly a no-op
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

