# Prompt for Shopify Docs AI - Discount Function Not Applying

I'm building a Shopify app with a Discount Function that automatically applies referral discounts at checkout. The function works correctly in local testing, but the discount is not appearing at checkout on my dev store. Here's my setup and the issue:

## My Setup

1. **Discount Function**: Rust-based function that reads cart attributes and applies an order-level discount
2. **Function Target**: `cart.lines.discounts.generate.run`
3. **Cart Attributes**: Setting attributes on the Online Store cart using AJAX Cart API (`/cart/update.js`)
4. **Discount Creation**: Using `discountAutomaticAppCreate` with `functionId` to link the discount to the function

## What Works

1. ✅ Function logic is correct - local test with `shopify app function run` returns correct discount operations
2. ✅ Referrer lookup works - widget successfully validates referrers
3. ✅ Cart attributes are being set - browser console shows "Cart attributes updated successfully"
4. ✅ Function compiles and deploys without errors

## The Problem

When I:
1. Add a product to cart
2. Use the referral widget to enter a referrer name (shows success)
3. Go to checkout

**The discount does not appear at checkout.**

## My Function Input Query

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

## How I'm Setting Cart Attributes

Using AJAX Cart API in the storefront widget:
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

## Questions

1. **Cart Attributes**: When I set attributes via `/cart/update.js` on the Online Store cart, are those attributes available to the Discount Function at checkout? Or do I need to set them differently?

2. **Function Execution**: How can I verify that my Discount Function is actually being called at checkout? I'm running `shopify app dev` but not seeing function execution logs when I go to checkout.

3. **Discount Status**: How do I verify that my automatic discount created with `discountAutomaticAppCreate` is:
   - Active and enabled
   - Properly linked to the function
   - Has the correct metafield configuration
   - Is eligible for the checkout channel I'm using

4. **Debugging**: What's the best way to debug why a Discount Function isn't applying? Are there logs I should check, or a way to see what input the function receives at checkout?

5. **Common Issues**: What are the most common reasons a Discount Function would work in local testing but not apply at checkout?

## Additional Context

- Using a development store
- Online Store channel is enabled
- Function is deployed via `shopify app dev`
- Discount was created via Admin GraphQL API
- Cart attributes are set on the Online Store cart (not Storefront API cart)

Please help me understand what I'm missing and how to debug this issue.

