# Store Credit Implementation - Current State & Options

## Current State ⚠️

**What works:**
- ✅ Credits are **stored** in customer metafields (`referral_credits`)
- ✅ Credits **accumulate** when referrals are made (they stack)
- ✅ Credits are tracked per customer

**What doesn't work:**
- ❌ Credits are **NOT automatically applied** at checkout
- ❌ Customers **cannot use their credits** currently
- ❌ The email says "automatically applied" but that's not implemented yet

## How Credits Are Currently Stored

Credits are stored as a **customer metafield**:
- **Namespace:** `$app:daisychain`
- **Key:** `referral_credits`
- **Type:** `number_decimal`
- **Value:** Total accumulated credit amount (e.g., "15.00" for $15)

When a referral order is completed:
1. Webhook fires (`/webhooks/orders/create`)
2. `addReferralCredit()` increments the customer's metafield
3. Credits accumulate (they stack: $5 + $5 = $10 total)

## The Problem

**Credits are stored but never used.** There's no code that:
- Applies credits at checkout
- Creates discount codes for customers
- Shows credits in a customer portal

## Options for Implementation

### Option A: Automatic Discount Function (Recommended for Subscriptions)

**How it works:**
- Create a second discount function that checks customer metafields
- When customer checks out, function reads their `referral_credits` metafield
- Automatically applies credit as a discount (up to their available balance)
- Deducts from their credit balance after order

**Pros:**
- ✅ Works automatically - no customer action needed
- ✅ Works with subscriptions (if `appliesOnSubscription: true`)
- ✅ Credits can be stacked/combined
- ✅ Seamless customer experience
- ✅ Can apply partial credits (e.g., use $3 of $10 credit)

**Cons:**
- ⚠️ Requires a second discount function
- ⚠️ Need to access customer data in discount function (requires customer to be logged in)
- ⚠️ Need to deduct credits after order (webhook or function)

**Implementation:**
1. Create new discount function target: `cart.lines.discounts.generate.run`
2. Function checks `input.customer()` for metafield `referral_credits`
3. Applies discount up to available credit
4. Webhook deducts credit after order completes

**Subscription support:**
- Set `appliesOnSubscription: true` in discount creation
- Credits will apply to subscription orders automatically
- Can stack with other discounts if configured

### Option B: Discount Code Generation

**How it works:**
- When customer earns credit, automatically create a discount code
- Email customer with their unique code
- Customer enters code at checkout
- Code is single-use or has usage limits

**Pros:**
- ✅ Simple to implement
- ✅ Works with subscriptions (if code discount allows it)
- ✅ Customer has control over when to use it
- ✅ Can set expiration dates

**Cons:**
- ❌ Customer must remember/enter code
- ❌ Less seamless experience
- ❌ Need to manage code lifecycle (expiration, usage)
- ❌ Harder to stack credits (would need multiple codes)

**Implementation:**
1. When credit is awarded, create discount code via `discountCodeBasicCreate`
2. Store code in customer metafield
3. Email customer with code
4. Customer enters at checkout

**Subscription support:**
- Discount codes can apply to subscriptions if `appliesOnSubscription: true`
- Each code can be used once or multiple times
- Can stack if multiple codes are created

### Option C: Customer Account Portal

**How it works:**
- Build a customer-facing page showing their credit balance
- Customer can "redeem" credits to generate discount codes
- Customer uses codes at checkout

**Pros:**
- ✅ Customer has visibility into their credits
- ✅ Customer controls when to use credits
- ✅ Can show credit history

**Cons:**
- ❌ Requires building customer portal
- ❌ More complex implementation
- ❌ Still requires discount codes (Option B)

**Implementation:**
1. Create customer account extension or app proxy route
2. Display credit balance from metafield
3. Generate discount codes on-demand
4. Customer uses codes at checkout

## Recommendation for Your Use Case

**For subscriptions + stacking credits:**

**Option A (Automatic Discount Function)** is best because:
1. ✅ **Works seamlessly with subscriptions** - just set `appliesOnSubscription: true`
2. ✅ **Credits stack automatically** - if they have $15 credit, it all applies
3. ✅ **No customer friction** - happens automatically at checkout
4. ✅ **Can use partial credits** - if order is $10 and they have $15 credit, uses $10

**Implementation steps:**
1. Create a second discount function that:
   - Checks `input.customer().metafield("referral_credits")`
   - Applies discount up to available credit
   - Works for both one-time and subscription orders

2. Update discount creation to:
   - Set `appliesOnSubscription: true` (for subscription support)
   - Link to the credit discount function

3. Update webhook to:
   - Deduct used credit from customer's balance after order

## Technical Details

### Accessing Customer Data in Discount Functions

Discount functions can access customer data if:
- Customer is logged in at checkout
- Function queries `input.customer()` for metafields

**Example query:**
```graphql
query Input {
  customer {
    metafield(namespace: "$app:daisychain", key: "referral_credits") {
      value
    }
  }
  cart {
    cost {
      subtotalAmount {
        amount
      }
    }
  }
}
```

### Deducting Credits After Order

After order completes:
1. Webhook fires (`orders/create`)
2. Check order discounts to see how much credit was used
3. Deduct that amount from customer's `referral_credits` metafield
4. Update metafield with new balance

## Questions to Answer

1. **Should credits apply to subscriptions?**
   - Yes → Use Option A with `appliesOnSubscription: true`
   - No → Use Option A with `appliesOnSubscription: false`

2. **Should credits be automatically applied or customer-controlled?**
   - Automatic → Option A
   - Customer-controlled → Option B or C

3. **Can customers use partial credits?**
   - Yes → Option A (automatic)
   - No → Option B (codes for specific amounts)

4. **Should credits expire?**
   - Yes → Need expiration logic (easier with codes)
   - No → Credits never expire (easier with automatic)

## Next Steps

1. **Decide on approach** (I recommend Option A for subscriptions)
2. **If Option A:** I'll create the credit discount function
3. **Update webhook** to deduct credits after use
4. **Test with subscriptions** to ensure it works

Would you like me to:
- Implement Option A (automatic discount function)?
- Create a prompt for Shopify Docs AI about customer metafields in discount functions?
- Discuss the trade-offs further?

