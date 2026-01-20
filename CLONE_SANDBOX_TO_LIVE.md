# Clone Sandbox Database Schema to Live Database

## CRITICAL: You Have Two Supabase Databases

Based on your files:
- **SANDBOX**: `cuaukcvccxvfpuxaciac.supabase.co` (currently in your .env)
- **LIVE**: `rhetupzcrsufhiruacoo.supabase.co` (from .env.example)

**GOAL**: Copy all tables, RLS policies, and functions from SANDBOX to LIVE

---

## STEP 1: Export Schema from SANDBOX Database

### Option A: Using Supabase Dashboard (EASIEST)

1. Go to **SANDBOX** Supabase Dashboard:
   ```
   https://supabase.com/dashboard/project/cuaukcvccxvfpuxaciac
   ```

2. Click **Database** → **Migrations**

3. Click **Create a new migration**

4. In the migration editor, run this query to get full schema:
   ```sql
   -- This will show you all your table creation statements
   SELECT
     'CREATE TABLE ' || schemaname || '.' || tablename || E'\n(\n' ||
     string_agg(
       '  ' || column_name || ' ' || data_type ||
       CASE WHEN character_maximum_length IS NOT NULL
         THEN '(' || character_maximum_length || ')'
         ELSE ''
       END ||
       CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END,
       E',\n'
     ) || E'\n);'
   FROM information_schema.columns
   WHERE schemaname = 'public'
   GROUP BY schemaname, tablename
   ORDER BY tablename;
   ```

5. **BETTER OPTION**: Use the pre-built schema file

---

### Option B: Use Your Existing COMPLETE_DATABASE_SCHEMA.sql (RECOMMENDED)

**You already have the complete schema file!**

This file contains:
- All 23 tables
- All RLS policies
- All indexes
- All functions
- All constraints

**Location**: `COMPLETE_DATABASE_SCHEMA.sql` in your project root

---

## STEP 2: Prepare Live Database

### 2.1: Get Live Database Credentials

1. Go to **LIVE** Supabase Dashboard:
   ```
   https://supabase.com/dashboard/project/rhetupzcrsufhiruacoo
   ```

2. Go to **Settings** → **API**

3. Copy these values:
   - **Project URL**: `https://rhetupzcrsufhiruacoo.supabase.co`
   - **Anon Key**: (public key)
   - **Service Role Key**: (private key - keep secure!)

4. Save them temporarily - you'll need them for Vercel later

---

### 2.2: Backup Live Database (SAFETY FIRST!)

1. In **LIVE** dashboard, go to **Database** → **Backups**

2. Click **Create backup now**

3. Wait for backup to complete (shows green checkmark)

4. **DO NOT PROCEED** until backup is complete!

---

## STEP 3: Apply Schema to Live Database

### Method 1: Using PowerShell (WINDOWS)

```powershell
# Copy schema to clipboard
Get-Content "COMPLETE_DATABASE_SCHEMA.sql" | Set-Clipboard
```

Then:
1. Go to **LIVE** dashboard: `https://supabase.com/dashboard/project/rhetupzcrsufhiruacoo`
2. Click **SQL Editor** → **New Query**
3. Press `Ctrl+V` to paste the schema
4. Click **Run** (this will take 30-60 seconds)
5. Wait for "Success" message
6. Verify: Should show 23 tables created

---

### Method 2: Using Supabase CLI (ADVANCED)

If you have Supabase CLI installed:

```bash
# Set Live database connection
$env:SUPABASE_URL = "https://rhetupzcrsufhiruacoo.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "your-live-service-role-key"

# Apply schema
supabase db push
```

---

## STEP 4: Verify Schema Was Applied

Run this in **LIVE** database SQL Editor:

```sql
-- Should return 23
SELECT COUNT(*) as table_count
FROM information_schema.tables
WHERE table_schema = 'public';

-- List all tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Verify RLS is enabled (all should be TRUE)
SELECT tablename, rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Check if auth trigger exists
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%handle%new%user%';
```

**Expected Results:**
- 23 tables
- All tables have RLS enabled (TRUE)
- `handle_new_user` function exists
- All policies are in place

---

## STEP 5: Update Vercel Environment Variables

Now that LIVE database has the schema, configure Vercel to use it:

### 5.1: Go to Vercel Dashboard

1. Open: `https://vercel.com`
2. Click on your project: `inkops` (or whatever you named it)
3. Click **Settings** → **Environment Variables**

### 5.2: Add/Update These Variables

**Delete old variables first if they exist, then add new ones:**

| Variable Name | Value | Source |
|--------------|-------|--------|
| `VITE_SUPABASE_URL` | `https://rhetupzcrsufhiruacoo.supabase.co` | Live database |
| `VITE_SUPABASE_ANON_KEY` | `[your-live-anon-key]` | Live database API settings |

### 5.3: Important Settings

- **Environment**: Select all environments (Production, Preview, Development)
- **Save** each variable
- After saving all variables, you MUST redeploy

### 5.4: Redeploy Application

1. In Vercel dashboard, go to **Deployments** tab
2. Click **...** menu on latest deployment
3. Click **Redeploy**
4. Select **Use existing build cache: NO**
5. Click **Redeploy**

---

## STEP 6: Test Account Creation on Vercel

1. Wait for Vercel deployment to complete (2-3 minutes)

2. Visit your Vercel URL: `https://your-app.vercel.app`

3. Try to create a new account:
   - Click "Sign Up" or "Create Account"
   - Enter email: `test@example.com`
   - Enter password: `TestPassword123!`
   - Click Submit

4. **Check for errors in browser console**:
   - Press `F12` to open DevTools
   - Click **Console** tab
   - Look for any red errors

5. **If it still fails**, check Supabase Auth logs:
   - Go to Live dashboard
   - Click **Authentication** → **Users**
   - See if the user was created
   - Click **Logs** to see any errors

---

## STEP 7: Verify Authentication Trigger

The `handle_new_user` function should automatically:
- Create a company for new users
- Assign them as SUPER_ADMIN
- Create a user profile

**Test it:**

```sql
-- In LIVE database SQL Editor, check if trigger exists
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND trigger_name LIKE '%user%';
```

Should show a trigger on `auth.users` table.

---

## Common Issues & Fixes

### Issue 1: "Email already exists"

**Cause**: User already exists in LIVE database

**Fix**:
```sql
-- Delete test user
DELETE FROM auth.users WHERE email = 'test@example.com';
```

---

### Issue 2: "User created but no company"

**Cause**: Trigger didn't fire or failed

**Fix**: Check trigger exists and is enabled:
```sql
-- Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

---

### Issue 3: "RLS policy prevents access"

**Cause**: RLS policies too restrictive

**Fix**: Check user has company:
```sql
-- See if user has company
SELECT
  u.email,
  up.company_id,
  up.role,
  cs.company_name
FROM auth.users u
LEFT JOIN user_profiles up ON up.user_id = u.id
LEFT JOIN company_settings cs ON cs.id = up.company_id
WHERE u.email = 'test@example.com';
```

Should show company_id and role = 'SUPER_ADMIN'

---

### Issue 4: CORS or Network Errors on Vercel

**Cause**: Environment variables not properly set

**Fix**:
1. Go to Vercel → Settings → Environment Variables
2. Verify `VITE_SUPABASE_URL` matches LIVE database
3. Verify `VITE_SUPABASE_ANON_KEY` is correct
4. Redeploy with "Use existing build cache: NO"

---

## CRITICAL CHECKLIST

Before going live, verify:

- [ ] Backup of LIVE database created
- [ ] All 23 tables exist in LIVE database
- [ ] All tables have RLS enabled
- [ ] `handle_new_user` function exists
- [ ] Auth trigger is enabled
- [ ] Vercel environment variables point to LIVE database
- [ ] Vercel redeployed with new variables
- [ ] Test account creation works on Vercel URL
- [ ] User gets SUPER_ADMIN role automatically
- [ ] User can log in after signup
- [ ] Dashboard loads after login

---

## Quick Reference

**SANDBOX Database (for testing)**
```
URL: https://cuaukcvccxvfpuxaciac.supabase.co
Dashboard: https://supabase.com/dashboard/project/cuaukcvccxvfpuxaciac
```

**LIVE Database (for production)**
```
URL: https://rhetupzcrsufhiruacoo.supabase.co
Dashboard: https://supabase.com/dashboard/project/rhetupzcrsufhiruacoo
```

**Schema File**: `COMPLETE_DATABASE_SCHEMA.sql` (23 tables, all RLS policies)

**Vercel Settings**: Settings → Environment Variables → Add LIVE credentials → Redeploy

---

## Emergency Rollback

If something goes wrong:

1. Go to LIVE dashboard → **Database** → **Backups**
2. Find the backup you created in Step 2.2
3. Click **Restore**
4. Wait for restore to complete
5. Start over from Step 3

---

## Need Help?

If signup still fails after following all steps:

1. Open browser DevTools (F12) on Vercel deployment
2. Try to sign up
3. Copy the error message from Console tab
4. Check Supabase LIVE dashboard → Auth → Logs
5. Look for any failed auth attempts
6. Share the error message for further help
