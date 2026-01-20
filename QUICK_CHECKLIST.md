# Quick Checklist - Clone Database & Fix Vercel

Print this and check off each step as you complete it.

---

## PHASE 1: Prepare LIVE Database

- [ ] **1.1** Open LIVE Supabase dashboard
  - URL: https://supabase.com/dashboard/project/rhetupzcrsufhiruacoo

- [ ] **1.2** Create backup
  - Go to: Database → Backups
  - Click: "Create backup now"
  - Wait for green checkmark

- [ ] **1.3** Copy schema SQL to clipboard
  - PowerShell: `Get-Content "COMPLETE_DATABASE_SCHEMA.sql" | Set-Clipboard`
  - Or run: `.\copy-sql-to-clipboard.ps1` → Option 2

- [ ] **1.4** Apply schema to LIVE database
  - In LIVE dashboard: SQL Editor → New Query
  - Press: Ctrl+V to paste
  - Click: RUN button
  - Wait: 30-60 seconds

- [ ] **1.5** Verify schema applied
  - Run: `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';`
  - Expected: 23 tables

---

## PHASE 2: Get LIVE Database Credentials

- [ ] **2.1** In LIVE dashboard, go to Settings → API

- [ ] **2.2** Copy Project URL
  - Should be: `https://rhetupzcrsufhiruacoo.supabase.co`
  - Write it here: ___________________________________

- [ ] **2.3** Copy anon/public key
  - Click eye icon to reveal
  - Copy the long string starting with "eyJ..."
  - Write first 10 characters here: ___________________________________

---

## PHASE 3: Configure Vercel

- [ ] **3.1** Open Vercel dashboard
  - URL: https://vercel.com

- [ ] **3.2** Select your project

- [ ] **3.3** Go to Settings → Environment Variables

- [ ] **3.4** Add VITE_SUPABASE_URL
  - Name: `VITE_SUPABASE_URL`
  - Value: `https://rhetupzcrsufhiruacoo.supabase.co`
  - Environments: Check ALL three boxes
  - Click: Save

- [ ] **3.5** Add VITE_SUPABASE_ANON_KEY
  - Name: `VITE_SUPABASE_ANON_KEY`
  - Value: [paste the anon key from step 2.3]
  - Environments: Check ALL three boxes
  - Click: Save

---

## PHASE 4: Redeploy Vercel

- [ ] **4.1** Go to Deployments tab

- [ ] **4.2** Click "..." menu on latest deployment

- [ ] **4.3** Click "Redeploy"

- [ ] **4.4** UNCHECK "Use existing build cache"

- [ ] **4.5** Click "Redeploy" button

- [ ] **4.6** Wait for deployment to complete (2-3 minutes)

---

## PHASE 5: Test Account Creation

- [ ] **5.1** Visit your Vercel URL
  - Write URL here: ___________________________________

- [ ] **5.2** Open DevTools
  - Press: F12

- [ ] **5.3** Go to Console tab

- [ ] **5.4** Try to create account
  - Email: test@example.com
  - Password: TestPassword123!

- [ ] **5.5** Check for errors in console

- [ ] **5.6** Verify account creation worked
  - No red errors
  - Can log in

---

## PHASE 6: Verify in Supabase

- [ ] **6.1** Go to LIVE dashboard → Authentication → Users

- [ ] **6.2** Find test@example.com user

- [ ] **6.3** Verify user exists

- [ ] **6.4** Check user has profile
  - SQL: `SELECT * FROM user_profiles WHERE user_id = '[user-id]';`

- [ ] **6.5** Verify user has company
  - Should have company_id and role = 'SUPER_ADMIN'

---

## SUCCESS CRITERIA

All of these should be TRUE:

- [ ] LIVE database has 23 tables
- [ ] Vercel has both environment variables set
- [ ] Vercel deployment completed successfully
- [ ] Can visit Vercel URL without errors
- [ ] Can create new account on Vercel
- [ ] New user appears in Supabase → Authentication → Users
- [ ] New user has company_id and SUPER_ADMIN role
- [ ] Can log in with created account
- [ ] Dashboard loads after login

---

## If Something Failed

### Account creation fails:
→ Check: `VERCEL_DEPLOYMENT_FIX.md` page 1

### Database schema not applied:
→ Run: `FIX_STATUS_COLUMN.sql` then retry `COMPLETE_DATABASE_SCHEMA.sql`

### Vercel deployment failed:
→ Check: Vercel → Deployments → Build Logs

### Browser shows errors:
→ Press F12, read console errors, compare with troubleshooting guides

---

## Emergency Rollback

If you need to undo everything:

- [ ] Go to LIVE dashboard → Database → Backups
- [ ] Find backup from Phase 1.2
- [ ] Click Restore
- [ ] Wait for completion
- [ ] Update Vercel env vars to SANDBOX if needed

---

## Notes Section

Use this space for notes, errors, or credentials:

```
Project URL:


Anon Key (first 10 chars):


Vercel URL:


Test Account Email:


Any Errors:



```

---

## Completion

Date completed: ___________________

Time taken: ___________________

Working? ☐ YES  ☐ NO

If NO, what's the issue: ___________________

---

**Print this checklist and check off items as you go!**
