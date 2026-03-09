# Quick Fix: Status Column Error

## You got a "FAILED COLUMN STATUS" error. Here's the fix:

### OPTION 1: PowerShell (EASIEST)

**Step 1: Run PowerShell Script**
```powershell
.\copy-sql-to-clipboard.ps1
```
- Choose option 1 to copy the fix SQL
- Choose option 4 to open Supabase Dashboard
- Paste and run the SQL

**Step 2: Copy Full Schema**
```powershell
.\copy-sql-to-clipboard.ps1
```
- Choose option 2 to copy the complete schema
- Paste and run in Supabase Dashboard

---

### OPTION 2: Manual (If script doesn't work)

**Step 1: Copy Fix SQL**

In PowerShell:
```powershell
Get-Content "FIX_STATUS_COLUMN.sql" | Set-Clipboard
```

**Step 2: Apply in Supabase**

1. Go to Supabase Dashboard
2. Click "SQL Editor" → "New Query"
3. Press `Ctrl+V` to paste
4. Click "Run"
5. Wait for success message

**Step 3: Copy Full Schema**

In PowerShell:
```powershell
Get-Content "COMPLETE_DATABASE_SCHEMA.sql" | Set-Clipboard
```

**Step 4: Apply Full Schema**

1. In SQL Editor, click "New Query"
2. Press `Ctrl+V` to paste
3. Click "Run"
4. Wait for completion (30-60 seconds)

---

### What the Fix Does

The `FIX_STATUS_COLUMN.sql` file:
- Drops existing status columns that have wrong types
- Removes conflicting constraints
- Cleans up orphaned indexes
- Prepares database for clean schema application

After running the fix, the full schema will apply cleanly.

---

### Files Created for You

1. **copy-sql-to-clipboard.ps1** - Interactive PowerShell menu
2. **FIX_STATUS_COLUMN.sql** - Fixes status column conflicts
3. **COMPLETE_DATABASE_SCHEMA.sql** - Full database schema
4. **POWERSHELL_SCHEMA_UPDATE_GUIDE.md** - Detailed PowerShell guide
5. **SUPABASE_SCHEMA_UPDATE_GUIDE.md** - General schema update guide

---

### Quick PowerShell Commands

```powershell
# Copy fix to clipboard
Get-Content "FIX_STATUS_COLUMN.sql" | Set-Clipboard

# Copy schema to clipboard
Get-Content "COMPLETE_DATABASE_SCHEMA.sql" | Set-Clipboard

# Check your Supabase URL
Get-Content ".env" | Select-String "VITE_SUPABASE_URL"
```

---

### Verify Success

After applying both SQL files, run this in Supabase SQL Editor:

```sql
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';
```

Should return **23** tables.

---

## Summary

1. Run `FIX_STATUS_COLUMN.sql` in Supabase Dashboard
2. Run `COMPLETE_DATABASE_SCHEMA.sql` in Supabase Dashboard
3. Verify 23 tables exist
4. Done!

PowerShell makes it easy - just copy to clipboard and paste into Supabase.
