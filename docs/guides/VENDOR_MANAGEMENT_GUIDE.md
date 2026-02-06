# Vendor Management in PO Settings - Complete Guide

## Overview

The Vendor Management section has been added to the Purchase Order Settings, allowing you to add, edit, and manage vendors directly from the Account Settings interface. Vendors added here will appear in the vendor dropdown when creating purchase orders.

**Location:** Account Settings → Manage Goods → PO Settings → Vendor Management (first section)

---

## Features Implemented

### ✅ **1. Vendor Management Section**

**Location in UI:**
- First collapsible section in PO Settings
- Expanded by default
- Blue Building2 icon for visual identification

**Features:**
- Add new vendors
- Edit existing vendors
- Delete vendors
- View all vendors in a table
- Toggle active/inactive status

### ✅ **2. Vendor Table**

**Columns:**
- **Vendor Name** - Primary identifier
- **Type** - Category (SanMar, S&S Activewear, Independent, etc.)
- **Contact** - Contact name or email
- **Status** - Active/Inactive badge
- **Actions** - Edit and Delete buttons

**Empty State:**
- Friendly message when no vendors exist
- Large Building2 icon
- "Add Your First Vendor" button

### ✅ **3. Add/Edit Vendor Modal**

**Modal Features:**
- Full-screen responsive modal
- Two-column grid layout on desktop
- All vendor fields available
- Dark mode support
- Scrollable content area

**Required Fields:**
- ✅ Vendor Name (required)

**Optional Fields:**
- Vendor Type (dropdown: SanMar, S&S Activewear, Independent, Manufacturer, Distributor, Other)
- Status (Active/Inactive)
- Contact Name
- Contact Email
- Contact Phone
- Address Line 1
- Address Line 2
- City
- State
- ZIP Code
- Country (defaults to USA)
- Payment Terms (e.g., "Net 30")
- Notes (internal notes about vendor)

### ✅ **4. Vendor Types**

**Pre-defined Types:**
- **SanMar** - For SanMar vendor integration
- **SSActivewear** - For S&S Activewear integration
- **Independent** - Independent vendors
- **Manufacturer** - Direct manufacturers
- **Distributor** - Distributors/wholesalers
- **Other** - Any other type

### ✅ **5. Integration with PO Creation**

**Automatic Integration:**
- All active vendors appear in PO creation vendor dropdown
- Vendor dropdown in "Create Purchase Order" is now populated
- Inactive vendors are hidden from PO creation
- Vendors are sorted alphabetically

**Default Vendor:**
- Can set a default vendor in PO Settings
- Default vendor is pre-selected when creating new POs
- Only active vendors can be set as default

---

## User Workflow

### **Adding a New Vendor**

1. Navigate to **Account Settings** → **Manage Goods** → **PO Settings**
2. The **Vendor Management** section is at the top (expanded by default)
3. Click the blue **"Add Vendor"** button (top right of section)
4. Fill in the vendor modal:
   - **Vendor Name** * (required)
   - Select **Vendor Type** from dropdown
   - Set **Status** (Active by default)
   - Add **Contact Information** (optional but recommended)
   - Add **Address** (optional)
   - Add **Payment Terms** (optional)
   - Add **Notes** (optional)
5. Click **"Add Vendor"** button
6. Vendor is immediately saved to database
7. Success notification appears
8. Vendor appears in table
9. Vendor is now available in PO creation dropdown

### **Editing an Existing Vendor**

1. Locate vendor in the Vendor Management table
2. Click the blue **pencil icon** in the Actions column
3. Modal opens with all current vendor data
4. Make desired changes
5. Click **"Update Vendor"** button
6. Changes are saved immediately
7. Success notification appears
8. Table updates with new information

### **Deleting a Vendor**

1. Locate vendor in the Vendor Management table
2. Click the red **trash icon** in the Actions column
3. Confirmation dialog appears: "Are you sure you want to delete this vendor?"
4. Click **OK** to confirm deletion
5. Vendor is removed from database
6. Success notification appears
7. Table updates (vendor disappears)
8. **Note:** Vendor will no longer appear in PO creation dropdown

**⚠️ Important:** Deleting a vendor does NOT delete existing POs associated with that vendor. Historical data is preserved.

### **Setting Vendor Status**

**Active vs Inactive:**
- **Active** vendors appear in PO creation dropdown
- **Inactive** vendors are hidden from PO creation
- Both show in Vendor Management table with color-coded badges

**Use Cases:**
- Mark vendor **Inactive** when temporarily not ordering from them
- Keeps historical data intact
- Can reactivate later without re-entering information

---

## Database Schema

### **vendors Table**

```sql
CREATE TABLE vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  vendor_name text NOT NULL,
  vendor_type text NOT NULL,
  contact_name text,
  contact_email text,
  contact_phone text,
  address_1 text,
  address_2 text,
  city text,
  state text,
  zip text,
  country text DEFAULT 'USA',
  payment_terms text,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**RLS Policies:**
- Users can only see vendors for their company
- Users can only modify vendors for their company
- Company isolation enforced at database level

---

## Technical Implementation

### **Component Location**
`/src/components/settings/POSettings.tsx`

### **State Management**

```typescript
// Vendor list state
const [vendors, setVendors] = useState<Vendor[]>([]);

// Modal visibility
const [showVendorModal, setShowVendorModal] = useState(false);

// Editing mode
const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);

// Form data
const [vendorForm, setVendorForm] = useState<Partial<Vendor>>({
  vendor_name: '',
  vendor_type: 'Independent',
  contact_name: '',
  // ... all other fields
  is_active: true,
});
```

### **Key Functions**

**1. Load Vendors**
```typescript
const loadVendors = async () => {
  // Fetches all vendors for user's company
  // Orders by vendor_name alphabetically
  // Includes both active and inactive
};
```

**2. Add Vendor**
```typescript
const handleAddVendor = () => {
  // Resets form to default values
  // Opens modal in "Add" mode
};
```

**3. Edit Vendor**
```typescript
const handleEditVendor = (vendor: Vendor) => {
  // Populates form with existing vendor data
  // Opens modal in "Edit" mode
};
```

**4. Save Vendor**
```typescript
const handleSaveVendor = async () => {
  // Validates vendor_name is not empty
  // INSERT for new vendors
  // UPDATE for existing vendors
  // Refreshes vendor list after save
};
```

**5. Delete Vendor**
```typescript
const handleDeleteVendor = async (vendorId: string) => {
  // Shows confirmation dialog
  // Deletes from database if confirmed
  // Refreshes vendor list
};
```

### **Integration Points**

**1. PO Creation Component**
- Located: `/src/components/purchase-orders/CreatePurchaseOrder.tsx`
- Calls `loadVendors()` on mount
- Filters by `is_active = true`
- Populates vendor dropdown

**2. PO Settings - Default Vendor**
- Located: Same component (POSettings.tsx)
- "Default Vendor" dropdown in "PO Numbering & Defaults" section
- Filters by `is_active = true`
- Pre-selects default when creating new POs

**3. Garment Order Report**
- Located: `/src/components/purchase-orders/GarmentOrderReport.tsx`
- Uses vendors for filtering
- Shows supplier names in report

---

## UI Screenshots (Text Description)

### **Vendor Management Section - Empty State**
```
┌─────────────────────────────────────────────────────────┐
│ [Building Icon] Vendor Management               [▲]    │
├─────────────────────────────────────────────────────────┤
│ Manage vendors for purchase orders    [+ Add Vendor]   │
│                                                          │
│  ╔════════════════════════════════════════════════╗    │
│  ║           [Building Icon]                      ║    │
│  ║       No vendors added yet                     ║    │
│  ║    [+ Add Your First Vendor]                   ║    │
│  ╚════════════════════════════════════════════════╝    │
└─────────────────────────────────────────────────────────┘
```

### **Vendor Management Section - With Vendors**
```
┌─────────────────────────────────────────────────────────┐
│ [Building Icon] Vendor Management               [▲]    │
├─────────────────────────────────────────────────────────┤
│ Manage vendors for purchase orders    [+ Add Vendor]   │
│                                                          │
│ Name         │ Type        │ Contact      │ Status│ ⚙  │
│──────────────┼─────────────┼──────────────┼───────┼────│
│ SanMar       │ SanMar      │ John Doe     │●Active│✎🗑 │
│ S&S Active   │ SSActive... │ orders@ss... │●Active│✎🗑 │
│ Local Vendor │ Independent │ —            │○Inact.│✎🗑 │
└─────────────────────────────────────────────────────────┘
```

### **Add/Edit Vendor Modal**
```
┌─────────────────────────────────────────────────────────┐
│ Add New Vendor                                    [×]   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Vendor Name *                                           │
│ [SanMar________________________]                        │
│                                                          │
│ Vendor Type          Status                             │
│ [SanMar ▼]          [Active ▼]                         │
│                                                          │
│ Contact Name         Contact Email                      │
│ [John Doe______]    [orders@______]                    │
│                                                          │
│ Contact Phone                                           │
│ [(555) 123-4567________________]                        │
│                                                          │
│ Address Line 1                                          │
│ [123 Main St___________________]                        │
│                                                          │
│ ... (additional address fields)                         │
│                                                          │
│ Payment Terms                                           │
│ [Net 30____________________]                            │
│                                                          │
│ Notes                                                   │
│ [________________________]                              │
│                                                          │
├─────────────────────────────────────────────────────────┤
│                        [Cancel] [Add Vendor]            │
└─────────────────────────────────────────────────────────┘
```

---

## Troubleshooting

### **Issue: Vendor list is empty but I know I added vendors**
**Possible Causes:**
1. Viewing wrong company (multi-tenant issue)
2. RLS policies blocking access
3. Browser cache issue

**Solution:**
1. Refresh page
2. Check database directly: `SELECT * FROM vendors WHERE company_id = 'YOUR_COMPANY_ID'`
3. Verify RLS policies are correct

### **Issue: Vendor not appearing in PO creation dropdown**
**Possible Causes:**
1. Vendor is set to Inactive
2. CreatePurchaseOrder component filters only active vendors

**Solution:**
1. Edit vendor and set Status to "Active"
2. Refresh PO creation page
3. Vendor should now appear

### **Issue: Can't delete vendor - constraint error**
**Possible Cause:**
- Vendor has existing purchase orders (foreign key constraint)

**Solution:**
- Instead of deleting, set vendor to "Inactive"
- This preserves historical data while hiding from dropdown

### **Issue: Modal fields not saving**
**Possible Cause:**
- Validation failure (vendor_name is empty)
- Database connection issue

**Solution:**
1. Ensure Vendor Name field is filled
2. Check browser console for errors
3. Check network tab for failed API calls

---

## Best Practices

### **Naming Conventions**
- Use clear, recognizable vendor names
- Include vendor type in name if helpful (e.g., "SanMar - Seattle")
- Be consistent with formatting

### **Vendor Types**
- Choose appropriate type for accurate reporting
- Use "SanMar" for SanMar integration
- Use "SSActivewear" for S&S Activewear integration
- Use "Independent" for local/custom vendors

### **Contact Information**
- Always add contact email for PO communications
- Phone number helpful for urgent issues
- Notes field good for account numbers, rep names, etc.

### **Active vs Inactive**
- Set vendors to Inactive instead of deleting
- Preserves historical data
- Can reactivate later
- Keeps reporting accurate

### **Payment Terms**
- Document payment terms for reference
- Examples: "Net 30", "Net 60", "COD", "Prepay"
- Helps with cash flow planning

---

## Future Enhancements

### **Potential Additions**
1. **Vendor Performance Tracking**
   - On-time delivery rate
   - Quality score
   - Average lead time

2. **Vendor Documents**
   - W-9 forms
   - Contracts
   - Price lists
   - Catalogs

3. **Vendor Portal**
   - Allow vendors to view POs
   - Update order status
   - Upload invoices

4. **Bulk Import**
   - CSV import for multiple vendors
   - Template download

5. **Vendor Categories**
   - Group vendors by category
   - Filter by category in reports

6. **Credit Terms Tracking**
   - Credit limit
   - Current balance
   - Payment history

7. **Preferred Vendor Flag**
   - Mark preferred vendors
   - Show in PO creation

8. **Vendor Approval Workflow**
   - Require manager approval for new vendors
   - Approval history log

---

## Security Considerations

### **Data Isolation**
- All queries filtered by `company_id`
- RLS policies enforce company isolation
- No cross-company data leakage

### **Permissions**
- Only authenticated users can access
- Users can only see their company's vendors
- Delete operations are company-scoped

### **Audit Trail**
- `created_at` timestamp recorded
- `updated_at` timestamp on changes
- Future: Add audit log for all changes

---

## API Reference

### **Supabase Queries**

**Get All Vendors**
```typescript
const { data, error } = await supabase
  .from('vendors')
  .select('*')
  .eq('company_id', companyId)
  .order('vendor_name');
```

**Get Active Vendors Only**
```typescript
const { data, error } = await supabase
  .from('vendors')
  .select('id, vendor_name, vendor_type')
  .eq('company_id', companyId)
  .eq('is_active', true)
  .order('vendor_name');
```

**Insert New Vendor**
```typescript
const { error } = await supabase
  .from('vendors')
  .insert([{
    company_id: companyId,
    vendor_name: 'SanMar',
    vendor_type: 'SanMar',
    // ... other fields
  }]);
```

**Update Vendor**
```typescript
const { error } = await supabase
  .from('vendors')
  .update({ vendor_name: 'New Name' })
  .eq('id', vendorId)
  .eq('company_id', companyId);
```

**Delete Vendor**
```typescript
const { error } = await supabase
  .from('vendors')
  .delete()
  .eq('id', vendorId)
  .eq('company_id', companyId);
```

---

## Testing Checklist

### **Add Vendor**
- [ ] Click "Add Vendor" button
- [ ] Fill in vendor name
- [ ] Select vendor type
- [ ] Add contact information
- [ ] Click "Add Vendor"
- [ ] Verify success notification
- [ ] Verify vendor appears in table
- [ ] Verify vendor appears in PO creation dropdown

### **Edit Vendor**
- [ ] Click pencil icon on existing vendor
- [ ] Modal opens with correct data
- [ ] Make changes
- [ ] Click "Update Vendor"
- [ ] Verify success notification
- [ ] Verify changes reflected in table

### **Delete Vendor**
- [ ] Click trash icon
- [ ] Confirmation dialog appears
- [ ] Click OK
- [ ] Verify success notification
- [ ] Verify vendor removed from table
- [ ] Verify vendor removed from PO dropdown

### **Inactive Vendor**
- [ ] Edit vendor
- [ ] Set status to Inactive
- [ ] Save
- [ ] Verify vendor still in table with gray "Inactive" badge
- [ ] Verify vendor NOT in PO creation dropdown
- [ ] Verify vendor NOT in "Default Vendor" dropdown

### **Default Vendor**
- [ ] Expand "PO Numbering & Defaults" section
- [ ] Select vendor from "Default Vendor" dropdown
- [ ] Save settings
- [ ] Create new PO
- [ ] Verify default vendor is pre-selected

---

**Last Updated:** 2026-02-06
**Version:** 1.0.0
**Component:** `/src/components/settings/POSettings.tsx`
