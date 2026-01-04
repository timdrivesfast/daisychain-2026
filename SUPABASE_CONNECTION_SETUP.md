# Supabase Connection Setup for Vercel with Prisma

## ✅ Perfect! You're in the Right Place

You're looking at the **ORMs → Prisma** tab, which is exactly what you need!

## What You Need (Two Connection Strings)

Prisma requires **TWO** connection strings for optimal performance:

### 1. DATABASE_URL (For Regular Queries - Uses Connection Pooling)

From the `.env.local` tab, copy the **first** `DATABASE_URL`:

```
DATABASE_URL="postgresql://postgres.tdlgthgawidonipzhwpz:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
```

**Key points:**
- Port `6543` (connection pooler)
- Has `?pgbouncer=true` parameter
- Used for all regular Prisma queries
- Prevents connection exhaustion in serverless

### 2. DIRECT_URL (For Migrations Only)

From the `.env.local` tab, copy the **second** `DIRECT_URL`:

```
DIRECT_URL="postgresql://postgres.tdlgthgawidonipzhwpz:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:5432/postgres"
```

**Key points:**
- Port `5432` (direct connection)
- NO `pgbouncer=true` parameter
- Used ONLY for `prisma migrate` commands
- Not used during normal app operation

### Step 3: Replace [YOUR-PASSWORD]

Replace `[YOUR-PASSWORD]` in **both** connection strings with your **database password** (NOT your Supabase account password).

**Important**: This is the password you set when **creating the Supabase project**, not your GitHub/Supabase login password.

**Don't remember it?**
1. Go to Supabase → Your Project → Settings → Database
2. Scroll to "Database password" section
3. Click "Reset database password"
4. Set a new password and save it securely
5. Use this new password in your connection strings

### Step 4: Update Prisma Schema

Update `prisma/schema.prisma` to use both URLs:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

### Step 5: Set Both in Vercel

Go to Vercel → Your Project → Settings → Environment Variables

Add **both**:
- `DATABASE_URL` = (the pooled connection string with `pgbouncer=true`)
- `DIRECT_URL` = (the direct connection string without `pgbouncer=true`)

Apply to: **Production**, **Preview**, and **Development**

## Why Connection Pooling?

- **Vercel serverless functions** can create many concurrent connections
- **Direct connection** will exhaust your PostgreSQL connection limit
- **Connection pooling** (PgBouncer) manages connections efficiently
- **Session mode** is required for Prisma to work correctly

## IPv4 Warning

If you see "Not IPv4 compatible" warning:
- **Solution**: Use the **Shared Pooler** connection string (which you should be using anyway)
- The pooler connection works with IPv4 networks
- You don't need to purchase the IPv4 add-on if using pooler

## Quick Checklist

- [ ] Using **Connection Pooling** (not direct)
- [ ] Using **Session mode** (for Prisma)
- [ ] Port is **6543** (not 5432)
- [ ] Host contains **pooler.supabase.com**
- [ ] Connection string includes `?sslmode=require`
- [ ] Replaced `[YOUR-PASSWORD]` with actual password
- [ ] Set as `DATABASE_URL` in Vercel environment variables

