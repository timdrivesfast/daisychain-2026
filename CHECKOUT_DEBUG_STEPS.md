# Debugging Steps for Checkout Discount Issue

## What to Check When Going to Checkout

### 1. Watch Your Terminal (shopify app dev)

When you go to checkout, you should see function execution logs in your terminal. Look for:

```
daisychain-discount-function │ Function executed
daisychain-discount-function │ logs: .shopify/logs/functions/daisychain-discount-function/XXXXXX.json
```

**If you see NOTHING in the terminal:**
- The function isn't being called
- The discount might not be active or linked properly
- Check Shopify Admin → Discounts to verify the discount exists

### 2. Check Function Log Files

If you see a log file path in the terminal:
1. Open that JSON file (e.g., `.shopify/logs/functions/daisychain-discount-function/XXXXXX.json`)
2. Look at the `input` section:
   - Does `cart.referralValidated.value` equal `"true"`?
   - Does `cart.referrerCustomerId.value` exist?
   - Does `discount.discountClasses` include `"ORDER"`?
3. Look at the `output` section:
   - Does it have `operations` array with `orderDiscountsAdd`?
   - Or is `operations` empty `[]`?

### 3. Verify Discount in Shopify Admin

1. Go to Shopify Admin → Discounts
2. Find "Daisychain Referral Rewards"
3. Check:
   - Status: Should be "Active"
   - Type: Should be "Automatic app discount"
   - Applies to: Should include your test products
   - No minimum requirements (for testing)

### 4. Check Browser Console

When you:
1. Add product to cart
2. Use widget to identify referrer
3. Go to checkout

Look in browser console (F12) for:
- `Daisychain: ✅ Cart attributes verified` (should appear after identifying referrer)
- Any errors related to cart or checkout

### 5. Verify Cart Attributes Before Checkout

After identifying referrer, before going to checkout, run this in browser console:

```javascript
fetch('/cart.js').then(r => r.json()).then(cart => {
  console.log('Cart attributes:', cart.attributes);
  console.log('Has referral_validated:', cart.attributes?.referral_validated);
});
```

Should show:
```javascript
{
  referral_validated: "true",
  referrer_customer_id: "gid://shopify/Customer/...",
  referrer_name: "..."
}
```

## Common Issues

### No Function Logs in Terminal
- Discount doesn't exist → Go to Settings page to create it
- Discount not active → Check Admin → Discounts
- Wrong function linked → Recreate discount

### Function Runs But Returns Empty Operations
- Cart attributes missing in input → Check log file input section
- Discount classes mismatch → Should be `["ORDER"]`
- Metafield missing → Check discount has metafield configured

### Cart Attributes Not Present
- Timing issue → Already fixed with verification step
- Wrong cart → Make sure you're using Online Store cart, not Storefront API cart

