# Deployment Guide for Daisychain Shopify App

## Hosting Platform: Vercel (Recommended)

Vercel is the best choice for React Router apps. It's free for hobby projects and has excellent Shopify app support.

## Prerequisites

1. **GitHub Account** - Vercel integrates with GitHub
2. **Vercel Account** - Sign up at https://vercel.com
3. **Database** - You'll need to migrate from SQLite to PostgreSQL (Vercel doesn't support SQLite)

## Step 1: Set Up PostgreSQL Database

Vercel doesn't support SQLite. You need PostgreSQL. Options:

### Option A: Vercel Postgres (Recommended - Easiest)
1. Go to your Vercel project dashboard
2. Navigate to "Storage" → "Create Database"
3. Select "Postgres"
4. Choose a plan (Hobby tier is free)
5. Copy the connection string

### Option B: Supabase (Free tier available)
1. Sign up at https://supabase.com
2. Create a new project
3. Go to Settings → Database
4. Copy the connection string (starts with `postgresql://`)

### Option C: Railway (Good alternative)
1. Sign up at https://railway.app
2. Create a new PostgreSQL database
3. Copy the connection string

## Step 2: Update Prisma Schema

Update `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Then run:
```bash
npx prisma migrate dev --name migrate_to_postgres
npx prisma generate
```

## Step 3: Push Code to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-github-repo-url>
git push -u origin main
```

## Step 4: Deploy to Vercel

1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Configure the project:
   - **Framework Preset**: Other
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`
   - **Output Directory**: `build/client`
   - **Install Command**: `npm install`

## Step 5: Set Environment Variables in Vercel

In Vercel dashboard → Settings → Environment Variables, add:

### Required Variables:
```
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SCOPES=write_discounts,read_customers,write_customers,read_orders,write_orders,read_products
SHOPIFY_APP_URL=https://your-app.vercel.app
DATABASE_URL=your_postgres_connection_string
NODE_ENV=production
```

### Optional Variables:
```
SHOP_CUSTOM_DOMAIN=your-custom-domain.com (if using custom domain)
```

## Step 6: Update Shopify Partner Dashboard

1. Go to https://partners.shopify.com
2. Navigate to your app → App setup
3. Update URLs:
   - **App URL**: `https://your-app.vercel.app`
   - **Allowed redirection URL(s)**: `https://your-app.vercel.app/api/auth/callback`
4. Save changes

## Step 7: Run Database Migrations

After first deployment, run migrations:

```bash
# Option 1: Via Vercel CLI
vercel env pull .env.local
npx prisma migrate deploy

# Option 2: Via Vercel dashboard
# Go to your deployment → Functions → Run command
# Or use Vercel's database migration feature
```

## Step 8: Deploy Shopify Extensions

Your discount function extension needs to be deployed separately:

```bash
shopify app deploy
```

This will deploy your `extensions/daisychain-discount-function` to Shopify.

## Troubleshooting

### Database Connection Issues
- Make sure `DATABASE_URL` is set correctly in Vercel
- Check that your database allows connections from Vercel's IPs
- For Supabase: Check "Connection Pooling" settings

### Build Failures
- Make sure all dependencies are in `package.json`
- Check that `prisma generate` runs during build (it should automatically)

### App Not Loading
- Verify `SHOPIFY_APP_URL` matches your Vercel deployment URL
- Check that redirect URLs are updated in Partner Dashboard
- Verify webhooks are still registered (they should be, but check)

## Alternative Hosting Options

### Railway (Good for full-stack apps)
- Pros: Built-in PostgreSQL, easier database management
- Cons: Slightly more expensive than Vercel

### Render (Similar to Railway)
- Pros: Good free tier, PostgreSQL included
- Cons: Slower cold starts than Vercel

### Fly.io (More control)
- Pros: More control, good for complex apps
- Cons: More setup required

## Next Steps After Deployment

1. Test the app on a development store
2. Verify all webhooks are working
3. Test the discount function
4. Submit for App Store review

