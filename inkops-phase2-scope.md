# InkOps Phase 2 — Scope & Implementation Guide

## Project Context
InkOps is a SaaS platform for screen printing & embroidery businesses.
Built on Bolt.new, GitHub repo (JLampert23/InkOps.ink), Supabase backend, deployed via Netlify at inkops.ink.

---

## CRITICAL RULE BEFORE TOUCHING ANY CODE
> ⚠️ **READ THE CODEBASE FIRST.**
> Before implementing any feature, read and understand the existing code related to that feature.
> Understand what's already built, what's partially built, and what's missing.
> Never assume — always verify in the code first.
> The order of priority below must be followed exactly as listed.

---

## Priority Order (as requested by client)

1. Subscription tiers + new company signup
2. User level access / roles
3. Notifications wired to central email
4. Separate email setup
5. Activity tracking / timestamps
6. Payment refund fix
7. Quote follow-up logic verification

---

## 📊 PHASE 2 PROGRESS TRACKER

### Feature 1: Subscription Tiers — ⏸️ BLOCKED (waiting on Stripe Price IDs)
**Status:** Client shared tier breakdown! Still need Stripe Price IDs to wire up checkout.

**Tier Breakdown (from client spreadsheet):**

| Feature | Starter ($159/mo) | Professional ($299/mo) |
|---|---|---|
| Quote Management | ✅ | ✅ |
| Product Catalog Integration | ✅ | ✅ |
| Pricing Matrices | Basic (3) | Unlimited |
| Work Order Management | ✅ | ✅ |
| Production Kanban | ❌ | ✅ |
| Production Scheduler | ❌ | ✅ |
| Proof Management | ✅ | ✅ |
| Mockup Generator | ✅ | ✅ |
| Purchase Orders | ❌ | ✅ |
| Auto PO Creation | ❌ | ✅ |
| Receiving Workflow | ❌ | ✅ |
| Invoice Management | ✅ | ✅ |
| Stripe Payments | ✅ | ✅ |
| Partial Payments | ❌ | ✅ |
| Customer Portal | ❌ | ✅ |
| Custom Domain | ❌ | ✅ |
| ShipStation Integration | ❌ | ✅ |
| Email Templates | Basic | ✅ |
| Workflow Automation | ❌ | Unlimited |
| Reports & Analytics | Basic | ✅ |
| Automated Reports | ❌ | ✅ |
| Chipply Integration | ❌ | ✅ |
| User Seats | 2 users | 25 |
| Support | Email | Priority + Phone |
| API Access | ❌ | Full Access |

**⚠️ Additional requirement:** Client said subscriptions must charge tax (Stripe Tax).

**Still waiting on:**
- [ ] **Stripe Price IDs** for both tiers (from the InkOps Stripe account)
- [ ] **Confirmation** on checkout flow (Stripe Checkout redirect vs embedded)

---

### Feature 2: User Level Access / Roles — ✅ DONE (pending client confirmation)
**What's built:**
- [x] Three roles implemented: `super_admin`, `admin`, `user`
- [x] RBAC types, service, and hook all updated
- [x] Sidebar navigation gated per role (user sees only Production)
- [x] Account Settings restricted to super_admin only
- [x] Role dropdown in user management includes all 3 roles
- [x] Backend validation: role values validated, privilege escalation prevented
- [x] Safety redirect: user role auto-bounced to Production tab

**⏳ Waiting on client:**
- [ ] Client is compiling a spreadsheet showing **which users get which role** and **what each role should access**
- [ ] Once received, we may need to **tweak the permission mappings** if his access rules differ from our current setup:
  - Current: `user` = Production only, `admin` = everything except Settings, `super_admin` = everything
  - Client may want different access for certain roles — TBD

---

### Feature 3: Notifications → Central Email — 🔲 NOT STARTED
No blockers. Can start when ready.

---

### Feature 3: Notifications → Central Email — 🔲 NOT STARTED
No blockers. Can start when ready.

---

### Feature 4: Separate Email Setup — 🔲 NOT STARTED
**Status:** Client confirmed they want emails coming from 2 sender addresses. We told them it's easy to configure. Ready to build when prioritized.

---

### Feature 5: Activity Tracking / Timestamps — 🔲 NOT STARTED
No blockers. Can start when ready.

---

### Feature 6: Payment Refund Fix — ✅ DONE
Fixed the endpoint. The frontend now correctly calls the `stripe-refund` edge function instead of the generic `stripe-proxy`, resolving the refund failures.

---

### Feature 7: Quote Follow-up Verification — 🔲 NOT STARTED
No blockers. Can start when ready.

---

## FEATURE 1: Subscription Tiers (HIGHEST PRIORITY)

### What the client wants
- Add a pricing tab on the home/landing screen
- Two subscription levels: **$199/month** and **$299/month**
- New companies can sign up and create their own isolated accounts
- Connected to Jamie's existing Stripe account with subscription products

### Before coding
- Read the existing Stripe integration code — find where Stripe is currently used in the codebase
- Check if subscription products/price IDs already exist in Jamie's Stripe account
- Check if there's already a signup flow for new companies or if it needs to be built from scratch
- Check the existing company creation logic in Supabase

### What to build
- Pricing page/tab visible before login
- Stripe Checkout or Stripe Payment Links for $199 and $299 tiers
- On successful payment → auto-create new company account in Supabase
- User gets redirected to their own InkOps dashboard after signup

---

## FEATURE 2: User Level Access / Roles

### What the client wants
Three role levels:

| Role | Permissions |
|---|---|
| Super Admin | Full access to everything |
| Admin | Full access EXCEPT account settings |
| User | Scheduler access only, can change scheduler status, CANNOT see pricing |

### Before coding
- Read the existing auth and role system — check if roles are already in the Supabase database schema
- Find every protected route and component in the codebase
- Understand how the current session/user object is structured
- Check if any role-based logic already exists

### What to build
- Role field on user accounts in Supabase
- Route-level protection based on role
- Hide pricing from User role throughout the app
- Restrict account settings access to Super Admin only
- Apply consistently across all components

---

## FEATURE 3: Notifications Wired to Central Email

### What the client wants
- Quote approvals, rejections, payments, and follow-ups already show as in-app notifications
- These same events need to send an email to **one central email** (Jamie's inbox)
- Setup should be configurable in account settings

### Before coding
- Find the existing notification trigger logic in the codebase
- Understand what's already firing and what's missing
- Check the Resend email integration — find where emails are currently sent
- Trace the full notification flow from trigger → in-app → (missing) email

### What to build
- Wire existing notification triggers to also dispatch emails via Resend
- Events to cover: quote approval, quote rejection, payment received, quote follow-up
- Central email address configurable in account settings
- Do NOT change the in-app notification logic — only add email dispatch on top

---

## FEATURE 4: Activity Tracking / Timestamps

### What the client wants
Every key action tracked with a timestamp and logged:
- Quote created
- Quote opened for editing
- Quote edited
- Email sent
- Text sent
- Payment request sent
- Payment applied
- Quote sent

### Before coding
- Check if an audit/activity log table already exists in Supabase
- Find every mutation point in the codebase for the above actions
- Understand the current quote and payment flow end to end

### What to build
- Dedicated `activity_log` table in Supabase if it doesn't exist
- Log entry on every key action above with: `user_id`, `company_id`, `action_type`, `record_id`, `timestamp`
- Activity visible somewhere in the UI (check if Jamie has a location in mind)

---

## FEATURE 5: Payment Refund Fix

### What the client wants
- Refund functionality is broken — needs to be fixed

### Before coding
- Find the existing refund code
- Test what happens when a refund is attempted
- Check Stripe dashboard to see if refunds are being attempted but failing, or if the code isn't calling Stripe at all
- Check error logs

### What to build
- Fix whatever is broken in the refund flow
- Ensure Stripe refund API is being called correctly
- Confirm refund status updates properly in the UI and database

---

## FEATURE 6: Quote Follow-up Logic Verification

### What the client wants
- Follow-up logic is already built in bolt.new
- Needs to verify it's triggering correctly and not missing any triggers

### Before coding
- Find the quote follow-up automation code
- Read the logic completely
- Test manually to confirm it fires or doesn't fire

### What to do
- If working → confirm and document
- If broken → identify the specific trigger that's failing and fix it

---

## Deployment Workflow (How to push to live)

Jamie can push his own bolt.new changes anytime:
1. GitHub → Pull requests → New pull request
2. Base: `InkOps-Production` ← Compare: `main`
3. Create pull request → Merge → Confirm
4. Netlify auto-redeploys inkops.ink in 2-3 minutes

For code changes:
```
git add .
git commit -m "description of change"
git push origin main
```
Then merge main into InkOps-Production on GitHub.

---

## Branch Rules
| Branch | Purpose | Deployed to |
|---|---|---|
| `main` | All development work | Nothing (dev only) |
| `InkOps-Production` | Live code | inkops.ink via Netlify |

**Never push directly to InkOps-Production. Always work on main and merge.**

---

## Tech Stack Reference
- Frontend: React + TypeScript (Vite)
- Backend: Supabase (auth, database, edge functions)
- Payments: Stripe
- Email: Resend
- SMS: Twilio
- Hosting: Netlify
- Domain: inkops.ink (managed by Netlify DNS)
