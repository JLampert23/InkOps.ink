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
| "Inkops branded password reset email" (unnumbered #1) | T1-D | ✅ Done |
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
**Status:** ⬜ Not started | **Files:** `quote-approval/`, `quote-actions/`, `PublicQuoteApproval.tsx`, `QuoteDetail.tsx`

**Confirmed flow (from Jamie's doc + chat reply):**
- Customer approves quote → artwork section unlocks (only if artwork exists on quote)
- Customer declines quote → artwork section stays locked
- No artwork on quote → artwork approval section grayed out / hidden
- Customer declines artwork → admin sees "Resend for Artwork Approval" button on QuoteDetail
- **Change request flow:** customer requests changes off-platform → admin (user) edits the quote in QuoteBuilder → admin manually re-sends for approval → on re-approval, the existing **work order, scheduler entry, AND invoice all UPDATE in place** (not new ones)

**DB changes:**
```sql
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS artwork_approval_status text DEFAULT 'pending';
-- values: 'not_applicable' | 'pending' | 'sent' | 'approved' | 'declined'
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS artwork_approval_sent_at timestamptz;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS artwork_approved_at timestamptz;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS artwork_declined_at timestamptz;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS artwork_decline_reason text;
```

---

### [3.1-B] Auto Payment Link — 50% minimum, balance on Complete
**Status:** ⬜ Not started | **Files:** `quote-actions/`, `billing-service.ts`, `stripe-proxy/`, `CompanySettings.tsx`

**Confirmed flow (from Jamie's chat reply #5):**
- After quote approval + invoice creation, automatically send payment link to customer
- Payment link is **minimum 50%** — customer can enter ANY amount ≥ 50% if they want to pay more (e.g. full upfront)
- On work order status = "COMPLETE" (the existing PRODUCTION COMPLETE automation), an automation rule fires the **second payment link** for the remaining balance

**DB changes:**
```sql
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS auto_send_payment_link boolean DEFAULT false;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS minimum_deposit_percent integer DEFAULT 50;
```

---

### [3.1-C] Mockup Generator — Click thumbnail to edit + resave
**Status:** ⬜ Not started | **File:** `MockupGenerator.tsx`

**Confirmed (Jamie's doc #4):** click a saved mockup on the left → loads onto canvas → edit → save replaces existing record.

---

### [3.1-D] Custom Save Warning in Quote Builder
**Status:** ⬜ Not started | **File:** `QuoteBuilder.tsx`

**Confirmed (Jamie's doc #5):** custom modal "You have unsaved changes…are you sure you want to continue without saving?" with **[ SAVE ] [ CONTINUE ] [ CANCEL ]** instead of native `beforeunload`.

---

## Items awaiting client clarification ⏳

### [3.1-E] Copy invoice — clear history
**Status:** ⏳ Awaiting Jamie's clarification on what "history" means.
**Source:** Jamie's doc small things #4 ("When i copy an invoice the history should be cleared on that copy").
**Open questions sent:**
- Payment records cleared? Status change log cleared? Both?
- Should the copied invoice start as Draft?

### [3.1-F] Master Scheduler
**Status:** ⏳ Awaiting Jamie's full scope ("still working through it").
**Source:** Jamie's doc #7 — "When quotes are approved they go to master schedule like it is. From there I can move it to its individual schedule as needed when things are ready for production."
**Open questions sent:**
- How does a job move from master → individual scheduler? Drag-drop / row button / batch select?
- Same columns as current scheduler or simpler list view?
- Replace current default scheduler view OR sit alongside as a separate tab?

### [3.1-G] Scheduler — visible tabs along the top instead of dropdown
**Status:** ⬜ Not started — confirmed in Jamie's chat reply #2.
**File:** `ProductionScheduler.tsx` + `SchedulerTabManager.tsx`
**Scope:** replace the current schedule selector dropdown with horizontal tabs across the top of the scheduler page. One tab per saved schedule. Active tab visually distinct.

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

### [3.2-F] Customer portal branding ⏳
**Status:** ⏳ Awaiting Jamie's clarification on what type.
**Source:** Jamie's doc 3.2 #6.
**Open question sent:** logo upload? Color theme picker? Custom subdomain (`portal.toddssportinggoods.com`)? Full white-label (all of the above)?

---

# 🆕 New asks from chat (not in original docs)

### Customer portal link still broken per individual customer
**Status:** ⏳ Awaiting repro details.
**Background:** commit `b0c7013` was supposed to generate a unique token per customer when admin clicks Copy Link. Jamie says it's still not working.
**Open question sent:** what does he see — same link for every customer, error message, broken URL? Which customer did he test? Screenshot if possible.

### Square dashboard removal
**Status:** Acknowledged, not urgent.
**Scope:** remove `src/components/square/SquareReports.tsx` + `SquareCustomers.tsx`, drop their routing entries, remove integration. Estimated: a few hours.

---

# Open Questions Outstanding (waiting on Jamie)

1. **BUG-2 colors** — explicit yes/no on switching Stock Status "Ordered" badge from blue to RED.
2. **Copy invoice** — what specifically should be cleared? Should copy start as Draft?
3. **Master scheduler** — full UX scope (move mechanism, columns, layout).
4. **Customer portal branding** — what type of branding.
5. **Customer portal link bug** — repro details + screenshot.
6. **BUG-3** — screenshot of the address-required error and which screen.

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
