# InkOps Phase 3.1 + 3.2 — Technical Execution Plan
> Last Updated: 2026-04-23
> Stack: React + TypeScript + Vite | Supabase (Postgres + Edge Functions + Auth) | Stripe | Resend (email) | Deno edge runtime
> Repo root: `c:\CODE_26\InkOps.ink`
> Production URL pattern: `https://{subdomain}.inkops.ink`
> Branch strategy: `main` (dev) → `InkOps-Production` (live/Netlify) | `dev` branch → `dev.inkops.ink` (staging for Phase 3.1 main features)

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
    shared/           AttachmentsSection.tsx  ← NEW (file uploads)
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
Bugs → Minor Fixes (4/22 billable) → Tier 2 → Tier 3 → Phase 3.2

> **Dev workflow:** Bugs + minor fixes push to `main` → `InkOps-Production` (prod).
> Phase 3.1 heavy features build on `dev` branch → test on `dev.inkops.ink` → merge to prod when ready.

---

# ✅ TIER 1 — Small Things (ALL COMPLETE — 2026-04-22)

All items completed and deployed to `InkOps-Production`.

| Task | Status |
|------|--------|
| [T1-A] Fix broken scheduler column filters | ✅ Done |
| [T1-B] Add contact name to customer-facing invoice email | ✅ Done |
| [T1-C] Quote terms + invoice terms in customer emails | ✅ Done |
| [T1-D] InkOps branded password reset email (manual — Supabase Dashboard) | ✅ Done |
| [T1-E] Mark garment purchase report items as ordered | ✅ Done |
| [T1-F] File upload section on quotes and work orders | ✅ Done |
| BONUS: This/Next/Last week quick filters on scheduler | ✅ Done |
| BONUS: 3 status columns on scheduler (revised — see BUG-2) | ⚠️ Needs fix |

### DB migrations applied (Supabase Dashboard — run manually)
```sql
-- T1-E: is_ordered on garment_requirements_staging
ALTER TABLE garment_requirements_staging
  ADD COLUMN IF NOT EXISTS is_ordered boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS ordered_at timestamptz,
  ADD COLUMN IF NOT EXISTS ordered_by text;

-- T1-F: attachments table
CREATE TABLE IF NOT EXISTS attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  reference_type text NOT NULL CHECK (reference_type IN ('quote','work_order')),
  reference_id uuid NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  mime_type text,
  uploaded_by text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS attachments_reference_idx ON attachments(reference_type, reference_id);
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members can manage their own attachments"
  ON attachments FOR ALL
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid()));
```

### Edge functions redeployed
```bash
npx supabase functions deploy quote-approval --project-ref cuaukcvccxvfpuxaciac --no-verify-jwt
npx supabase functions deploy send-invoice --project-ref cuaukcvccxvfpuxaciac
```

---

# 🔴 ACTIVE BUGS — Fix Immediately (Client Found — 2026-04-22)
> Push target: `main` → `InkOps-Production`
> No extra charge — these are our issues to fix.

---

## [BUG-1] QuoteBuilder — Qty Shows 0 in Quote View After Save
**Status:** 🟡 Pushed to `dev` (commit b0facd1) — awaiting validation on dev.inkops.ink | **Priority:** 1st

### Resolution attempted (2026-05-04)
Hypothesis in this doc was `quantity` field; actual QuoteDetail code uses `total_quantity`. The two views diverged on the formula:
- **QuoteBuilder** `calculateItemsTotal`: `sizeQty + total_quantity` (additive)
- **QuoteDetail** (old): `sizeQty > 0 ? sizeQty : total_quantity` (either-or, plus a separate Qty column that hid total_quantity for sized rows)

Aligned QuoteDetail to QuoteBuilder's formula:
- Qty column → always shows `total_quantity` (matches QuoteBuilder Qty input)
- Items column → `sizeQty + total_quantity`
- Top-of-quote totalQty rollup uses the same sum

**Not yet validated against Jamie's reproduction case.** If he tests on dev and the bug persists, the fix is wrong direction and we need to dig into how QuoteBuilder writes the value rather than how QuoteDetail reads it.

### What's broken
- In **QuoteBuilder** (editing mode): Qty column shows the correct value entered (e.g. `2`)
- After saving and opening **Quote View** (QuoteDetail.tsx): Qty and Items columns show `0` or blank
- **Unit Price and Line Total are correct** — so the price calculation works, only the qty display is broken
- Affects "CS" (customer supplied) line items — might affect all items

### Files to investigate
- `src/components/production/QuoteDetail.tsx` — how it reads and renders the qty columns
- `src/components/production/QuoteBuilder.tsx` — what field it saves the qty to
- DB table: `quote_line_items` — check if `quantity` vs size qty fields (`qty_xs`, `qty_s`...) are being mismatched

### Root cause hypothesis
QuoteDetail reads a `quantity` field but QuoteBuilder saves to individual size fields (`qty_xs`, `qty_s`, `qty_m`, etc.) and doesn't write back to the aggregate `quantity` field. The display reads `quantity` which stays 0.

### Fix approach
Find where QuoteDetail renders the Qty column and check what field it reads from. Cross-reference with what QuoteBuilder writes. Either:
- Update QuoteDetail to compute total from sum of size fields
- Or ensure QuoteBuilder also writes the aggregate `quantity` field on save

---

## [BUG-2] Scheduler — Status Columns Wrong Position and Wrong Count
**Status:** 🟡 Fix pushed to `dev` — awaiting validation on dev.inkops.ink | **Priority:** 2nd

### Resolution attempted (2026-05-05)
On inspection, `ProductionScheduler.tsx` was already partially refactored — the 3-column setup was reduced to 2 columns positioned right after Qty, with `stock_status` and `art_status` enrichment logic computing values from `garment_requirements_staging` + PO receiving + `quotes.artwork_approval_status`. What remained wrong:
- Headers were labeled **"Proof Status"** and **"Garment Status"** instead of the client-requested **"Art Status"** / **"Stock Status"**
- Order was reversed: Art (Proof) was first, Stock (Garment) was second — client wants Stock first

Edits applied to `src/components/production/ProductionScheduler.tsx`:
- Renamed header `Proof Status` → `Art Status`, `Garment Status` → `Stock Status`
- Swapped column order so Stock Status renders first (right after Qty), then Art Status
- Swapped matching `<td>` cells in the row body so values align with the new header order
- Color theming preserved: Stock = blue, Art = purple

**Not validated on prod data.** If on dev.inkops.ink Jamie sees correct labels/order but values look wrong (e.g. all "—"), the issue is in the enrichment computation (lines 200-265), not the columns.

### What's wrong (client feedback)
- We added 3 columns (Stock Ordered, Stock Received, Art Approved) — client wants **2 only**
- They are at the **end of the table** — client wants them **right after the Qty column** (before workflow steps)
- Values need to change

### What client wants exactly
| Column | Name | Values | Connected to |
|--------|------|--------|-------------|
| 1 | **Stock Status** | `Ordered` / `Partial` / `Received` | Garment purchasing (GarmentOrderReport) |
| 2 | **Art Status** | `Approved` / `Rejected` | Art proof approval/decline |

### Fix approach
**Step 1 — Remove current 3 columns** from `ProductionScheduler.tsx` (headers + cells + enrichment logic)

**Step 2 — Add 2 DB columns** for manual/computed storage:
```sql
ALTER TABLE production_schedule_entries
  ADD COLUMN IF NOT EXISTS stock_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS art_status text DEFAULT 'pending';
-- stock_status values: 'pending' | 'ordered' | 'partial' | 'received'
-- art_status values: 'pending' | 'approved' | 'rejected'
```

**Step 3 — Compute on load in `loadScheduleEntries`:**
- `stock_status`: check `garment_requirements_staging.is_ordered` and PO receiving data for the quote
- `art_status`: check `quotes.artwork_approval_status` for the quote

**Step 4 — Position:** Move the 2 new columns so they render AFTER the Qty `<th>` and BEFORE the `{workflowSteps.map(...)}` block (both in header and row cells)

**Step 5 — Styling:** Use colored badges:
- Stock: grey = Pending, blue = Ordered, yellow = Partial, green = Received
- Art: grey = Pending, green = Approved, red = Rejected

---

## [BUG-3] Customer Form — Address Line 1 Required (Should Be Optional)
**Status:** ⬜ Not started | **Priority:** 3rd

### What's broken
Address Line 1 field in the new customer creation/editing form is marked as `required`, causing validation errors when creating customers without a full address.

### Files to find
Search for customer creation form — likely in:
- `src/components/customers/` or similar
- Search for `address_1` or `bill_address_1` with `required` attribute

### Fix
Remove `required` attribute/validation from address fields. Only `company_name` or `customer_name` should be required.

---

# 🟠 4/22 MINOR FIXES — Billable New Scope
> Client added: 2026-04-22 | **New scope — charge extra**
> Push target: `main` → `InkOps-Production` (not a 3.1 feature, no dev branch needed)

---

## [MF-1] Portal Welcome Email — Send from sales@toddssportinggoods.com
**Status:** ⬜ Not started

### What's needed
The welcome email sent when a customer is created/invited via the portal should come from `sales@toddssportinggoods.com` instead of the current sender address.

### Fix
Find the welcome email send function (likely in `supabase/functions/send-email/index.ts` or portal invite function). Update the `from` field in the Resend API call.

---

## [MF-2] Box Label Not Printing Properly
**Status:** ⬜ Not started

### What's needed
Client says the box label is not printing properly. Need to:
1. Get client to share exactly what's wrong (size? layout? content missing?)
2. Find `src/components/production/BoxLabel.tsx` and `LabelPreviewModal.tsx`
3. Fix layout/print CSS

---

## [MF-3] Remove Blue Mockup Builder Button from Imprints
**Status:** ⬜ Not started

### What's needed
In QuoteBuilder → +Imprint(s) → imprint card → there's a blue button on the right that opens the mockup builder. Client wants it removed.

### Fix
Find the imprint card component (likely inside `QuoteBuilder.tsx` or a child component). Locate and remove the mockup builder button from the imprint row. Keep the mockup builder accessible from elsewhere if needed.

---

## [MF-4] Upload Images Directly to Imprint Box (No Full Mockup Builder)
**Status:** ⬜ Not started

### What's needed
In QuoteBuilder → +Imprint(s) → imprint card → add a simple image upload button that lets users upload an artwork image directly to the imprint without opening the full mockup builder.

### Fix
Add a file input (or drag-drop zone) to the imprint card. On upload:
- Upload to Supabase storage (`artwork` bucket or similar)
- Save URL to `quote_imprints.artwork_url` or `mockups` array
- Display thumbnail on the imprint card

---

## [MF-5] Company Logo Header + Email Signature in All Emails
**Status:** ⬜ Not started

### What's needed
1. Add company logo at the top of all outgoing emails as a header
2. Add a text block in Communication Templates / Settings that allows editing an email signature
3. Signature appended to all outgoing emails

### Files
- `supabase/functions/quote-approval/index.ts` — quote email
- `supabase/functions/send-invoice/index.ts` — invoice email
- `supabase/functions/send-email/index.ts` — generic emails
- `src/components/settings/` — add email signature field to company settings
- DB: `ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS email_signature text;`

### Fix approach
1. Add `email_signature` and confirm `company_logo_primary_url` to company_settings
2. Update all email HTML templates to include logo `<img>` header and signature block
3. Add "Email Signature" textarea in Settings → Communication Templates

---

## [MF-6] State Field in Customer Profile → Dropdown
**Status:** ⬜ Not started

### What's needed
The state field in the customer address section should be a dropdown of US states instead of a free-text input.

### Fix
Find the customer form component. Replace the state `<input>` with a `<select>` populated with all 50 US state abbreviations.

---

## [MF-7] Street Address Autofill
**Status:** ⬜ Not started

### What's needed
Street address field should autofill/suggest addresses as user types.

### Fix approach (simplest first)
Add `autocomplete="street-address"` to the address input — this triggers browser-stored address suggestions with zero API cost.

For full Google Maps Places autocomplete (if client wants it):
- Add Google Maps Places API key to `.env`
- Use `@react-google-maps/api` or a lightweight wrapper
- Call Places Autocomplete API on keystroke, show dropdown, fill fields on select

---

## [MF-8] Undo "Mark as Ordered" in Garment Purchase Report
**Status:** ⬜ Not started

### What's needed
The "Mark Ordered" button we added (T1-E) needs an undo/toggle. When a row is already marked ordered, clicking "Ordered" badge should ask "Undo?" and set `is_ordered = false`.

### Fix
In `GarmentOrderReport.tsx`, update `handleMarkOrdered` to toggle: if already ordered, set `is_ordered = false, ordered_at = null`. Change the "Ordered" badge into a clickable button with confirm dialog.

---

## [MF-9] Box Label Refinement
**Status:** ⬜ Awaiting client details

### What's needed
Client mentioned box label refinement but was vague. Need more specifics from client before implementing.

---

# 🟡 TIER 2 — Medium Features

---

## [T2-A] Scheduler Sorting (This Week / Next Week / Last Week)
**Status:** ✅ Done (completed during Tier 1 bonus)

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

---

## [T2-C] Mockup Generator: Click Existing Mockup to Edit + Resave
**Status:** ⬜ Not started
**File:** `src/components/production/MockupGenerator.tsx`

### What's needed
**Current:** You can upload new artwork but CANNOT click a saved mockup thumbnail to load it back onto the canvas.
**Goal:** Click imprint → saved mockup loads onto canvas → edit → Save → replaces old mockup in DB.

---

## [T2-D] Goods Ordered / Goods Received Auto-Column in Scheduler
**Status:** ⚠️ Superseded by BUG-2 fix above
> BUG-2 implements the 2-column scheduler status (Stock Status + Art Status) which covers the intent of T2-D. Mark complete once BUG-2 is done.

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
1. Add to `company_settings`:
```sql
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS auto_send_payment_link boolean DEFAULT false;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS default_payment_split text DEFAULT '100';
```
2. In `quote-actions/index.ts`, after invoice created: check `auto_send_payment_link` → if true, generate payment links and send email
3. For 50%: calculate `amount * 0.5`, create Stripe Payment Link; for 100%: use full amount

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
- Quote approved → artwork section unlocks (if artwork exists on quote)
- Quote declined → artwork section stays locked
- No artwork on quote → artwork section hidden (`artwork_approval_status = 'not_applicable'`)
- Art declined → admin QuoteDetail shows "Resend for Artwork Approval" button
- Customer requests changes after approval → `quote.status` resets to pending → new approval email → on re-approval: `quote-actions` updates WO, scheduler entries, invoice

---

# 🔵 PHASE 3.2 — Future Sprint (after 3.1 complete)

## [P3.2-1] Subscription Dashboard
- Admin UI to manage user subscriptions, assign beta testers, track monthly Stripe revenue
- Relevant: `supabase/functions/create-subscription-checkout/index.ts`, `src/contexts/SubscriptionContext.tsx`

## [P3.2-2] Security — Noindex Public Links
- Add `<meta name="robots" content="noindex, nofollow">` to `PublicQuoteApprovalPage.tsx` and public invoice pages
- Add `X-Robots-Tag: noindex` response header in edge functions serving public pages

## [P3.2-3] Speed Optimization
- Garment lookup in QuoteBuilder: add debounce (300ms) + cache results in sessionStorage
- MockupGenerator: lazy-load canvas library only when modal opens

## [P3.2-4] Customer Portal Full Overhaul
- Customers view unpaid invoices, past quotes, proofs, paid invoices, contacts; store payment methods
- Existing portal edge functions: `portal-data/`, `portal-payment/`, `portal-proof-approval/`, `customer-payment-methods/`

## [P3.2-5] Customer CSV Upload from Printavo
- Parse Printavo CSV export, map to `customers` table
- New settings page section + `supabase/functions/import-customers/index.ts`

---

# ✅ Execution Order (Current)

```
BUGS (Fix now → push to prod)
├── [BUG-1] QuoteBuilder qty showing 0 in quote view
├── [BUG-2] Scheduler: fix column count, position, and values
└── [BUG-3] Customer form: make address not required

4/22 MINOR FIXES (Billable — after bugs)
├── [MF-1] Portal email from sales@toddssportinggoods.com → ⚙️ Config: set email_from_address in Settings → Resend
├── [MF-2] Box label printing fix → ⏳ Awaiting client details
├── [MF-3] Remove mockup builder button from imprints → ✅ Done (commit efc0b6b)
├── [MF-4] Image upload directly to imprint box → ✅ Done (commit efc0b6b)
├── [MF-5] Company logo in email headers + email signature setting → ✅ Done (commit efc0b6b)
├── [MF-6] State dropdown in customer profile → ✅ Done (commit efc0b6b)
├── [MF-7] Address autofill (autocomplete attrs) → ✅ Done (commit efc0b6b)
├── [MF-8] Undo "Mark as Ordered" → ✅ Done (commit efc0b6b)
└── [MF-9] Box label refinement → ⏳ Awaiting client details


TIER 2 (dev branch → dev.inkops.ink staging)
├── [T2-B] Custom unsaved changes modal in QuoteBuilder
└── [T2-C] MockupGenerator: load existing mockup to canvas

TIER 3 (dev branch)
├── [T3-A] Auto payment link 50%/100%
└── [T3-B] Quote + Artwork Approval flow (biggest feature)

PHASE 3.2
└── [P3.2-1 through P3.2-5]
```
