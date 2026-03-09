# Vercel Deployment Guide

## Overview

This guide explains how to deploy InkOps to Vercel with proper environment variable configuration.

## Prerequisites

1. A Vercel account
2. A GitHub repository (InkOps-Live)
3. A Supabase project with all migrations applied

## Step-by-Step Deployment

### 1. Set Up Environment Variables in Vercel

Before deploying, you **must** configure environment variables in Vercel. Without these, the app will not work.

1. Go to your Vercel dashboard: https://vercel.com/dashboard
2. Select your project (InkOps-Live)
3. Go to **Settings** → **Environment Variables**
4. Add the following variables:

#### Required Environment Variables

| Variable Name | Value | Where to Find It |
|---------------|-------|------------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | Supabase Dashboard → Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon/public key | Supabase Dashboard → Settings → API → Project API keys → `anon` `public` |

**Example:**
```
VITE_SUPABASE_URL=https://rhetupzcrsufhiruacoo.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Important Notes:

- The `VITE_` prefix is **required** for Vite apps to access these variables in the browser
- These are public keys (anon key), not service role keys
- Apply these to **all environments** (Production, Preview, Development)

### 2. Deploy from GitHub

1. Push your code to the InkOps-Live repository
2. If not already connected, import the repository in Vercel:
   - Go to Vercel Dashboard → Add New → Project
   - Import your GitHub repository
   - Configure build settings (Vite should be detected automatically)
3. Vercel will automatically deploy when you push to GitHub

### 3. Verify Deployment

After deployment:

1. Visit your Vercel app URL
2. Try to log in
3. If you see errors, check the browser console (F12)

### Common Errors and Solutions

#### Error: "Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL"

**Cause:** Environment variables are not set in Vercel

**Solution:**
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
3. Redeploy: Settings → Deployments → Click on latest deployment → Redeploy

#### Error: "Failed to encrypt API token"

**Cause:** The `VITE_SUPABASE_URL` is undefined, creating an invalid URL for edge functions

**Solution:**
1. Set the environment variables as described above
2. Redeploy the application

#### Error: Network request failed or CORS error

**Cause:**
- Wrong Supabase URL
- Supabase project authentication settings

**Solution:**
1. Verify the Supabase URL is correct
2. In Supabase Dashboard → Authentication → URL Configuration:
   - Add your Vercel domain to "Site URL"
   - Add your Vercel domain to "Redirect URLs"

### 4. Configure Supabase for Vercel

1. Go to your Supabase Dashboard
2. Navigate to Authentication → URL Configuration
3. Add your Vercel URLs:
   - Site URL: `https://your-app.vercel.app`
   - Redirect URLs: `https://your-app.vercel.app/**`

### 5. Edge Functions Configuration

Your Supabase Edge Functions also need environment variables. These are already configured in Supabase:

- `ENCRYPTION_KEY` - For encrypting API credentials
- `SUPABASE_URL` - Auto-configured by Supabase
- `SUPABASE_ANON_KEY` - Auto-configured by Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Auto-configured by Supabase

If encryption doesn't work, verify in Supabase Dashboard → Edge Functions → crypto-service that the `ENCRYPTION_KEY` secret is set.

## Build Settings

Vercel should auto-detect these, but if needed:

- **Framework Preset:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm install`

## Updating Your Deployment

Your current workflow (GitHub Desktop → Push → Auto-deploy) is correct. Just make sure:

1. Environment variables are set in Vercel (one-time setup)
2. Push your code to GitHub
3. Vercel automatically builds and deploys

## Troubleshooting Checklist

- [ ] Environment variables set in Vercel
- [ ] Variables applied to all environments (Production, Preview, Development)
- [ ] Variables have `VITE_` prefix
- [ ] Supabase URL includes `https://` protocol
- [ ] Supabase authentication URLs include Vercel domain
- [ ] Latest code pushed to GitHub
- [ ] Vercel deployment succeeded (check deployment logs)

## Getting Your Supabase Credentials

**Quick Link:** https://supabase.com/dashboard/project/rhetupzcrsufhiruacoo/settings/api

1. Go to the link above (you may need to log in)
2. Copy these values:
   - **Project URL**: `https://rhetupzcrsufhiruacoo.supabase.co` → Use as `VITE_SUPABASE_URL`
   - **Project API keys** → `anon` `public` → Use as `VITE_SUPABASE_ANON_KEY`

## Security Notes

- Never commit `.env` files to GitHub
- The `.env` file is in `.gitignore` (already configured)
- Only the `anon` key should be used in the frontend
- Service role keys are only used in Supabase Edge Functions
- API tokens (Printavo, Square, Stripe, etc.) are encrypted before storage

## Support

If you continue to have issues:

1. Check Vercel deployment logs: Vercel Dashboard → Deployments → Click on deployment
2. Check browser console for errors: Press F12 in your browser
3. Verify Supabase Edge Functions are deployed: Supabase Dashboard → Edge Functions
4. Test Supabase connection directly from Vercel app
