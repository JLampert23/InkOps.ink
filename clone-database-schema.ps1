# PowerShell Script to Help Clone Database Schema from Sandbox to Live
# This script helps you copy SQL and provides instructions

param(
    [Parameter(Position=0)]
    [string]$Action = "menu"
)

$SANDBOX_URL = "https://cuaukcvccxvfpuxaciac.supabase.co"
$LIVE_URL = "https://rhetupzcrsufhiruacoo.supabase.co"

function Show-Menu {
    Clear-Host
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  Clone Database Schema Helper" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "SANDBOX Database:" -ForegroundColor Yellow
    Write-Host "  $SANDBOX_URL" -ForegroundColor White
    Write-Host ""
    Write-Host "LIVE Database:" -ForegroundColor Yellow
    Write-Host "  $LIVE_URL" -ForegroundColor White
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "What would you like to do?" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. Copy schema SQL to clipboard (for LIVE database)" -ForegroundColor White
    Write-Host "2. Open LIVE database dashboard" -ForegroundColor White
    Write-Host "3. Open SANDBOX database dashboard" -ForegroundColor White
    Write-Host "4. Show database verification query" -ForegroundColor White
    Write-Host "5. Show Vercel environment variables" -ForegroundColor White
    Write-Host "6. Complete guided setup" -ForegroundColor Green
    Write-Host "Q. Quit" -ForegroundColor White
    Write-Host ""
}

function Copy-SchemaToClipboard {
    Write-Host ""
    Write-Host "Copying COMPLETE_DATABASE_SCHEMA.sql to clipboard..." -ForegroundColor Yellow

    if (-not (Test-Path "COMPLETE_DATABASE_SCHEMA.sql")) {
        Write-Host "ERROR: COMPLETE_DATABASE_SCHEMA.sql not found!" -ForegroundColor Red
        Write-Host "Make sure you're in the project directory." -ForegroundColor Red
        return
    }

    try {
        $content = Get-Content "COMPLETE_DATABASE_SCHEMA.sql" -Raw
        $content | Set-Clipboard
        Write-Host ""
        Write-Host "SUCCESS! Schema copied to clipboard!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Cyan
        Write-Host "1. Go to LIVE database dashboard (option 2 in menu)" -ForegroundColor White
        Write-Host "2. Click SQL Editor -> New Query" -ForegroundColor White
        Write-Host "3. Press Ctrl+V to paste the schema" -ForegroundColor White
        Write-Host "4. Click RUN (wait 30-60 seconds)" -ForegroundColor White
        Write-Host "5. Verify 23 tables were created" -ForegroundColor White
        Write-Host ""
    }
    catch {
        Write-Host "ERROR: Failed to copy to clipboard: $_" -ForegroundColor Red
    }
}

function Open-LiveDashboard {
    Write-Host ""
    Write-Host "Opening LIVE database dashboard..." -ForegroundColor Green
    $url = "https://supabase.com/dashboard/project/rhetupzcrsufhiruacoo/editor"
    Start-Process $url
    Write-Host "Dashboard opened in browser" -ForegroundColor Green
}

function Open-SandboxDashboard {
    Write-Host ""
    Write-Host "Opening SANDBOX database dashboard..." -ForegroundColor Green
    $url = "https://supabase.com/dashboard/project/cuaukcvccxvfpuxaciac/editor"
    Start-Process $url
    Write-Host "Dashboard opened in browser" -ForegroundColor Green
}

function Show-VerificationQuery {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Database Verification Queries" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Run these in Supabase SQL Editor to verify setup:" -ForegroundColor Yellow
    Write-Host ""

    $query = @"
-- 1. Count tables (should return 23)
SELECT COUNT(*) as table_count
FROM information_schema.tables
WHERE table_schema = 'public';

-- 2. List all tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- 3. Verify RLS is enabled (all should be TRUE)
SELECT tablename, rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 4. Check auth function exists
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'handle_new_user';

-- 5. Check auth trigger exists
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
"@

    Write-Host $query -ForegroundColor White
    Write-Host ""
    Write-Host "Copy to clipboard? (Y/N)" -ForegroundColor Yellow
    $response = Read-Host
    if ($response -eq "Y" -or $response -eq "y") {
        $query | Set-Clipboard
        Write-Host "Verification queries copied to clipboard!" -ForegroundColor Green
    }
    Write-Host ""
}

function Show-VercelEnvVars {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Vercel Environment Variables" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Add these to Vercel (Settings -> Environment Variables):" -ForegroundColor Yellow
    Write-Host ""

    Write-Host "For PRODUCTION (LIVE database):" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Variable 1:" -ForegroundColor White
    Write-Host "  Name:  VITE_SUPABASE_URL" -ForegroundColor White
    Write-Host "  Value: $LIVE_URL" -ForegroundColor Green
    Write-Host ""
    Write-Host "Variable 2:" -ForegroundColor White
    Write-Host "  Name:  VITE_SUPABASE_ANON_KEY" -ForegroundColor White
    Write-Host "  Value: [Get from LIVE database Settings -> API]" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "For TESTING (SANDBOX database):" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Variable 1:" -ForegroundColor White
    Write-Host "  Name:  VITE_SUPABASE_URL" -ForegroundColor White
    Write-Host "  Value: $SANDBOX_URL" -ForegroundColor Green
    Write-Host ""
    Write-Host "Variable 2:" -ForegroundColor White
    Write-Host "  Name:  VITE_SUPABASE_ANON_KEY" -ForegroundColor White
    Write-Host "  Value: [Get from SANDBOX database Settings -> API]" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "IMPORTANT:" -ForegroundColor Red
    Write-Host "- Select ALL environments (Production, Preview, Development)" -ForegroundColor White
    Write-Host "- After adding variables, REDEPLOY with build cache disabled" -ForegroundColor White
    Write-Host ""
}

function Start-GuidedSetup {
    Clear-Host
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  Guided Database Cloning Setup" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""

    # Step 1
    Write-Host "STEP 1: Create Backup" -ForegroundColor Green
    Write-Host "Before making any changes, let's backup the LIVE database" -ForegroundColor White
    Write-Host ""
    Write-Host "Action required:" -ForegroundColor Yellow
    Write-Host "1. I'll open the LIVE database dashboard" -ForegroundColor White
    Write-Host "2. Go to Database -> Backups" -ForegroundColor White
    Write-Host "3. Click 'Create backup now'" -ForegroundColor White
    Write-Host "4. Wait for completion (green checkmark)" -ForegroundColor White
    Write-Host ""
    Write-Host "Press Enter to open LIVE dashboard..." -ForegroundColor Yellow
    Read-Host
    Open-LiveDashboard
    Write-Host ""
    Write-Host "Did you create the backup? (Y/N)" -ForegroundColor Yellow
    $response = Read-Host
    if ($response -ne "Y" -and $response -ne "y") {
        Write-Host "Please create a backup before continuing!" -ForegroundColor Red
        return
    }

    # Step 2
    Write-Host ""
    Write-Host "STEP 2: Copy Schema to Clipboard" -ForegroundColor Green
    Write-Host "Press Enter to copy the schema SQL..." -ForegroundColor Yellow
    Read-Host
    Copy-SchemaToClipboard
    Write-Host "Schema copied! Keep this clipboard content." -ForegroundColor Green

    # Step 3
    Write-Host ""
    Write-Host "STEP 3: Apply Schema to LIVE Database" -ForegroundColor Green
    Write-Host ""
    Write-Host "Action required:" -ForegroundColor Yellow
    Write-Host "1. In the LIVE dashboard (should already be open)" -ForegroundColor White
    Write-Host "2. Click 'SQL Editor' -> 'New Query'" -ForegroundColor White
    Write-Host "3. Press Ctrl+V to paste the schema" -ForegroundColor White
    Write-Host "4. Click 'RUN' button" -ForegroundColor White
    Write-Host "5. Wait 30-60 seconds for completion" -ForegroundColor White
    Write-Host ""
    Write-Host "Press Enter when schema is applied..." -ForegroundColor Yellow
    Read-Host

    # Step 4
    Write-Host ""
    Write-Host "STEP 4: Verify Schema" -ForegroundColor Green
    Write-Host "Let's verify the schema was applied correctly" -ForegroundColor White
    Write-Host ""
    Show-VerificationQuery
    Write-Host "Did verification queries show 23 tables? (Y/N)" -ForegroundColor Yellow
    $response = Read-Host
    if ($response -ne "Y" -and $response -ne "y") {
        Write-Host "Schema may not be complete. Check for errors in SQL Editor." -ForegroundColor Red
        return
    }

    # Step 5
    Write-Host ""
    Write-Host "STEP 5: Get LIVE Database Credentials" -ForegroundColor Green
    Write-Host ""
    Write-Host "Action required:" -ForegroundColor Yellow
    Write-Host "1. In LIVE dashboard, go to Settings -> API" -ForegroundColor White
    Write-Host "2. Copy the 'Project URL' (should be $LIVE_URL)" -ForegroundColor White
    Write-Host "3. Copy the 'anon / public' key (click eye icon)" -ForegroundColor White
    Write-Host "4. Keep these values ready for Vercel" -ForegroundColor White
    Write-Host ""
    Write-Host "Press Enter when you have the credentials..." -ForegroundColor Yellow
    Read-Host

    # Step 6
    Write-Host ""
    Write-Host "STEP 6: Configure Vercel" -ForegroundColor Green
    Write-Host ""
    Show-VercelEnvVars
    Write-Host "Action required:" -ForegroundColor Yellow
    Write-Host "1. Open https://vercel.com" -ForegroundColor White
    Write-Host "2. Go to your project -> Settings -> Environment Variables" -ForegroundColor White
    Write-Host "3. Add VITE_SUPABASE_URL = $LIVE_URL" -ForegroundColor White
    Write-Host "4. Add VITE_SUPABASE_ANON_KEY = [your copied key]" -ForegroundColor White
    Write-Host "5. Select ALL environments for both variables" -ForegroundColor White
    Write-Host "6. Click Save" -ForegroundColor White
    Write-Host ""
    Write-Host "Press Enter when Vercel is configured..." -ForegroundColor Yellow
    Read-Host

    # Step 7
    Write-Host ""
    Write-Host "STEP 7: Redeploy Vercel" -ForegroundColor Green
    Write-Host ""
    Write-Host "Action required:" -ForegroundColor Yellow
    Write-Host "1. In Vercel, go to Deployments tab" -ForegroundColor White
    Write-Host "2. Click '...' menu on latest deployment" -ForegroundColor White
    Write-Host "3. Click 'Redeploy'" -ForegroundColor White
    Write-Host "4. UNCHECK 'Use existing build cache'" -ForegroundColor White
    Write-Host "5. Click 'Redeploy'" -ForegroundColor White
    Write-Host "6. Wait 2-3 minutes for deployment" -ForegroundColor White
    Write-Host ""
    Write-Host "Press Enter when deployment is complete..." -ForegroundColor Yellow
    Read-Host

    # Step 8
    Write-Host ""
    Write-Host "STEP 8: Test Account Creation" -ForegroundColor Green
    Write-Host ""
    Write-Host "Action required:" -ForegroundColor Yellow
    Write-Host "1. Visit your Vercel URL" -ForegroundColor White
    Write-Host "2. Press F12 to open DevTools" -ForegroundColor White
    Write-Host "3. Go to Console tab" -ForegroundColor White
    Write-Host "4. Try to create a new account" -ForegroundColor White
    Write-Host "5. Check for errors in console" -ForegroundColor White
    Write-Host ""
    Write-Host "Did account creation work? (Y/N)" -ForegroundColor Yellow
    $response = Read-Host

    Write-Host ""
    if ($response -eq "Y" -or $response -eq "y") {
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "  SUCCESS! Setup Complete!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Your LIVE database is now ready!" -ForegroundColor Green
        Write-Host "Vercel is connected and working!" -ForegroundColor Green
        Write-Host ""
    }
    else {
        Write-Host "========================================" -ForegroundColor Red
        Write-Host "  Troubleshooting Needed" -ForegroundColor Red
        Write-Host "========================================" -ForegroundColor Red
        Write-Host ""
        Write-Host "Check these files for help:" -ForegroundColor Yellow
        Write-Host "- VERCEL_DEPLOYMENT_FIX.md (detailed troubleshooting)" -ForegroundColor White
        Write-Host "- CLONE_SANDBOX_TO_LIVE.md (complete guide)" -ForegroundColor White
        Write-Host ""
        Write-Host "Common issues:" -ForegroundColor Yellow
        Write-Host "1. Wrong Supabase credentials in Vercel" -ForegroundColor White
        Write-Host "2. Forgot to redeploy after adding env vars" -ForegroundColor White
        Write-Host "3. Auth trigger not created in database" -ForegroundColor White
        Write-Host ""
    }
}

# Main menu loop
if ($Action -eq "guided") {
    Start-GuidedSetup
    exit
}

do {
    Show-Menu
    $choice = Read-Host "Enter your choice"

    switch ($choice) {
        "1" {
            Copy-SchemaToClipboard
            Read-Host "Press Enter to continue"
        }
        "2" {
            Open-LiveDashboard
            Read-Host "Press Enter to continue"
        }
        "3" {
            Open-SandboxDashboard
            Read-Host "Press Enter to continue"
        }
        "4" {
            Show-VerificationQuery
            Read-Host "Press Enter to continue"
        }
        "5" {
            Show-VercelEnvVars
            Read-Host "Press Enter to continue"
        }
        "6" {
            Start-GuidedSetup
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
