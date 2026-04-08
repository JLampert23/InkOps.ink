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

### Feature 1: Subscription Tiers — ✅ DONE
**Status:** Fully deployed and tested.

**What was built:**
- [x] Hard Paywall — blocks all non-paying users from accessing the dashboard
- [x] Tier selection page with Starter ($199/mo) and Professional ($299/mo)
- [x] Stripe Checkout using inline product creation (no pre-configured Stripe products needed)
- [x] Stripe Webhook (`inkops-stripe-webhook`) — auto-stamps `company_settings` on successful payment
- [x] Feature gating via UpgradeWall for Pro-only features (Kanban, Scheduler, Purchase Orders, ShipStation)
- [x] Webhook uses `constructEventAsync` for Deno Edge Runtime compatibility
- [x] Both branches synced (`main` + `InkOps-Production`)

**Tier Breakdown:**

| Feature | Starter ($199/mo) | Professional ($299/mo) |
|---|---|---|
| Quote Management | ✅ | ✅ |
| Product Catalog Integration | ✅ | ✅ |
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
| ShipStation Integration | ❌ | ✅ |
| Workflow Automation | ❌ | Unlimited |
| Reports & Analytics | Basic | ✅ |

**Payment Method:** 🛡️ Stripe Checkout (Redirect) with inline product creation

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

### Feature 3: Notifications / Automations → Central Email — ✅ DONE
**Status:** Feature has been completely refactored with full dynamic workflow selector UI and edge function integration.

**What was built:**
- [x] Automation Builder: Replaced the static dropdown with a dynamic dual-dropdown selector for "Type of Production" and "Status".
- [x] Automation Engine: Parses the complex object config for status triggers.
- [x] `send-email` Edge Function automatically fetches the saved central email structure.
- [x] Added `UpgradeWall` gating to ensure automations are only available on the Professional Tier.

---

### Feature 4: Dual Email Setup — ✅ DONE
**Status:** Both backend routing and UI integration are fully implemented out-of-the-box.

**What was built:**
- [x] New DB Column: `secondary_email_from_address` and `quote_email_sender` in `company_settings` (via Migration).
- [x] Backend Edge Function: The `send-email` webhook now defaults non-invoice traffic to the secondary sender.
- [x] Frontend Config UI: Available today in `AccountSettings -> Resend Integration` with selector dropdown.

---

### Feature 5: Activity Tracking / Timestamps — ✅ DONE
**Status:** Core activity tracking events (Quote opened, Quote edited, Quote sent, Email sent, Payment applied) are now fully implemented.
- [x] ActivityLogger service added for consistency.
- [x] Frontend components (`QuoteBuilder`, `SendQuoteModal`) updated to log events.
- [x] Edge functions (`send-email`, `stripe-webhook`) updated to log automated backend events.
- [x] UI added to `QuoteDetail` to display the "Activity History" log.

---

### Feature 6: Payment Refund Fix — ✅ DONE
Fixed the endpoint. The frontend now correctly calls the `stripe-refund` edge function instead of the generic `stripe-proxy`, resolving the refund failures.

---

### Feature 7: Quote Follow-up Verification — 🔲 NOT STARTED
No blockers. Can start when ready.

---

### Feature 8: Links & Redirects — 🔲 NOT STARTED (NEW from client Apr 7)
**Status:** Client mentioned this but did not provide details. Need clarification on what links/redirects he wants fixed or changed.

---

### Feature 9: Full Debug — 🔲 NOT STARTED (NEW from client Apr 7)
**Status:** General QA pass requested by client. Will address after feature work is complete.

---

## 📌 OFF-SCOPE — Things to Do Later (Post Phase 2)

1. **Manage Subscription Portal** — "Cancel, downgrade, change payment method" button for subscribers (Stripe Customer Portal integration)
2. **Beta/Free Access System** — Allow Jamie to grant free access to beta testers without them paying
3. **Admin Panel for Subscribers** — Back-office view for Jamie to see all companies/subscribers and manage their access
4. _(reserved)_
5. _(reserved)_
6. _(reserved)_
7. _(reserved)_

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
