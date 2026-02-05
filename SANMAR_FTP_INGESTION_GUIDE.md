# SanMar FTP Ingestion Pipeline - Complete Guide

## Overview

The SanMar FTP ingestion pipeline automatically downloads and processes product catalog data from SanMar's SFTP server on a scheduled basis. This system maintains a local cache of SanMar's product catalog for fast searches and real-time inventory lookups.

## Architecture

### Components

1. **SFTP Client** (`sanmar-ftp-client.ts`)
   - Connects to ftp.sanmar.com:2200
   - Downloads catalog files using curl with SFTP protocol
   - Validates required files are present

2. **File Parsers** (`sanmar-file-parsers.ts`)
   - Parses SDL (CSV), EPDD (CSV), PDD (pipe-delimited), DIP (pipe-delimited), and Catalog (tab-delimited)
   - Deduplicates EPDD rows by unique_key
   - Merges data from multiple sources

3. **Sync Function** (`sanmar-ftp-sync/index.ts`)
   - Edge function that orchestrates the sync process
   - Supports full catalog sync and inventory-only sync
   - Stores data in sanmar_catalog_* tables

4. **Database Tables**
   - `sanmar_catalog_styles` - Master product data
   - `sanmar_catalog_products` - Individual SKUs
   - `sanmar_catalog_inventory` - Warehouse inventory
   - `sanmar_catalog_pricing` - Pricing tiers

5. **Cron Jobs**
   - Full sync: Nightly at 2 AM
   - Inventory sync: Hourly during business hours (8 AM - 8 PM)

## Database Schema

### sanmar_catalog_styles
Stores master product information from SDL (Style Data Library)

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| company_id | uuid | Company reference |
| style_number | text | Style number (e.g., "PC54") |
| style_name | text | Product name |
| brand_name | text | Brand (e.g., "Port & Company") |
| category | text | Product category |
| product_description | text | Extended description |
| fabric_content | text | Fabric composition |
| construction | text | Construction details |
| weight | text | Product weight |
| gender | text | Gender category |
| fit | text | Fit description |
| country_of_origin | text | Manufacturing country |
| is_closeout | boolean | Closeout flag |
| is_new | boolean | New product flag |
| is_active | boolean | Active status |
| raw_data | jsonb | Original data |
| created_at | timestamptz | Created timestamp |
| updated_at | timestamptz | Updated timestamp |

### sanmar_catalog_products
Stores individual SKU/part data from EPDD (Enhanced Product Data Download)

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| company_id | uuid | Company reference |
| unique_key | text | Style_Color_Size identifier |
| style_id | uuid | Reference to sanmar_catalog_styles |
| style_number | text | Style number |
| color_name | text | Color name |
| color_code | text | Color code |
| size_name | text | Size name |
| sku | text | SanMar SKU |
| upc | text | UPC code |
| gtin | text | GTIN from PDD file |
| piece_weight | decimal | Weight per piece |
| case_weight | decimal | Weight per case |
| case_quantity | integer | Pieces per case |
| image_front | text | Front image URL |
| image_back | text | Back image URL |
| image_side | text | Side image URL |
| image_lifestyle | text | Lifestyle image URL |
| raw_data | jsonb | Original data |
| created_at | timestamptz | Created timestamp |
| updated_at | timestamptz | Updated timestamp |

### sanmar_catalog_inventory
Stores warehouse inventory from DIP (Daily Inventory and Pricing)

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| company_id | uuid | Company reference |
| unique_key | text | Style_Color_Size identifier |
| product_id | uuid | Reference to sanmar_catalog_products |
| warehouse_code | text | Warehouse identifier |
| warehouse_name | text | Warehouse name |
| quantity_available | integer | Available quantity |
| quantity_on_order | integer | On-order quantity |
| eta_date | date | Expected arrival date |
| last_updated | timestamptz | Last update timestamp |

### sanmar_catalog_pricing
Stores pricing tiers from DIP

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| company_id | uuid | Company reference |
| unique_key | text | Style_Color_Size identifier |
| product_id | uuid | Reference to sanmar_catalog_products |
| price_type | text | Price type (standard, sale, etc.) |
| quantity_min | integer | Minimum quantity |
| quantity_max | integer | Maximum quantity |
| unit_price | decimal | Unit price |
| is_sale | boolean | Sale flag |
| sale_price | decimal | Sale price |
| sale_end_date | date | Sale end date |
| created_at | timestamptz | Created timestamp |
| updated_at | timestamptz | Updated timestamp |

## File Formats

### SDL (SanMar_SDL_N.csv)
Style-level product data in CSV format.

**Columns:**
- Style Number
- Style Name
- Brand Name
- Category
- Description
- Fabric Content
- Construction
- Weight
- Gender
- Fit
- Country of Origin
- Is Closeout (boolean)
- Is New (boolean)

**Note:** SDL contains NO inventory data, only product attributes.

### EPDD (SanMar_EPDD.csv)
SKU-level product data with inventory in CSV format.

**Columns:**
- Style Number
- Color Name
- Size Name
- Color Code
- SKU
- UPC
- Piece Weight
- Case Weight
- Case Quantity
- Image Front
- Image Back
- Image Side
- Image Lifestyle
- Inventory Available

**Important:** EPDD can have duplicate rows. The system deduplicates by unique_key (style + color + size).

### PDD (sanmar_pdd.txt)
GTIN and extended descriptions in pipe-delimited format.

**Columns:**
- Style Number | SKU | GTIN | Extended Description

### DIP (sanmar_dip.txt)
Daily inventory and pricing in pipe-delimited format.

**Record Types:**
- `I` = Inventory record
- `P` = Pricing record

**Inventory Format:**
- Record Type | Style | Color | Size | Warehouse Code | Warehouse Name | Qty Available | Qty On Order | ETA Date

**Pricing Format:**
- Record Type | Style | Color | Size | Price Type | Qty Min | Qty Max | Unit Price | Is Sale | Sale Price | Sale End Date

### Catalog (Catalog.txt)
Extended descriptions in tab-delimited format.

**Columns:**
- Style Number \t Description \t Extended Description

## Sync Process

### Full Catalog Sync (Nightly at 2 AM)

1. **Download Files**
   - Connects to ftp.sanmar.com:2200 via SFTP
   - Downloads all required files from /SanMarPDD/
   - Validates all required files were downloaded successfully

2. **Parse Files**
   - SDL → Style master data
   - EPDD → SKU data with images
   - PDD → GTINs and extended descriptions
   - DIP → Inventory and pricing
   - Catalog → Additional descriptions

3. **Merge Data**
   - Combines SDL + Catalog + PDD for complete style descriptions
   - Deduplicates EPDD by unique_key
   - Links products to styles

4. **Sync to Database**
   - Upserts styles to `sanmar_catalog_styles`
   - Upserts products to `sanmar_catalog_products`
   - Upserts inventory to `sanmar_catalog_inventory`
   - Upserts pricing to `sanmar_catalog_pricing`

### Inventory-Only Sync (Hourly 8 AM - 8 PM)

1. **Download DIP File**
   - Downloads only sanmar_dip.txt

2. **Parse DIP**
   - Extracts inventory records
   - Extracts pricing records

3. **Update Database**
   - Updates inventory quantities
   - Updates pricing (including sale prices)

## Configuration

### Required Settings

In `company_settings` table:
- `sanmar_enabled` = true
- `sanmar_username` = Your SanMar customer number
- `sanmar_password_encrypted` = Encrypted FTP password

### FTP Connection Details

- **Host:** ftp.sanmar.com
- **Port:** 2200
- **Protocol:** SFTP
- **Path:** /SanMarPDD/
- **Authentication:** Username/Password (Basic Auth)

## API Usage

### Trigger Manual Sync

**Full Catalog Sync:**
```bash
POST /functions/v1/sanmar-ftp-sync
Content-Type: application/json
Authorization: Bearer <token>

{
  "companyId": "uuid",
  "syncType": "full"
}
```

**Inventory-Only Sync:**
```bash
POST /functions/v1/sanmar-ftp-sync
Content-Type: application/json
Authorization: Bearer <token>

{
  "companyId": "uuid",
  "syncType": "inventory"
}
```

### Response Format

```json
{
  "success": true,
  "syncType": "full",
  "stats": {
    "styles": 5000,
    "products": 150000,
    "inventoryRows": 200000,
    "pricingRows": 50000
  }
}
```

## Cron Jobs

### Viewing Active Jobs

```sql
SELECT * FROM cron.job;
```

### Manually Triggering Jobs

**Full Sync:**
```sql
SELECT trigger_sanmar_full_sync();
```

**Inventory Sync:**
```sql
SELECT trigger_sanmar_inventory_sync();
```

### Disabling Jobs

```sql
SELECT cron.unschedule('sanmar-full-sync-nightly');
SELECT cron.unschedule('sanmar-inventory-sync-hourly');
```

### Re-enabling Jobs

```sql
-- Full sync at 2 AM daily
SELECT cron.schedule(
  'sanmar-full-sync-nightly',
  '0 2 * * *',
  'SELECT trigger_sanmar_full_sync();'
);

-- Inventory sync hourly from 8 AM to 8 PM
SELECT cron.schedule(
  'sanmar-inventory-sync-hourly',
  '0 8-20 * * *',
  'SELECT trigger_sanmar_inventory_sync();'
);
```

## Querying Catalog Data

### Get All Active Styles

```sql
SELECT *
FROM sanmar_catalog_styles
WHERE company_id = 'your-company-id'
  AND is_active = true
ORDER BY style_number;
```

### Get Products with Inventory

```sql
SELECT
  p.style_number,
  p.color_name,
  p.size_name,
  p.image_front,
  SUM(i.quantity_available) as total_inventory
FROM sanmar_catalog_products p
LEFT JOIN sanmar_catalog_inventory i ON p.id = i.product_id
WHERE p.company_id = 'your-company-id'
GROUP BY p.id, p.style_number, p.color_name, p.size_name, p.image_front
HAVING SUM(i.quantity_available) > 0;
```

### Get Pricing for a Product

```sql
SELECT *
FROM sanmar_catalog_pricing
WHERE company_id = 'your-company-id'
  AND unique_key = 'PC54_Black_L'
ORDER BY quantity_min;
```

## Integration with Product Search

The catalog data can be used to enhance the product search functionality:

1. Search local catalog first for instant results
2. Fall back to PromoStandards SOAP API for real-time data
3. Use cached images from EPDD for fast loading
4. Display inventory levels from DIP data

## Troubleshooting

### Sync Fails to Download Files

**Problem:** SFTP connection fails or files not found

**Solutions:**
- Verify FTP credentials are correct
- Check that curl is available in the Deno environment
- Ensure port 2200 is not blocked
- Verify the file path (/SanMarPDD/) is correct

### Duplicate EPDD Rows

**Problem:** Multiple rows with same unique_key

**Solution:** The parser automatically deduplicates by unique_key during parsing. Check logs for warnings.

### Missing Inventory Data

**Problem:** Products show zero inventory

**Solutions:**
- Check that DIP file was downloaded successfully
- Verify inventory sync ran recently
- Ensure product unique_keys match between EPDD and DIP

### Pricing Not Updating

**Problem:** Sale prices not reflected

**Solutions:**
- Check sale_end_date in sanmar_catalog_pricing
- Verify DIP file contains pricing records (type 'P')
- Check that inventory sync is running hourly

### Cron Jobs Not Running

**Problem:** Scheduled syncs not executing

**Solutions:**
```sql
-- Check if jobs are scheduled
SELECT * FROM cron.job;

-- Check job run history
SELECT * FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;

-- Re-schedule if needed
SELECT cron.schedule(
  'sanmar-full-sync-nightly',
  '0 2 * * *',
  'SELECT trigger_sanmar_full_sync();'
);
```

## Performance Considerations

### Full Sync Duration
- Typical: 5-15 minutes
- Depends on catalog size and network speed
- Runs during low-traffic hours (2 AM)

### Inventory Sync Duration
- Typical: 1-3 minutes
- Only updates inventory and pricing
- Runs hourly during business hours

### Database Size
- Styles: ~5,000 rows
- Products: ~150,000 rows
- Inventory: ~200,000 rows (multiple warehouses)
- Pricing: ~50,000 rows (multiple tiers)

### Indexes
All tables have appropriate indexes on:
- company_id + primary lookup columns
- Foreign key relationships
- Frequently queried columns

## Separation from Other Integrations

This system is **completely independent** of:
- SSActivewear catalog sync
- PromoStandards SOAP API
- Printavo integration

Each integration has its own:
- Database tables (sanmar_catalog_* vs ss_catalog_*)
- Edge functions
- Cron jobs
- Settings flags

## Next Steps

### Optional Enhancements

1. **Add Test Connection Button**
   - Test SFTP credentials in Account Settings
   - Preview available files

2. **Sync Status Dashboard**
   - Show last sync time
   - Display sync statistics
   - Show file download status

3. **Manual Trigger UI**
   - Button to trigger full sync
   - Button to trigger inventory sync
   - Real-time progress indicator

4. **Error Notifications**
   - Email alerts on sync failures
   - Slack/Teams integration
   - Error log viewer in UI

5. **Incremental Updates**
   - Only update changed records
   - Track modification timestamps
   - Delta sync option

## Support

For issues with:
- **SFTP Access:** Contact SanMar Web Services support
- **File Formats:** Refer to SanMar Integration Guide v24.2
- **Integration Issues:** Check edge function logs in Supabase dashboard
