# Store Credit Implementation - Fixes Applied

## Critical Fixes Based on Shopify Docs AI Feedback

### ✅ 1. Merged Functions into Single Export
**Issue:** Can't have two separate Rust functions for the same target `cart.lines.discounts.generate.run`

**Fix:**
- Removed `cart_lines_discounts_generate_run_store_credits` function
- Merged store credit logic into main `cart_lines_discounts_generate_run` function
- Function now branches based on whether discount has config metafield:
  - **Has config metafield** → Referral discount logic
  - **No config metafield** → Store credit discount logic

### ✅ 2. Fixed Customer Metafield Query
**Issue:** Customer metafield query was wrong - no top-level `customer` field

**Fix:**
- Changed from: `customer { metafield(...) }`
- Changed to: `cart { buyerIdentity { customer { metafield(...) } } }`
- Updated Rust code to use: `input.cart().buyer_identity().and_then(|identity| identity.customer())`

### ✅ 3. Fixed Namespace
**Issue:** Need to verify namespace matches what's actually used

**Fix:**
- Using `namespace: "$app:daisychain"` to match the namespace used when creating metafields
- This matches `METAFIELD_NAMESPACE = "$app:daisychain"` constant

### ✅ 4. Updated Webhook Credit Deduction
**Issue:** `order.total_discounts` is too coarse - includes all discounts

**Fix:**
- Now queries order's `discountApplications` via GraphQL
- Filters for `AppDiscountApplication` with `title === "Daisychain Store Credits"`
- Deducts only the store credit amount, not total discounts

### ✅ 5. Removed Duplicate Target
**Issue:** Had duplicate `cart.lines.discounts.generate.run` target in `shopify.extension.toml`

**Fix:**
- Removed the duplicate store credit target
- Now only one target for `cart.lines.discounts.generate.run`
- Both discounts use the same function, differentiated by metafield presence

## How It Works Now

### Function Execution Flow:
1. **Shopify runs the function twice** (once per discount instance):
   - Discount A: "Daisychain Referral Rewards" (has config metafield)
   - Discount B: "Daisychain Store Credits" (no config metafield)

2. **Function branches based on metafield:**
   - If `discount.metafield()` exists → Referral discount path
   - If `discount.metafield()` is None → Store credit discount path

3. **Both can apply simultaneously** if conditions are met:
   - Referral discount: applies if `referral_validated` attribute exists
   - Store credit: applies if customer has credits

### Store Credit Flow:
1. Customer has $10 in credits (stored in metafield)
2. Customer logs in, adds $20 item to cart
3. Store credit discount runs:
   - Checks `cart.buyerIdentity.customer.metafield("referral_credits")`
   - Finds $10 credit
   - Applies $10 discount (min of $10 credit and $20 subtotal)
4. Order completes
5. Webhook queries `order.discountApplications`
6. Finds "Daisychain Store Credits" application with $10 amount
7. Deducts $10 from customer's credits

## Files Changed

1. ✅ `extensions/daisychain-discount-function/src/cart_lines_discounts_generate_run.rs` - Merged logic
2. ✅ `extensions/daisychain-discount-function/src/cart_lines_discounts_generate_run.graphql` - Fixed customer query
3. ✅ `extensions/daisychain-discount-function/src/main.rs` - Removed store credit module
4. ✅ `extensions/daisychain-discount-function/shopify.extension.toml` - Removed duplicate target
5. ✅ `app/routes/webhooks.orders.create.tsx` - Updated credit deduction
6. ✅ `app/lib/discount-config.ts` - Added store credit discount creation
7. ✅ `app/lib/app-setup.ts` - Added store credit discount setup
8. ✅ `app/lib/function-management.ts` - Added store credit discount ID storage
9. ✅ `prisma/schema.prisma` - Added `storeCreditDiscountId` field

## Next Steps

1. **Run database migration:**
   ```bash
   npx prisma migrate dev
   ```

2. **Deploy function:**
   ```bash
   shopify app dev
   ```

3. **Test:**
   - Give customer credits
   - Test checkout with credits
   - Test with subscriptions
   - Verify credits are deducted correctly

## Remaining Questions

1. **Namespace verification:** Should verify that `$app:daisychain` is the actual namespace used, or if we should omit it and use app-reserved namespace

2. **Credit deduction accuracy:** The webhook now queries `discountApplications` by title, but ideally should use `discountId` for more reliability

3. **Both discounts applying:** Need to test that both referral and store credit can apply simultaneously without conflicts


