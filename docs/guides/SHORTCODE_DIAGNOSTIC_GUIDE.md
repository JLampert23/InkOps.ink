# Short-Code System Diagnostic Tool

Comprehensive audit tool for the communication template short-code system.

## What It Does

This diagnostic script performs a complete health check of your short-code infrastructure by:

1. **Registry Inspection** - Validates all registered short codes have proper keys, descriptions, and data sources
2. **Resolver Verification** - Tests that each short code properly handles data, null values, and edge cases
3. **Template Usage Analysis** - Scans all database templates for unknown, malformed, or missing required codes
4. **Rendering Tests** - Executes mock renders with sample data to catch runtime issues
5. **UI Exposure Check** - Ensures all short codes are properly exposed in the UI reference panel

## Installation

```bash
# Install tsx if not already installed
npm install -D tsx
```

## Running the Diagnostic

### Quick Run

```bash
npx tsx shortcode-diagnostic.ts
```

### Add to package.json

Add this script to your `package.json`:

```json
{
  "scripts": {
    "diagnostic:shortcodes": "tsx shortcode-diagnostic.ts"
  }
}
```

Then run:

```bash
npm run diagnostic:shortcodes
```

## Output

### Console Output

The tool displays real-time progress and a formatted summary:

```
🔍 Starting Short-Code System Diagnostic...

📋 Step 1: Inspecting Short Code Registry...
   Found 52 registered short codes
   Data sources:
     - Customer: 10 codes
     - Quote: 10 codes
     - Invoice: 9 codes
     - Company: 8 codes
     - User: 5 codes
     - Payment: 4 codes
     - System: 3 codes

🔧 Step 2: Verifying Resolver Functions...
   Testing 52 resolvers...
   ✓ Resolver tests complete

📝 Step 3: Analyzing Template Usage...
   Analyzing 8 templates...
   ✓ Template analysis complete

🎨 Step 4: Running Rendering Tests...
   Running render tests on 52 short codes...
   ✓ Rendering tests complete

🖥️  Step 5: Verifying UI Exposure...
   Verifying UI exposure for 52 short codes...
   ✓ UI exposure verification complete

✅ Diagnostic Complete!

================================================================================
SHORT-CODE SYSTEM DIAGNOSTIC REPORT
================================================================================

📊 SUMMARY
────────────────────────────────────────────────────────────────────────────────
Total Short Codes: 52
Total Templates: 8
Total Issues Found: 0
  - Critical: 0
  - Warnings: 0
  - Info: 0

✅ No issues found! The short-code system is functioning correctly.
```

### JSON Report

A detailed JSON report is saved to `shortcode-diagnostic-report.json`:

```json
{
  "registry_issues": [],
  "resolver_issues": [],
  "template_issues": [],
  "render_issues": [],
  "ui_issues": [],
  "summary": {
    "total_short_codes": 52,
    "total_templates": 8,
    "issues_found": 0,
    "critical_issues": 0,
    "warnings": 0
  }
}
```

## Issue Types

### Registry Issues

- **missing_resolver** - Short code has no resolver function
- **missing_description** - Short code lacks user-friendly description
- **invalid_key** - Key format doesn't follow conventions (lowercase, underscores)
- **duplicate_key** - Multiple short codes with same key

### Resolver Issues

- **resolver_not_found** - Resolver function doesn't exist in codebase
- **invalid_return_type** - Returns wrong type (object instead of string)
- **throws_error** - Resolver crashes during execution
- **missing_null_handling** - Doesn't gracefully handle null/undefined input

### Template Issues

- **unknown_short_code** - Template uses unregistered short code
- **missing_required_code** - Template missing required code for its type
- **malformed_code** - Syntax errors like unclosed `{{` brackets
- **deprecated_code** - Uses old/deprecated short codes

### Render Issues

- **empty_output** - Renders as empty string (may be expected)
- **undefined_output** - Renders as literal "undefined" string
- **error_thrown** - Crashes during rendering
- **injection_risk** - Output contains potential XSS vectors
- **object_returned** - Returns `[object Object]` instead of string

### UI Issues

- **missing_in_ui** - Registered but not shown in UI reference panel
- **description_mismatch** - UI description doesn't match registry
- **category_mismatch** - Wrong category assignment
- **deprecated_shown** - Deprecated codes still visible in UI

## Issue Severity Levels

- **CRITICAL** - Must be fixed immediately, causes failures or security risks
- **WARNING** - Should be addressed soon, may cause user confusion or errors
- **INFO** - Nice to fix, minor improvements or edge cases

## Exit Codes

- `0` - Success (no critical issues)
- `1` - Failure (critical issues found)

## When to Run

Run this diagnostic:

- **Before deployment** - Catch issues before they reach production
- **After adding short codes** - Verify new codes integrate properly
- **After template changes** - Ensure templates use valid codes
- **During debugging** - Diagnose template rendering problems
- **In CI/CD pipeline** - Automated quality checks

## CI/CD Integration

Add to your GitHub Actions workflow:

```yaml
- name: Run Short-Code Diagnostic
  run: npm run diagnostic:shortcodes
```

Or GitLab CI:

```yaml
test:shortcodes:
  script:
    - npm run diagnostic:shortcodes
```

## Troubleshooting

### "Cannot find module" errors

Make sure all dependencies are installed:

```bash
npm install
```

### Database connection errors

Ensure your `.env` file has valid Supabase credentials:

```env
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Authentication errors

The diagnostic needs to access the database. If running in CI/CD, you may need to:

1. Use a service role key instead of anon key
2. Temporarily disable RLS for the diagnostic
3. Create a dedicated test user with proper permissions

## Extending the Diagnostic

To add custom checks, edit `shortcode-diagnostic.ts`:

```typescript
// Add a new inspection function
async function inspectCustomLogic(report: DiagnosticReport): Promise<void> {
  // Your custom validation logic
}

// Call it from runDiagnostic()
async function runDiagnostic(): Promise<DiagnosticReport> {
  // ... existing code ...
  await inspectCustomLogic(report);
  // ... rest of code ...
}
```

## Related Documentation

- [Email Template Builder Guide](./EMAIL_TEMPLATES_UI_GUIDE.md)
- [Short Code Engine Guide](./SHORTCODE_ENGINE_GUIDE.md)
- [Communication Templates Schema](./EMAIL_TEMPLATES_SCHEMA_GUIDE.md)

## Support

If you encounter issues with the diagnostic tool itself, please check:

1. TypeScript version compatibility
2. Node.js version (requires 18+)
3. Supabase client library version

## License

Part of the InkOps project.
