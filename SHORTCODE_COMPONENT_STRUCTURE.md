# Short Code Component Structure

## Visual Component Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│  ShortCodeReference Component                                   │
│  ════════════════════════════════════════════════════════════   │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Header Section                                             │ │
│  │ ──────────────────────────────────────────────────────────│ │
│  │ [Code Icon] Available Short Codes    [Show Preview Button]│ │
│  │ Use these placeholders in your email templates...          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Live Preview Section (Toggleable)                          │ │
│  │ ──────────────────────────────────────────────────────────│ │
│  │ ┌──────────────────────┐  ┌──────────────────────────────┐│ │
│  │ │ Template with        │  │ Rendered with Sample Data    ││ │
│  │ │ Short Codes          │  │                              ││ │
│  │ │                      │  │ Hi John,                     ││ │
│  │ │ Hi {{customer_       │  │                              ││ │
│  │ │ first_name}},        │  │ Your quote QTE-0001 for      ││ │
│  │ │                      │  │ $1,250.00 is ready!          ││ │
│  │ │ Your quote           │  │                              ││ │
│  │ │ {{quote_number}}...  │  │ ...                          ││ │
│  │ └──────────────────────┘  └──────────────────────────────┘│ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Category: 👤 Customer Fields           [Expand/Collapse]   │ │
│  │ ══════════════════════════════════════════════════════════│ │
│  │                                                            │ │
│  │ ┌────────────────────────────────────────────────────────┐│ │
│  │ │ {{customer_first_name}}                    [Copy]      ││ │
│  │ │ Customer First Name                                    ││ │
│  │ ├────────────────────────────────────────────────────────┤│ │
│  │ │ {{customer_last_name}}                     [Copy]      ││ │
│  │ │ Customer Last Name                                     ││ │
│  │ ├────────────────────────────────────────────────────────┤│ │
│  │ │ {{customer_company}}                       [Copy]      ││ │
│  │ │ Customer Company                                       ││ │
│  │ └────────────────────────────────────────────────────────┘│ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Category: 📄 Quote Fields              [Expand/Collapse]   │ │
│  │ ══════════════════════════════════════════════════════════│ │
│  │                                                            │ │
│  │ ┌────────────────────────────────────────────────────────┐│ │
│  │ │ {{quote_number}}                           [Copy]      ││ │
│  │ │ Quote Number                                           ││ │
│  │ ├────────────────────────────────────────────────────────┤│ │
│  │ │ {{quote_total}}                            [Copy]      ││ │
│  │ │ Quote Total Amount                                     ││ │
│  │ └────────────────────────────────────────────────────────┘│ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  [... 5 more categories: Invoice, Company, User, Payment, ...]  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 💡 Usage Tips                                              │ │
│  │ ──────────────────────────────────────────────────────────│ │
│  │ • Copy any short code and paste into your template        │ │
│  │ • Short codes are replaced with real data when sent       │ │
│  │ • Currency values are automatically formatted             │ │
│  │ • Missing data is replaced with empty string              │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Component Tree

```
ShortCodeReference
├── Header
│   ├── Title + Icon
│   ├── Description
│   └── Preview Toggle Button
│
├── Preview Section (conditional)
│   ├── Template Panel (left)
│   │   └── Raw template with {{codes}}
│   └── Rendered Panel (right)
│       └── Sample data output
│
├── Category Sections (7 total)
│   └── For Each Category:
│       ├── Category Header (collapsible)
│       │   ├── Emoji Icon
│       │   ├── Title
│       │   ├── Code Count
│       │   └── Expand/Collapse Icon
│       │
│       └── Short Code Rows (when expanded)
│           └── For Each Short Code:
│               ├── Code Badge (blue monospace)
│               ├── Description (gray text)
│               └── Copy Button
│                   ├── Copy Icon
│                   └── "Copy" / "Copied!" text
│
└── Usage Tips Section
    ├── Icon (💡)
    ├── Title
    └── Bullet List of Tips
```

## State Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ Component Mount                                             │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│ Initialize State:                                           │
│ • copiedCode: null                                          │
│ • previewVisible: false                                     │
│ • expandedCategories: Set(['customer', 'quote'])            │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│ Render Categories                                           │
│ • Group short codes by prefix                               │
│ • Show/hide based on expandedCategories                     │
└─────┬───────────────────────────────────────────────────┬───┘
      │                                                   │
      │                                                   │
      ▼                                                   ▼
┌─────────────────────┐                     ┌──────────────────────┐
│ User Clicks Copy    │                     │ User Toggles Preview │
└──────┬──────────────┘                     └──────┬───────────────┘
       │                                            │
       ▼                                            ▼
┌─────────────────────┐                     ┌──────────────────────┐
│ handleCopy()        │                     │ setPreviewVisible()  │
│ • Copy to clipboard │                     │ • Toggle boolean     │
│ • Set copiedCode    │                     │ • Show/hide preview  │
│ • Start 2s timer    │                     └──────────────────────┘
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Button → Green      │
│ "Copy" → "Copied!"  │
└──────┬──────────────┘
       │
       │ (2 seconds later)
       ▼
┌─────────────────────┐
│ Reset copiedCode    │
│ Button → Gray       │
│ "Copied!" → "Copy"  │
└─────────────────────┘
```

## Data Flow

```
┌──────────────────────────────────────────────────────────────┐
│ AVAILABLE_SHORT_CODES (types/shortcode.ts)                   │
│ { customer_first_name: "Customer First Name", ... }          │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ categorizeShortCode()                                         │
│ Analyzes key prefix and assigns category                     │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ groupedShortCodes                                             │
│ {                                                             │
│   customer: [{ key: "...", label: "..." }, ...],            │
│   quote: [...],                                               │
│   invoice: [...],                                             │
│   ...                                                         │
│ }                                                             │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ Render Loop                                                   │
│ • Object.entries(categories).map()                           │
│ • For each category, render header + codes                   │
│ • Conditionally render based on expandedCategories           │
└──────────────────────────────────────────────────────────────┘
```

## Copy Flow

```
User Clicks "Copy" Button
         │
         ▼
┌──────────────────────────────┐
│ handleCopy(key)               │
│ • Build shortCode: {{key}}    │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ navigator.clipboard.writeText│
│ (shortCode)                   │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ setCopiedCode(key)            │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ Re-render with green button   │
│ showing "Copied!"             │
└──────────┬───────────────────┘
           │
           │ (setTimeout 2000ms)
           ▼
┌──────────────────────────────┐
│ setCopiedCode(null)           │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ Re-render with gray button    │
│ showing "Copy"                │
└──────────────────────────────┘
```

## Preview Generation Flow

```
User Clicks "Show Preview"
         │
         ▼
┌──────────────────────────────────┐
│ setPreviewVisible(true)           │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ ShortCodeEngine.generatePreview()│
│ • Create sample ShortCodeData    │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ renderTemplate()                  │
│ • Replace all {{codes}}           │
│ • Return HTML string              │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ Display in preview panel          │
│ • Left: Original template         │
│ • Right: Rendered HTML            │
└──────────────────────────────────┘
```

## Styling Architecture

```
┌────────────────────────────────────────────────────────────┐
│ Container                                                   │
│ • space-y-4 (vertical spacing)                             │
│                                                             │
│ ┌────────────────────────────────────────────────────────┐│
│ │ Header                                                  ││
│ │ • flex justify-between                                  ││
│ │ • text-lg font-semibold                                 ││
│ └────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌────────────────────────────────────────────────────────┐│
│ │ Preview (conditional)                                   ││
│ │ • bg-blue-50 dark:bg-blue-900/20                       ││
│ │ • border-blue-200 dark:border-blue-800                 ││
│ │ • grid grid-cols-1 lg:grid-cols-2                      ││
│ └────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌────────────────────────────────────────────────────────┐│
│ │ Category Cards                                          ││
│ │ • bg-white dark:bg-slate-800                           ││
│ │ • border-gray-200 dark:border-slate-700                ││
│ │ • rounded-lg overflow-hidden                           ││
│ │                                                         ││
│ │ ┌────────────────────────────────────────────────────┐││
│ │ │ Category Header                                     │││
│ │ │ • bg-gray-50 dark:bg-slate-750                     │││
│ │ │ • hover:bg-gray-100                                │││
│ │ │ • px-4 py-3                                        │││
│ │ └────────────────────────────────────────────────────┘││
│ │                                                         ││
│ │ ┌────────────────────────────────────────────────────┐││
│ │ │ Short Code Rows                                     │││
│ │ │ • hover:bg-gray-50 dark:hover:bg-slate-750         │││
│ │ │ • px-4 py-3                                        │││
│ │ │                                                     │││
│ │ │ ┌──────────────────────────────────────────┐      │││
│ │ │ │ Code Badge                                │      │││
│ │ │ │ • font-mono font-semibold text-sm        │      │││
│ │ │ │ • text-blue-600 dark:text-blue-400       │      │││
│ │ │ │ • bg-blue-50 dark:bg-blue-900/30         │      │││
│ │ │ │ • px-2 py-0.5 rounded                    │      │││
│ │ │ └──────────────────────────────────────────┘      │││
│ │ │                                                     │││
│ │ │ ┌──────────────────────────────────────────┐      │││
│ │ │ │ Copy Button                               │      │││
│ │ │ │ • bg-gray-100 → bg-green-100 (copied)    │      │││
│ │ │ │ • px-3 py-1.5 rounded                    │      │││
│ │ │ │ • transition-all                         │      │││
│ │ │ └──────────────────────────────────────────┘      │││
│ │ └────────────────────────────────────────────────────┘││
│ └────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌────────────────────────────────────────────────────────┐│
│ │ Usage Tips                                              ││
│ │ • bg-amber-50 dark:bg-amber-900/20                     ││
│ │ • border-amber-200 dark:border-amber-800               ││
│ └────────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────┘
```

## File Dependencies

```
ShortCodeReference.tsx
├── Depends on:
│   ├── types/shortcode.ts
│   │   ├── ShortCodeKey
│   │   └── AVAILABLE_SHORT_CODES
│   │
│   ├── services/shortcode-service.ts
│   │   └── ShortCodeEngine
│   │       ├── generatePreview()
│   │       ├── renderTemplate()
│   │       └── extractShortCodes()
│   │
│   └── lucide-react
│       ├── Copy
│       ├── Check
│       ├── Eye
│       ├── EyeOff
│       ├── Code
│       ├── ChevronDown
│       └── ChevronUp
│
└── Used by:
    └── components/AccountSettings.tsx
        └── In 'quote-invoice-settings' tab
```

## Integration Point

```
AccountSettings.tsx
└── activeTab === 'quote-invoice-settings'
    ├── Quote/Invoice Numbering Settings
    ├── Payment Terms
    ├── Custom Invoice Status
    └── Email Short Codes Reference ← NEW
        └── <ShortCodeReference showPreview={true} />
```

## Component Interface

```typescript
// Props
interface ShortCodeReferenceProps {
  showPreview?: boolean;    // Default: true
  compact?: boolean;         // Default: false
}

// State
const [copiedCode, setCopiedCode] = useState<string | null>(null);
const [previewVisible, setPreviewVisible] = useState(false);
const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
  new Set(['customer', 'quote'])
);

// Methods
- categorizeShortCode(key: string): CategoryKey
- handleCopy(key: string): void
- toggleCategory(category: string): void
```

## Summary

The ShortCodeReference component is a self-contained, highly interactive UI panel that:
- Organizes 60+ short codes into 7 logical categories
- Provides instant copy-to-clipboard functionality
- Offers live preview with sample data
- Maintains state for UI interactions
- Integrates seamlessly into existing settings
- Follows consistent design patterns
- Supports dark mode throughout
- Works responsively across devices
