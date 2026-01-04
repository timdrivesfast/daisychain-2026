# Shopify Docs AI Prompt - Billing & Payment Options for Referral App

## Context

I've built a Shopify app called "Daisychain" that provides a referral program for merchants. The app is fully functional and ready to launch. Now I need to implement billing so merchants can pay for the app.

## What My App Does

**Core Features:**
- Referral widget on storefront (customers can enter referrer name)
- Automatic discount application at checkout (via Discount Functions)
- Referrer earns store credits when their referral makes a purchase
- Analytics dashboard showing referrals, revenue, conversion rates
- Store credit system that applies automatically at checkout
- Works with subscriptions (store credits apply to recurring orders)

**Technical Stack:**
- React Router app (`@shopify/shopify-app-react-router`)
- Discount Functions (Rust-based)
- Prisma database
- GraphQL Admin API

## Questions About Billing

### 1. What Billing Models Are Available?

I know Shopify supports different billing models, but I'm not sure which one(s) make sense for a referral app:

**Questions:**
- What are all the billing models Shopify supports? (one-time, recurring, usage-based, etc.)
- Can I use multiple billing models simultaneously?
- What are the pros/cons of each model for a referral app?
- Are there any restrictions or requirements for each model?

### 2. Which Billing Model Makes Sense for a Referral App?

**My App's Value Proposition:**
- Merchants pay for the referral program functionality
- Value scales with store size (more customers = more potential referrals)
- Ongoing value (merchants use it continuously, not one-time)

**Questions:**
- Should I use recurring billing (monthly/annual subscription)?
- Should I use usage-based billing (per referral, per order, per active referrer)?
- Should I use a hybrid model (base subscription + usage)?
- What do similar apps (referral, loyalty, rewards) typically use?

### 3. How Do I Implement Billing?

**Questions:**
- What API/endpoints do I use to create billing charges?
- Do I need to use the Billing API or GraphQL mutations?
- How do I handle billing in React Router apps?
- What's the flow: create charge → merchant approves → activate features?
- How do I check if a merchant has an active subscription?
- How do I handle failed payments or expired subscriptions?

### 4. Pricing Strategy

**Questions:**
- What are typical price points for referral/loyalty apps?
- Should I offer free tier, trial period, or paid-only?
- Should I have multiple pricing tiers (Starter, Pro, Enterprise)?
- How do I structure pricing based on:
  - Number of active referrers?
  - Number of referrals per month?
  - Store size (revenue, orders)?
  - Features (basic vs advanced analytics)?

### 5. Billing API Implementation

**Questions:**
- What's the exact code/API I need to use?
- Do I need to create a billing route/page?
- How do I handle the merchant approval flow?
- What happens after a merchant approves a charge?
- How do I verify a charge is active before allowing app usage?
- How do I handle charge updates (upgrade/downgrade)?

### 6. Best Practices & Edge Cases

**Questions:**
- When should I create the first charge? (on install? after trial? immediately?)
- How do I handle app uninstall (cancel charges automatically?)
- What about refunds/chargebacks?
- How do I handle merchants who uninstall and reinstall?
- Should I offer a free trial period? How long?
- How do I gracefully handle expired/failed payments (show banner, limit features)?

## What I Need

1. **Recommended billing model** for a referral app with my features
2. **Step-by-step implementation guide** for that billing model
3. **Code examples** for React Router apps
4. **Pricing strategy recommendations**
5. **Best practices** for handling billing edge cases

## Current App State

- App is fully functional and tested
- No billing implemented yet
- Ready to launch once billing is added
- Using React Router with `@shopify/shopify-app-react-router`

## Technical Details

**App Structure:**
- Main routes in `app/routes/`
- Database: Prisma with SQLite (dev) / PostgreSQL (production)
- Authentication: `authenticate.admin()` from `shopify.server.ts`
- App setup: `ensureAppSetup()` runs on first admin access

**What I'm Looking For:**
- Clear recommendation on billing model
- Complete implementation guide with code examples
- Integration points in my existing codebase
- Testing strategies for billing

Please help me understand the best billing approach for my referral app and how to implement it!

