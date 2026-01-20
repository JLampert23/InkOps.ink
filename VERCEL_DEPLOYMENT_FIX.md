# Fix Vercel Deployment - Account Creation Not Working

## Problem: Works in Bolt, Fails on Vercel

Your app works perfectly in the Bolt development environment but users can't create accounts on Vercel.

**Most Common Causes:**
1. Environment variables not configured in Vercel
2. Vercel pointing to wrong Supabase database
3. Live database missing schema/tables
4. RLS policies blocking new users
5. Auth trigger not configured

---

## IMMEDIATE FIX - Step by Step

### STEP 1: Identify Your Databases

You have TWO Supabase databases. Let's identify them:

**Current .env file (used by Bolt):**
- URL: `https://cuaukcvccxvfpuxaciac.supabase.co`
- This is your **SANDBOX** database

**Your .env.example references:**
- URL: `https://rhetupzcrsufhiruacoo.supabase.co`
- This is likely your **LIVE** database

**Question: Which database should Vercel use?**
- For production: Use **LIVE** database (`rhetupzcrsufhiruacoo`)
- For testing: Use **SANDBOX** database (`cuaukcvccxvfpuxaciac`)

---

### STEP 2: Check Vercel Environment Variables

1. **Go to Vercel Dashboard**
   ```
   https://vercel.com
   ```

2. **Select your project** (inkops or whatever you named it)

3. **Click Settings** → **Environment Variables**

4. **Check these variables exist:**
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

5. **Are they set?**
   - **NO** → Go to STEP 3 (Add them)
   - **YES** → Verify they point to the correct database

---

### STEP 3: Add/Update Environment Variables in Vercel

#### 3.1: Get Credentials from Supabase

**For LIVE database:**

1. Go to: `https://supabase.com/dashboard/project/rhetupzcrsufhiruacoo`
2. Click **Settings** → **API**
3. Copy:
   - **Project URL**: `https://rhetupzcrsufhiruacoo.supabase.co`
   - **Project API keys** → **anon** → **public** (click eye icon to reveal)

**For SANDBOX database (testing):**

1. Go to: `https://supabase.com/dashboard/project/cuaukcvccxvfpuxaciac`
2. Click **Settings** → **API**
3. Copy the same credentials

#### 3.2: Add Variables to Vercel

In Vercel dashboard (Settings → Environment Variables):

**If using LIVE database:**

1. Add `VITE_SUPABASE_URL`:
   ```
   Name: VITE_SUPABASE_URL
   Value: https://rhetupzcrsufhiruacoo.supabase.co
   Environments: Production, Preview, Development (select all)
   ```

2. Add `VITE_SUPABASE_ANON_KEY`:
   ```
   Name: VITE_SUPABASE_ANON_KEY
   Value: [paste your live anon key]
   Environments: Production, Preview, Development (select all)
   ```

**If using SANDBOX database:**

1. Add `VITE_SUPABASE_URL`:
   ```
   Name: VITE_SUPABASE_URL
   Value: https://cuaukcvccxvfpuxaciac.supabase.co
   Environments: Production, Preview, Development (select all)
   ```

2. Add `VITE_SUPABASE_ANON_KEY`:
   ```
   Name: VITE_SUPABASE_ANON_KEY
   Value: [paste your sandbox anon key]
   Environments: Production, Preview, Development (select all)
   ```

3. **Click Save** for each variable

---

### STEP 4: Verify Database Has Schema

The database Vercel points to MUST have all tables and functions.

1. **Open Supabase dashboard for the database Vercel uses**

2. **Go to SQL Editor** → **New Query**

3. **Run this query:**
   ```sql
   -- Check if tables exist
   SELECT COUNT(*) as table_count
   FROM information_schema.tables
   WHERE table_schema = 'public';
   ```

4. **Expected result**: Should return **23** tables

5. **If it returns 0 or less than 23:**
   - Your database is empty or incomplete
   - You MUST apply the schema (see next section)

---

### STEP 5: Apply Schema to Database (If Missing)

**If the database has 0 tables or incomplete schema:**

#### Method 1: Using PowerShell

```powershell
# Copy schema to clipboard
Get-Content "COMPLETE_DATABASE_SCHEMA.sql" | Set-Clipboard
```

Then:
1. Go to Supabase dashboard for target database
2. Click **SQL Editor** → **New Query**
3. Press `Ctrl+V` to paste
4. Click **Run**
5. Wait 30-60 seconds for completion

#### Method 2: Manual Steps

1. Open `COMPLETE_DATABASE_SCHEMA.sql` in notepad
2. Copy entire contents (`Ctrl+A`, `Ctrl+C`)
3. Go to Supabase dashboard → SQL Editor
4. Paste (`Ctrl+V`)
5. Click **Run**

---

### STEP 6: Verify Auth Function Exists

The `handle_new_user()` function is CRITICAL for account creation.

**Run this query in Supabase SQL Editor:**

```sql
-- Check if function exists
SELECT routine_name, routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'handle_new_user';
```

**Expected result**: Should return 1 row with the function definition

**If it returns nothing:**
- The function is missing
- Apply `COMPLETE_DATABASE_SCHEMA.sql` (it includes this function)

---

### STEP 7: Verify Auth Trigger Exists

**Run this query:**

```sql
-- Check if trigger exists
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
```

**Expected result**: Should show trigger on `auth.users` table

**If missing, create it:**

```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

---

### STEP 8: Redeploy Vercel

After updating environment variables, you MUST redeploy:

1. **Go to Vercel** → **Deployments** tab

2. **Click the "..." menu** on the latest deployment

3. **Click "Redeploy"**

4. **IMPORTANT**: Uncheck "Use existing build cache"

5. **Click "Redeploy"**

6. **Wait 2-3 minutes** for deployment to complete

---

### STEP 9: Test Account Creation

1. **Visit your Vercel URL**: `https://your-app.vercel.app`

2. **Open browser DevTools**: Press `F12`

3. **Go to Console tab** (to see any errors)

4. **Try to create account:**
   - Email: `test@example.com`
   - Password: `TestPassword123!`
   - Click Sign Up

5. **Watch for errors in console**

---

## Debugging Specific Errors

### Error: "Failed to fetch" or Network Error

**Cause**: Environment variables not set or incorrect

**Fix**:
1. Verify `VITE_SUPABASE_URL` in Vercel matches Supabase dashboard
2. Check for typos (common: extra space, missing 'https://')
3. Redeploy with build cache disabled

---

### Error: "Invalid API key"

**Cause**: Wrong anon key

**Fix**:
1. Go to Supabase → Settings → API
2. Copy the **anon** / **public** key (not service role!)
3. Update `VITE_SUPABASE_ANON_KEY` in Vercel
4. Redeploy

---

### Error: "Email rate limit exceeded"

**Cause**: Too many signup attempts with same email

**Fix**:
1. Try different email address
2. Or wait 60 minutes
3. Or disable email confirmation in Supabase (see below)

---

### Error: "New row violates row-level security policy"

**Cause**: RLS policies too restrictive

**Fix**: Verify `handle_new_user` function creates user profile

**Run in SQL Editor:**
```sql
-- Check if user profile was created
SELECT
  u.id,
  u.email,
  up.company_id,
  up.role
FROM auth.users u
LEFT JOIN user_profiles up ON up.user_id = u.id
WHERE u.email = 'test@example.com';
```

Should show `company_id` and `role = 'SUPER_ADMIN'`

---

### Error: "Email not confirmed"

**Cause**: Email confirmation is enabled but user can't access email

**Fix**: Disable email confirmation in Supabase

1. Go to Supabase dashboard
2. Click **Authentication** → **Settings**
3. Scroll to **Email Auth**
4. Uncheck "Enable email confirmations"
5. Click **Save**

---

## Verify Vercel Build Settings

Sometimes build settings cause issues:

1. **Vercel** → **Settings** → **General**

2. **Framework Preset**: Should be **Vite**

3. **Build Command**: Should be `npm run build`

4. **Output Directory**: Should be `dist`

5. **Install Command**: Should be `npm install`

---

## Check Browser Console for Errors

When testing on Vercel:

1. Press `F12` to open DevTools
2. Go to **Console** tab
3. Try to create account
4. Look for red errors

**Common errors:**

| Error Message | Cause | Fix |
|--------------|-------|-----|
| `Failed to fetch` | Env vars missing | Add to Vercel, redeploy |
| `Invalid API key` | Wrong anon key | Update in Vercel |
| `CORS error` | Supabase config | Check Supabase URL is correct |
| `RLS policy violation` | Database setup | Run COMPLETE_DATABASE_SCHEMA.sql |
| `Function handle_new_user does not exist` | Missing function | Run COMPLETE_DATABASE_SCHEMA.sql |

---

## Ultimate Checklist

Go through each item:

- [ ] Vercel has `VITE_SUPABASE_URL` environment variable
- [ ] Vercel has `VITE_SUPABASE_ANON_KEY` environment variable
- [ ] Both variables are set for all environments (Production, Preview, Development)
- [ ] Variables match the Supabase dashboard (Settings → API)
- [ ] Target database has 23 tables (run count query)
- [ ] `handle_new_user` function exists in database
- [ ] `on_auth_user_created` trigger exists and is enabled
- [ ] Vercel redeployed with build cache disabled
- [ ] Tested account creation with browser DevTools open
- [ ] No errors in browser console
- [ ] User appears in Supabase → Authentication → Users

---

## Still Not Working?

If you've completed all steps and it still fails:

### 1. Check Vercel Build Logs

1. Go to Vercel → Deployments
2. Click on latest deployment
3. Click **Build Logs**
4. Look for errors during build
5. Look for environment variable warnings

### 2. Check Vercel Function Logs

1. Go to Vercel → Deployments
2. Click on latest deployment
3. Click **Functions** tab
4. Look for runtime errors

### 3. Check Supabase Logs

1. Go to Supabase dashboard
2. Click **Logs** → **Auth Logs**
3. Try to sign up again
4. Look for failed auth attempts
5. Read error messages

### 4. Test Locally First

Before deploying to Vercel, test locally:

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Preview the production build
npm run preview
```

If it works locally but not on Vercel, it's definitely an environment variable issue.

---

## Quick Test Commands

**Test Supabase connection from browser console:**

```javascript
// Open browser console on Vercel URL
// Paste this:
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('Has anon key:', !!import.meta.env.VITE_SUPABASE_ANON_KEY);
```

Should show:
```
Supabase URL: https://rhetupzcrsufhiruacoo.supabase.co
Has anon key: true
```

If it shows `undefined`, environment variables are not loaded.

---

## Summary

**Most likely cause**: Environment variables not configured in Vercel

**Fix**:
1. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to Vercel
2. Apply schema to target database if missing
3. Redeploy with build cache disabled
4. Test account creation

**Time needed**: 10-15 minutes

**Files you need**:
- `COMPLETE_DATABASE_SCHEMA.sql` (for database setup)
- Supabase credentials (from Settings → API)
- Vercel access (to set environment variables)
