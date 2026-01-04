# Supabase Migration Guide: SQLite to PostgreSQL

This guide will help you migrate from SQLite (development) to Supabase PostgreSQL (production).

## Step 1: Create Supabase Project

1. Go to https://supabase.com and sign up/login (via GitHub is fine)
2. Click "New Project"
3. Fill in:
   - **Name**: `daisychain-app` (or your preferred name)
   - **Database Password**: ⚠️ **Create a strong password and SAVE IT!** This is different from your Supabase account password
   - **Region**: Choose closest to your Vercel deployment region
4. Click "Create new project"
5. Wait 2-3 minutes for the database to provision

**Important**: The **Database Password** you set here is what goes in `[YOUR-PASSWORD]` in the connection strings. This is NOT your Supabase account login password (which you don't have if you sign in via GitHub).

## Step 2: Get Connection Strings (Two Required!)

1. In your Supabase project, go to **Settings** → **Database**
2. Scroll down and click **"Connect to your project"** button
3. Click the **"ORMs"** tab
4. Select **"Prisma"** from the dropdown
5. You'll see two connection strings in the `.env.local` tab:

   **DATABASE_URL** (for regular queries - uses pooling):
   ```
   DATABASE_URL="postgresql://postgres.tdlgthgawidonipzhwpz:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
   ```

   **DIRECT_URL** (for migrations only):
   ```
   DIRECT_URL="postgresql://postgres.tdlgthgawidonipzhwpz:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:5432/postgres"
   ```

6. Replace `[YOUR-PASSWORD]` in **both** strings with your actual password

## Step 3: Update Prisma Schema

✅ **Already done!** The schema has been updated to:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

## Step 4: Create New Migration (Clean Slate Approach)

**Recommended**: Since you're migrating before production launch, use the clean slate approach:

```bash
# Set your DATABASE_URL temporarily
export DATABASE_URL="postgresql://postgres:yourpassword@db.xxxxx.supabase.co:5432/postgres?sslmode=require"

# Remove old SQLite migrations (they won't work with PostgreSQL anyway)
rm -rf prisma/migrations

# Create a fresh initial migration for PostgreSQL
npx prisma migrate dev --name init_postgres

# Generate Prisma Client
npx prisma generate
```

**Why clean slate?**
- SQLite and PostgreSQL use different SQL dialects
- Old migrations won't work with PostgreSQL
- Since you're pre-launch, starting fresh is cleaner
- This is the recommended approach from Shopify Docs AI

**Alternative** (if you want to keep history):
If you prefer to keep old migrations for reference, you can create a new migration:
```bash
npx prisma migrate dev --name migrate_to_postgres
```
But the old SQLite migrations will be ignored.

## Step 5: Verify Migration

Check that the migration was created:

```bash
ls -la prisma/migrations/
```

You should see a new migration folder like `20250103xxxxxx_migrate_to_postgres/`

## Step 6: Test Locally

1. Make sure your `.env` file has **both** connection strings:
   ```
   DATABASE_URL="postgresql://postgres.tdlgthgawidonipzhwpz:yourpassword@aws-0-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
   DIRECT_URL="postgresql://postgres.tdlgthgawidonipzhwpz:yourpassword@aws-0-us-west-1.pooler.supabase.com:5432/postgres"
   ```
   
   **Important**: Replace `yourpassword` with your actual Supabase database password in both strings.

2. Run your app:
   ```bash
   npm run dev
   ```

3. Test that:
   - App installs correctly
   - Sessions are stored
   - Shop config is saved
   - All features work as expected

## Step 7: Set Up Vercel Environment Variables

1. Go to your Vercel project → **Settings** → **Environment Variables**
2. Add **BOTH** connection strings:

   **DATABASE_URL** (for regular queries):
   ```
   DATABASE_URL = postgresql://postgres.tdlgthgawidonipzhwpz:yourpassword@aws-0-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true
   ```

   **DIRECT_URL** (for migrations):
   ```
   DIRECT_URL = postgresql://postgres.tdlgthgawidonipzhwpz:yourpassword@aws-0-us-west-1.pooler.supabase.com:5432/postgres
   ```

   - **Environment**: Select "Production", "Preview", and "Development" for both
   - Click "Save" after adding each one

## Step 8: Deploy to Vercel

1. Push your changes to GitHub:
   ```bash
   git add .
   git commit -m "Migrate to PostgreSQL/Supabase"
   git push
   ```

2. Vercel will automatically:
   - Run `npm install` (which runs `prisma generate` via postinstall)
   - Run `npm run build`
   - Deploy your app

3. **Run production migrations** (IMPORTANT):
   
   **Option 1: Manual (First Time)**
   ```bash
   # Pull production env vars
   vercel env pull .env.production
   
   # Run migrations against production database
   npx prisma migrate deploy
   ```
   
   **Option 2: Automated (Recommended for ongoing)**
   Add to your deployment pipeline or use Vercel's build command:
   ```json
   // In package.json, you can add:
   "vercel-build": "prisma generate && prisma migrate deploy && react-router build"
   ```
   
   Or use Vercel's "Build Command" override:
   ```
   prisma generate && prisma migrate deploy && npm run build
   ```
   
   **Note**: `prisma migrate deploy` is idempotent - it only runs unapplied migrations, so it's safe to run on every deploy.

## Step 9: Verify Production Deployment

1. Visit your Vercel deployment URL
2. Install the app on a test store
3. Verify:
   - ✅ App installs successfully
   - ✅ Sessions are stored in Supabase
   - ✅ Shop config is saved
   - ✅ All features work

## Troubleshooting

### Migration fails with "relation already exists"
- This means tables already exist in Supabase
- Solution: Drop tables in Supabase SQL Editor, then re-run migration:
  ```sql
  DROP TABLE IF EXISTS "Session" CASCADE;
  DROP TABLE IF EXISTS "ShopConfig" CASCADE;
  DROP TABLE IF EXISTS "_prisma_migrations" CASCADE;
  ```

### Connection timeout
- Check that your Supabase project is active (not paused)
- Verify the connection string is correct
- Make sure `?sslmode=require` is included

### Prisma Client not generated
- Make sure `postinstall` script is in `package.json` ✅ (already added)
- Check Vercel build logs for errors

## Connection Pooling (Recommended for Vercel Serverless)

**IMPORTANT**: For Vercel serverless functions, you MUST use connection pooling to avoid exhausting database connections.

Supabase offers connection pooling via PgBouncer:

1. Go to Supabase → Settings → Database
2. Scroll to **Connection Pooling**
3. Select **Session mode** (recommended for Prisma)
4. Copy the **Connection Pooling** connection string
5. Format: `postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require`
6. **Note**: Uses port `6543` instead of `5432`

**Use this pooled connection string** in your Vercel `DATABASE_URL` environment variable, NOT the direct connection string.

**Why?**
- Vercel serverless functions can create many concurrent connections
- Without pooling, you'll hit PostgreSQL connection limits
- PgBouncer manages connection pooling efficiently

## Security Best Practices

1. **Never commit** your `DATABASE_URL` to git (already in `.gitignore`)
2. **Use environment variables** in Vercel
3. **Rotate passwords** periodically in Supabase
4. **Enable Row Level Security (RLS)** in Supabase if needed (not required for this app)

## Next Steps

After successful migration:
1. ✅ Test all app features
2. ✅ Verify webhooks are working
3. ✅ Check analytics are saving correctly
4. ✅ Submit for App Store review

