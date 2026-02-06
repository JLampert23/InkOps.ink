# PowerShell Guide for Supabase Schema Update

## Fix Status Column Error First

If you got a "FAILED COLUMN STATUS" error, run this SQL first:

### Step 1: Copy Fix SQL to Clipboard (PowerShell)

```powershell
# Copy the fix SQL to clipboard
Get-Content "FIX_STATUS_COLUMN.sql" | Set-Clipboard
Write-Host "FIX_STATUS_COLUMN.sql copied to clipboard!" -ForegroundColor Green
```

### Step 2: Apply Fix in Supabase Dashboard

1. Go to your Supabase Dashboard → SQL Editor
2. Click "New Query"
3. Press `Ctrl+V` to paste
4. Click "Run" or press `Ctrl+Enter`
5. Wait for success message

---

## Apply Full Schema

### Step 3: Copy Full Schema to Clipboard (PowerShell)

```powershell
# Copy the complete schema to clipboard
Get-Content "COMPLETE_DATABASE_SCHEMA.sql" | Set-Clipboard
Write-Host "COMPLETE_DATABASE_SCHEMA.sql copied to clipboard!" -ForegroundColor Green
```

### Step 4: Apply Schema in Supabase Dashboard

1. In SQL Editor, click "New Query" again
2. Press `Ctrl+V` to paste
3. Click "Run" or press `Ctrl+Enter`
4. Wait for completion (may take 30-60 seconds)

---

## Quick PowerShell Commands

### Copy SQL to Clipboard
```powershell
# Fix status column
Get-Content "FIX_STATUS_COLUMN.sql" | Set-Clipboard

# Full schema
Get-Content "COMPLETE_DATABASE_SCHEMA.sql" | Set-Clipboard

# Individual migration
Get-Content "supabase/migrations/FILENAME.sql" | Set-Clipboard
```

### View Your .env Variables
```powershell
# Show Supabase URL
$env:VITE_SUPABASE_URL

# Show Service Role Key (first 20 chars only for security)
$env:SUPABASE_SERVICE_ROLE_KEY.Substring(0, 20) + "..."
```

### Load .env File into PowerShell Session
```powershell
Get-Content ".env" | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        if (-not [string]::IsNullOrEmpty($key) -and $key -notlike '#*') {
            Set-Item -Path "env:$key" -Value $value
        }
    }
}
Write-Host "Environment variables loaded!" -ForegroundColor Green
```

---

## Troubleshooting Status Column Errors

### Error: "column 'status' already exists"

**Cause:** The status column exists but with wrong type or constraints

**Solution:** Run `FIX_STATUS_COLUMN.sql` first

### Error: "column 'status' of relation 'invoices' does not exist"

**Cause:** Schema was partially applied

**Solution:** Run full `COMPLETE_DATABASE_SCHEMA.sql` again (safe with IF NOT EXISTS)

### Error: "type 'text' does not match existing type 'varchar'"

**Cause:** Status column exists with different data type

**Solution:**
1. Run `FIX_STATUS_COLUMN.sql` to drop the column
2. Run `COMPLETE_DATABASE_SCHEMA.sql` to recreate it

---

## Alternative: Use psql (if available)

If you have PostgreSQL client tools installed:

```powershell
# Set connection string (replace with your values)
$env:PGPASSWORD = "your-db-password"
$conn = "postgresql://postgres:$env:PGPASSWORD@db.your-project.supabase.co:5432/postgres"

# Apply fix SQL
Get-Content "FIX_STATUS_COLUMN.sql" | psql $conn

# Apply full schema
Get-Content "COMPLETE_DATABASE_SCHEMA.sql" | psql $conn
```

---

## Verify Schema Applied Successfully

Run this in Supabase SQL Editor:

```sql
-- Should return 23
SELECT COUNT(*) as table_count
FROM information_schema.tables
WHERE table_schema = 'public';

-- Should show all tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check RLS is enabled (all should be TRUE)
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

---

## Summary

1. ✅ Copy `FIX_STATUS_COLUMN.sql` to clipboard with PowerShell
2. ✅ Paste and run in Supabase Dashboard → SQL Editor
3. ✅ Copy `COMPLETE_DATABASE_SCHEMA.sql` to clipboard
4. ✅ Paste and run in Supabase Dashboard → SQL Editor
5. ✅ Verify 23 tables exist
6. ✅ Done!

PowerShell is perfect for copying SQL files to clipboard for easy pasting into Supabase Dashboard.
