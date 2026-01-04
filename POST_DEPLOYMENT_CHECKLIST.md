# Post-Deployment Checklist

## ✅ Build Completed Successfully!

Your build finished. Now let's verify everything works.

## Step 1: Check if App Loads

Visit: `https://daisychain-2026.vercel.app`

**Expected**: You should see either:
- A Shopify login page (if not authenticated)
- Your app's home page (if already authenticated)
- **NOT** a 500 error

## Step 2: If You Still See 500 Error

Check **Runtime Logs** (not build logs):

1. Go to **Vercel Dashboard → Your Project → Deployments**
2. Click the latest deployment
3. Click **"Runtime Logs"** or **"Function Logs"**
4. Look for errors when you visit the URL

Common runtime errors:

### "DATABASE_URL is not defined"
**Fix**: Add `DATABASE_URL` to Vercel environment variables

### "Cannot connect to database"
**Fix**: 
- Verify `DATABASE_URL` has correct password (not `[YOUR-PASSWORD]`)
- Check Supabase project is active
- Verify connection string format

### "SHOPIFY_API_KEY is not defined"
**Fix**: Add all Shopify env vars to Vercel

## Step 3: Verify Environment Variables

Go to **Vercel → Settings → Environment Variables** and confirm:

✅ `SHOPIFY_API_KEY` = `2e491639d4aac4af9be1df4b408fb9ac`
✅ `SHOPIFY_API_SECRET` = (your secret)
✅ `SCOPES` = `write_discounts,read_customers,write_customers,read_orders,write_orders,read_products,write_app_proxy`
✅ `SHOPIFY_APP_URL` = `https://daisychain-2026.vercel.app`
✅ `DATABASE_URL` = (Supabase pooled connection with password)
✅ `DIRECT_URL` = (Supabase direct connection with password)
✅ `NODE_ENV` = `production`

**Critical**: Make sure `DATABASE_URL` and `DIRECT_URL` have your actual Supabase password, not `[YOUR-PASSWORD]`!

## Step 4: Test the App

1. Visit `https://daisychain-2026.vercel.app`
2. You should be redirected to Shopify login
3. After login, you should see your app dashboard

## Step 5: Update Shopify Partner Dashboard

Once the app loads:

1. Go to https://partners.shopify.com
2. Your App → **App setup**
3. Update:
   - **App URL**: `https://daisychain-2026.vercel.app`
   - **Allowed redirection URL(s)**: `https://daisychain-2026.vercel.app/api/auth/callback`
4. Save

## Step 6: Test Installation

1. Install the app on a test store
2. Verify:
   - ✅ App installs successfully
   - ✅ Dashboard loads
   - ✅ Settings page works
   - ✅ Referral widget appears on storefront

## Troubleshooting

### If app still shows 500:
1. Check runtime logs (not build logs)
2. Verify all environment variables are set
3. Check database connection is working
4. Make sure `SHOPIFY_APP_URL` matches your Vercel URL exactly

### If migrations didn't run:
- Check build logs for "Applying migration" messages
- If not, you may need to run manually:
  ```bash
  vercel env pull .env.production
  npx prisma migrate deploy
  ```

### If database connection fails:
- Verify Supabase project is active (not paused)
- Check connection strings are correct
- Make sure passwords are correct (no placeholders)

## Next Steps After It Works

1. ✅ Test all app features
2. ✅ Verify webhooks are working
3. ✅ Test referral flow end-to-end
4. ✅ Submit for App Store review

The build warnings are fine - your app should work!

