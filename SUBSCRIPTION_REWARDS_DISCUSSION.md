# Subscription Rewards Discussion

## Current State

**What we have now:**
- The discount applies to **all orders** (both one-time purchases and subscriptions)
- No distinction is made between subscription vs one-time purchases
- The discount function doesn't check if a cart contains subscription products
- The discount creation doesn't specify `appliesOnOneTimePurchase` or `appliesOnSubscription` fields

## The Question

Your co-founder is asking: **"How should referral rewards work with subscription products?"**

This is a strategic business decision that affects:
1. **Customer experience** - Do customers get discounts on their first subscription order? On recurring orders? Both?
2. **Business economics** - Subscription products often have different margins and lifetime value
3. **Referrer rewards** - Should referrers get credit for subscription referrals? How much?

## Shopify's Built-in Support

Shopify's `DiscountAutomaticApp` API has two fields that control this:

```graphql
appliesOnOneTimePurchase: Boolean  # Default: true
appliesOnSubscription: Boolean     # Default: false
```

**Current behavior (defaults):**
- ✅ Discount applies to one-time purchases
- ❌ Discount does NOT apply to subscriptions

## Options to Consider

### Option 1: Apply to First Subscription Order Only (Recommended)
**Strategy:** Give the discount on the initial subscription purchase, but not on recurring renewals.

**Pros:**
- Encourages new subscriptions via referrals
- Prevents ongoing revenue loss from recurring discounts
- Clear, simple customer experience
- Matches typical referral program patterns

**Cons:**
- Requires code changes to detect subscription products
- Need to track if this is the first subscription order

**Implementation:**
- Set `appliesOnSubscription: true` in discount creation
- Add logic to detect if cart contains subscription products
- Optionally: Only apply if it's the customer's first subscription order

### Option 2: Apply to All Subscription Orders (Ongoing Discount)
**Strategy:** Give the discount on every subscription renewal.

**Pros:**
- Maximum customer benefit
- Strong incentive for referrals

**Cons:**
- Significant ongoing revenue impact
- May not be sustainable for subscription businesses
- Could be expensive if subscription value is high

**Implementation:**
- Set `appliesOnSubscription: true` in discount creation
- No additional logic needed - discount applies automatically

### Option 3: No Discount on Subscriptions (Current Default)
**Strategy:** Only apply referral discounts to one-time purchases.

**Pros:**
- Protects subscription revenue
- No code changes needed
- Simple to explain

**Cons:**
- May reduce referral incentive for subscription-heavy businesses
- Customers might feel misled if they refer someone for a subscription

**Implementation:**
- No changes needed - this is the current default behavior

### Option 4: Different Discount Amounts
**Strategy:** Apply a smaller discount to subscriptions (e.g., 5% vs 10% for one-time).

**Pros:**
- Balances customer benefit with business economics
- More flexible approach

**Cons:**
- More complex to implement and explain
- Requires tracking subscription vs one-time in the discount function

**Implementation:**
- Set `appliesOnSubscription: true`
- Add logic in discount function to detect subscription products
- Apply different discount percentage based on product type

## Technical Implementation Requirements

### If we choose Option 1, 2, or 4:

**Changes needed:**

1. **Discount Creation** (`app/lib/discount-config.ts`):
   - Add `appliesOnSubscription: true` to the discount input
   - May need to add config option for subscription discount percentage

2. **Discount Function** (`extensions/daisychain-discount-function/src/cart_lines_discounts_generate_run.rs`):
   - Check if cart contains subscription products
   - For Option 1: Verify if this is customer's first subscription
   - For Option 4: Apply different discount percentage for subscriptions

3. **Settings UI** (`app/routes/app.settings._index.tsx`):
   - Add toggle/options for subscription discount behavior
   - Add separate discount percentage field for subscriptions (if Option 4)

### If we choose Option 3:
- **No code changes needed** - current behavior is already this

## Shopify's Recommendation

Based on Shopify's documentation and common practices:

1. **For most businesses:** Option 1 (first subscription order only) is recommended
   - Balances customer acquisition with revenue protection
   - Standard practice in referral programs

2. **For subscription-first businesses:** Option 2 might make sense
   - If subscriptions are your primary product
   - If you have high lifetime value and can afford ongoing discounts

3. **For mixed businesses:** Option 4 provides flexibility
   - Different margins on subscriptions vs one-time
   - Can optimize each separately

## Questions to Discuss

1. **What's your co-founder's primary concern?**
   - Revenue protection?
   - Customer experience?
   - Competitive parity?

2. **What's the business model?**
   - Subscription-heavy?
   - One-time purchases?
   - Mixed?

3. **What's the margin difference?**
   - Can you afford ongoing subscription discounts?
   - Is the first order discount enough incentive?

4. **What do competitors do?**
   - Research similar referral programs in your space

## Recommendation

**Start with Option 1** (first subscription order only):
- It's the most balanced approach
- Protects recurring revenue
- Still incentivizes referrals for subscriptions
- Can always expand to Option 2 or 4 later if needed

**Implementation complexity:** Medium
- Need to detect subscription products in cart
- May need to track first subscription order (via customer metafields or order history)

## Next Steps

1. **Decide on the strategy** (Option 1, 2, 3, or 4)
2. **If Option 1 or 4:** I'll need to check Shopify's API for detecting subscription products
3. **If Option 2:** Simple - just add `appliesOnSubscription: true`
4. **If Option 3:** No changes needed

Would you like me to:
- Create a prompt for Shopify Docs AI to understand subscription detection?
- Implement one of these options?
- Discuss the trade-offs further?

