# START HERE - Fix Vercel Deployment & Clone Database

## Your Situation

- ✅ App works in Bolt (development)
- ❌ Account creation fails on Vercel (production)
- 🎯 Need to clone SANDBOX database to LIVE database

## Quick Start - Choose Your Path

### Path 1: Guided Setup with PowerShell (RECOMMENDED)

**Run this command in PowerShell:**
```powershell
.\clone-database-schema.ps1 guided
```

This interactive script will walk you through every step:
1. Backup LIVE database
2. Copy schema to clipboard
3. Apply schema to LIVE database
4. Verify setup
5. Configure Vercel
6. Test deployment

**Estimated time**: 15-20 minutes

---

### Path 2: Manual Step-by-Step

**Follow this guide**: `CLONE_SANDBOX_TO_LIVE.md`

This comprehensive guide includes:
- Explicit steps for each action
- PowerShell commands
- SQL queries to verify
- Troubleshooting for common errors

**Estimated time**: 20-30 minutes

---

### Path 3: Quick Vercel Fix Only

**If your LIVE database already has the schema**, just fix Vercel:

**Follow**: `VERCEL_DEPLOYMENT_FIX.md`

Quick steps:
1. Get LIVE database credentials from Supabase
2. Add to Vercel environment variables
3. Redeploy
4. Test

**Estimated time**: 10 minutes

---

## Quick Reference

### Your Two Databases

**SANDBOX (for testing):**
- URL: `https://cuaukcvccxvfpuxaciac.supabase.co`
- Dashboard: https://supabase.com/dashboard/project/cuaukcvccxvfpuxaciac
- Currently used by Bolt (in .env file)

**LIVE (for production):**
- URL: `https://rhetupzcrsufhiruacoo.supabase.co`
- Dashboard: https://supabase.com/dashboard/project/rhetupzcrsufhiruacoo
- Should be used by Vercel

---

## PowerShell Tools Created for You

### 1. Interactive Database Cloner
```powershell
.\clone-database-schema.ps1
```

Menu options:
1. Copy schema to clipboard
2. Open LIVE database
3. Open SANDBOX database
4. Show verification queries
5. Show Vercel config
6. **Complete guided setup** ← Start here!

---

### 2. SQL Clipboard Helper
```powershell
.\copy-sql-to-clipboard.ps1
```

Quick copy commands:
- Copy fix SQL
- Copy full schema
- Open Supabase dashboard
- Verify environment variables

---

### 3. Quick Commands

**Copy schema to clipboard:**
```powershell
Get-Content "COMPLETE_DATABASE_SCHEMA.sql" | Set-Clipboard
```

**Open LIVE database:**
```powershell
Start-Process "https://supabase.com/dashboard/project/rhetupzcrsufhiruacoo"
```

**Show Supabase URL in .env:**
```powershell
Get-Content ".env" | Select-String "VITE_SUPABASE_URL"
```

---

## The Problem Explained

### Why it works in Bolt but not Vercel:

**In Bolt:**
- Uses `.env` file with SANDBOX database
- SANDBOX has all tables and functions
- Account creation works perfectly

**On Vercel:**
- Environment variables not configured
- OR pointing to empty/incomplete LIVE database
- Account creation fails

### The Solution:

1. **Clone schema** from SANDBOX to LIVE database
2. **Configure Vercel** to use LIVE database credentials
3. **Redeploy** Vercel with new settings
4. **Test** account creation

---

## Files Guide

| File | Purpose | When to Use |
|------|---------|-------------|
| `START_HERE.md` | This file - overview | Start here! |
| `clone-database-schema.ps1` | Interactive guided setup | Best for most users |
| `CLONE_SANDBOX_TO_LIVE.md` | Complete manual guide | Prefer reading step-by-step |
| `VERCEL_DEPLOYMENT_FIX.md` | Vercel troubleshooting | Database already has schema |
| `COMPLETE_DATABASE_SCHEMA.sql` | Full database schema (23 tables) | Don't edit, just apply |
| `FIX_STATUS_COLUMN.sql` | Fixes status column errors | Only if schema fails |
| `copy-sql-to-clipboard.ps1` | Quick clipboard helper | Need to copy SQL files |

---

## Step-by-Step (TL;DR)

### 1. Backup LIVE Database
- Go to LIVE Supabase dashboard
- Database → Backups → Create backup now

### 2. Apply Schema to LIVE Database
```powershell
# Copy to clipboard
Get-Content "COMPLETE_DATABASE_SCHEMA.sql" | Set-Clipboard
```
- Go to LIVE dashboard → SQL Editor
- Paste and run
- Wait 30-60 seconds

### 3. Get LIVE Database Credentials
- Go to LIVE dashboard → Settings → API
- Copy Project URL and anon key

### 4. Configure Vercel
- Go to Vercel → Your Project → Settings → Environment Variables
- Add `VITE_SUPABASE_URL` = LIVE URL
- Add `VITE_SUPABASE_ANON_KEY` = LIVE anon key
- Select all environments

### 5. Redeploy Vercel
- Vercel → Deployments → ... → Redeploy
- Uncheck "Use existing build cache"
- Click Redeploy

### 6. Test
- Visit Vercel URL
- Press F12 (DevTools)
- Try creating account
- Should work!

---

## Verification Checklist

After setup, verify:

**In LIVE Database (SQL Editor):**
```sql
-- Should return 23
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';
```

**In Vercel (Settings → Environment Variables):**
- ✅ VITE_SUPABASE_URL is set
- ✅ VITE_SUPABASE_ANON_KEY is set
- ✅ Both set for all environments

**In Browser (on Vercel URL):**
- ✅ Account creation works
- ✅ No errors in DevTools console
- ✅ User can log in after signup

---

## Need Help?

If something goes wrong:

1. **Check Vercel build logs**: Vercel → Deployments → Build Logs
2. **Check browser console**: F12 → Console tab
3. **Check Supabase logs**: Supabase → Logs → Auth Logs
4. **Review troubleshooting**: `VERCEL_DEPLOYMENT_FIX.md`

---

## Emergency Rollback

If you need to undo changes:

1. Go to LIVE dashboard → Database → Backups
2. Find the backup you created
3. Click Restore
4. Wait for completion

---

## Ready to Start?

**Recommended**: Run the guided setup script

```powershell
.\clone-database-schema.ps1 guided
```

It will walk you through everything step-by-step!

---

## Common Questions

**Q: Will this delete data from LIVE database?**
A: The schema file uses `CREATE TABLE IF NOT EXISTS`, so it won't delete existing data. But always backup first!

**Q: Can I use SANDBOX for Vercel instead?**
A: Yes! Just use SANDBOX credentials in Vercel environment variables. But LIVE is recommended for production.

**Q: Do I need to run migrations?**
A: No, `COMPLETE_DATABASE_SCHEMA.sql` includes everything. It's a complete schema in one file.

**Q: What if I get "status column" errors?**
A: Run `FIX_STATUS_COLUMN.sql` first, then run the complete schema.

**Q: How long does Vercel redeployment take?**
A: Usually 2-3 minutes. Watch the deployment logs.

---

## Success Indicators

You'll know it worked when:
- Vercel URL loads without errors
- You can create a new account on Vercel
- User is automatically assigned SUPER_ADMIN role
- You can log in after signup
- Dashboard loads and shows "No data" (not errors)

---

**Good luck! You've got this!** 🚀
