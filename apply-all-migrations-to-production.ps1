# PowerShell script to apply all migrations to production database

Write-Host ""
Write-Host "=== Applying All Migrations to Production ===" -ForegroundColor Cyan
Write-Host ""

# Read the migration file
$migrationFile = "PRODUCTION_COMPLETE_MIGRATION.sql"
if (-not (Test-Path $migrationFile)) {
    Write-Host "Error: Migration file not found: $migrationFile" -ForegroundColor Red
    exit 1
}

$sql = Get-Content $migrationFile -Raw
Write-Host "Loaded migration file: $($sql.Length) characters" -ForegroundColor Green

Write-Host ""
Write-Host "Open your Supabase SQL Editor to apply:" -ForegroundColor Yellow
Write-Host "https://supabase.com/dashboard/project/gccvdsxiqgbxhdyamzaa/sql/new" -ForegroundColor Cyan
Write-Host ""
Write-Host "The migration SQL has been copied to your clipboard!" -ForegroundColor Green
Write-Host ""

# Copy to clipboard (Windows)
$sql | Set-Clipboard

Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Paste into the SQL Editor (Ctrl+V)"
Write-Host "2. Click 'Run'"
Write-Host "3. Wait 30 seconds for schema reload"
Write-Host "4. Refresh your application"
Write-Host ""
