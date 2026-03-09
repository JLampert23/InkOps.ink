# Imprint Builder Feature Guide

## Where to Find the New Features

### 1. Manage Imprints Modal

**Location:** Production → Quotes → Create/Edit Quote

**How to Access:**
1. Navigate to **Production** tab in the main navigation
2. Click on **Quotes**
3. Either create a new quote or edit an existing one
4. Below the **Line Items Table**, click the **"+ Imprint(s)"** button next to the "+ Line Item" button
5. This opens the **Manage Imprints** modal where you can configure decorations for all line items in the quote

**In the Line Items Table**, you'll see action buttons in the rightmost column for each line item:
   - **Green Dollar Icon** - Refresh pricing from matrix (coming soon)
   - **Red X Icon** - Remove line item

**Manage Imprints Modal Features:**
- **Proof Builder Section (Blue):**
  - Upload artwork files (images or PDFs)
  - Manage multiple proof versions
  - Add notes for each version
  - Visual preview of uploaded artwork

- **Imprint Configuration Section (Green):**
  - Location field (e.g., "Front", "Back", "Left Chest")
  - Ink colors management (add/remove colors)
  - Print passes setting
  - Production notes

- **Pricing Matrix Selection Section (Purple):**
  - Dropdown to select pricing matrix
  - Real-time price calculation based on quantity
  - Display of setup fees
  - Tier preview

### 2. Pricing Matrices Manager

**Location:** Account Settings → Production Settings → Price Matrices

**How to Access:**
1. Click on **Settings** (gear icon) in the main navigation
2. In the left sidebar, expand **Production Settings**
3. Click on **Price Matrices**

**Features:**
- List all pricing matrices
- Create new matrices with:
  - Name and description
  - Matrix type (Screen Print, Embroidery, DTG, Vinyl, Sublimation, Heat Transfer)
  - Setup fee
  - Unlimited rows and columns for tier pricing
  - Color count adjustments (optional)
- Edit existing matrices
- Duplicate matrices
- Delete matrices
- Active/Inactive status toggle

### 3. Database Tables Created

The following tables have been created in your Supabase database:

- **imprints** - Stores imprint configuration for line items
- **imprint_proofs** - Stores multiple proof versions with artwork
- **imprint-proofs** (storage bucket) - Stores uploaded artwork files

### 4. Price Matrix Fields Added

The `price_matrices` table now includes:
- `matrix_type` - Type of decoration method
- `setup_fee` - One-time setup cost
- `color_count_adjustments` - JSON field for color-based pricing adjustments

## Quick Start Guide

### Creating Your First Pricing Matrix

1. Go to **Settings** → **Production Settings** → **Price Matrices**
2. Click **"+ Create Matrix"**
3. Fill in:
   - Name: "Screen Print Basic"
   - Type: "Screen Print"
   - Setup Fee: 25.00
4. Set up your tiers:
   - Rows: "1-24", "25-49", "50-99", "100+"
   - Columns: "Base Price"
   - Fill in prices for each tier
5. Click **Save**

### Adding Imprints to a Quote

1. Go to **Production** → **Quotes** → **Create Quote**
2. Add line items to your quote (e.g., "Gildan T-Shirt - Navy - L")
3. Click the **"+ Imprint(s)"** button below the line items table
4. In the Manage Imprints modal:
   - Select which line items should have imprints
   - Upload artwork using the "Upload Artwork" button
   - Set location: "Front"
   - Add ink colors: "Black", "White"
   - Select pricing matrix from dropdown
   - Review calculated price
5. Click **Save & Close**

**Note:** To save imprint data to the database, you must first save the quote. The Manage Imprints modal will work with unsaved quotes but will prompt you to save the quote before persisting imprint data.

## Visual Features

- **Color-coded sections** in Manage Imprints modal for easy navigation
- **Matrix type badges** in Price Matrices list (blue badges)
- **Active status indicators** (green badges)
- **Centralized imprint management** with "+ Imprint(s)" button
- **Real-time price calculation** as you select matrices and adjust quantities

## Security

- All data is company-isolated with Row Level Security (RLS)
- Only authenticated users from your company can view/edit imprints
- Artwork files are stored securely in Supabase Storage
- Admin-only access to pricing matrices management
