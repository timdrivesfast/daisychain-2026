# Shopify Docs AI Prompt - Store Credit Implementation Verification

## Context

I'm building a Shopify app with a referral program. I just implemented automatic store credit application at checkout. Customers earn referral credits (stored in customer metafields), and I want these credits to automatically apply as discounts at checkout - working for both one-time purchases and subscriptions.

## What I Implemented

### 1. Discount Function for Store Credits

I added a new function target to my existing discount function extension:

**Extension Structure:**
- Extension handle: `daisychain-discount-function`
- Has 3 targets:
  1. `cart.lines.discounts.generate.run` (for referral discounts)
  2. `cart.delivery-options.discounts.generate.run` (for shipping)
  3. `cart.lines.discounts.generate.run` (for store credits - NEW)

**GraphQL Input Query:**
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
  discount {
    discountClasses
  }
}
```

**Rust Function Logic:**
- Checks if `input.customer()` exists (customer logged in)
- Reads `customer.metafield().value()` for credits (stored as decimal string like "15.00")
- Applies fixed amount discount up to `min(available_credits, cart_subtotal)`
- Returns `OrderDiscountsAdd` operation with `FixedAmount` value

### 2. Discount Creation

I create a separate automatic discount for store credits:

```graphql
mutation CreateStoreCreditDiscount($input: DiscountAutomaticAppInput!) {
  discountAutomaticAppCreate(automaticAppDiscount: $input) {
    automaticAppDiscount {
      discountId
    }
  }
}
```

**Input:**
```json
{
  "title": "Daisychain Store Credits",
  "startsAt": "2025-01-01T00:00:00Z",
  "discountClasses": ["ORDER"],
  "appliesOnOneTimePurchase": true,
  "appliesOnSubscription": true,
  "functionHandle": "daisychain-discount-function"
}
```

### 3. Credit Deduction After Order

In the `orders/create` webhook, I deduct credits after order completion by checking `order.total_discounts` and deducting that amount from the customer's `referral_credits` metafield.

## Questions & Concerns

### 1. Function Target Conflict ⚠️

**Issue:** Both my referral discount and store credit discount use the same target: `cart.lines.discounts.generate.run`, and both link to the same function handle `daisychain-discount-function`.

**Questions:**
- When Shopify evaluates ORDER discounts, will it run both functions (referral and store credit)?
- How does Shopify know which function to call when both use the same target and function handle?
- Should I create a separate function extension for store credits instead?
- Can both discounts apply simultaneously if both conditions are met (customer has credits AND used a referral)?

**What I'm doing now:**
- Both functions check different conditions:
  - Referral function: checks for `cart.attribute("referral_validated")`
  - Store credit function: checks for `customer.metafield("referral_credits")`
- I'm hoping Shopify runs both and they each decide whether to apply based on their conditions

**Is this correct?** Or do I need separate function extensions/handles?

### 2. Customer Metafield Access in Discount Functions

**Question:** Is my GraphQL query correct for accessing customer metafields in a discount function?

```graphql
customer {
  metafield(namespace: "$app:daisychain", key: "referral_credits") {
    value
  }
}
```

**Concerns:**
- Will `input.customer()` be `None` for guest checkouts? (I handle this - return empty operations)
- Is the metafield namespace correct? I'm using `$app:daisychain` (app-reserved namespace)
- Do I need to specify the namespace explicitly, or can I omit it?

### 3. Subscription Support

**Question:** I set `appliesOnSubscription: true` in the discount creation. Is this correct?

**Concerns:**
- Will the discount function run for subscription orders?
- Does `input.customer()` work the same way for subscription checkouts?
- Are there any special considerations for subscription products vs one-time purchases?

### 4. Credit Deduction Logic

**Current Implementation:**
In the webhook, I check `order.total_discounts` and deduct that amount. But this is problematic because:
- `total_discounts` includes ALL discounts (referral discount + store credit + any other discounts)
- I can't tell which discount was the store credit

**Questions:**
- How can I accurately detect when store credit was used vs other discounts?
- Should I query the order's `discountApplications` via GraphQL to see which discounts were applied?
- Is there a way to identify the store credit discount by title or metafield?
- What's the best practice for tracking which discount was applied?

**Alternative approach I'm considering:**
- Query order via GraphQL: `order.discountApplications` to see all applied discounts
- Filter by discount title containing "Store credit" or check discount metafields
- Deduct only the store credit amount

**Is this the right approach?**

### 5. Discount Function Return Type

**Question:** I'm returning `OrderDiscountsAdd` with `FixedAmount`. Is this correct for store credits?

**Concerns:**
- Should I use `FixedAmount` or `Percentage`? (I'm using FixedAmount since credits are dollar amounts)
- The `FixedAmount` struct requires `amount: Decimal` - is my conversion correct?
- Can I apply a discount that's larger than the cart subtotal? (I'm using `min(credits, subtotal)`)

### 6. Multiple Discounts Stacking

**Scenario:** Customer has $10 in credits AND used a referral (gets 10% off).

**Questions:**
- Can both discounts apply simultaneously?
- Will Shopify run both functions and apply both discounts?
- Is there a limit to how many ORDER discounts can apply?
- Should I prevent both from applying, or is stacking allowed/desired?

### 7. Function Handle vs Function ID

**Question:** I'm using `functionHandle: "daisychain-discount-function"` for both discounts. Is this correct?

**Concerns:**
- Since both discounts link to the same function handle, will Shopify know which target/function to use?
- Should I use `functionId` instead for one of them?
- Or should I create separate function extensions with different handles?

## What I Need Verified

1. ✅ **Is my function target setup correct?** (Same handle, same target, different conditions)
2. ✅ **Is my customer metafield query correct?** (GraphQL structure, namespace)
3. ✅ **Will `appliesOnSubscription: true` work as expected?**
4. ✅ **What's the best way to detect store credit usage in webhook?**
5. ✅ **Can both discounts apply simultaneously?**
6. ✅ **Is `FixedAmount` the correct discount type for store credits?**

## Code Snippets for Reference

**Store Credit Function (Rust):**
```rust
#[shopify_function]
fn cart_lines_discounts_generate_run_store_credits(
    input: schema::cart_lines_discounts_generate_run_store_credits::Input,
) -> Result<schema::CartLinesDiscountsGenerateRunResult> {
    let customer = match input.customer() {
        Some(c) => c,
        None => return Ok(schema::CartLinesDiscountsGenerateRunResult { operations: vec![] }),
    };

    let credits_str = match customer.metafield() {
        Some(m) => m.value().unwrap_or("0"),
        None => "0",
    };

    let available_credits = credits_str.parse::<f64>().unwrap_or(0.0);
    if available_credits <= 0.0 {
        return Ok(schema::CartLinesDiscountsGenerateRunResult { operations: vec![] });
    }

    let cart_subtotal = input.cart().cost().subtotal_amount().amount().as_f64();
    let discount_amount = available_credits.min(cart_subtotal);

    let operations = vec![schema::CartOperation::OrderDiscountsAdd(
        schema::OrderDiscountsAddOperation {
            selection_strategy: schema::OrderDiscountSelectionStrategy::First,
            candidates: vec![schema::OrderDiscountCandidate {
                targets: vec![schema::OrderDiscountCandidateTarget::OrderSubtotal(
                    schema::OrderSubtotalTarget {
                        excluded_cart_line_ids: vec![],
                    },
                )],
                message: Some(format!("Store credit: ${:.2}", discount_amount)),
                value: schema::OrderDiscountCandidateValue::FixedAmount(
                    schema::FixedAmount {
                        amount: Decimal::from(discount_amount),
                    },
                ),
                conditions: None,
                associated_discount_code: None,
            }],
        },
    )];

    Ok(schema::CartLinesDiscountsGenerateRunResult { operations })
}
```

**Discount Creation:**
```typescript
const input = {
  title: "Daisychain Store Credits",
  startsAt: new Date().toISOString(),
  discountClasses: ["ORDER"],
  appliesOnOneTimePurchase: true,
  appliesOnSubscription: true,
  functionHandle: "daisychain-discount-function"
};
```

## Expected Behavior

1. Customer earns $5 credit → stored in `referral_credits` metafield
2. Customer logs in, adds $20 item to cart
3. At checkout, store credit function runs:
   - Checks customer metafield → finds $5 credit
   - Applies $5 discount
4. Order completes → webhook deducts $5 from customer's credits
5. Customer now has $0 credits

**For subscriptions:**
- Same flow, but discount applies to subscription order
- Credits are deducted after subscription order completes

## Potential Issues I'm Aware Of

1. **Function target conflict** - Both discounts use same target/handle
2. **Credit deduction accuracy** - Can't reliably detect store credit vs other discounts
3. **Multiple discounts** - Not sure if both can apply simultaneously
4. **Guest checkout** - Store credits won't work (expected, but want to confirm)

Please verify my implementation and provide guidance on the questions above. Thank you!

