# SanMar Image Ingestion Pipeline

Complete implementation of SanMar product image ingestion, CDN storage, and resolution system.

## Overview

The SanMar image ingestion pipeline downloads product images from SanMar's FTP server, stores them in Supabase Storage (CDN), and provides instant image resolution for product searches. This system is fully isolated from the SSActivewear image logic.

## Architecture

```
SanMar FTP Server
    ↓
[sanmar-image-sync] Edge Function
    ↓
Supabase Storage (sanmar-images bucket)
    ↓
[sanmar_image_map] Database Table
    ↓
[sanmar-image-resolver] Helper
    ↓
[product-search] Edge Function
```

## Components

### 1. Database Table: `sanmar_image_map`

**Purpose**: Maps original FTP filenames to CDN URLs

**Schema**:
```sql
- id (uuid, primary key)
- company_id (uuid) - Multi-tenant isolation
- style (text) - Product style number
- color_code (text) - Color identifier
- image_type (text) - Type of image
  * front_model
  * back_model
  * front_flat
  * back_flat
  * color_swatch
  * thumbnail
  * brand_logo
- original_filename (text) - Original FTP filename
- cdn_url (text) - Full Supabase Storage URL
- file_size (bigint) - File size in bytes
- last_synced_at (timestamptz)
- created_at (timestamptz)
- updated_at (timestamptz)
```

**Indexes**:
- Composite index on (company_id, style, color_code, image_type)
- Index on style for fast style lookups
- Index on last_synced_at for cleanup operations

**RLS Policies**:
- Users can read their company's image mappings
- Service role can manage all mappings

### 2. Storage Bucket: `sanmar-images`

**Configuration**:
- Public read access (CDN-style delivery)
- 10MB file size limit
- Allowed MIME types: JPEG, PNG, GIF, WebP
- Folder structure: `/{style}/{color}/{filename}`

### 3. Edge Function: `sanmar-image-sync`

**Purpose**: Downloads images from FTP and uploads to CDN

**Location**: `/supabase/functions/sanmar-image-sync/index.ts`

**Features**:
- Downloads from two FTP folders:
  - `/Images/EPDD/` - Model and flat shots
  - `/Images/SDL/` - Color swatches, thumbnails, logos
- Uploads to Supabase Storage with organized folder structure
- Creates/updates entries in `sanmar_image_map`
- Handles errors gracefully without failing entire sync

**Invocation**:
```bash
# Manual sync for a specific company
curl -X POST \
  "https://[PROJECT].supabase.co/functions/v1/sanmar-image-sync?company_id=[UUID]" \
  -H "Authorization: Bearer [SERVICE_KEY]"
```

**Response**:
```json
{
  "success": true,
  "imagesProcessed": 150,
  "imagesUploaded": 148,
  "errors": [
    "Could not parse EPDD filename: invalid_file.jpg",
    "Upload failed for PC54_Red.jpg: network error"
  ]
}
```

### 4. Cron Job: Nightly Image Sync

**Schedule**: 2 AM UTC daily (after catalog sync at midnight)

**Database Function**: `trigger_sanmar_image_sync()`

**Cron Job Name**: `sanmar-image-sync-nightly`

**Manual Trigger**:
```sql
-- Trigger for all companies
SELECT trigger_sanmar_image_sync();

-- Trigger for specific company
SELECT manual_sanmar_image_sync('company-uuid-here');
```

### 5. Helper Library: `sanmar-image-resolver.ts`

**Purpose**: Resolves product images from the database

**Location**: `/supabase/functions/_shared/sanmar-image-resolver.ts`

**Key Functions**:

#### `resolveSanMarImages()`
```typescript
const images = await resolveSanMarImages(
  supabase,
  companyId,
  'PC54',
  'Red'
);
// Returns:
// {
//   frontModel: 'https://...cdn.url/PC54/Red/front_model.jpg',
//   backModel: 'https://...cdn.url/PC54/Red/back_model.jpg',
//   frontFlat: 'https://...cdn.url/PC54/Red/front_flat.jpg',
//   backFlat: 'https://...cdn.url/PC54/Red/back_flat.jpg',
//   colorSwatch: 'https://...cdn.url/PC54/Red/swatch.jpg',
//   thumbnail: 'https://...cdn.url/PC54/Red/thumb.jpg',
//   brandLogo: null
// }
```

#### `getSanMarFrontImage()`
```typescript
// Gets best available front image (prioritizes model over flat)
const frontImage = await getSanMarFrontImage(
  supabase,
  companyId,
  'PC54',
  'Red'
);
```

#### `getSanMarBackImage()`
```typescript
// Gets best available back image (prioritizes model over flat)
const backImage = await getSanMarBackImage(
  supabase,
  companyId,
  'PC54',
  'Red'
);
```

#### `sanMarImagesExist()`
```typescript
// Checks if any images exist for a style
const hasImages = await sanMarImagesExist(
  supabase,
  companyId,
  'PC54'
);
```

### 6. Integration: Product Search

**Changes**: Updated `product-search` function to use image resolver

**Implementation**: In `sanmar-provider.ts`, images are now resolved from CDN:

```typescript
// Resolve image URL from sanmar_image_map (CDN)
const imageUrls = await resolveSanMarImages(
  supabaseAdmin,
  companyId,
  styleData.style_number,
  product.color_code
);

// Use front model, then front flat, then thumbnail as fallback
const imageUrl = imageUrls.frontModel ||
                 imageUrls.frontFlat ||
                 imageUrls.thumbnail || "";
```

**Fallback**: If image resolver fails, falls back to building URL from filename.

## FTP Image Folders

### `/Images/EPDD/`
Model and flat photography:
- `{style}_{color}_model_front.jpg` → front_model
- `{style}_{color}_model_back.jpg` → back_model
- `{style}_{color}_flat_front.jpg` → front_flat
- `{style}_{color}_flat_back.jpg` → back_flat

### `/Images/SDL/`
Color swatches, thumbnails, and logos:
- `{style}_{color}_swatch.jpg` → color_swatch
- `{style}_thumbnail.jpg` → thumbnail
- `{brand}_logo.jpg` → brand_logo

## Image Resolution Priority

When resolving images for product display:

1. **Front Image**: front_model → front_flat → thumbnail
2. **Back Image**: back_model → back_flat
3. **Color Swatch**: color_swatch
4. **Thumbnail**: thumbnail → front_flat → front_model

## Security

### Multi-Tenant Isolation
- All queries filtered by `company_id`
- RLS policies enforce company-level access
- Service role bypasses RLS for sync operations

### Storage Security
- Public read access (required for CDN delivery)
- Only service role can upload/modify
- File size and MIME type restrictions

### FTP Credentials
- Encrypted in `company_settings` table
- Decrypted via `crypto-service` edge function
- Never exposed to client

## Error Handling

### Image Sync Errors
- Individual file failures don't stop entire sync
- All errors collected and returned in response
- Logs include detailed error messages

### Image Resolution Errors
- Missing images return `null` (no exceptions)
- Fallback to filename-based URLs if resolver fails
- Never blocks product search results

## Performance Considerations

### Database Indexes
- Composite index on (company_id, style, color_code, image_type)
- Fast lookups for specific style/color combinations
- Efficient filtering by company

### CDN Delivery
- Public bucket enables direct browser access
- No authentication required for image viewing
- Leverages Supabase CDN infrastructure

### Caching
- Images cached indefinitely in CDN
- Database table tracks sync timestamps
- Re-sync updates existing images (upsert)

## Monitoring

### Check Sync Status
```sql
-- Last sync time by company
SELECT company_id, MAX(last_synced_at) as last_sync
FROM sanmar_image_map
GROUP BY company_id;

-- Image count by style
SELECT style, COUNT(*) as image_count
FROM sanmar_image_map
WHERE company_id = 'your-company-id'
GROUP BY style
ORDER BY image_count DESC;

-- Missing image types
SELECT DISTINCT image_type
FROM sanmar_image_map
WHERE company_id = 'your-company-id'
  AND style = 'PC54';
```

### Check Storage Usage
```sql
-- Total image count
SELECT COUNT(*) FROM sanmar_image_map;

-- Total storage size
SELECT SUM(file_size) / 1024 / 1024 as total_mb
FROM sanmar_image_map;

-- Average image size by type
SELECT image_type, AVG(file_size) / 1024 as avg_kb
FROM sanmar_image_map
GROUP BY image_type;
```

## Maintenance

### Cleanup Old Images
```sql
-- Remove images not synced in 90 days
DELETE FROM sanmar_image_map
WHERE last_synced_at < NOW() - INTERVAL '90 days';
```

### Re-sync Specific Style
```sql
-- Delete existing images for a style (will re-download on next sync)
DELETE FROM sanmar_image_map
WHERE company_id = 'your-company-id'
  AND style = 'PC54';

-- Then trigger manual sync
SELECT manual_sanmar_image_sync('your-company-id');
```

### Force Full Re-sync
```sql
-- Clear all images for a company
DELETE FROM sanmar_image_map
WHERE company_id = 'your-company-id';

-- Trigger sync
SELECT manual_sanmar_image_sync('your-company-id');
```

## Troubleshooting

### Images Not Appearing in Product Search

1. **Check if images exist in database**:
```sql
SELECT * FROM sanmar_image_map
WHERE company_id = 'your-company-id'
  AND style = 'PC54';
```

2. **Check if image sync ran**:
```sql
SELECT MAX(last_synced_at) FROM sanmar_image_map
WHERE company_id = 'your-company-id';
```

3. **Manually trigger sync**:
```sql
SELECT manual_sanmar_image_sync('your-company-id');
```

4. **Check FTP credentials**:
```sql
SELECT sanmar_username,
       sanmar_password_encrypted IS NOT NULL as has_password
FROM company_settings
WHERE company_id = 'your-company-id';
```

### Sync Failures

1. **Check edge function logs** in Supabase Dashboard
2. **Verify FTP credentials** are correct
3. **Check FTP server connectivity**
4. **Review error messages** in sync response

### Missing Specific Images

1. **Verify file exists on FTP server**
2. **Check filename parsing logic** in `sanmar-image-sync/index.ts`
3. **Review file naming conventions** in FTP folders
4. **Check MIME type restrictions** on storage bucket

## Isolation from SSActivewear

This implementation is completely isolated:

- **Separate database table**: `sanmar_image_map` (vs SSA's cache tables)
- **Separate storage bucket**: `sanmar-images`
- **Separate edge function**: `sanmar-image-sync`
- **Separate resolver**: `sanmar-image-resolver.ts`
- **No shared utilities**: All logic self-contained
- **Independent cron jobs**: Separate schedules

## Future Enhancements

### Potential Improvements
1. Image optimization (resize, compress, WebP conversion)
2. Lazy loading for large catalogs
3. Background image validation
4. CDN cache warming
5. Delta syncs (only new/changed images)
6. Image placeholder generation
7. Multi-region CDN distribution

### Additional Features
1. Image analytics (most viewed, click tracking)
2. A/B testing different image priorities
3. Custom image transformations
4. Dynamic image serving based on device
5. Progressive image loading
6. Image version history

## Summary

The SanMar image ingestion pipeline provides:

✅ Automated nightly image downloads from FTP
✅ CDN storage with instant global delivery
✅ Fast database lookups with proper indexing
✅ Multi-tenant security with RLS
✅ Graceful error handling
✅ Complete isolation from SSActivewear logic
✅ Integration with product search
✅ Manual trigger capabilities
✅ Comprehensive monitoring and maintenance tools

All images are now served directly from your CDN with sub-second response times.
