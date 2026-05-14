# InkOps Phase 3.1 + 3.2 — Execution Plan
> Source of truth: client's `phase 3.1.txt` + `phase 3.2.txt` docs.
> Last updated: 2026-05-07.
> Stack: React + TypeScript + Vite | Supabase (Postgres + Edge Functions + Auth) | Stripe | Resend | Deno.
> Branches: `main` → `InkOps-Production` (live, auto-deploys via Netlify) | `dev` → `devs.inkops.ink` (staging).

---

## Strategy
1. Validate today's dev pushes with Jamie → promote to `InkOps-Production`.
2. Build Phase 3.1 remaining items on `dev` → Jamie tests on `devs.inkops.ink` → merge to prod.
3. Phase 3.2 is a separate sprint after 3.1 is signed off.

---

# ✅ Already Shipped (Tier 1 — matches client's doc 1:1)

All deployed to `InkOps-Production`.

| Client doc item | Internal id | Status |
|-----------------|-------------|--------|
| "Inkops branded password reset email" (unnumbered #1) | T1-D | ✅ Done (closeout 2026-05-14: added `/reset-password` route + PASSWORD_RECOVERY handler + branded email HTML at `supabase/email-templates/reset-password.html`. Email template must be pasted into Supabase Dashboard → Auth → Email Templates → Reset Password.) |
| "Quote terms / invoice terms on customer-facing PDFs and emails" (unnumbered #2) | T1-C | ✅ Done |
| "Scheduler sorting — This / Next / Last week" (#3) | T2-A | ✅ Done |
| "Add contact name to the invoice" (small #1) | T1-B | ✅ Done |
| "Upload file button to each work order and quote" (small #2) | T1-F | ✅ Done |
| "Mark each item on garment purchase report as ordered" (small #3) | T1-E | ✅ Done |
| "Filters inside scheduler do not work" (#6) | T1-A | ✅ Done |

---

# ✅ Already Shipped (4/22 minor fixes — billable additions, not in client doc)

These came from chat after the original docs and were billable extras. All on `InkOps-Production`.

| Item | Commit |
|------|--------|
| MF-3 Remove blue mockup builder button from imprints | efc0b6b |
| MF-4 Image upload directly to imprint box | efc0b6b |
| MF-5 Company logo + email signature in outgoing emails | efc0b6b |
| MF-6 State dropdown in customer profile | efc0b6b |
| MF-7 Address autocomplete (browser autofill) | efc0b6b |
| MF-8 Undo "Mark as Ordered" toggle | efc0b6b |
| BUG-1 hypothesis fix (QuoteDetail Qty=0) | b0facd1 (dev — needs validation) |

---

# ✅ Shipped Today (2026-05-07)

## Crisis recovery — Automation pipeline fully restored

Jamie reported automations weren't firing. Diagnosis surfaced 5 separate issues that had been silently breaking each other:

| # | Bug | Fix | Where |
|---|-----|-----|-------|
| 1 | `getWorkflowTracking` console error (PGRST116 on missing row) | `.single()` → `.maybeSingle()` | `production-workflow-service.ts` (commit `64afa7c` → cherry-picked to prod `eccbeb6`) |
| 2 | `send-email` deployed with default `verify_jwt=true` — gateway rejected new `sb_secret_` keys | Added entry to `config.toml` with `verify_jwt = false` | `f198f38` (prod) |
| 3 | `crypto-service` same issue as #2 | Same fix | `b707f6b` (prod) |
| 4 | DB trigger for `work_step_status_changed` was wired to `work_orders` table since codebase inheritance — never fired for scheduler step changes | New `enqueue_scheduler_step_status_automation` trigger on `production_schedule_entries` | Migration `20260507120000_*.sql` (commit `8a11630`, applied via SQL Editor) |
| 5 | Cross-function service-call detection broken — Supabase key migration leaks different env values to different function runtimes | Structural `role: service_role` JWT check in `send-email` and `crypto-service` so bearer doesn't have to byte-match the env | `7c3ae65`, `9812fff` (prod) |

**Also fixed via SQL:** typo in Jamie's "PRODUCTION COMPLETE" automation (`sales@toddssportinggoods,com` → `sales@toddssportinggoods.com`).

End-to-end verification: 3 re-queued automation_queue entries flipped to `status='completed'` and Jamie confirmed receiving all 3 emails.

## BUG-2 — Scheduler status columns

| Step | Status |
|------|--------|
| 2 columns (Stock Status, Art Status) right after Qty | ✅ shipped to dev (`114d9b0`) |
| Stock Status color: Ordered = RED | ⏳ awaiting Jamie's explicit yes/no |
| Partial = YELLOW | ✅ already correct |
| Received = GREEN | ✅ already correct |
| Art Status: Approved = GREEN, Rejected = RED | ✅ already correct |

## WO list — In Production / Completed tabs

| Step | Status |
|------|--------|
| Replace status filter dropdown with In Production / Completed tabs | ✅ shipped to dev (`17cdab7`) |
| Default tab = In Production | ✅ done |
| Confirm with Jamie + promote to prod | ⏳ awaiting validation |

---

# 🟡 Phase 3.1 — In Progress on `dev`

## Items confirmed and ready to build

### [3.1-A] Quote + Artwork Approval Flow ⭐ BIGGEST
**Status:** 📐 Design locked, awaiting client answers on 4 open questions before code | **Files:** `quote-approval/`, `quote-actions/`, `PublicQuoteApproval.tsx`, `QuoteDetail.tsx`
**Estimated effort:** 3–4 days (code + tests + design refinement + manual validation)

**Confirmed flow (from Jamie's doc + chat reply):**
- Customer approves quote → artwork section unlocks (only if artwork exists on quote)
- Customer declines quote → artwork section stays locked
- No artwork on quote → artwork approval section grayed out / hidden (`artwork_approval_status='not_applicable'`)
- Customer declines artwork → admin sees "Resend for Artwork Approval" button on QuoteDetail
- **Change request flow:** customer requests changes off-platform → admin (user) edits the quote in QuoteBuilder → admin manually re-sends for approval → on re-approval, the existing **work order, scheduler entry, AND invoice all UPDATE in place** (not new ones)

**DB changes:**
```sql
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS artwork_approval_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS artwork_approval_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS artwork_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS artwork_declined_at timestamptz,
  ADD COLUMN IF NOT EXISTS artwork_decline_reason text;
-- artwork_approval_status values: 'not_applicable' | 'pending' | 'sent' | 'approved' | 'declined'
```

**State machine:**
```
quote sent → has artwork? → no → status='not_applicable' (done)
                          → yes → status='pending'
   ↓
customer approves quote → UI unlocks artwork section, status stays 'pending'
   ↓
   ├── customer approves artwork → status='approved', artwork_approved_at=now
   └── customer declines artwork → status='declined', artwork_declined_at=now,
                                    artwork_decline_reason=text (optional)
                                    ↓
                                    admin clicks "Resend for Artwork Approval"
                                    ↓
                                    status='pending', clear declined_at, send fresh email
```

**Code changes:**
| File | What changes |
|------|--------------|
| Migration | DB columns above |
| `supabase/functions/quote-approval/index.ts` (GET) | Return `artwork_approval_status`, `artwork_decline_reason`, mockup composite image URLs in payload. |
| `supabase/functions/quote-approval/index.ts` (POST) | New action types: `approve_artwork`, `decline_artwork`. Validate `quote.status='approved'` before allowing artwork actions. Update quote columns. |
| `supabase/functions/quote-actions/index.ts` (`approve` action) | **CRITICAL CHANGE**: detect if quote already has WO/scheduler entries/invoice. If yes, UPDATE existing instead of INSERT new. If no, current INSERT path. |
| `supabase/functions/quote-actions/index.ts` (`resend_artwork_approval` NEW action) | Reset `artwork_approval_status='pending'`, clear `artwork_declined_at`, send approval email. |
| `src/components/production/PublicQuoteApproval.tsx` (customer-facing) | Add Artwork Approval section. Locked until quote approved. Shows mockup composite. Approve / Decline buttons. Decline reason textarea (optional). |
| `src/components/production/QuoteDetail.tsx` (admin) | Add artwork status badge near header. If declined, show reason + "Resend for Artwork Approval" button. Timeline of approval events. |

**Re-approval cascade pseudocode (the risky part):**
```typescript
// In quote-actions/approve action
const existingWO = await supabase.from('work_orders')
  .select('id').eq('quote_id', quoteId).maybeSingle();

if (existingWO) {
  // RE-APPROVAL PATH — update existing
  await updateWorkOrderFromQuote(existingWO.id, quote, lineItems, imprints);
  await replaceSchedulerEntriesForQuote(existingWO.id, imprints); // delete+recreate, simpler
  await updateInvoiceFromQuote(quote.id, lineItems, fees);
} else {
  // FIRST APPROVAL — current INSERT path
  await createWorkOrder(...);
  await createSchedulerEntries(...);
  await createInvoice(...);
}
```

**Open questions sent to Jamie (2026-05-08) — defaults will apply if no reply:**
1. Decline reason required or optional? *(defaulting to optional)*
2. Artwork approval same page as quote approval, or separate link? *(defaulting to same page, locked until approved)*
3. Multi-imprint: approve together or separately? *(defaulting to together)*
4. WO in production at edit time: block or warn? *(defaulting to warn with confirm dialog)*

**Integration test plan (mandatory before merge to prod):**
- `scripts/verify-quote-artwork-flow-happy-path.ts` — create test quote with artwork → send → approve quote → assert artwork unlocks → approve artwork → assert state transitions.
- `scripts/verify-artwork-decline-resend-flow.ts` — approve quote → decline artwork with reason → admin resend → re-approve → assert all state transitions.
- `scripts/verify-reapproval-cascade.ts` — approve → WO+scheduler+invoice created → admin edits → re-send → re-approve → assert SAME ids updated. **Most important test.**
- `scripts/verify-no-artwork-flow.ts` — quote without artwork → approve → assert artwork status='not_applicable' and no artwork UI shown.

---

### [3.1-B] Auto Payment Link — 50% minimum, balance on Complete
**Status:** 📐 Design locked, awaiting client answer on 1 open question before code | **Files:** `quote-actions/`, `billing-service.ts`, `stripe-proxy/`, `create-payment-link/` (new), `stripe-webhook/`, `CompanySettings.tsx`, `InvoiceDetail.tsx`
**Estimated effort:** 1.5–2 days (code + tests + manual validation)

**Confirmed flow (from Jamie's chat reply #5):**
- After quote approval + invoice creation, automatically send payment link to customer
- Payment link is **minimum 50%** — customer can enter ANY amount ≥ 50% (Stripe handles via `custom_unit_amount.minimum`)
- On work order status = "COMPLETE" (existing PRODUCTION COMPLETE automation), automation rule fires the **second payment link** for the remaining balance

**DB changes:**
```sql
ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS auto_send_payment_link boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS minimum_deposit_percent integer DEFAULT 50;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS deposit_payment_link_id text,
  ADD COLUMN IF NOT EXISTS deposit_payment_link_url text,
  ADD COLUMN IF NOT EXISTS balance_payment_link_id text,
  ADD COLUMN IF NOT EXISTS balance_payment_link_url text;
```

**Code changes:**
| File | What changes |
|------|--------------|
| Migration | DB columns above |
| `supabase/functions/create-payment-link/index.ts` (NEW) | Stripe Payment Link API call with `custom_unit_amount.minimum = total * minPct/100` and `preset = same`. Returns `{ id, url }`. Uses encrypted Stripe key per company. |
| `supabase/functions/quote-actions/index.ts` (`approve` action) | After invoice created: if `company_settings.auto_send_payment_link=true`, call create-payment-link for the deposit, save link id+url on invoice, send email with link. |
| `supabase/functions/process-automation-queue/index.ts` (new action OR piggyback `send_message`) | Action triggered on `work_order_invoice_status_changed='COMPLETE'`. Calculates remaining balance, generates second payment link, emails customer. |
| `supabase/functions/stripe-webhook/index.ts` | Add handling for `checkout.session.completed` from payment links (since payment links don't fire `invoice.paid` directly). Records payment in `payments` table. |
| `src/components/settings/CompanySettings.tsx` | Toggle for `auto_send_payment_link`, numeric input for `minimum_deposit_percent`. |
| `src/services/billing-service.ts` | Helper `outstanding_balance(invoice_id) = invoice.total - sum(payments.where(status='succeeded').amount)`. |
| `src/components/billing/InvoiceDetail.tsx` | Show payment link status badges (Deposit Sent / Deposit Paid / Balance Sent / Paid in Full). |

**Edge case logic:**
- Customer pays 100% via deposit link → `outstanding_balance(invoice) = 0` → skip second link on Complete trigger.
- Refunds — already handled in `stripe-refund/`. `outstanding_balance` always reads current `payments` state, so a refund automatically unhides the balance link path.
- Tax — open question (see below).

**Open question sent to Jamie (2026-05-08) — default applies if no reply:**
1. Deposit % calculated **before tax** or **after tax (total)**? *(defaulting to after tax — % of grand total)*

**Integration test plan (write before merge to prod):**
- `scripts/verify-deposit-link-flow.ts` — create test quote → approve via quote-actions → assert invoice has `deposit_payment_link_url` → simulate Stripe webhook for partial payment → assert `payments` row created → assert `outstanding_balance` updated.
- `scripts/verify-balance-link-flow.ts` — load fixture invoice with deposit paid → mark linked WO `COMPLETE` → assert automation_queue entry → assert `balance_payment_link_url` populated and emailed.
- Run both against the dev Supabase project (Stripe in test mode).

---

### [3.1-C] Mockup Generator — Click thumbnail to edit + resave
**Status:** 🟡 Built locally (uncommitted on `dev`) — needs Jamie validation. | **File:** `MockupGenerator.tsx`

**Confirmed (Jamie's doc #4):** click a saved mockup on the left → loads onto canvas → edit → save replaces existing record.

**What was found (honest):** the feature was already built for new-format mockups stored as `{url, proof_id}` objects. Clicking calls `loadExistingProof(proofId)` which loads artwork onto the canvas, and `handleSave` correctly UPDATEs the existing proof when `proofId` is set. The gap was **legacy mockups stored as plain string URLs** — clicking those did nothing because there's no `proof_id` linkage to follow.

**Fix:** modified the click handler. When a legacy string-format mockup is clicked, queries `proofs` table for a row where `composite_image_url = mockupUrl` to recover the proof_id, then calls `loadExistingProof(recoveredProofId)`. If no matching proof is found (truly orphaned mockup), logs a warning. New-format mockups continue to use the direct proof_id path.

---

### [3.1-D] Custom Save Warning in Quote Builder
**Status:** 🟡 Built locally (uncommitted on `dev`) — needs Jamie validation on devs.inkops.ink. | **File:** `QuoteBuilder.tsx`

**Confirmed (Jamie's doc #5):** custom modal "You have unsaved changes…are you sure you want to continue without saving?" with **[ SAVE ] [ CONTINUE ] [ CANCEL ]** instead of native `beforeunload`.

**Implementation:**
- Added `hasUnsavedChanges` state + `showUnsavedChangesModal` state + `skipDirtyCheckRef` ref.
- `useEffect` watches all user-editable state (customer/contact, quote metadata, billing/shipping, line items, fees, imprints, totals tax). First run skipped via ref so initial mount + DB hydration don't false-positive.
- `loadQuote` resets the dirty flag on completion (clean baseline).
- `handleSave` and `handleSaveAndClose` reset dirty flag on success.
- `handleCancel` checks `hasUnsavedChanges`; if true, opens the modal instead of immediately closing.
- Modal has 3 actions: **Save** (calls `performSave`, resets dirty, calls `onSave`), **Continue without saving** (calls `proceedWithCancel`), **Cancel** (closes modal, stays in editor).

**Typecheck:** clean — no new errors introduced (existing TS6133/TS2339 noise in unrelated lines).

---

## Items awaiting client clarification ⏳

### [3.1-E] Copy QUOTE — produce a clean copy with no related data
**Status:** 🟡 Built locally (uncommitted on `dev`) — needs edge function redeploy + Jamie validation.
**Source:** Jamie's chat reply: *"i think i ment copy quote — and when a quote is copied it should just copy the quote itself nothing else"*
**File:** `supabase/functions/quote-actions/index.ts` (`duplicate` action)

**What I found:** the existing duplicate handler was already correctly creating a draft quote, copying line items, and copying imprints. BUT it was also copying **proofs** and **proof_artwork** — the artwork approval history records (with prior approve/decline state, customer signatures, version history). Those don't make sense for a brand-new draft quote and are exactly the "history" Jamie wanted gone.

**Implementation:**
- Removed `originalProofs` fetch.
- Removed the entire proofs + proof_artwork copy block.
- Removed the now-unused `imprintIdMap` (only ever used to wire proofs to new imprint ids).
- Quote duplicate now copies: quote header (status='draft'), line items (price_locked=true), imprints. Nothing else.
- Code still does NOT trigger any cascading WO / scheduler / invoice creation — those are gated on quote.status='approved', and our new copy is 'draft'.

**Note on quote_fees:** the existing duplicate code was NEVER copying quote_fees. That's arguably a separate bug (fees are part of the quote pricing). Left untouched per Jamie's "nothing else" intent — flag for follow-up if he notices missing fees on a copy.

**Deploy step needed before testing:**
```bash
npx supabase functions deploy quote-actions --project-ref cuaukcvccxvfpuxaciac
```

### [3.1-F] Master Scheduler
**Status:** ⏳ Awaiting Jamie's full scope ("still working through it").
**Source:** Jamie's doc #7 — "When quotes are approved they go to master schedule like it is. From there I can move it to its individual schedule as needed when things are ready for production."
**Open questions sent:**
- How does a job move from master → individual scheduler? Drag-drop / row button / batch select?
- Same columns as current scheduler or simpler list view?
- Replace current default scheduler view OR sit alongside as a separate tab?

### [3.1-G] Scheduler — visible tabs along the top instead of dropdown
**Status:** 🟡 Built locally (uncommitted on `dev`) — needs Jamie validation on devs.inkops.ink.
**File:** `ProductionDashboard.tsx`
**Scope (final):** the dropdown Jamie was referring to was the **Type of Work** dropdown that switches between work types (Screen Print / Embroidery / etc.) on the Scheduling AND Kanban Calendar views — NOT the saved-tab manager (that's already tabs). Replaced both dropdowns with horizontal tab buttons.

**Implementation:**
- Scheduling view: row of tabs, one per active type_of_work. No "View All" (matches existing dropdown behavior — the scheduler always picks the first one if 'all' was selected).
- Kanban Calendar view: same row of tabs, plus a "View All" tab at the start (matches existing dropdown behavior).
- Active tab: blue text + blue bottom border + light blue tint background.
- Tabs use `overflow-x-auto` so 5+ work types scroll horizontally instead of wrapping.

**Typecheck:** clean — no errors in ProductionDashboard.tsx.

---

## Items shipped to dev awaiting validation

### BUG-1 — QuoteDetail Qty=0
**Status:** 🟡 Pushed to `dev` (commit `b0facd1`). Hypothesis fix: aligned QuoteDetail's qty formula to QuoteBuilder's `sizeQty + total_quantity`. Not yet validated against Jamie's reproduction case. If still broken, dig into how QuoteBuilder writes the value rather than how QuoteDetail reads it.

### BUG-3 — Customer Address Line 1 required
**Status:** ⏳ Cannot reproduce. Investigated all customer create/edit forms — nothing currently requires address. DB column is nullable. Need Jamie to send a screenshot + screen name where he sees the validation error.

---

# 🔵 Phase 3.2 — Future Sprint (after 3.1 sign-off)

### [3.2-A] User Subscription Dashboard (end-user self-service)
**Status:** Confirmed (chat reply #6).
**Scope:** each user can manage their own subscription from Account Settings — upgrade / downgrade / cancel, change payment method or card type, view monthly paid invoices.
**Files:** `create-subscription-checkout/`, `SubscriptionContext.tsx`, new settings page section.

### [3.2-B] Beta tester access (indefinite)
**Status:** Confirmed (chat reply #7).
**Scope:** admin (Jamie) adds emails to a beta-tester list in admin settings; those users bypass paid-tier checks indefinitely.
**Implementation:** flag column on `user_profiles` (e.g. `is_beta_tester`); subscription gate checks this flag before enforcing paid tier.

### [3.2-C] Security — Noindex public links + secure account data
**Status:** Confirmed (Jamie's doc 3.2 #3).
**Scope:**
- Add `<meta name="robots" content="noindex, nofollow">` to `PublicQuoteApprovalPage.tsx` + public invoice + proof pages.
- Add `X-Robots-Tag: noindex` response header in edge functions serving public pages.
- Audit account data security — confirm payment info is Stripe-tokenized only and never stored locally.

### [3.2-D] Speed optimization
**Status:** Confirmed (Jamie's doc 3.2 #4).
**Scope:**
- Garment lookup in QuoteBuilder: debounce (300ms) + cache results in sessionStorage.
- MockupGenerator: lazy-load canvas library only when modal opens.

### [3.2-E] Customer portal full overhaul
**Status:** Confirmed (Jamie's doc 3.2 #5).
**Scope:** full debug + feature build — customers can store payment info properly, see all open/unpaid invoices, view past quotes, proofs, paid invoices, contacts.
**Files:** `portal-data/`, `portal-payment/`, `portal-proof-approval/`, `customer-payment-methods/`, `CustomerPortalPage.tsx`.

### [3.2-G] Admin subscription oversight dashboard
**Status:** ⬜ Not started — added by us (not in Jamie's doc, but operational need).
**Scope:** dashboard for the platform admin (you) to:
- See all users' subscription tiers and statuses
- Manually upgrade / downgrade / cancel any user's subscription
- Track monthly Stripe revenue (total + per-tier breakdown)
- Toggle beta-tester flag on individual users (overlaps with [3.2-B])
**Files:** new admin page (e.g. `src/components/admin/SubscriptionAdmin.tsx`), Stripe revenue query via `stripe-proxy`, RLS guard requiring `super_admin` role.
**Note:** keep this scoped to YOU running the platform — not customer-facing. Hide behind super_admin role check.

---

### [3.2-F] Customer portal branding — company logo
**Status:** ⬜ Not started — confirmed scope.
**Source:** Jamie's chat reply: *"I want the portal to have the company name so the customers portal that are my customers should see a todds logo"*
**Scope:** when a customer accesses the portal, they should see the company's logo (and company name). Logo is sourced from `company_settings.company_logo_primary_url` (already exists). No subdomain or color theme requested — just logo + company name on the portal pages.
**Files:** portal templates / `CustomerPortalPage.tsx` / portal layout component.

---

# 🐛 Bugs found by Jamie during dev validation (2026-05-08)

### Email spam — every step status change firing email ✅ FIXED
**Status:** ✅ Pushed to prod (commit `d22395d` on 2026-05-09).
**Root cause:** old client-side code in `ProductionScheduler.tsx` was calling `supabase.rpc('queue_matching_automations', ...)` on every step change, ignoring `trigger_config.status_name` filter. Was masked by JWT bugs silently failing emails — once JWT fixed, over-firing started actually delivering. Removed the client-side enqueue. DB trigger from May 7 already enqueues correctly with target-status filter.

### QTE-0059 group order swaps between Quote Viewer and Quote Builder
**Status:** 🟡 Built locally on dev (uncommitted). Awaiting Jamie validation on QTE-0059 specifically.
**File:** `src/components/production/QuoteDetail.tsx`
**Root cause:** QuoteDetail sorted line items by `created_at`, QuoteBuilder by `sort_order`. The former ignores user-controlled ordering set when reordering groups in the editor.
**Fix:** changed QuoteDetail's query to `.order('sort_order', { ascending: true })` to match QuoteBuilder. Both views now derive group order from the same column the user controls.

---

# 📋 Jamie's May 8 follow-up requests (validation feedback)

| Item | Original status | Follow-up needed |
|------|----------------|------------------|
| BUG-2 Stock Status colors | ✅ on prod | 🔴 Hook "marked ordered" → check-in module workflow (partial check-in = yellow, full = green) |
| WO list tabs | ✅ on prod | 🟡 Remove 4 stat cards above table (built on dev, uncommitted) |
| QuoteBuilder unsaved-changes modal | ✅ on prod (cancel button only) | 🟡 Extended on dev — same modal now fires from in-app nav clicks (sidebar tabs, sub-tabs, customers link, settings) via NavigationGuardContext + browser-level via beforeunload. Awaiting Jamie validation. |
| Scheduler / Kanban tabs | ✅ on prod | None — fully approved |
| Mockup click-to-edit | ✅ on prod | None — fully approved |
| Copy Quote | ✅ on prod | None — fully approved |
| Square hidden | ✅ on prod | None — fully approved |

---

# 🆕 New asks from chat (not in original docs)

### Customer portal link still broken per individual customer ✅ FIXED
**Status:** ✅ Fixed + deployed (2026-05-09). No client repro needed — root cause was visible in code.
**Root cause:** the `EditCustomerModal` "Copy Portal Link" button was already fixed (uses `create_portal_session_by_customer_id` RPC). But the SEPARATE "Send Welcome Email" button in the same modal triggered the `send-customer-portal-welcome` edge function, which was still calling the OLD `create_portal_session(p_email)` RPC. That older RPC has a documented bug (see migration `20260430120000`): when two customers share an email or when `customers.email` is empty (address only on the primary contact), the email-based lookup picks the wrong customer or the same customer for everybody. Result: every welcome email got a token tied to the wrong customer.
**Fix:** swapped the RPC call in `send-customer-portal-welcome/index.ts` to `create_portal_session_by_customer_id(p_customer_id)` — the customer UUID is already in the request body. Same return shape, no other changes. Deployed.
**Note:** `send-magic-link/index.ts` still uses the old RPC, but that's customer-self-initiated (only email available, no customer_id). Different problem — would require a "which account?" UX picker. Left for later.

### Square dashboard — HIDE the UI (soft remove)
**Status:** ⬜ Not started — confirmed scope.
**Source:** Jamie's chat reply: *"lets hold off can you just remove the UI so it is not visible?"*
**Scope:** remove the navigation entries / menu items / route registrations that expose Square pages to the user. Keep `src/components/square/SquareReports.tsx` and `SquareCustomers.tsx` files intact (and their service code) so we can flip it back on later without rebuilding.
**Implementation:** find where Square is added to nav (likely `App.tsx` routes + sidebar/menu component) and remove those lines.

---

# Open Questions Outstanding (waiting on Jamie)

1. ~~BUG-2 colors~~ ✅ Confirmed YES (2026-05-08) — promote color fix from dev to prod.
2. ~~Copy invoice~~ ✅ Re-scoped to Copy QUOTE — see [3.1-E].
3. **Master scheduler** — full UX scope (move mechanism, columns, layout). Still pending.
4. ~~Customer portal branding~~ ✅ Confirmed = company logo on portal — see [3.2-F].
5. **Customer portal link bug** — repro details + screenshot. Jamie just confirmed it's still broken in his 2026-05-08 reply ("the link does not seem to be specific to each customer") but didn't send repro yet.
6. **BUG-3** — screenshot of the address-required error and which screen. Still pending.

---

# Execution Order

```
TODAY (already shipped)
├── Automation pipeline crisis recovery (5 separate fixes)
├── BUG-2 scheduler columns (color fix awaiting confirmation)
└── WO list tabs (awaiting validation)

NEXT (immediate, dev branch)
└── Phase 3.1 remaining — pick top priority once Jamie answers open questions
    Order suggestion (lightest → heaviest):
    ├── [3.1-D] Save warning modal
    ├── [3.1-G] Scheduler visible tabs
    ├── [3.1-C] Mockup click-to-edit
    ├── [3.1-B] Auto payment link 50/100
    └── [3.1-A] Quote + Artwork Approval flow ⭐ (biggest)

AWAITING CLIENT
├── [3.1-E] Copy invoice clarification
├── [3.1-F] Master scheduler scope
└── Customer portal link bug repro

PHASE 3.2 (after 3.1 wraps)
├── [3.2-A] Subscription dashboard
├── [3.2-B] Beta tester access
├── [3.2-C] Security
├── [3.2-D] Speed
├── [3.2-E] Customer portal overhaul
└── [3.2-F] Customer portal branding
```
