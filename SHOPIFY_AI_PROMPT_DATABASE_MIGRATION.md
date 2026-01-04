# Shopify Docs AI Prompt: SQLite to PostgreSQL Migration for App Submission

I'm preparing my Shopify app for App Store submission and need to migrate from SQLite (used during development) to PostgreSQL (required for production hosting on Vercel).

## Current Setup

- **Framework**: React Router (Remix-based) with Shopify App React Router
- **Database**: Currently using SQLite (`prisma/schema.prisma` with `provider = "sqlite"`)
- **ORM**: Prisma
- **Session Storage**: `@shopify/shopify-app-session-storage-prisma`
- **Hosting**: Planning to deploy to Vercel (requires PostgreSQL)

## Current Prisma Schema

```prisma
datasource db {
  provider = "sqlite"
  url      = "file:dev.sqlite"
}

model Session {
  id            String    @id
  shop          String
  state         String
  isOnline      Boolean   @default(false)
  scope         String?
  expires       DateTime?
  accessToken   String
  userId        BigInt?
  firstName     String?
  lastName      String?
  email         String?
  accountOwner  Boolean   @default(false)
  locale        String?
  collaborator  Boolean?  @default(false)
  emailVerified Boolean?  @default(false)
  refreshToken        String?
  refreshTokenExpires DateTime?
}

model ShopConfig {
  id                      String   @id @default(uuid())
  shop                    String   @unique
  functionId              String?
  discountId              String?
  storeCreditDiscountId  String?
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt
}
```

## Migration Plan

1. **Update Prisma schema** to use PostgreSQL:
   - Change `provider` from `"sqlite"` to `"postgresql"`
   - Change `url` from `"file:dev.sqlite"` to `env("DATABASE_URL")`

2. **Create new migration** for PostgreSQL:
   - Run `npx prisma migrate dev --name migrate_to_postgres`
   - This should create a new migration that works with PostgreSQL

3. **Update environment variables**:
   - Set `DATABASE_URL` to Supabase PostgreSQL connection string
   - Format: `postgresql://user:password@host:port/database?sslmode=require`

4. **Update build process**:
   - Already have `postinstall: "prisma generate"` in package.json
   - Need to ensure migrations run during deployment

## Questions

1. **Schema Compatibility**: Are there any SQLite-specific features in my schema that won't work with PostgreSQL?
   - The `@default(uuid())` on `ShopConfig.id` - is this PostgreSQL-compatible?
   - The `BigInt?` type for `userId` - is this correct for PostgreSQL?
   - Any other type differences I should be aware of?

2. **Migration Strategy**: 
   - Should I create a completely new migration, or can I modify existing ones?
   - Do I need to keep the SQLite migrations, or can I delete them?
   - What's the best practice for migrating existing data (if any)?

3. **Session Storage Compatibility**:
   - The `@shopify/shopify-app-session-storage-prisma` package - does it work seamlessly with PostgreSQL?
   - Are there any configuration changes needed for the session storage adapter?

4. **Production Deployment**:
   - Should I run `prisma migrate deploy` during Vercel deployment?
   - Or should migrations be run manually after first deployment?
   - What's the recommended approach for production migrations?

5. **Connection String Format**:
   - For Supabase, should I use the direct connection string or the connection pooler?
   - What SSL mode should I use?
   - Any special connection parameters needed for Vercel serverless functions?

6. **Environment Variables**:
   - Should `DATABASE_URL` be set in Vercel environment variables?
   - Do I need any other database-related environment variables?

7. **Testing**:
   - How should I test the migration locally before deploying?
   - Should I set up a local PostgreSQL instance, or use Supabase's development database?

## Expected Outcome

After migration:
- App should work identically with PostgreSQL as it did with SQLite
- Session storage should continue working without code changes
- All Prisma queries should work the same way
- Deployment to Vercel should be seamless

## References

- Prisma migration docs: https://www.prisma.io/docs/guides/migrate
- Shopify session storage: https://github.com/Shopify/shopify-app-session-storage-prisma
- Supabase connection strings: https://supabase.com/docs/guides/database/connecting-to-postgres

Please verify:
1. My schema is PostgreSQL-compatible
2. My migration strategy is correct
3. Session storage will work without changes
4. Deployment process is correct
5. Any other considerations for Shopify app submission

