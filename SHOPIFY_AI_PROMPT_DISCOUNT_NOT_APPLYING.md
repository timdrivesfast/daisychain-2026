# Prompt for Shopify Docs AI - Discount Not Applying After Referrer Identification

I've implemented a referral discount system using Shopify Discount Functions, but the discount is not applying at checkout even after successfully identifying a referrer. Here's my current setup and what I've verified:

## Current Status

1. ✅ **Function works locally**: `shopify app function run` returns correct discount operations
2. ✅ **Cart attributes are set**: Browser console shows "Cart attributes updated successfully" with `referral_validated: "true"` and `referrer_customer_id`
3. ✅ **Discount created with correct config**: Added `discountClasses: ["ORDER"]` to discount creation
4. ✅ **Function deployed**: Running `shopify app dev` and function is deployed
5. ❌ **Discount not appearing at checkout**: After identifying referrer and going to checkout, no discount is shown

## My Setup

**Discount Function**: Rust-based function targeting `cart.lines.discounts.generate.run`

**Function Input Query**:
```graphql
query Input {
  cart {
    cost {
      subtotalAmount {
        amount
      }
    }
    referralValidated: attribute(key: "referral_validated") {
      value
    }
    referrerCustomerId: attribute(key: "referrer_customer_id") {
      value
    }
  }
  discount {
    discountClasses
    metafield(namespace: "$app:daisychain", key: "config") {
      jsonValue
    }
  }
}
```

**How I Set Cart Attributes**:
Using AJAX Cart API (`/cart/update.js`) from the Online Store widget:
```javascript
await fetch('/cart/update.js', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    attributes: {
      referral_validated: 'true',
      referrer_customer_id: '<customer_id>',
      referrer_name: '<name>'
    }
  })
});
```

**Discount Creation Code**:
```typescript
discountAutomaticAppCreate(automaticAppDiscount: {
  title: "Daisychain Referral Rewards",
  functionId: "<function_id>",
  startsAt: "<current_date>",
  discountClasses: ["ORDER"],  // ✅ Added this
  metafields: [{
    namespace: "$app:daisychain",
    key: "config",
    type: "json",
    value: JSON.stringify(config)
  }]
})
```

## What I've Verified

1. **Cart attributes are set**: After clicking "Submit" in the widget, browser console shows:
   ```
   Daisychain: Cart attributes updated successfully
   Daisychain: Cart attributes after update: {
     referral_validated: "true",
     referrer_customer_id: "gid://shopify/Customer/...",
     referrer_name: "..."
   }
   ```

2. **Function works with test input**: Local test with `shopify app function run` returns:
   ```json
   {
     "operations": [{
       "orderDiscountsAdd": {
         "candidates": [{
           "message": "Referral discount: 10% off",
           "value": { "percentage": { "value": "10.0" } }
         }]
       }
     }]
   }
   ```

3. **Discount exists in Admin**: I can see "Daisychain Referral Rewards" in Shopify Admin → Discounts

## The Problem

When I:
1. Add product to cart
2. Use widget to identify referrer (shows success message)
3. Go to checkout

**The discount does not appear at checkout.**

## Questions

1. **Function Execution**: How can I verify the function is actually being called at checkout? I'm running `shopify app dev` but not seeing function execution logs when I go to checkout. Should I see logs in the terminal, or are they stored somewhere else?

2. **Discount Status**: How do I verify the discount is:
   - Active (not scheduled/expired)
   - Properly linked to the function
   - Has the correct `discountClasses: ["ORDER"]`
   - Is eligible for the checkout channel

3. **Cart Attributes Timing**: I'm setting attributes via `/cart/update.js` and then navigating to checkout. Is there a timing issue? Should I verify attributes are present on `/cart.js` before going to checkout?

4. **Function Input at Checkout**: How can I see what input the function actually receives at checkout? The local test works, but I need to see what Shopify passes to the function during real checkout.

5. **Common Issues**: What are the most common reasons a discount function would:
   - Work in local testing
   - Have cart attributes set correctly
   - Have discount created with correct `discountClasses`
   - But still not apply at checkout?

## What I Need

I need a step-by-step debugging checklist to:
1. Verify the discount is correctly configured and active
2. Confirm the function is being called at checkout
3. See the actual input the function receives (to verify cart attributes are present)
4. Identify why the discount operations aren't being applied

Please help me understand what I'm missing and provide concrete debugging steps.

