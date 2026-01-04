# Vercel 500 Error Troubleshooting

## The Error
`500: INTERNAL_SERVER_ERROR` with `FUNCTION_INVOCATION_FAILED`

This means your serverless function is crashing. Let's debug it.

## Step 1: Check Vercel Logs

1. Go to **Vercel Dashboard → Your Project → Deployments**
2. Click on the latest deployment
3. Click **"View Function Logs"** or **"Runtime Logs"**
4. Look for error messages - they'll tell you what's failing

Common issues you might see:

### Missing Environment Variables
```
Error: Environment variable SHOPIFY_API_KEY is not set
```
**Fix**: Make sure all required env vars are set in Vercel

### Database Connection Error
```
Error: Can't reach database server
```
**Fix**: Check `DATABASE_URL` and `DIRECT_URL` are correct

### Prisma Client Not Generated
```
Error: Cannot find module '@prisma/client'
```
**Fix**: Build command should run `npx prisma generate`

### Migration Error
```
Error: Migration failed
```
**Fix**: Check `DIRECT_URL` is correct for migrations

## Step 2: Verify Environment Variables

Go to **Vercel → Settings → Environment Variables** and verify:

✅ **SHOPIFY_API_KEY** is set
✅ **SHOPIFY_API_SECRET** is set  
✅ **SCOPES** is set
✅ **SHOPIFY_APP_URL** is set to your Vercel URL
✅ **DATABASE_URL** is set (with correct password)
✅ **DIRECT_URL** is set (with correct password)
✅ **NODE_ENV** is set to `production`

**Important**: Make sure you replaced `[YOUR-PASSWORD]` in both database URLs!

## Step 3: Check Build Logs

In the deployment, check if:
- ✅ Build completed successfully
- ✅ `npx prisma generate` ran
- ✅ `npx prisma migrate deploy` ran
- ✅ `npm run build` completed

## Step 4: Test Database Connection

The most common issue is database connection. Verify:

1. Your Supabase project is **active** (not paused)
2. Connection strings are correct:
   - `DATABASE_URL` uses port `6543` with `pgbouncer=true`
   - `DIRECT_URL` uses port `5432` without `pgbouncer=true`
3. Passwords are correct (no `[YOUR-PASSWORD]` placeholder)

## Step 5: Common Fixes

### If logs show "DATABASE_URL not found":
- Add it to Vercel environment variables
- Make sure it's set for Production, Preview, and Development

### If logs show "Connection refused":
- Check Supabase project is active
- Verify connection strings are correct
- Check Supabase firewall settings (should allow all IPs by default)

### If logs show "Migration failed":
- Check `DIRECT_URL` is correct
- Verify migrations ran during build (check build logs)
- You might need to run migrations manually first time

## Step 6: Manual Migration (If Needed)

If migrations didn't run during build, run them manually:

```bash
# Install Vercel CLI
npm i -g vercel

# Pull environment variables
vercel env pull .env.production

# Run migrations
npx prisma migrate deploy
```

## Where Should the URL Go?

Yes, `daisychain-2026.vercel.app` is correct! This is your app's URL.

**After it's working**, you need to:

1. **Update Shopify Partner Dashboard**:
   - Go to https://partners.shopify.com
   - Your App → App setup
   - **App URL**: `https://daisychain-2026.vercel.app`
   - **Allowed redirection URL(s)**: `https://daisychain-2026.vercel.app/api/auth/callback`
   - Save

2. **Update SHOPIFY_APP_URL in Vercel**:
   - Make sure `SHOPIFY_APP_URL` env var = `https://daisychain-2026.vercel.app`
   - Redeploy after updating

## Next Steps

1. **Check the logs first** - they'll tell you exactly what's wrong
2. **Share the error message** from logs if you need help
3. **Verify all environment variables** are set correctly
4. **Test database connection** is working

The app should load and show your Shopify app interface, not a 500 error.

