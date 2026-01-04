# Migration Commands to Run

Since you have `DATABASE_URL` and `DIRECT_URL` in your `.env` file, run these commands in order:

## Step 1: Remove Old SQLite Migrations

```bash
rm -rf prisma/migrations
```

## Step 2: Reset Database (If Needed)

If you see "Drift detected" or "We need to reset", run:

```bash
npx prisma migrate reset
```

This will:
- Drop all existing tables
- Clear the migration history
- Prepare for a fresh migration

**Type `y` when prompted** (it will ask for confirmation)

## Step 3: Create New PostgreSQL Migration

```bash
npx prisma migrate dev --name init_postgres
```

This will:
- Connect to your Supabase database using `DIRECT_URL`
- Create the `Session` and `ShopConfig` tables
- Generate a new migration file

## Step 4: Generate Prisma Client

```bash
npx prisma generate
```

This generates the Prisma Client that your app uses.

## Step 5: Verify Migration

Check that the migration was created:

```bash
ls -la prisma/migrations/
```

You should see a new folder like `20250103xxxxxx_init_postgres/`

## Step 6: Test Locally

Start your app and test:

```bash
npm run dev
```

Then:
1. Install the app on a dev store
2. Verify sessions are being saved
3. Check that shop config is working

## Troubleshooting

**If migration fails with connection error:**
- Verify `DATABASE_URL` and `DIRECT_URL` are correct in `.env`
- Make sure you replaced `[YOUR-PASSWORD]` with actual password
- Check that your Supabase project is active (not paused)

**If you see "relation already exists":**
- Tables might already exist in Supabase
- You can drop them in Supabase SQL Editor:
  ```sql
  DROP TABLE IF EXISTS "Session" CASCADE;
  DROP TABLE IF EXISTS "ShopConfig" CASCADE;
  DROP TABLE IF EXISTS "_prisma_migrations" CASCADE;
  ```
- Then re-run the migration commands

