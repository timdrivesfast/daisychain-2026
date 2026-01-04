# Shopify Docs AI Prompt - Webhook Registration Not Showing Up

## Problem

I'm running `shopify app dev` but my webhooks aren't showing up when I query them via GraphQL. The webhook status page shows "No webhooks found" even though I have webhooks defined in `shopify.app.toml`.

## Current Setup

### 1. Webhook Configuration in `shopify.app.toml`

```toml
[webhooks]
api_version = "2026-01"

  [[webhooks.subscriptions]]
  topics = [ "app/uninstalled" ]
  uri = "/webhooks/app/uninstalled"

  [[webhooks.subscriptions]]
  topics = [ "app/scopes_update" ]
  uri = "/webhooks/app/scopes_update"

  [[webhooks.subscriptions]]
  topics = [ "orders/create" ]
  uri = "/webhooks/orders/create"
```

### 2. Webhook Handler Routes

I have webhook handler files:
- `app/routes/webhooks.orders.create.tsx` - handles `orders/create`
- `app/routes/webhooks.app.uninstalled.tsx` - handles `app/uninstalled`
- `app/routes/webhooks.app.scopes_update.tsx` - handles `app/scopes_update`

All handlers use `authenticate.webhook(request)` from `@shopify/shopify-app-react-router`.

### 3. Querying Webhooks

I'm querying webhooks via GraphQL in my webhook status page:

```graphql
query GetWebhookSubscriptions {
  webhookSubscriptions(first: 50) {
    edges {
      node {
        id
        uri
        format
        topic
        apiVersion {
          displayName
        }
        createdAt
        updatedAt
      }
    }
  }
}
```

This query returns an empty array even though I'm running `shopify app dev`.

## Questions

1. **Are webhooks defined in `shopify.app.toml` automatically registered when running `shopify app dev`?**
   - I thought they were, but they're not showing up
   - Do I need to manually call `registerWebhooks()` somewhere?
   - When exactly are app-specific webhooks (from TOML) registered?

2. **Is my GraphQL query correct for querying webhook subscriptions?**
   - Should I be using `webhookSubscriptions` or a different query?
   - Do I need to filter by app ID or shop?
   - Are there any required scopes to query webhooks?

3. **What's the difference between app-specific and shop-specific webhooks?**
   - My TOML defines app-specific webhooks
   - Do these show up differently in queries?
   - Should I be using a different approach?

4. **Do webhooks need to be registered manually in code?**
   - I see `registerWebhooks` exported from `shopify.server.ts`
   - Should I call this in an `afterAuth` hook or somewhere else?
   - Or are TOML-defined webhooks handled automatically?

5. **What could cause webhooks to not show up even when defined in TOML?**
   - App not fully installed?
   - Missing scopes?
   - Wrong API version?
   - Webhooks not synced yet?

## What I've Tried

1. ✅ Defined webhooks in `shopify.app.toml`
2. ✅ Created webhook handler routes with `authenticate.webhook()`
3. ✅ Running `shopify app dev` (webhooks should auto-register)
4. ✅ Querying via GraphQL `webhookSubscriptions` query
5. ❌ Webhooks not appearing in query results

## Expected Behavior

When I run `shopify app dev` and query webhooks, I expect to see:
- `app/uninstalled` webhook registered
- `app/scopes_update` webhook registered  
- `orders/create` webhook registered

## Current Behavior

- GraphQL query returns empty array: `{ webhookSubscriptions: { edges: [] } }`
- Webhook status page shows "No webhooks found"
- Webhook handlers work when manually triggered (I can test them)

## Additional Context

- Using `@shopify/shopify-app-react-router` (React Router adapter)
- App is embedded
- Running in development mode with `shopify app dev`
- App is installed on a dev store
- Using API version `2026-01` for webhooks

## Code Snippets

**Webhook Handler Example:**
```typescript
// app/routes/webhooks.orders.create.tsx
export async function action({ request }: ActionFunctionArgs) {
  const { payload, shop, admin } = await authenticate.webhook(request);
  console.log(`Received orders/create webhook for ${shop}`);
  // ... process webhook
  return new Response(null, { status: 200 });
}
```

**Shopify Server Config:**
```typescript
// app/shopify.server.ts
const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  // ... other config
});

export const registerWebhooks = shopify.registerWebhooks;
```

**Webhook Status Query:**
```typescript
// app/routes/app.webhook-status.tsx
const query = `#graphql
  query GetWebhookSubscriptions {
    webhookSubscriptions(first: 50) {
      edges {
        node {
          id
          uri
          format
          topic
          apiVersion {
            displayName
          }
          createdAt
          updatedAt
        }
      }
    }
  }
`;

const response = await admin.graphql(query);
const data = await response.json();
const webhooks = data.data?.webhookSubscriptions?.edges?.map((edge: any) => edge.node) || [];
```

## What I Need

1. Confirmation on whether TOML-defined webhooks auto-register or need manual registration
2. Correct GraphQL query to see app-specific webhooks
3. Troubleshooting steps if webhooks aren't showing up
4. Best practices for webhook registration in React Router apps

Please help me understand why my webhooks aren't showing up and how to fix it!

