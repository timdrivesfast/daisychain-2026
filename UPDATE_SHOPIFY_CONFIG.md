# Updating Shopify App Configuration

## Two Options:

### Option 1: Manual Update (Recommended for Production)

**For production apps**, it's safer to update manually in the Partner Dashboard:

1. Go to https://partners.shopify.com
2. Your App → **App setup**
3. Update:
   - **App URL**: `https://daisychain-2026.vercel.app`
   - **Redirect URLs**: `https://daisychain-2026.vercel.app/api/auth/callback`
   - **App proxy URL**: `https://daisychain-2026.vercel.app/daisychain`
4. Save

**Why manual?**
- More control
- Immediate effect
- No risk of CLI issues
- Standard practice for production apps

### Option 2: CLI Update (For Development)

If you want to use CLI, you can update the TOML file and then:

```bash
# Update the TOML file (already done above)
# Then link and sync config
shopify app config link
```

However, **for production**, the CLI doesn't always sync all settings to the Partner Dashboard, so manual update is more reliable.

## What I Updated

I've updated `shopify.app.referral-company.toml` with:
- ✅ `application_url` = `https://daisychain-2026.vercel.app`
- ✅ `redirect_urls` = `https://daisychain-2026.vercel.app/api/auth/callback`
- ✅ `app_proxy.url` = `https://daisychain-2026.vercel.app/daisychain`

## Recommendation

**For now, update manually in the Partner Dashboard** - it's faster and more reliable for production.

The TOML file is now updated so it's in sync for future reference, but the Partner Dashboard is the source of truth for production apps.

