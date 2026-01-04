# Vercel Environment Variables - Complete List

## Required Environment Variables

Set these in: **Vercel Dashboard → Your Project → Settings → Environment Variables**

### 1. Shopify App Credentials

**SHOPIFY_API_KEY**
```
2e491639d4aac4af9be1df4b408fb9ac
```
- This is your Client ID from Shopify Partner Dashboard
- Get it from: Partners → Your App → App setup → Credentials

**SHOPIFY_API_SECRET**
```
[Your Secret from Shopify Partner Dashboard]
```
- This is your Secret from Shopify Partner Dashboard
- Get it from: Partners → Your App → App setup → Credentials
- Click the eye icon to reveal it, or rotate if needed

**SCOPES**
```
write_discounts,read_customers,write_customers,read_orders,write_orders,read_products,write_app_proxy
```
- Comma-separated list of Shopify API scopes
- These match what's in your `shopify.app.toml`

**SHOPIFY_APP_URL**
```
https://your-app-name.vercel.app
```
- Your Vercel deployment URL
- **Important**: Update this AFTER first deployment with your actual Vercel URL
- Format: `https://[your-project].vercel.app`

### 2. Database Connection (Supabase)

**DATABASE_URL**
```
postgresql://postgres.tdlgthgawidonipzhwpz:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```
- Connection pooling URL for regular queries
- Get from: Supabase → Settings → Database → Connect → ORMs → Prisma → .env.local tab
- Replace `[YOUR-PASSWORD]` with your Supabase database password
- Uses port `6543` (pooler)

**DIRECT_URL**
```
postgresql://postgres.tdlgthgawidonipzhwpz:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:5432/postgres
```
- Direct connection URL for migrations
- Get from: Supabase → Settings → Database → Connect → ORMs → Prisma → .env.local tab
- Replace `[YOUR-PASSWORD]` with your Supabase database password (same as DATABASE_URL)
- Uses port `5432` (direct)

### 3. Node Environment

**NODE_ENV**
```
production
```
- Set to `production` for Vercel deployments
- Vercel may set this automatically, but good to set explicitly

## Optional Environment Variables

**SHOP_CUSTOM_DOMAIN**
```
your-custom-domain.com
```
- Only if you're using a custom domain
- Leave empty if using default Vercel domain

## Environment Settings

For each variable, select:
- ✅ **Production**
- ✅ **Preview** 
- ✅ **Development**

This ensures they work in all environments.

## Quick Copy-Paste Checklist

Copy these into Vercel (replace placeholders):

```
SHOPIFY_API_KEY=2e491639d4aac4af9be1df4b408fb9ac
SHOPIFY_API_SECRET=[Your Secret]
SCOPES=write_discounts,read_customers,write_customers,read_orders,write_orders,read_products,write_app_proxy
SHOPIFY_APP_URL=https://your-app-name.vercel.app
DATABASE_URL=postgresql://postgres.tdlgthgawidonipzhwpz:[PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.tdlgthgawidonipzhwpz:[PASSWORD]@aws-0-us-west-1.pooler.supabase.com:5432/postgres
NODE_ENV=production
```

## After First Deployment

1. **Update SHOPIFY_APP_URL** with your actual Vercel URL
2. **Update Shopify Partner Dashboard**:
   - App URL: `https://your-app-name.vercel.app`
   - Redirect URL: `https://your-app-name.vercel.app/api/auth/callback`

## Security Notes

- ✅ Never commit `.env` files to git (already in `.gitignore`)
- ✅ Use Vercel's environment variables (encrypted at rest)
- ✅ Rotate secrets periodically
- ✅ Use different secrets for production vs development if needed

