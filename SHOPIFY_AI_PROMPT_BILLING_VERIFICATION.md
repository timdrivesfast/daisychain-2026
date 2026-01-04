# Shopify Docs AI Prompt: Billing Implementation Verification

I've implemented billing for my Shopify app using the React Router template and want to verify the implementation is correct. Please review the following:

## Current Implementation

### 1. Billing Configuration (`app/shopify.server.ts`)

```typescript
billing: {
  DAISYCHAIN_PLAN: {
    lineItems: [
      {
        amount: process.env.BILLING_AMOUNT ? parseFloat(process.env.BILLING_AMOUNT) : 0,
        currencyCode: "USD",
        interval: BillingInterval.Every30Days,
      },
    ],
    trialDays: process.env.BILLING_AMOUNT ? 14 : 0,
  },
},
```

**Questions:**
- Is the `lineItems` array structure correct for a simple recurring subscription?
- Should I export `billing` from `shopify.server.ts`, or is it only accessible via `authenticate.admin(request).billing`?

### 2. Route Gating (`app/routes/app.tsx`)

```typescript
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing } = await authenticate.admin(request);

  const url = new URL(request.url);
  if (!url.pathname.includes("/pricing")) {
    await billing.require({
      plans: ["DAISYCHAIN_PLAN"],
      isTest: process.env.NODE_ENV !== "production",
      onFailure: async () => {
        return redirect("/app/pricing");
      },
    });
  }

  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};
```

**Questions:**
- Is accessing `billing` from `authenticate.admin(request)` the correct pattern?
- Is the `onFailure` callback approach correct, or should I check a return value?
- Should I handle the redirect inside `onFailure`, or does `billing.require()` handle redirects automatically?

### 3. Pricing Page (`app/routes/app.pricing.tsx`)

**Loader:**
```typescript
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing } = await authenticate.admin(request);

  const billingCheck = await billing.check({
    isTest: process.env.NODE_ENV !== "production",
  });

  if (billingCheck.hasActivePayment) {
    return redirect("/app");
  }

  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const billingAmount = process.env.BILLING_AMOUNT ? parseFloat(process.env.BILLING_AMOUNT) : 0;

  return { error, billingAmount };
};
```

**Action:**
```typescript
export const action = async ({ request }: ActionFunctionArgs) => {
  const { billing } = await authenticate.admin(request);

  await billing.request({
    plan: "DAISYCHAIN_PLAN",
    isTest: process.env.NODE_ENV !== "production",
  });

  // This should never be reached (billing.request redirects)
  return {
    error: "Failed to create billing subscription. Please try again.",
  };
};
```

**Questions:**
- Is `billing.check()` the right method to check subscription status without requiring it?
- Does `billing.request()` always redirect, or can it return normally in some cases?
- Should I provide a `returnUrl` parameter to `billing.request()`, or is it handled automatically?

### 4. Billing Confirmation (`app/routes/billing.confirm.tsx`)

```typescript
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing } = await authenticate.admin(request);

  const billingCheck = await billing.check({
    isTest: process.env.NODE_ENV !== "production",
  });

  if (billingCheck.hasActivePayment) {
    return redirect("/app");
  }

  return redirect("/app/pricing?error=subscription_not_activated");
};
```

**Questions:**
- Is this the correct pattern for handling the return from Shopify's billing confirmation page?
- Should I use `billing.check()` or `billing.require()` here?

## Specific Concerns

1. **Free Plan for App Store Submission**: I'm setting `amount: 0` when `BILLING_AMOUNT` is not set. Is this the correct way to offer a free plan for App Store submission?

2. **Trial Days**: I'm setting `trialDays: 0` for the free plan and `trialDays: 14` for paid plans. Is this correct?

3. **Error Handling**: How should I handle cases where:
   - `billing.request()` fails to create a subscription?
   - The merchant declines the subscription on Shopify's confirmation page?
   - The subscription becomes inactive/expired?

4. **Webhooks**: Should I set up webhooks for `APP_SUBSCRIPTIONS_UPDATE` to track subscription status changes? If so, what's the recommended pattern?

5. **Test Mode**: I'm using `isTest: process.env.NODE_ENV !== "production"`. Is this the correct way to enable test mode for development stores?

## Expected Behavior

- Merchant installs app → visits `/app` → redirected to `/app/pricing` if no subscription
- Merchant clicks "Subscribe" → redirected to Shopify's billing confirmation page
- Merchant approves → redirected back to `/billing/confirm` → then to `/app`
- Merchant visits `/app` with active subscription → no redirect, app loads normally
- Merchant with expired subscription → redirected to `/app/pricing` again

Is this flow correct?

## References

- React Router billing helpers: https://shopify.dev/docs/apps/tools/react-router/billing
- Billing API: https://shopify.dev/docs/api/admin-graphql/latest/mutations/appSubscriptionCreate
- About billing: https://shopify.dev/docs/apps/billing

Please verify:
1. The billing configuration structure
2. The API access pattern (`billing` from `authenticate.admin()`)
3. The route gating approach
4. The pricing page implementation
5. The confirmation page handling
6. Any missing error handling or edge cases
