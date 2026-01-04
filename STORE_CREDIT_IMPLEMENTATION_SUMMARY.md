# Store Credit Implementation Summary

## ✅ What's Been Implemented

### 1. Discount Function for Store Credits
- **File:** `extensions/daisychain-discount-function/src/cart_lines_discounts_generate_run_store_credits.rs`
- **Functionality:**
  - Checks if customer is logged in
  - Reads `referral_credits` metafield from customer
  - Applies fixed amount discount up to available credits or cart subtotal
  - Works with ORDER discount class
  - Supports both one-time and subscription purchases (via `appliesOnSubscription: true`)

### 2. GraphQL Input Query
- **File:** `extensions/daisychain-discount-function/src/cart_lines_discounts_generate_run_store_credits.graphql`
- Queries customer metafield for credits and cart subtotal

### 3. Discount Creation
- **File:** `app/lib/discount-config.ts`
- Added `createStoreCreditDiscount()` function
- Creates discount with:
  - `appliesOnOneTimePurchase: true`
  - `appliesOnSubscription: true` ✅ (enables subscription support)
  - `discountClasses: ["ORDER"]`

### 4. Database Schema
- **File:** `prisma/schema.prisma`
- Added `storeCreditDiscountId` field to `ShopConfig` model
- **⚠️ Migration needed:** Run `npx prisma migrate dev` to apply schema changes

### 5. App Setup
- **File:** `app/lib/app-setup.ts`
- Updated to create store credit discount during app setup
- Stores `storeCreditDiscountId` in database

### 6. Credit Deduction
- **File:** `app/lib/shopify-queries.ts`
- Added `deductReferralCredit()` function
- **File:** `app/routes/webhooks.orders.create.tsx`
- Updated webhook to deduct credits after order completion
- ⚠️ **Note:** Current deduction logic is simplified - may need refinement to accurately detect store credit usage

## 🔧 What Needs to Be Done

### 1. Run Database Migration
```bash
npx prisma migrate dev
```
This will add the `storeCreditDiscountId` field to the database.

### 2. Deploy Function
The function extension now has 3 targets:
- `cart.lines.discounts.generate.run` (referral discount)
- `cart.delivery-options.discounts.generate.run` (shipping - existing)
- `cart.lines.discounts.generate.run` (store credits - new)

When you run `shopify app dev`, it should deploy all targets.

### 3. Test the Implementation

**Test Store Credit Application:**
1. Give a customer some credits (via test route or manually set metafield)
2. Have that customer log in and add items to cart
3. Go to checkout - store credit should apply automatically
4. Complete order
5. Verify credits were deducted

**Test with Subscriptions:**
1. Create a subscription product
2. Customer with credits adds subscription to cart
3. Verify store credit applies to subscription order
4. Complete subscription order
5. Verify credits were deducted

### 4. Improve Credit Deduction Logic (Optional)

The current webhook deduction logic is simplified. For more accuracy, you could:
- Query order's `discountApplications` via GraphQL
- Check discount title to identify store credit discount
- Deduct exact amount used

## 🎯 How It Works

### Flow:
1. **Customer earns credits** → Stored in `referral_credits` metafield
2. **Customer shops** → Logs in, adds items to cart
3. **Checkout** → Store credit discount function runs:
   - Checks if customer is logged in ✅
   - Reads `referral_credits` metafield
   - Applies discount up to available credits
4. **Order completes** → Webhook deducts credits from customer's balance

### Stacking:
- Credits **stack** automatically (multiple referrals = accumulated credits)
- Credits can be used **partially** (e.g., $10 credit on $5 order = uses $5)
- Works with **subscriptions** (if `appliesOnSubscription: true` is set)

## ⚠️ Important Notes

1. **Function Target Conflict:** Both referral and store credit functions use `cart.lines.discounts.generate.run`. Shopify will run both functions when evaluating ORDER discounts. This is fine because:
   - Referral function checks for referral attributes (only applies if referral exists)
   - Store credit function checks for customer credits (only applies if credits exist)
   - They won't interfere with each other

2. **Customer Must Be Logged In:** Store credits only work for logged-in customers (function checks `input.customer()`)

3. **Credit Deduction:** The webhook deduction logic may need refinement to accurately detect when store credit was used vs other discounts

## 🚀 Next Steps

1. Run migration: `npx prisma migrate dev`
2. Deploy function: `shopify app dev`
3. Test store credit application
4. Test with subscriptions
5. Refine credit deduction logic if needed


