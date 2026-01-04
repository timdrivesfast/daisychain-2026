# Vercel Deployment Checklist

## ✅ Pre-Deployment Checklist

- [x] Database migrated to PostgreSQL/Supabase
- [x] `Session` and `ShopConfig` tables created
- [x] Local app tested and working
- [ ] Code committed and pushed to GitHub
- [ ] Environment variables set in Vercel

## Step 1: Commit and Push Changes

```bash
git add .
git commit -m "Migrate to PostgreSQL/Supabase for production"
git push origin main
```

## Step 2: Set Environment Variables in Vercel

Go to: **Vercel Dashboard → Your Project → Settings → Environment Variables**

Add **BOTH** of these (from your Supabase Prisma connection strings):

### DATABASE_URL
```
postgresql://postgres.tdlgthgawidonipzhwpz:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```
- **Environment**: Production, Preview, Development (select all three)
- Replace `[YOUR-PASSWORD]` with your actual Supabase database password

### DIRECT_URL
```
postgresql://postgres.tdlgthgawidonipzhwpz:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:5432/postgres
```
- **Environment**: Production, Preview, Development (select all three)
- Replace `[YOUR-PASSWORD]` with your actual Supabase database password

**Important**: 
- Use the **exact** connection strings from Supabase (ORMs → Prisma → .env.local tab)
- Make sure to replace `[YOUR-PASSWORD]` in both
- The passwords should be the same for both URLs

## Step 3: Deploy

Vercel will automatically deploy when you push to GitHub, OR:

1. Go to Vercel Dashboard → Your Project
2. Click "Deployments" tab
3. Click "Redeploy" on the latest deployment (or it will auto-deploy from GitHub push)

## Step 4: Run Migrations on Production

After first deployment, migrations will run automatically (we added `prisma migrate deploy` to the build command in `vercel.json`).

**Verify migrations ran:**
- Check Vercel build logs for "Applying migration" messages
- Or check Supabase to see if tables exist

## Step 5: Update Shopify Partner Dashboard

1. Go to https://partners.shopify.com
2. Navigate to your app → **App setup**
3. Update **App URL** to your Vercel deployment URL:
   ```
   https://your-app-name.vercel.app
   ```
4. Update **Allowed redirection URL(s)**:
   ```
   https://your-app-name.vercel.app/api/auth/callback
   ```
5. Save changes

## Step 6: Test Production Deployment

1. Visit your Vercel app URL
2. Install the app on a test store
3. Verify:
   - ✅ App installs successfully
   - ✅ Sessions are saved (check Supabase `Session` table)
   - ✅ Shop config is created (check Supabase `ShopConfig` table)
   - ✅ All features work as expected

## Troubleshooting

**Build fails with "DATABASE_URL not found":**
- Make sure you set environment variables in Vercel
- Verify they're set for the correct environment (Production/Preview/Development)

**Migrations fail:**
- Check that `DIRECT_URL` is set correctly
- Verify the password is correct
- Check Vercel build logs for specific error messages

**App can't connect to database:**
- Verify `DATABASE_URL` uses the pooled connection (port 6543, `pgbouncer=true`)
- Check Supabase project is active (not paused)
- Verify connection strings are correct

