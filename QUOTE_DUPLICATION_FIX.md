# Quote Duplication Fix - Complete Implementation

## Problem Summary

When duplicating a quote, the system was only copying a minimal set of fields, resulting in incomplete duplicates that were missing:
- Item numbers
- Colors
- Size breakdowns (all qty_* fields)
- Additional fees
- Imprint blocks
- Proofs and proof artwork
- Many other important fields

## Solution Implemented

Updated the `quote-actions` edge function (`supabase/functions/quote-actions/index.ts`) to perform a comprehensive duplication that copies all relevant data.

## Changes Made

### 1. Quote Table Fields
Now copying all quote fields including:
- Customer contact information (contact_id, customer details)
- Complete billing and shipping addresses (all address fields)
- Financial fields (subtotal, tax_rate, tax_amount, total, discounts)
- Date fields (production_due_date, customer_due_date, payment_due_date)
- Notes fields (notes, customer_notes, production_notes, terms)
- Additional fields (nickname, pricing_reference)

### 2. Line Items - Complete Field Set
Now copying **all** line item fields:
- **Item identification**: item_number, color, sku, description
- **All size quantities**: qty_yxs, qty_ys, qty_ym, qty_yl, qty_yxl, qty_xs, qty_s, qty_m, qty_l, qty_xl, qty_2xl, qty_3xl, qty_4xl, qty_5xl
- **Double sizes**: qty_sm, qty_lxl, qty_ysym, qty_ylyxl
- **Size modes**: size_mode, regular_sizes, double_sizes, youth_sizes, adult_sizes
- **Pricing**: unit_price, total_price, wholesale_price, retail_price, garment_unit_price
- **Supplier information**: supplier_name, supplier_partid, brand, color_code, supplier_metadata, stock_availability
- **Images**: All garment image URLs (front, back, sleeve, rear, side, lifestyle) and garment_images_data
- **Decoration**: decoration_method, decoration_location, artwork_url
- **Imprint details**: imprint_number, num_colors, group_label
- **Other**: line_type, taxed, sort_order, total_quantity, notes

### 3. Quote Imprints
Now duplicating all imprints with complete field set:
- matrix, column_number, type_of_work, details
- mockups, sort_order, location
- price_matrix_id, thread_ink_color, pricing_matrix_column
- group_label, imprint_number, price, num_colors
- artwork_url, artwork_images, garment_images

### 4. Proofs
Now duplicating all proofs with complete field set:
- proof_number, proof_version, status (reset to "pending")
- garment details (garment_image_url, garment_name, garment_brand, garment_description)
- print dimensions (print_width, print_height, print_depth, print_unit)
- composite_image_url, type_of_work
- decoration_location_id, pricing_matrix_id, pricing_matrix_column
- imprint pricing (imprint_unit_price, imprint_setup_fee)
- group_label, selected_colors, notes
- Maintains relationship with duplicated imprints

### 5. Proof Artwork
Now duplicating all proof artwork records:
- artwork_url, artwork_name, artwork_version
- file details (file_type, file_size)
- positioning (position_x, position_y, scale, rotation)
- print dimensions (width_inches, height_inches)
- customer_artwork_id, print_location, sort_order
- Maintains relationship with duplicated proofs and imprints

## Technical Details

### Implementation Strategy
1. Query all related records (line items, imprints, proofs) from original quote
2. Generate new quote number using `generate_quote_number` RPC
3. Create new quote record with all fields (status set to "draft")
4. Insert all line items with complete field mapping
5. Insert all imprints and create ID mapping for relationships
6. Insert all proofs using the imprint ID mapping
7. Insert all proof artwork using the proof ID mapping

### ID Mapping
Created an `imprintIdMap` to properly maintain relationships between:
- Original imprints → New imprints
- Proofs → New imprints
- Proof artwork → New imprints

This ensures all foreign key relationships are preserved in the duplicate.

## Result

Duplicated quotes now contain:
- ✅ All item numbers
- ✅ All colors
- ✅ All size breakdowns (complete qty_* fields)
- ✅ All additional fees (via line_type="fee" in line items)
- ✅ All imprint blocks with complete details
- ✅ All proofs with complete details
- ✅ All proof artwork with complete details
- ✅ All garment images and supplier metadata
- ✅ All customer and billing information
- ✅ All pricing and financial data

The duplicate is an exact copy of the original quote, with only the following differences:
- New quote_id (UUID)
- New quote_number (auto-generated)
- Status set to "draft"
- New created_at timestamp
- created_by set to current user

## Deployment

The updated edge function has been deployed successfully to Supabase.
