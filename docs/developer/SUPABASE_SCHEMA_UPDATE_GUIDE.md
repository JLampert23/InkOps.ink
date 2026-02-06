# Supabase Schema Update Guide

## ⚠️ IMPORTANT: DO NOT USE SUPABASE CLI

The Supabase CLI is NOT supported in this environment and will NOT work for deployments.

---

## Method 1: Apply Schema via Supabase Dashboard (RECOMMENDED)

### Steps:

1. **Login to Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Click "SQL Editor" in left sidebar
   - Click "New Query"

3. **Copy Your Schema**
   - Open the file: `COMPLETE_DATABASE_SCHEMA.sql`
   - Copy the entire contents

4. **Paste and Run**
   - Paste into the SQL Editor
   - Click "Run" or press `Ctrl+Enter`

5. **Verify Success**
   - Check for any error messages
   - Look for "Success. No rows returned" or similar

6. **Verify Tables Created**
   - Go to "Table Editor" in left sidebar
   - You should see all 23 tables

### What This Does:
- Creates all 23 tables
- Sets up 50+ indexes for performance
- Enables RLS on all tables
- Creates 60+ security policies
- Creates helper functions

---

## Method 2: Apply Individual Migrations (If Starting Fresh)

If you want to apply migrations one-by-one to understand what each does:

### Steps:

1. **Go to SQL Editor** (as above)

2. **Run Migrations in Order** (by date in filename):
   ```
   supabase/migrations/20251229151519_create_printavo_cache_tables.sql
   supabase/migrations/20251230151317_add_api_credentials_table.sql
   supabase/migrations/20251230175711_enable_pg_cron_for_printavo_sync.sql
   ... (continue in chronological order)
   ```

3. **Run Each Migration File**:
   - Copy contents of migration file
   - Paste into SQL Editor
   - Click "Run"
   - Verify success before moving to next

4. **Check for Errors**:
   - If you get "already exists" errors, that's OK (migrations use IF NOT EXISTS)
   - Any other errors should be investigated

---

## Method 3: Using Supabase API (Programmatic)

If you want to automate schema updates, you can use the Supabase Management API:

```bash
# NOT RECOMMENDED - Manual process is safer
curl -X POST 'https://api.supabase.com/v1/projects/{project-ref}/database/query' \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "-- Your SQL here"
  }'
```

---

## Checking Current Schema Status

### Option A: Use SQL Editor

Run this query to see all your tables:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

### Option B: Use Table Editor

- Go to "Table Editor" in Supabase Dashboard
- Expand "public" schema
- View all tables

---

## What to Do If Schema Already Exists

### If Tables Already Exist:

The `COMPLETE_DATABASE_SCHEMA.sql` file uses `CREATE TABLE IF NOT EXISTS`, so it's safe to run multiple times.

**However**, if you need to modify existing tables:

1. **Don't drop tables** - You'll lose data
2. **Use ALTER TABLE** instead:

```sql
-- Example: Add a new column
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS new_column_name TEXT;

-- Example: Create missing index
CREATE INDEX IF NOT EXISTS idx_name
ON table_name(column_name);
```

---

## Migration Best Practices

### ✅ DO:
- Backup your database before major changes
- Test migrations on a development project first
- Use IF NOT EXISTS for idempotent operations
- Review migration contents before running
- Run migrations in chronological order

### ❌ DON'T:
- Don't use the Supabase CLI in this environment
- Don't run destructive operations (DROP, DELETE) without backups
- Don't skip migrations or run them out of order
- Don't modify migration files after they've been applied

---

## Verifying Your Schema is Correct

After applying the schema, run these checks:

### 1. Count Tables (Should be 23)
```sql
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public';
```

### 2. Check RLS is Enabled
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```
All should have `rowsecurity = true`

### 3. Check Indexes Exist
```sql
SELECT COUNT(*) FROM pg_indexes
WHERE schemaname = 'public';
```
Should have 50+ indexes

### 4. Check Policies Exist
```sql
SELECT COUNT(*) FROM pg_policies
WHERE schemaname = 'public';
```
Should have 60+ policies

---

## Troubleshooting

### "Permission denied for schema public"
- You need database owner privileges
- Contact Supabase support or check project settings

### "Already exists" errors
- These are safe to ignore if using IF NOT EXISTS
- Means the object was already created

### "Foreign key violation"
- Check that parent tables exist before child tables
- Run migrations in chronological order

### "Function does not exist"
- Make sure you ran all migrations
- Some migrations depend on functions from earlier migrations

---

## Getting Help

If you encounter issues:

1. Check the Supabase logs in Dashboard → Database → Logs
2. Review the specific migration file causing issues
3. Test the SQL in SQL Editor with small portions first
4. Check Supabase documentation: https://supabase.com/docs

---

## Summary

**To update your Supabase schema:**

1. ✅ Use Supabase Dashboard → SQL Editor
2. ✅ Copy/paste `COMPLETE_DATABASE_SCHEMA.sql`
3. ✅ Click "Run"
4. ✅ Verify all 23 tables exist
5. ❌ Do NOT use Supabase CLI
6. ❌ Do NOT run destructive operations without backups

The entire schema can be applied in one go using the SQL Editor. It's safe, fast, and includes all necessary tables, indexes, RLS policies, and functions.
