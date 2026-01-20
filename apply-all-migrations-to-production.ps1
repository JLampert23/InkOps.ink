# Apply All Migrations to Production Database
# This script combines all migration files into one SQL file for easy application

$ErrorActionPreference = "Stop"

Write-Host "=== Production Migration Helper ===" -ForegroundColor Cyan
Write-Host ""

# Get all migration files in order
$migrationFiles = Get-ChildItem -Path "supabase/migrations" -Filter "*.sql" | Sort-Object Name

if ($migrationFiles.Count -eq 0) {
    Write-Host "No migration files found in supabase/migrations/" -ForegroundColor Red
    exit 1
}

Write-Host "Found $($migrationFiles.Count) migration files" -ForegroundColor Green
Write-Host ""

# Create combined SQL file
$outputFile = "PRODUCTION_COMPLETE_MIGRATION.sql"
$content = @"
/*
  COMPLETE PRODUCTION MIGRATION SCRIPT
  Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

  This file combines all migrations in chronological order.
  Apply this to your production database at:
  https://supabase.com/dashboard/project/cuaukcvccxvfpuxaciac/sql/new

  IMPORTANT:
  1. Run this in the SQL Editor
  2. After completion, run: NOTIFY pgrst, 'reload schema';
  3. Wait 30 seconds for PostgREST to reload
  4. Test your application
*/

-- Start transaction (comment out if you want to apply step by step)
-- BEGIN;

"@

# Append each migration
foreach ($file in $migrationFiles) {
    $content += @"

-- ============================================================================
-- Migration: $($file.Name)
-- ============================================================================

"@

    $migrationContent = Get-Content -Path $file.FullName -Raw
    $content += $migrationContent
    $content += "`n`n"

    Write-Host "  ✓ Added: $($file.Name)" -ForegroundColor Gray
}

# Add schema reload at the end
$content += @"

-- ============================================================================
-- Force PostgREST to reload schema
-- ============================================================================

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

-- Commit transaction (uncomment if you started with BEGIN)
-- COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Uncomment to verify the schema:

-- SELECT table_name
-- FROM information_schema.tables
-- WHERE table_schema = 'public'
-- ORDER BY table_name;

-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'company_settings'
-- ORDER BY ordinal_position;

"@

# Save to file
$content | Out-File -FilePath $outputFile -Encoding UTF8

Write-Host ""
Write-Host "=== Migration file created: $outputFile ===" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Open: https://supabase.com/dashboard/project/cuaukcvccxvfpuxaciac/sql/new"
Write-Host "2. Copy the contents of: $outputFile"
Write-Host "3. Paste into the SQL Editor"
Write-Host "4. Click 'Run' to execute"
Write-Host "5. Wait 30 seconds for schema reload"
Write-Host "6. Test your application at your Vercel URL"
Write-Host ""

# Try to copy to clipboard
try {
    $content | Set-Clipboard
    Write-Host "✓ SQL also copied to clipboard!" -ForegroundColor Green
} catch {
    Write-Host "Note: Could not auto-copy to clipboard. Please open $outputFile manually." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
