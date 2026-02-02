# S&S Catalog Sync Testing Guide

## Manual Testing

### Method 1: Using the Supabase Dashboard

1. Go to your Supabase Dashboard
2. Navigate to **Edge Functions**
3. Find `sync-ss-catalog` function
4. Click **Invoke** button
5. Use an empty JSON body: `{}`
6. Check the response and logs

### Method 2: Using curl

```bash
curl -X POST \
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-ss-catalog' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

Replace:
- `YOUR_PROJECT_REF` with your Supabase project reference
- `YOUR_SERVICE_ROLE_KEY` with your service role key (from Settings > API)

### Method 3: Using SQL Function

```sql
-- Trigger the sync manually via SQL
SELECT trigger_catalog_sync();
```

## Checking Sync Results

After running the sync, check if data was populated:

```sql
-- Check catalog table counts
SELECT
  (SELECT COUNT(*) FROM styles) as styles_count,
  (SELECT COUNT(*) FROM parts) as parts_count,
  (SELECT COUNT(*) FROM inventory) as inventory_count,
  (SELECT COUNT(*) FROM images) as images_count;

-- View synced styles
SELECT
  style_number,
  brand,
  name,
  last_synced
FROM styles
ORDER BY last_synced DESC
LIMIT 10;

-- View parts for a specific style
SELECT
  p.part_id,
  p.color_name,
  p.size,
  s.style_number
FROM parts p
JOIN styles s ON p.style_id = s.id
WHERE s.style_number = 'YOUR_STYLE_NUMBER'
ORDER BY p.color_name, p.size;
```

## Troubleshooting

### Check if SSActivewear is enabled
```sql
SELECT
  id,
  ssactivewear_enabled,
  ssactivewear_username,
  CASE
    WHEN ssactivewear_api_key_encrypted IS NOT NULL THEN 'Configured'
    ELSE 'Missing'
  END as api_key_status
FROM company_settings
WHERE ssactivewear_enabled = true;
```

### Check if there are styles to sync
```sql
SELECT
  COUNT(DISTINCT item_number) as unique_styles
FROM quote_line_items
WHERE company_id = 'YOUR_COMPANY_ID'
  AND item_number IS NOT NULL;
```

### View sync logs
Check the Edge Function logs in the Supabase Dashboard under:
**Edge Functions** > **sync-ss-catalog** > **Logs**

Look for:
- `🔄 Starting S&S Catalog Sync...`
- `📊 Found X companies to sync`
- `📦 Found X unique styles for company`
- `✅ Successfully synced style: XXXX`

## Expected Behavior

1. **Sync starts**: Looks for companies with SSActivewear enabled
2. **Fetches styles**: Gets unique item numbers from quote_line_items
3. **Calls PromoStandards**: Makes API calls for each style
4. **Writes to database**: Upserts data into styles, parts, inventory, and images tables
5. **Returns summary**: Shows total styles processed, success/failure counts

## Common Issues

### Issue: No companies found
**Solution**: Enable SSActivewear in Account Settings and configure credentials

### Issue: No styles found
**Solution**: Create at least one quote with garments that have item numbers

### Issue: PromoStandards API fails
**Solution**:
- Verify SSActivewear credentials are correct
- Check that API key is properly encrypted
- Test credentials using the promostandards-unified function first

### Issue: Database write fails
**Solution**:
- Check that unique constraints exist on tables
- Verify RLS policies allow writes
- Check error logs for specific SQL errors
