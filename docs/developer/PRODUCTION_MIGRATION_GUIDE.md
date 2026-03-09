# Production Migration Guide

## Current Situation
- **Sandbox**: `szanpyrwedgbgixbmpok.supabase.co` ✅ Working
- **Production**: `cuaukcvccxvfpuxaciac.supabase.co` ❌ 400 errors

## Problem
The production database doesn't have all the migrations applied, causing the API to fail when fetching `company_settings`.

## Solution

### Option 1: Apply All Migrations to Production (Recommended)

1. **Switch to Production Environment**
   ```bash
   # Temporarily point to production in your .env
   VITE_SUPABASE_URL=https://cuaukcvccxvfpuxaciac.supabase.co
   VITE_SUPABASE_ANON_KEY=your-production-anon-key
   ```

2. **Go to Supabase Dashboard**
   - Visit: https://supabase.com/dashboard/project/cuaukcvccxvfpuxaciac/editor
   - Open the SQL Editor

3. **Run This Combined Migration Script**

   Copy all migration files from `supabase/migrations/` and run them in order, or use this consolidated script:

   ```sql
   -- Run each migration file in order from the supabase/migrations folder
   -- Start with: 20251229151519_create_printavo_cache_tables.sql
   -- End with: 20260120185034_fix_signup_rls_policy.sql
   ```

4. **Force Schema Reload**
   ```sql
   NOTIFY pgrst, 'reload schema';
   NOTIFY pgrst, 'reload config';
   ```

5. **Wait 30 seconds** for PostgREST to reload

### Option 2: Use the Supabase CLI (Faster)

If you have the Supabase CLI installed:

```bash
# Link to your production project
supabase link --project-ref cuaukcvccxvfpuxaciac

# Push all migrations
supabase db push

# Or apply specific migrations
supabase migration up
```

### Option 3: Automated Script

I can create a PowerShell script that combines all migrations into one file for easy copy/paste into the SQL Editor.

## Verification

After applying migrations, test with:

```sql
-- Check if company_settings table exists with all columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'company_settings'
ORDER BY ordinal_position;

-- Check if RLS policies exist
SELECT policyname
FROM pg_policies
WHERE tablename = 'company_settings';

-- Test a query
SELECT * FROM company_settings LIMIT 1;
```

## Environment Variable Setup for Vercel

Make sure Vercel has these environment variables:
- `VITE_SUPABASE_URL` = `https://cuaukcvccxvfpuxaciac.supabase.co`
- `VITE_SUPABASE_ANON_KEY` = (your production anon key)

## Common Issues

1. **400 Error**: Schema mismatch - PostgREST cache is stale
   - Solution: `NOTIFY pgrst, 'reload schema';`

2. **403 Error**: RLS policies not set up
   - Solution: Check that all policies are applied

3. **Migration Order**: Migrations must be run in chronological order
   - Check the timestamp in the filename (YYYYMMDDHHMMSS)

## Next Steps

Would you like me to:
1. Generate a single SQL file with all migrations combined?
2. Create a PowerShell script to automate this?
3. Walk through the migration process step-by-step?
