/**
 * Mandatory Compliance Webhook: shop/redact
 * 
 * Required for GDPR compliance. Fired when a shop requests deletion of their data.
 * We must delete all shop data we've stored.
 * 
 * Route: /webhooks/shop/redact
 */

import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Payload structure for shop/redact:
  // {
  //   shop_id: number,
  //   shop_domain: string
  // }

  try {
    // Delete all shop-related data from our database
    if (shop) {
      // Delete shop config
      await db.shopConfig.deleteMany({
        where: { shop },
      });

      // Delete all sessions for this shop
      await db.session.deleteMany({
        where: { shop },
      });

      console.log(`Shop data redaction completed for ${shop}`);
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

