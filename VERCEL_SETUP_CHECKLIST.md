# Vercel Setup Checklist

## The Problem

You're getting an error when trying to save API tokens because the environment variables aren't configured in Vercel. The app tries to call `undefined/functions/v1/crypto-service`, which creates an invalid URL.

## Quick Fix (5 Minutes)

### Step 1: Get Your Supabase Credentials

1. Go to https://supabase.com/dashboard/project/rhetupzcrsufhiruacoo/settings/api
2. Copy these two values:
   - **Project URL**: `https://rhetupzcrsufhiruacoo.supabase.co`
   - **anon public** key (under "Project API keys" - it's a long JWT token starting with `eyJ...`)

### Step 2: Add Environment Variables to Vercel

1. Go to https://vercel.com/dashboard
2. Select your **InkOps-Live** project
3. Click **Settings** in the top menu
4. Click **Environment Variables** in the left sidebar
5. Add these two variables:

   **Variable 1:**
   - Name: `VITE_SUPABASE_URL`
   - Value: `https://rhetupzcrsufhiruacoo.supabase.co`
   - Environment: Select all (Production, Preview, Development)

   **Variable 2:**
   - Name: `VITE_SUPABASE_ANON_KEY`
   - Value: `eyJhbGc...` (copy the full anon key from Step 1)
   - Environment: Select all (Production, Preview, Development)

6. Click **Save** for each variable

### Step 3: Redeploy

1. Go to **Deployments** in your Vercel project
2. Click the three dots (...) on your latest deployment
3. Click **Redeploy**
4. Check "Use existing Build Cache"
5. Click **Redeploy**

### Step 4: Test

1. Wait for the deployment to complete (2-3 minutes)
2. Visit your Vercel app URL
3. Log in
4. Go to Settings → Integrations
5. Try to save your Printavo/Square/Stripe credentials
6. It should work now!

## What Changed

I've updated the code to:
- Give you a clear error message if environment variables are missing
- Remove hardcoded fallback values that were masking the configuration issue
- Provide better debugging information

## Still Having Issues?

Check these:
- [ ] Both environment variables are set in Vercel
- [ ] Variables start with `VITE_` (required for Vite apps)
- [ ] Variables are applied to all environments
- [ ] You redeployed after adding the variables
- [ ] Your Supabase URL includes `https://`
- [ ] You're using the anon key, not the service role key

## Additional Configuration (Optional)

### Add Your Vercel Domain to Supabase

This prevents authentication errors:

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **URL Configuration**
3. Add these URLs (replace with your actual Vercel domain):
   - Site URL: `https://your-app.vercel.app`
   - Redirect URLs: `https://your-app.vercel.app/**`

## Need More Help?

See the full guide: [VERCEL_DEPLOYMENT_GUIDE.md](./VERCEL_DEPLOYMENT_GUIDE.md)
