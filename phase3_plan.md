# InkOps Phase 3.1 + 3.2 — Technical Execution Plan
> Last Updated: 2026-04-22
> Stack: React + TypeScript + Vite | Supabase (Postgres + Edge Functions + Auth) | Stripe | Resend (email) | Deno edge runtime
> Repo root: `c:\CODE_26\InkOps.ink`
> Production URL pattern: `https://{subdomain}.inkops.ink`

---

## Project Structure (Key Paths)

```
src/
  components/
    billing/          InvoiceDetail.tsx, BillingQueue.tsx, ManualPaymentModal.tsx
    production/       ProductionScheduler.tsx, QuoteBuilder.tsx, QuoteDetail.tsx,
                      MockupGenerator.tsx, WorkOrderDetail.tsx, WorkOrdersList.tsx,
                      PublicQuoteApproval.tsx, PublicQuoteApprovalPage.tsx
    purchase-orders/  GarmentOrderReport.tsx
    accounting/       PaidInvoices.tsx
  services/           billing-service.ts, invoice-detail-service.ts, scheduler-service.ts, ...
  utils/              invoice-pdf-export.ts, quote-pdf-export.ts
supabase/
  functions/
    quote-approval/   index.ts  ← handles GET (fetch quote data) + POST (approve/reject)
    quote-actions/    index.ts  ← creates WO, scheduler entry, invoice after approval
    request-password-reset/  index.ts  ← CUSTOM password reset for customer portal
    send-invoice/     index.ts  ← sends billing email to customer
    record-manual-payment/   index.ts
    send-email/       index.ts  ← generic email sender
    _shared/          ← shared utilities used across edge functions
```

---

## Strategy
Small things (Tier 1) → Medium features (Tier 2) → Heavy features (Tier 3) → Phase 3.2

---

# 🟢 TIER 1 — Small Things (Do First)

---

## [T1-A] Fix Broken Scheduler Column Filters
**Status:** ⬜ Not started | **Priority:** 1st

### What's broken
The ≡ filter icon buttons on workflow step columns in the Production Scheduler open a dropdown but selecting filter options does NOT visually filter the rows displayed.

### Root cause (verified)
The filter pipeline is fully wired:
- `openColumnMenu` state toggles the dropdown ✅
- `e.stopPropagation()` is already on the button ✅
- `stepStatusFilters: Record<string, string[]>` state is updated when checkboxes are clicked ✅
- `filteredEntries = useMemo(...)` at line 363 reads `stepStatusFilters` ✅
- Line 371: `const entryStatus = entry.step_statuses[stepId]` — each entry has `step_statuses: Record<string, string>` ✅
- Table renders `filteredEntries.map(...)` at line 643 ✅

**The likely bug:** When `stepStatusFilters` has a key with an **empty array** (after user clicks "Clear"), the useMemo check at line 364 only returns early if `Object.keys(stepStatusFilters).length === 0` — but after Clear the key still exists with `[]`. This means the filter tries to match against an empty array and hides ALL rows. Also check: if a step column has no status set for an entry (`entry.step_statuses[stepId]` is `undefined`), those entries get incorrectly hidden.

### File
`src/components/production/ProductionScheduler.tsx`

### Fix
In the `filteredEntries` useMemo (around line 363-379), update the logic to:
1. Skip filter for any step where `stepStatusFilters[stepId].length === 0` (empty = no filter)
2. When comparing, if `entryStatus` is undefined/null and the filter is active, decide whether to include or exclude (recommend: exclude — entry has no status set for that step)

```typescript
// Corrected filteredEntries logic
const filteredEntries = useMemo(() => {
  const activeFilters = Object.entries(stepStatusFilters).filter(([_, v]) => v.length > 0);
  if (activeFilters.length === 0) return entries;
  return entries.filter(entry => {
    for (const [stepId, statuses] of activeFilters) {
      const entryStatus = entry.step_statuses?.[stepId];
      if (!entryStatus || !statuses.includes(entryStatus)) return false;
    }
    return true;
  });
}, [entries, stepStatusFilters]);
```

---

## [T1-B] Add Contact Name to Customer-Facing Invoice Email
**Status:** ⬜ Not started | **Priority:** 2nd

### Current state
- `invoice.contact.name` is shown on the InvoiceDetail UI screen ✅
- `invoice.contact.name` renders in the downloadable PDF ✅
- **MISSING:** The customer-facing invoice email HTML sent by `supabase/functions/send-invoice/index.ts` — unknown if contact name is included

### Fix
Open `supabase/functions/send-invoice/index.ts`, find the email HTML template, locate the "Bill To" section, and add `contact_name` above the company name. The data should already be available in the function's payload — check what fields are passed to the function from `billing-service.ts → sendInvoiceEmail()`.

---

## [T1-C] Quote Terms + Invoice Terms in Customer Emails
**Status:** ⬜ Not started | **Priority:** 3rd

### Current state (verified)

**Invoice PDF** (`src/utils/invoice-pdf-export.ts`):
- `invoiceTerms` option declared, `hasInvoiceTerms` block renders at bottom of PDF ✅
- `InvoiceDetail.tsx` passes `invoiceTerms: companySettings?.invoice_terms` to PDF call ✅
- **ALREADY WORKING — just needs live testing to confirm**

**Quote PDF** (`src/utils/quote-pdf-export.ts`):
- `quote.quote_terms` renders at bottom via `hasQuoteTerms` block ✅
- **ALREADY WORKING — just needs live testing to confirm**

**Quote approval email** (`supabase/functions/quote-approval/index.ts`):
- Line ~463 fetches company_settings but only selects: `company_name, logo_url, company_logo_primary_url, company_email, company_phone, company_website`
- `quote_terms` is NOT in the SELECT — **MISSING**
- Line 236: email shows `quote.terms` (short per-quote payment terms) but NOT the full company T&C

**Invoice email** (`supabase/functions/send-invoice/index.ts`):
- Unknown if `invoice_terms` from company_settings is appended — **needs investigation**

### Fix

**Step 1 — Quote approval email:** In `quote-approval/index.ts`, change the company_settings SELECT to include `quote_terms`:
```typescript
// Around line 463 — ADD quote_terms to the select
const { data: companySettings } = await supabase
  .from("company_settings")
  .select("company_name, logo_url, company_logo_primary_url, company_email, company_phone, company_website, quote_terms")
  .eq("id", approval.company_id)
  .maybeSingle();
```
Then in the email HTML body, before the closing `</body>`, append:
```typescript
${companySettings?.quote_terms ? `
  <div style="margin-top:40px; padding-top:20px; border-top:1px solid #e5e7eb;">
    <p style="font-size:12px; color:#6b7280; font-weight:600;">TERMS &amp; CONDITIONS</p>
    <div style="font-size:12px; color:#6b7280;">${companySettings.quote_terms}</div>
  </div>` : ''}
```

**Step 2 — Invoice email:** Open `send-invoice/index.ts`, add `invoice_terms` to company_settings fetch, append same pattern to bottom of email HTML.

**Step 3 — Test:** Download a quote PDF and invoice PDF on the live site to confirm terms already render (they should based on code).

---

## [T1-D] InkOps Branded Password Reset Email (Admin Users)
**Status:** ⬜ Not started | **Priority:** 4th

### Important context
There are TWO separate password reset flows in this system:

1. **Customer portal reset** (`supabase/functions/request-password-reset/index.ts`) — already branded, uses Resend API, sends link to `${subdomain}.inkops.ink/portal/reset-password?token=...` ✅ **This one works.**

2. **Admin user reset** (via Supabase Auth built-in) — this is what the client (Todd) uses to log in to the InkOps admin panel. Supabase sends its own default reset email. The redirect URL currently points to `inkopsink.bolt.host` (old URL) → **This is broken.**

### Fix
The admin reset email is controlled by Supabase Auth settings — NOT by code in the repo.

**Fix in Supabase Dashboard (not in code):**
1. Go to Supabase Dashboard → Authentication → Email Templates → "Reset Password"
2. Update the HTML template with InkOps branding (logo, colors)
3. The `{{ .ConfirmationURL }}` token in the template is the reset link — ensure it redirects to the correct production domain
4. Go to Authentication → URL Configuration:
   - Set **Site URL** to `https://inkops.ink` (or the admin's specific domain)
   - Add production domain to **Additional Redirect URLs**
5. If `supabase/config.toml` has a `[auth]` → `site_url` field, update it to production domain too

**Also check:** `src/components/auth/` — find where the admin password reset form is. When calling `supabase.auth.resetPasswordForEmail(email, { redirectTo: '...' })`, make sure the `redirectTo` URL is the production domain, not bolt.host.

---

## [T1-E] Mark Items on Garment Purchase Report as Ordered
**Status:** ⬜ Not started | **Priority:** 5th

### Current state
- **File:** `src/components/purchase-orders/GarmentOrderReport.tsx`
- `quantity_ordered` field tracks how many units are on a PO (already exists)
- Checkboxes at lines 789–816 are for **size selection** (which sizes to include), NOT for marking as ordered
- No `is_ordered` boolean per line item exists

### Fix

**Step 1 — DB migration:**
```sql
-- Check first: SELECT column_name FROM information_schema.columns WHERE table_name = 'purchase_order_items';
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS is_ordered boolean DEFAULT false;
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS ordered_at timestamptz;
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS ordered_by text;
```

**Step 2 — UI in GarmentOrderReport.tsx:**
Add a checkbox column to each row. On check:
```typescript
await supabase
  .from('purchase_order_items')
  .update({ is_ordered: true, ordered_at: new Date().toISOString() })
  .eq('id', item.id);
```

**Step 3 — Visual feedback:** When `is_ordered = true`, show a green "Ordered" badge on the row. When all items on a PO are ordered, show a green "Fully Ordered" badge on the PO header.

---

## [T1-F] File Upload Button on Work Orders and Quotes
**Status:** ⬜ Not started | **Priority:** 6th

### Current state
- `src/components/production/QuoteDetail.tsx` — NO file upload ❌
- `src/components/production/WorkOrderDetail.tsx` — NO file upload ❌
- No attachments table exists in DB

### Fix

**Step 1 — DB migration:**
```sql
CREATE TABLE IF NOT EXISTS attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id),
  reference_type text NOT NULL, -- 'quote' | 'work_order'
  reference_id uuid NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size integer,
  mime_type text,
  uploaded_by text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX ON attachments(reference_type, reference_id);
```

**Step 2 — Supabase Storage:** Create bucket `attachments` (private, with signed URL access).

**Step 3 — Reusable component:** Create `src/components/shared/AttachmentsSection.tsx`:
- Props: `referenceType: 'quote' | 'work_order'`, `referenceId: string`, `companyId: string`
- Upload: `supabase.storage.from('attachments').upload(path, file)`
- List: fetch from `attachments` table filtered by `reference_type` + `reference_id`
- Download: generate signed URL via `supabase.storage.from('attachments').createSignedUrl(path, 3600)`

**Step 4:** Import and render `<AttachmentsSection>` in both `QuoteDetail.tsx` and `WorkOrderDetail.tsx`.

---

# 🟡 TIER 2 — Medium Features

---

## [T2-A] Scheduler Sorting (This Week / Next Week / Last Week)
**Status:** ⬜ Not started
**File:** `src/components/production/ProductionScheduler.tsx`

### Current state
- `startDate` / `endDate` state controls the DB query date range
- Existing query already applies date range filtering

### Fix
Add 3 buttons to the scheduler header bar. Each calls a helper that sets `startDate`/`endDate`:

```typescript
const setWeekRange = (offset: -1 | 0 | 1) => {
  const today = new Date();
  const day = today.getDay(); // 0=Sun, 1=Mon...
  const monday = new Date(today);
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  setStartDate(monday.toISOString().split('T')[0]);
  setEndDate(sunday.toISOString().split('T')[0]);
};
```

Buttons: `Last Week` (offset -1) | `This Week` (offset 0) | `Next Week` (offset 1)

---

## [T2-B] Custom Save Warning in Quote Builder
**Status:** ⬜ Not started
**File:** `src/components/production/QuoteBuilder.tsx`

### What's needed
Replace native browser "Leave site?" with custom modal: **"You have unsaved changes. Are you sure you want to continue without saving?"** with **[ SAVE ] [ CONTINUE ] [ CANCEL ]** buttons.

### How to implement
1. Add `const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)` — set to `true` whenever any quote field is modified, `false` after a successful save
2. Add `useBlocker` from React Router (if using React Router v6.7+) or use a `useEffect` with `window.addEventListener('beforeunload', handler)` as fallback
3. When blocker is triggered, show a custom modal instead of the native browser dialog
4. "SAVE" → call existing save function → navigate; "CONTINUE" → allow navigation; "CANCEL" → dismiss modal, stay on page
5. Check which version of React Router is installed: `grep -r "react-router" package.json`

---

## [T2-C] Mockup Generator: Click Existing Mockup to Edit + Resave
**Status:** ⬜ Not started
**File:** `src/components/production/MockupGenerator.tsx`

### What's needed
**Current:** You can upload new artwork but CANNOT click a saved mockup thumbnail on the left panel to load it back onto the canvas.
**Goal:** Click imprint on left → saved mockup loads onto canvas → edit (resize/reposition) → Save → replaces old mockup in DB.

### How to implement
1. In the left imprint panel, make each saved mockup `<img>` thumbnail clickable
2. On click: call the canvas library (check if it's Fabric.js or Konva) to load the image URL onto the canvas — e.g., `fabric.Image.fromURL(mockupUrl, (img) => canvas.add(img))`
3. Store a reference to which imprint is being edited (`editingImprintId`)
4. On Save: if `editingImprintId` is set, UPDATE the existing mockup record instead of creating a new one

---

## [T2-D] Goods Ordered / Goods Received Auto-Column in Scheduler
**Status:** ⬜ Not started
**Depends on:** T1-E (is_ordered column) being done first

### Files
- `src/components/production/ProductionScheduler.tsx`
- `src/components/purchase-orders/GarmentOrderReport.tsx`
- DB: `production_schedule_entries` table

### Fix
**Step 1 — DB:**
```sql
ALTER TABLE production_schedule_entries ADD COLUMN IF NOT EXISTS goods_status text DEFAULT 'pending';
-- values: 'pending' | 'ordered' | 'received'
```

**Step 2 — Auto-update trigger:** Create a Postgres function that runs when `purchase_order_items.is_ordered` changes. If ALL items for a quote are `is_ordered = true`, update `production_schedule_entries.goods_status = 'ordered'` for that quote's entries. Similarly for received (link to existing receiving logic in `supabase/functions/` — check `receiving-service.ts`).

**Step 3 — Scheduler column:** Add a "Goods" column in `ProductionScheduler.tsx` showing badge: grey = Pending, blue = Ordered, green = Received.

---

# 🔴 TIER 3 — Heavy Features

---

## [T3-A] Auto Payment Link (50% or 100%) After Invoice Created
**Status:** ⬜ Not started

### Files
- `supabase/functions/quote-actions/index.ts` — invoice is created here after quote approval
- `src/services/billing-service.ts` — `generatePaymentLink()` and `createStripeInvoice()` exist here
- `supabase/functions/stripe-proxy/index.ts` — Stripe API calls go through here
- `src/components/settings/CompanySettings.tsx` — add new settings fields here

### Fix
1. Add to `company_settings` table:
```sql
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS auto_send_payment_link boolean DEFAULT false;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS default_payment_split text DEFAULT '100'; -- '50_100' | '100'
```
2. In `quote-actions/index.ts`, after invoice + billing_queue entry created: check `auto_send_payment_link` setting → if true, generate payment links and send email
3. For 50%: calculate `amount * 0.5`, create Stripe Payment Link for that amount
4. For 100%: use full amount
5. Email template shows both options with CTA buttons

---

## [T3-B] Quote + Artwork Approval Flow ⭐ BIGGEST FEATURE
**Status:** ⬜ Not started

### Files
- `supabase/functions/quote-approval/index.ts` — add artwork approval logic
- `src/components/production/PublicQuoteApproval.tsx` — customer-facing, add art approval UI
- `src/components/production/PublicQuoteApprovalPage.tsx` — wrapper page
- `src/components/production/QuoteDetail.tsx` — admin side: status badges + resend button
- `supabase/functions/quote-actions/index.ts` — handle re-approval cascade

### DB changes
```sql
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS artwork_approval_status text DEFAULT 'pending';
-- values: 'not_applicable' | 'pending' | 'sent' | 'approved' | 'declined'
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS artwork_approval_sent_at timestamptz;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS artwork_approved_at timestamptz;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS artwork_declined_at timestamptz;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS artwork_decline_reason text;
```

### Logic rules
- `1a` Quote approved → artwork section unlocks (if artwork exists on quote)
- `1b` Quote declined → artwork section stays locked
- `1c` No artwork on quote (`imprints` have no mockup/artwork files) → artwork section hidden
- `1d` Art declined → admin QuoteDetail shows "Resend for Artwork Approval" button
- `1e` Customer requests changes after approval → `quote.status` resets to pending → new approval email sent → on re-approval: `quote-actions` updates WO, scheduler entries, invoice line items

### How artwork existence is checked
Query `quote_imprints` table for the quote. Check if any imprint has a non-null `artwork_url` or mockup. If none → `artwork_approval_status = 'not_applicable'`.

---

# 🔵 PHASE 3.2 — Future Sprint (after 3.1 complete)

## [P3.2-1] Subscription Dashboard
- Admin UI to manage user subscriptions, assign beta testers (give full access without payment), track monthly Stripe revenue
- Relevant: `supabase/functions/create-subscription-checkout/index.ts`, `src/contexts/SubscriptionContext.tsx`

## [P3.2-2] Security — Noindex Public Links
- Quote, invoice, and proof pages are public URLs — must not appear in Google
- **Quick fix:** Add `<meta name="robots" content="noindex, nofollow">` to `PublicQuoteApprovalPage.tsx` and any public invoice page
- For extra security: add `X-Robots-Tag: noindex` response header in edge functions that serve public pages

## [P3.2-3] Speed Optimization
- Garment lookup in QuoteBuilder: add debounce (300ms) + cache results in sessionStorage
- MockupGenerator: lazy-load the canvas library (Fabric.js/Konva) only when modal opens
- Files: `src/components/production/QuoteBuilder.tsx`, `src/components/production/MockupGenerator.tsx`

## [P3.2-4] Customer Portal Full Overhaul
- Customers view unpaid invoices, past quotes, proofs, paid invoices, contacts; store payment methods
- Existing portal edge functions: `portal-data/`, `portal-payment/`, `portal-proof-approval/`, `customer-payment-methods/`

## [P3.2-5] Customer CSV Upload from Printavo
- Parse Printavo CSV export and map to `customers` table
- Create: new settings page section + `supabase/functions/import-customers/index.ts` edge function

---

# ✅ Execution Order

```
TIER 1 — Small Things
├── [T1-A] Fix scheduler filter empty-array bug (ProductionScheduler.tsx ~line 363)
├── [T1-B] Contact name in send-invoice email template
├── [T1-C] Add quote_terms to company_settings SELECT in quote-approval/index.ts + append to email
├── [T1-D] Fix admin password reset redirect URL in Supabase Dashboard + update redirectTo in auth code
├── [T1-E] Add is_ordered column to purchase_order_items + checkbox UI in GarmentOrderReport.tsx
└── [T1-F] Create attachments table + storage bucket + AttachmentsSection component

TIER 2 — Medium Features
├── [T2-A] Scheduler This/Next/Last week buttons (setWeekRange helper)
├── [T2-B] Custom unsaved changes modal in QuoteBuilder.tsx
├── [T2-C] MockupGenerator: load existing mockup onto canvas on click
└── [T2-D] goods_status column in production_schedule_entries + scheduler badge

TIER 3 — Heavy Features
├── [T3-A] Auto payment link 50%/100% (quote-actions + billing-service + Stripe)
└── [T3-B] Quote + Artwork Approval flow (biggest — multiple files + DB changes)

PHASE 3.2
├── [P3.2-1] Subscription dashboard
├── [P3.2-2] Noindex meta tags (quick)
├── [P3.2-3] Speed optimization
├── [P3.2-4] Customer portal overhaul
└── [P3.2-5] CSV upload
```
