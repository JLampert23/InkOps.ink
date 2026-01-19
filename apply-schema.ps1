# PowerShell Script to Apply Supabase Schema Updates
# Usage: .\apply-schema.ps1

param(
    [string]$ProjectUrl = $env:VITE_SUPABASE_URL,
    [string]$ServiceRoleKey = $env:SUPABASE_SERVICE_ROLE_KEY,
    [string]$SqlFile = "COMPLETE_DATABASE_SCHEMA.sql"
)

Write-Host "Supabase Schema Updater" -ForegroundColor Cyan
Write-Host "======================" -ForegroundColor Cyan
Write-Host ""

# Check if .env file exists and load it
if (Test-Path ".env") {
    Write-Host "Loading environment variables from .env..." -ForegroundColor Yellow
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            if (-not [string]::IsNullOrEmpty($key) -and $key -notlike '#*') {
                Set-Item -Path "env:$key" -Value $value
            }
        }
    }
    $ProjectUrl = $env:VITE_SUPABASE_URL
    $ServiceRoleKey = $env:SUPABASE_SERVICE_ROLE_KEY
}

# Validate parameters
if ([string]::IsNullOrEmpty($ProjectUrl)) {
    Write-Host "ERROR: Project URL not found!" -ForegroundColor Red
    Write-Host "Set VITE_SUPABASE_URL in .env or pass -ProjectUrl parameter" -ForegroundColor Red
    exit 1
}

if ([string]::IsNullOrEmpty($ServiceRoleKey)) {
    Write-Host "ERROR: Service Role Key not found!" -ForegroundColor Red
    Write-Host "Set SUPABASE_SERVICE_ROLE_KEY in .env or pass -ServiceRoleKey parameter" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $SqlFile)) {
    Write-Host "ERROR: SQL file not found: $SqlFile" -ForegroundColor Red
    exit 1
}

Write-Host "Project URL: $ProjectUrl" -ForegroundColor Green
Write-Host "SQL File: $SqlFile" -ForegroundColor Green
Write-Host ""

# Read SQL file
Write-Host "Reading SQL file..." -ForegroundColor Yellow
$sqlContent = Get-Content $SqlFile -Raw

# Prepare API endpoint
$apiUrl = "$ProjectUrl/rest/v1/rpc/exec_sql"

# For Supabase, we need to use the PostgREST API or Management API
# Since we can't directly execute arbitrary SQL via REST API,
# we'll use the Supabase Management API or output instructions

Write-Host ""
Write-Host "IMPORTANT: Direct SQL execution via API requires Management API access" -ForegroundColor Yellow
Write-Host ""
Write-Host "RECOMMENDED APPROACH:" -ForegroundColor Cyan
Write-Host "1. Go to: $ProjectUrl/project/default/sql" -ForegroundColor White
Write-Host "2. Click 'New Query'" -ForegroundColor White
Write-Host "3. Copy the contents of: $SqlFile" -ForegroundColor White
Write-Host "4. Paste into the SQL Editor" -ForegroundColor White
Write-Host "5. Click 'Run' or press Ctrl+Enter" -ForegroundColor White
Write-Host ""

# Offer to open the SQL file in notepad for easy copying
$response = Read-Host "Would you like to open the SQL file now for copying? (Y/N)"
if ($response -eq "Y" -or $response -eq "y") {
    notepad $SqlFile
}

Write-Host ""
Write-Host "Schema update process initiated." -ForegroundColor Green
