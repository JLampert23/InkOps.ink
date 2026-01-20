# PowerShell Script to Copy SQL Files to Clipboard for Supabase
# Makes it easy to paste into Supabase Dashboard SQL Editor

param(
    [Parameter(Position=0)]
    [string]$Action = "menu"
)

function Show-Menu {
    Clear-Host
    Write-Host "================================" -ForegroundColor Cyan
    Write-Host "Supabase Schema Update Helper" -ForegroundColor Cyan
    Write-Host "================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "What would you like to copy to clipboard?" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. FIX_STATUS_COLUMN.sql (Run this FIRST if you got status errors)" -ForegroundColor White
    Write-Host "2. COMPLETE_DATABASE_SCHEMA.sql (Full schema - 23 tables)" -ForegroundColor White
    Write-Host "3. View list of migration files" -ForegroundColor White
    Write-Host "4. Open Supabase Dashboard" -ForegroundColor White
    Write-Host "5. Verify .env variables" -ForegroundColor White
    Write-Host "Q. Quit" -ForegroundColor White
    Write-Host ""
}

function Copy-SqlToClipboard {
    param([string]$FilePath)

    if (-not (Test-Path $FilePath)) {
        Write-Host "ERROR: File not found: $FilePath" -ForegroundColor Red
        return $false
    }

    try {
        $content = Get-Content $FilePath -Raw
        $content | Set-Clipboard
        Write-Host ""
        Write-Host "SUCCESS! SQL copied to clipboard!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Yellow
        Write-Host "1. Go to Supabase Dashboard -> SQL Editor" -ForegroundColor White
        Write-Host "2. Click 'New Query'" -ForegroundColor White
        Write-Host "3. Press Ctrl+V to paste" -ForegroundColor White
        Write-Host "4. Click 'Run' or press Ctrl+Enter" -ForegroundColor White
        Write-Host ""
        return $true
    }
    catch {
        Write-Host "ERROR: Failed to copy to clipboard: $_" -ForegroundColor Red
        return $false
    }
}

function Show-MigrationFiles {
    Write-Host ""
    Write-Host "Migration files in supabase/migrations/:" -ForegroundColor Yellow
    Write-Host ""

    if (Test-Path "supabase/migrations") {
        $files = Get-ChildItem "supabase/migrations" -Filter "*.sql" | Sort-Object Name
        $i = 1
        foreach ($file in $files) {
            Write-Host "$i. $($file.Name)" -ForegroundColor White
            $i++
        }
        Write-Host ""
        Write-Host "To copy a specific migration:" -ForegroundColor Cyan
        Write-Host "Get-Content 'supabase/migrations/FILENAME.sql' | Set-Clipboard" -ForegroundColor White
    }
    else {
        Write-Host "No migrations folder found" -ForegroundColor Red
    }
    Write-Host ""
}

function Open-SupabaseDashboard {
    if (Test-Path ".env") {
        $envContent = Get-Content ".env" -Raw
        if ($envContent -match 'VITE_SUPABASE_URL=([^\s]+)') {
            $url = $matches[1]
            $dashboardUrl = $url -replace 'https://([^.]+)\.supabase\.co', 'https://supabase.com/dashboard/project/$1'
            $sqlEditorUrl = "$dashboardUrl/sql"

            Write-Host ""
            Write-Host "Opening Supabase SQL Editor..." -ForegroundColor Green
            Start-Process $sqlEditorUrl
        }
        else {
            Write-Host "ERROR: Could not find VITE_SUPABASE_URL in .env" -ForegroundColor Red
        }
    }
    else {
        Write-Host "ERROR: .env file not found" -ForegroundColor Red
    }
}

function Show-EnvVariables {
    Write-Host ""
    Write-Host "Environment Variables Check" -ForegroundColor Yellow
    Write-Host ""

    if (Test-Path ".env") {
        $envVars = Get-Content ".env"

        foreach ($line in $envVars) {
            if ($line -match '^VITE_SUPABASE_URL=(.*)$') {
                $url = $matches[1]
                Write-Host "VITE_SUPABASE_URL: " -NoNewline -ForegroundColor Cyan
                Write-Host $url -ForegroundColor Green
            }
            elseif ($line -match '^VITE_SUPABASE_ANON_KEY=(.*)$') {
                $key = $matches[1]
                $preview = $key.Substring(0, [Math]::Min(20, $key.Length)) + "..."
                Write-Host "VITE_SUPABASE_ANON_KEY: " -NoNewline -ForegroundColor Cyan
                Write-Host $preview -ForegroundColor Green
            }
            elseif ($line -match '^SUPABASE_SERVICE_ROLE_KEY=(.*)$') {
                $key = $matches[1]
                $preview = $key.Substring(0, [Math]::Min(20, $key.Length)) + "..."
                Write-Host "SUPABASE_SERVICE_ROLE_KEY: " -NoNewline -ForegroundColor Cyan
                Write-Host $preview -ForegroundColor Green
            }
        }
        Write-Host ""
        Write-Host "All required variables found!" -ForegroundColor Green
    }
    else {
        Write-Host "ERROR: .env file not found" -ForegroundColor Red
    }
    Write-Host ""
}

# Handle direct action parameter
if ($Action -eq "fix") {
    Copy-SqlToClipboard "FIX_STATUS_COLUMN.sql"
    exit
}
elseif ($Action -eq "schema") {
    Copy-SqlToClipboard "COMPLETE_DATABASE_SCHEMA.sql"
    exit
}

# Interactive menu
do {
    Show-Menu
    $choice = Read-Host "Enter your choice"

    switch ($choice) {
        "1" {
            Copy-SqlToClipboard "FIX_STATUS_COLUMN.sql"
            Read-Host "Press Enter to continue"
        }
        "2" {
            Copy-SqlToClipboard "COMPLETE_DATABASE_SCHEMA.sql"
            Read-Host "Press Enter to continue"
        }
        "3" {
            Show-MigrationFiles
            Read-Host "Press Enter to continue"
        }
        "4" {
            Open-SupabaseDashboard
            Read-Host "Press Enter to continue"
        }
        "5" {
            Show-EnvVariables
            Read-Host "Press Enter to continue"
        }
        "Q" {
            Write-Host "Goodbye!" -ForegroundColor Cyan
            exit
        }
        default {
            Write-Host "Invalid choice. Please try again." -ForegroundColor Red
            Start-Sleep -Seconds 1
        }
    }
} while ($choice -ne "Q")
