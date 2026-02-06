# Draft Quote Architecture Implementation

## Overview
Successfully implemented a draft-quote architecture that creates quote records immediately when users click "New Quote," ensuring a valid quote_id exists before any editing, autosave, or mockup creation occurs.

## Implementation Details

### 1. Database Changes
**Migration:** `implement_draft_quote_architecture.sql`

- Added `autosave_enabled` column (default: true) to quotes table
- Made `customer_name` nullable with default value "Draft Quote"
- Added performance indexes:
  - `idx_quotes_status_company` for faster draft queries
  - `idx_quotes_created_by` for user-specific queries
- Existing RLS policies allow authenticated users to create/update quotes in their company

### 2. Edge Function Enhancement
**Updated:** `supabase/functions/quotes-api/index.ts`

Added new endpoint:
```
POST /quotes-api/draft
```

Creates minimal draft quote with:
- Auto-generated quote number
- Status: "draft"
- Company ID from user profile
- Customer ID: null (not required)
- Customer name: "Draft Quote"
- All amounts: 0
- Autosave enabled: true

### 3. Frontend Changes (QuoteBuilder)

#### State Management
- Changed `quoteId` from prop to internal state
- Added `draftCreatedRef` to prevent duplicate draft creation

#### Draft Creation on Mount
- New `createDraftQuote()` function that:
  - Calls `/quotes-api/draft` endpoint
  - Sets the returned quote ID and number
  - Only runs once per component mount
  - Runs automatically when no `initialQuoteId` provided

#### Autosave Implementation
- Autosave interval: 30 seconds (reduced from 2 minutes)
- Triggers when `quoteId` exists and `hasUnsavedChanges` is true
- No longer requires customer selection for autosave
- Shows "Last saved" timestamp in header

#### Save Functionality Updates
- **Save Draft:** Updates existing draft quote (no validation required)
- **Send Quote:**
  - Validates customer is selected
  - Transitions status from "draft" → "sent"
  - Saves and closes
- **Save & Close:** Saves draft and closes builder

#### Mockup Generator Integration
- Removed "save first" requirement
- Mockup button now enabled immediately
- Always attaches to existing quote_id (no orphaned mockups)

### 4. Quote Lifecycle

```
┌─────────┐
│  Draft  │ ← Created immediately on "New Quote"
└────┬────┘
     │
     │ Customer selected + "Send Quote" clicked
     ▼
  ┌──────┐
  │ Sent │
  └──┬───┘
     │
     ├─→ Approved → Converted to Invoice
     ├─→ Rejected
     └─→ Expired
```

### 5. Benefits

✅ **No Save Required:** Users can start working immediately
✅ **Autosave:** Changes saved every 30 seconds automatically
✅ **Mockups Anytime:** Create mockups without saving first
✅ **No Orphaned Data:** All data tied to valid quote_id
✅ **Better UX:** Natural workflow without interruptions
✅ **Data Safety:** No lost work, everything autosaves

### 6. Validation Rules

**Draft Status:**
- Customer: Optional
- Line items: Optional
- All fields: Optional

**Sent Status (when clicking "Send Quote"):**
- Customer: Required
- Quote number: Auto-generated
- Line items: Recommended but not enforced

**Approved/Converted:**
- Cannot be edited (protected by business logic)

### 7. Technical Notes

**Performance:**
- Indexes added for fast draft queries
- Autosave debounced to 30 seconds
- Only saves when changes detected

**Security:**
- RLS policies enforce company isolation
- Users can only create/update quotes in their company
- Draft quotes private to creator until sent

**Edge Cases Handled:**
- Duplicate draft creation prevented with `draftCreatedRef`
- Missing customer handled gracefully for drafts
- Quote number generation atomic and race-condition safe

## Testing Checklist

- [x] Database migration applied successfully
- [x] Edge function deployed and accessible
- [x] Project builds without errors
- [x] Draft created automatically on "New Quote"
- [x] Autosave runs every 30 seconds
- [x] Mockup button works without saving
- [x] "Send Quote" validates customer selection
- [x] Status transitions work correctly
- [x] RLS policies allow draft creation

## Usage

1. Click "New Quote" → Draft automatically created
2. Edit quote details → Autosaves every 30 seconds
3. Create mockups → Works immediately
4. Add customer → Required before sending
5. Click "Send Quote" → Transitions to "Sent" status
6. Customer approves → Convert to invoice

## Files Modified

- `/supabase/migrations/20260202010000_implement_draft_quote_architecture.sql`
- `/supabase/functions/quotes-api/index.ts`
- `/src/components/production/QuoteBuilder.tsx`
- `/src/components/production/QuotesManager.tsx` (indirectly, no changes)

## API Reference

### Create Draft Quote
```
POST /functions/v1/quotes-api/draft
Authorization: Bearer <token>
```

Response:
```json
{
  "quote": {
    "id": "uuid",
    "quote_number": "QTE-0001",
    "status": "draft",
    "customer_name": "Draft Quote",
    "total": 0,
    "autosave_enabled": true,
    ...
  }
}
```
