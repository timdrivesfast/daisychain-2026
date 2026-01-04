# Testing the Daisychain Referral Discount Function

This document explains how to test the referral discount function locally and in your dev store.

## Quick Start

### 1. Local Testing with Mock Input

Use the provided `input.json` file to test the function locally:

```bash
cd extensions/daisychain-discount-function
shopify app function run \
  --input=input.json \
  --export=cart_lines_discounts_generate_run
```

This will:
- Compile your function
- Run it with the mock input data
- Display the output operations (discounts to apply)

### 2. Running Unit Tests

Run all test fixtures:

```bash
npm test
```

Or run the specific referral discount tests:

```bash
npm test -- referral-discount.test.js
```

## Test Fixtures

The following test fixtures are available in `tests/fixtures/`:

### `referral-valid.json`
- **Scenario**: Valid referral with cart above minimum order
- **Expected**: Discount should be applied (10% off)
- **Tests**: Happy path where everything works correctly

### `referral-not-validated.json`
- **Scenario**: Cart has no referral attributes
- **Expected**: No discount applied
- **Tests**: Function correctly skips discount when referral not validated

### `referral-below-minimum.json`
- **Scenario**: Valid referral but cart total below minimum order ($50)
- **Expected**: No discount applied
- **Tests**: Minimum order requirement enforcement

### `referral-no-metafield.json`
- **Scenario**: Valid referral but discount config metafield is missing
- **Expected**: No discount applied
- **Tests**: Graceful handling of missing configuration

### `referral-wrong-discount-class.json`
- **Scenario**: Valid referral but discount class is PRODUCT/SHIPPING, not ORDER
- **Expected**: No discount applied
- **Tests**: Discount class validation

## Testing in Dev Store

### Step 1: Start Development Server

```bash
shopify app dev
```

### Step 2: Create Automatic Discount

1. Open GraphiQL (press `g` in the terminal)
2. Create an automatic discount with your function:

```graphql
mutation {
  discountAutomaticAppCreate(
    automaticAppDiscount: {
      title: "Daisychain Referral Discount"
      functionId: "gid://shopify/DiscountFunction/YOUR_FUNCTION_ID"
      startsAt: "2025-01-01T00:00:00Z"
      status: ACTIVE
      metafields: [
        {
          namespace: "$app:daisychain"
          key: "config"
          type: "json"
          value: "{\"referee_discount_percentage\":10.0,\"referee_min_order\":0.0,\"referrer_credit_amount\":5.0,\"min_referrer_orders\":1}"
        }
      ]
    }
  ) {
    automaticAppDiscount {
      id
    }
    userErrors {
      field
      message
    }
  }
}
```

### Step 3: Test End-to-End

1. Open your dev store: `https://your-dev-store.myshopify.com`
2. Enter the password (required for dev stores)
3. Add products to cart
4. Use the referral widget to set cart attributes:
   - `referral_validated` = `"true"`
   - `referrer_customer_id` = `"gid://shopify/Customer/123456789"`
5. Proceed to checkout
6. Verify the discount appears in the order summary

### Step 4: View Function Logs

While `shopify app dev` is running, function executions are logged. You can:

- View logs in the terminal
- Replay a specific execution:

```bash
shopify app function replay --log <log_id>
```

## Input Query Review

The function's input query (`cart_lines_discounts_generate_run.graphql`) correctly reads:

- ✅ Cart attributes: `referral_validated` and `referrer_customer_id`
- ✅ Cart cost: `subtotalAmount` for minimum order check
- ✅ Discount metafield: Configuration from `$app:daisychain` namespace
- ✅ Discount classes: To ensure ORDER class is present

The query structure matches what the app proxy sets in cart attributes, so no changes are needed.

## Troubleshooting

### Function doesn't apply discount

1. Check that cart attributes are set correctly:
   - `referral_validated` must be exactly `"true"` (string)
   - `referrer_customer_id` must be a valid customer GID

2. Verify discount configuration:
   - Metafield must exist with namespace `$app:daisychain` and key `config`
   - Discount must have `ORDER` class

3. Check minimum order:
   - Cart subtotal must meet `referee_min_order` requirement

### Tests fail

1. Make sure the function is built:
   ```bash
   shopify app function build
   ```

2. Verify fixture JSON structure matches the input query schema

3. Check that expected outputs match the actual function output format

## Next Steps

- Add more test scenarios as needed
- Test edge cases (very large orders, multiple discounts, etc.)
- Verify discount calculations are correct for different percentages
- Test with different currency rates if supporting international stores

