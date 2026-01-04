# GraphQL Fragment Error: Querying DiscountAutomaticApp

## Problem

I'm getting GraphQL validation errors in my IDE when trying to query a `DiscountAutomaticApp` using a fragment spread on `discountNode`. The error says:

```
Fragment cannot be spread here as objects of type "DiscountNode" can never be of type "DiscountAutomaticApp".
```

However, my code works at runtime - the queries execute successfully. This appears to be an IDE schema validation issue, but I'd like to use the correct, officially supported approach.

## Current Code

I'm trying to query discount details like this:

```graphql
query GetDiscountDetails($id: ID!) {
  discountNode(id: $id) {
    id
    ... on DiscountAutomaticApp {
      title
      status
      discountClasses
      asyncAppDiscount {
        functionId
      }
      metafields(first: 1, namespace: "$app:daisychain", keys: ["config"]) {
        edges {
          node {
            key
            value
          }
        }
      }
    }
  }
}
```

## Questions

1. **What is the correct way to query `DiscountAutomaticApp` fields when you have a discount ID (GID)?**
   - Should I use `discountNode` with a fragment?
   - Is there a direct `automaticDiscountNode` query I should use instead?
   - What's the proper field structure?

2. **What fields are actually available on `DiscountAutomaticApp`?**
   - The IDE says `asyncAppDiscount` doesn't exist - should it be something else?
   - The IDE says `metafields` doesn't exist on `DiscountAutomaticApp` - how do I query metafields?
   - Is `discountClasses` the correct field (vs deprecated `discountClass`)?

3. **If I know the discount ID is definitely a `DiscountAutomaticApp` (e.g., `gid://shopify/DiscountAutomaticApp/123`), is there a more direct query I can use?**

## Context

- I'm building a Shopify app with a Discount Function
- I need to verify the discount configuration (status, discountClasses, functionId, metafields)
- The discount ID is stored as a GID like `gid://shopify/DiscountAutomaticApp/123`
- The code works at runtime but IDE validation fails

## What I Need

The correct, IDE-validated GraphQL query structure to:
- Query a `DiscountAutomaticApp` by ID
- Get `title`, `status`, `discountClasses`
- Get the linked `functionId`
- Get metafields from namespace `$app:daisychain` with key `config`

