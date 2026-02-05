/**
 * Short-Code System Diagnostic Script
 *
 * Comprehensive audit tool that inspects the short-code registry,
 * resolver functions, template usage, rendering tests, and UI exposure.
 *
 * Run with: npx tsx shortcode-diagnostic.ts
 */

import { supabase } from './src/lib/supabase-client';
import { ShortCodeEngine } from './src/services/shortcode-service';
import { AVAILABLE_SHORT_CODES, type ShortCodeKey, type ShortCodeData } from './src/types/shortcode';
import { TEMPLATE_TYPE_METADATA } from './src/types/communication-template';

interface DiagnosticReport {
  registry_issues: RegistryIssue[];
  resolver_issues: ResolverIssue[];
  template_issues: TemplateIssue[];
  render_issues: RenderIssue[];
  ui_issues: UIIssue[];
  summary: {
    total_short_codes: number;
    total_templates: number;
    issues_found: number;
    critical_issues: number;
    warnings: number;
  };
}

interface RegistryIssue {
  severity: 'critical' | 'warning' | 'info';
  type: 'missing_resolver' | 'missing_description' | 'invalid_key' | 'duplicate_key';
  short_code: string;
  message: string;
  notes?: string;
}

interface ResolverIssue {
  severity: 'critical' | 'warning' | 'info';
  type: 'resolver_not_found' | 'invalid_return_type' | 'throws_error' | 'missing_null_handling';
  short_code: string;
  message: string;
  details?: string;
}

interface TemplateIssue {
  severity: 'critical' | 'warning' | 'info';
  type: 'unknown_short_code' | 'missing_required_code' | 'malformed_code' | 'deprecated_code';
  template_id: string;
  template_name: string;
  template_type: string;
  short_code?: string;
  message: string;
  location?: 'subject' | 'body';
}

interface RenderIssue {
  severity: 'critical' | 'warning' | 'info';
  type: 'empty_output' | 'undefined_output' | 'error_thrown' | 'injection_risk' | 'object_returned';
  short_code: string;
  message: string;
  output?: any;
  error?: string;
}

interface UIIssue {
  severity: 'critical' | 'warning' | 'info';
  type: 'missing_in_ui' | 'description_mismatch' | 'category_mismatch' | 'deprecated_shown';
  short_code: string;
  message: string;
  expected?: string;
  actual?: string;
}

/**
 * Main diagnostic function
 */
async function runDiagnostic(): Promise<DiagnosticReport> {
  const report: DiagnosticReport = {
    registry_issues: [],
    resolver_issues: [],
    template_issues: [],
    render_issues: [],
    ui_issues: [],
    summary: {
      total_short_codes: 0,
      total_templates: 0,
      issues_found: 0,
      critical_issues: 0,
      warnings: 0,
    },
  };

  console.log('🔍 Starting Short-Code System Diagnostic...\n');

  // 1. Inspect Short Code Registry
  console.log('📋 Step 1: Inspecting Short Code Registry...');
  await inspectRegistry(report);

  // 2. Verify Resolver Functions
  console.log('\n🔧 Step 2: Verifying Resolver Functions...');
  await inspectResolvers(report);

  // 3. Analyze Template Usage
  console.log('\n📝 Step 3: Analyzing Template Usage...');
  await inspectTemplateUsage(report);

  // 4. Run Rendering Tests
  console.log('\n🎨 Step 4: Running Rendering Tests...');
  await testRendering(report);

  // 5. Verify UI Exposure
  console.log('\n🖥️  Step 5: Verifying UI Exposure...');
  await inspectUIExposure(report);

  // Calculate summary
  calculateSummary(report);

  console.log('\n✅ Diagnostic Complete!\n');

  return report;
}

/**
 * 1. Inspect Short Code Registry
 */
async function inspectRegistry(report: DiagnosticReport): Promise<void> {
  const registeredKeys = Object.keys(AVAILABLE_SHORT_CODES) as ShortCodeKey[];
  report.summary.total_short_codes = registeredKeys.length;

  console.log(`   Found ${registeredKeys.length} registered short codes`);

  // Check each registered short code
  for (const key of registeredKeys) {
    const description = AVAILABLE_SHORT_CODES[key];

    // Check for missing description
    if (!description || description.trim() === '') {
      report.registry_issues.push({
        severity: 'warning',
        type: 'missing_description',
        short_code: key,
        message: `Short code '${key}' is missing a description`,
        notes: 'All short codes should have clear, user-friendly descriptions',
      });
    }

    // Check for valid key format (lowercase, underscores only)
    if (!/^[a-z_]+$/.test(key)) {
      report.registry_issues.push({
        severity: 'critical',
        type: 'invalid_key',
        short_code: key,
        message: `Short code '${key}' has invalid format`,
        notes: 'Short code keys must contain only lowercase letters and underscores',
      });
    }
  }

  // Check for duplicate keys (shouldn't happen with TypeScript, but verify)
  const uniqueKeys = new Set(registeredKeys);
  if (uniqueKeys.size !== registeredKeys.length) {
    report.registry_issues.push({
      severity: 'critical',
      type: 'duplicate_key',
      short_code: 'multiple',
      message: 'Duplicate short code keys detected in registry',
      notes: `Found ${registeredKeys.length} keys but only ${uniqueKeys.size} unique keys`,
    });
  }

  // Verify data source categorization
  const dataSources = {
    customer: registeredKeys.filter(k => k.startsWith('customer_')),
    quote: registeredKeys.filter(k => k.startsWith('quote_')),
    invoice: registeredKeys.filter(k => k.startsWith('invoice_')),
    company: registeredKeys.filter(k => k.startsWith('company_')),
    user: registeredKeys.filter(k => k.startsWith('user_')),
    payment: registeredKeys.filter(k => k.startsWith('payment_')),
    system: registeredKeys.filter(k => k.startsWith('current_') || k === 'art_approval_link'),
  };

  console.log(`   Data sources:`);
  console.log(`     - Customer: ${dataSources.customer.length} codes`);
  console.log(`     - Quote: ${dataSources.quote.length} codes`);
  console.log(`     - Invoice: ${dataSources.invoice.length} codes`);
  console.log(`     - Company: ${dataSources.company.length} codes`);
  console.log(`     - User: ${dataSources.user.length} codes`);
  console.log(`     - Payment: ${dataSources.payment.length} codes`);
  console.log(`     - System: ${dataSources.system.length} codes`);
}

/**
 * 2. Verify Resolver Functions
 */
async function inspectResolvers(report: DiagnosticReport): Promise<void> {
  const registeredKeys = Object.keys(AVAILABLE_SHORT_CODES) as ShortCodeKey[];

  console.log(`   Testing ${registeredKeys.length} resolvers...`);

  // Note: In this architecture, there are no explicit resolver functions
  // The ShortCodeEngine uses direct property access on the ShortCodeData object
  // So we check that the rendering engine handles all data types correctly

  for (const key of registeredKeys) {
    try {
      // Test with undefined value
      const testDataUndefined: ShortCodeData = { [key]: undefined };
      const resultUndefined = ShortCodeEngine.renderTemplate(`{{${key}}}`, testDataUndefined);

      if (resultUndefined === 'undefined') {
        report.resolver_issues.push({
          severity: 'critical',
          type: 'invalid_return_type',
          short_code: key,
          message: `Short code '${key}' renders as string 'undefined' when value is undefined`,
          details: 'Should render as empty string when value is missing',
        });
      }

      // Test with null value
      const testDataNull: ShortCodeData = { [key]: null as any };
      const resultNull = ShortCodeEngine.renderTemplate(`{{${key}}}`, testDataNull);

      if (resultNull === 'null') {
        report.resolver_issues.push({
          severity: 'critical',
          type: 'invalid_return_type',
          short_code: key,
          message: `Short code '${key}' renders as string 'null' when value is null`,
          details: 'Should render as empty string when value is null',
        });
      }

      // Test with object value (should be caught)
      const testDataObject: ShortCodeData = { [key]: { test: 'object' } as any };
      const resultObject = ShortCodeEngine.renderTemplate(`{{${key}}}`, testDataObject);

      if (resultObject.includes('[object Object]')) {
        report.resolver_issues.push({
          severity: 'critical',
          type: 'object_returned',
          short_code: key,
          message: `Short code '${key}' renders as '[object Object]' when given object value`,
          details: 'Resolvers should only return strings or numbers, not objects',
        });
      }

    } catch (error) {
      report.resolver_issues.push({
        severity: 'critical',
        type: 'throws_error',
        short_code: key,
        message: `Short code '${key}' throws error during rendering`,
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log(`   ✓ Resolver tests complete`);
}

/**
 * 3. Analyze Template Usage
 */
async function inspectTemplateUsage(report: DiagnosticReport): Promise<void> {
  try {
    // Fetch all templates from database
    const { data: templates, error } = await supabase
      .from('communication_templates')
      .select('*');

    if (error) {
      console.log(`   ⚠️  Could not fetch templates: ${error.message}`);
      return;
    }

    if (!templates || templates.length === 0) {
      console.log(`   ℹ️  No templates found in database`);
      return;
    }

    report.summary.total_templates = templates.length;
    console.log(`   Analyzing ${templates.length} templates...`);

    const registeredKeys = Object.keys(AVAILABLE_SHORT_CODES);

    for (const template of templates) {
      // Extract short codes from subject and body
      const subjectCodes = ShortCodeEngine.extractShortCodes(template.subject_template || '');
      const bodyCodes = ShortCodeEngine.extractShortCodes(template.body_template || '');
      const allCodes = [...new Set([...subjectCodes, ...bodyCodes])];

      // Check for unknown short codes
      for (const code of allCodes) {
        if (!registeredKeys.includes(code)) {
          report.template_issues.push({
            severity: 'critical',
            type: 'unknown_short_code',
            template_id: template.id,
            template_name: template.template_name,
            template_type: template.template_type,
            short_code: code,
            message: `Template uses unknown short code '{{${code}}}'`,
            location: subjectCodes.includes(code) ? 'subject' : 'body',
          });
        }
      }

      // Check for required short codes based on template type
      const templateTypeInfo = TEMPLATE_TYPE_METADATA[template.template_type as keyof typeof TEMPLATE_TYPE_METADATA];
      if (templateTypeInfo && templateTypeInfo.requiredShortCodes) {
        for (const required of templateTypeInfo.requiredShortCodes) {
          if (!allCodes.includes(required.code)) {
            report.template_issues.push({
              severity: 'warning',
              type: 'missing_required_code',
              template_id: template.id,
              template_name: template.template_name,
              template_type: template.template_type,
              short_code: required.code,
              message: `Template missing required short code '{{${required.code}}}'`,
            });
          }
        }
      }

      // Check for malformed short codes
      const malformedPattern = /\{\{[^}]*$/g;
      if (malformedPattern.test(template.subject_template) || malformedPattern.test(template.body_template)) {
        report.template_issues.push({
          severity: 'critical',
          type: 'malformed_code',
          template_id: template.id,
          template_name: template.template_name,
          template_type: template.template_type,
          message: 'Template contains malformed short codes (unclosed brackets)',
        });
      }
    }

    console.log(`   ✓ Template analysis complete`);
  } catch (error) {
    console.log(`   ⚠️  Error during template analysis: ${error}`);
  }
}

/**
 * 4. Test Rendering
 */
async function testRendering(report: DiagnosticReport): Promise<void> {
  const registeredKeys = Object.keys(AVAILABLE_SHORT_CODES) as ShortCodeKey[];

  // Create comprehensive sample data
  const sampleData: ShortCodeData = {
    customer_first_name: 'John',
    customer_last_name: 'Doe',
    customer_full_name: 'John Doe',
    customer_company: 'Acme Corp',
    customer_email: 'john.doe@acme.com',
    customer_phone: '(555) 123-4567',
    customer_address: '123 Main St',
    customer_city: 'Springfield',
    customer_state: 'IL',
    customer_zip: '62701',

    quote_number: 'Q-2024-001',
    quote_total: '$1,250.00',
    quote_subtotal: '$1,000.00',
    quote_tax: '$62.50',
    quote_discount: '$50.00',
    quote_date: 'January 15, 2024',
    quote_expiry_date: 'January 30, 2024',
    quote_link: 'https://example.com/quotes/approve/abc123',
    quote_status: 'Sent',
    art_approval_link: 'https://example.com/art/approve/xyz789',

    invoice_number: 'INV-2024-001',
    invoice_total: '$1,250.00',
    invoice_subtotal: '$1,000.00',
    invoice_tax: '$62.50',
    invoice_balance: '$625.00',
    invoice_date: 'January 15, 2024',
    invoice_due_date: 'February 15, 2024',
    invoice_link: 'https://example.com/invoices/pay/xyz789',
    invoice_status: 'Unpaid',

    company_name: 'Your Company Name',
    company_address: '456 Business Blvd',
    company_city: 'Chicago',
    company_state: 'IL',
    company_zip: '60601',
    company_phone: '(555) 987-6543',
    company_email: 'info@yourcompany.com',
    company_website: 'www.yourcompany.com',

    user_name: 'Jane Smith',
    user_first_name: 'Jane',
    user_last_name: 'Smith',
    user_email: 'jane.smith@yourcompany.com',
    user_phone: '(555) 555-5555',

    payment_amount: '$625.00',
    payment_method: 'Credit Card',
    payment_date: 'January 20, 2024',
    payment_link: 'https://example.com/pay/xyz789',

    current_date: new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),
    current_year: new Date().getFullYear().toString(),
  };

  console.log(`   Running render tests on ${registeredKeys.length} short codes...`);

  for (const key of registeredKeys) {
    try {
      const template = `{{${key}}}`;
      const output = ShortCodeEngine.renderTemplate(template, sampleData);

      // Check for empty output (could be legitimate for optional fields)
      if (output === '' || output.trim() === '') {
        report.render_issues.push({
          severity: 'info',
          type: 'empty_output',
          short_code: key,
          message: `Short code '${key}' renders as empty string with sample data`,
          output,
        });
      }

      // Check for undefined output
      if (output === 'undefined') {
        report.render_issues.push({
          severity: 'critical',
          type: 'undefined_output',
          short_code: key,
          message: `Short code '${key}' renders as literal 'undefined'`,
          output,
        });
      }

      // Check for potential XSS injection (script tags, event handlers)
      const injectionPatterns = [
        /<script/i,
        /javascript:/i,
        /on\w+\s*=/i, // onclick=, onload=, etc.
        /<iframe/i,
      ];

      for (const pattern of injectionPatterns) {
        if (pattern.test(output)) {
          report.render_issues.push({
            severity: 'critical',
            type: 'injection_risk',
            short_code: key,
            message: `Short code '${key}' output contains potential XSS risk`,
            output: output.substring(0, 100),
          });
          break;
        }
      }

    } catch (error) {
      report.render_issues.push({
        severity: 'critical',
        type: 'error_thrown',
        short_code: key,
        message: `Short code '${key}' throws error during rendering`,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log(`   ✓ Rendering tests complete`);
}

/**
 * 5. Verify UI Exposure
 */
async function inspectUIExposure(report: DiagnosticReport): Promise<void> {
  const registeredKeys = Object.keys(AVAILABLE_SHORT_CODES) as ShortCodeKey[];

  console.log(`   Verifying UI exposure for ${registeredKeys.length} short codes...`);

  // Check that all registered short codes have descriptions for UI display
  for (const key of registeredKeys) {
    const description = AVAILABLE_SHORT_CODES[key];

    if (!description || description.trim() === '') {
      report.ui_issues.push({
        severity: 'warning',
        type: 'missing_in_ui',
        short_code: key,
        message: `Short code '${key}' has no description for UI display`,
        expected: 'A clear, user-friendly description',
        actual: 'Empty or missing',
      });
    }

    // Check for descriptions that are just the key reformatted
    const keyAsWords = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    if (description === keyAsWords) {
      report.ui_issues.push({
        severity: 'info',
        type: 'description_mismatch',
        short_code: key,
        message: `Short code '${key}' has generic description that matches key name`,
        expected: 'A more descriptive explanation',
        actual: description,
      });
    }

    // Verify categorization matches prefix
    const category = getCategoryFromKey(key);
    if (!category) {
      report.ui_issues.push({
        severity: 'warning',
        type: 'category_mismatch',
        short_code: key,
        message: `Short code '${key}' doesn't match any standard category prefix`,
        expected: 'customer_, quote_, invoice_, company_, user_, payment_, or current_',
        actual: key.split('_')[0] + '_',
      });
    }
  }

  console.log(`   ✓ UI exposure verification complete`);
}

/**
 * Helper to determine category from key
 */
function getCategoryFromKey(key: string): string | null {
  if (key.startsWith('customer_')) return 'customer';
  if (key.startsWith('quote_')) return 'quote';
  if (key.startsWith('invoice_')) return 'invoice';
  if (key.startsWith('company_')) return 'company';
  if (key.startsWith('user_')) return 'user';
  if (key.startsWith('payment_')) return 'payment';
  if (key.startsWith('current_') || key === 'art_approval_link') return 'general';
  return null;
}

/**
 * Calculate summary statistics
 */
function calculateSummary(report: DiagnosticReport): void {
  const allIssues = [
    ...report.registry_issues,
    ...report.resolver_issues,
    ...report.template_issues,
    ...report.render_issues,
    ...report.ui_issues,
  ];

  report.summary.issues_found = allIssues.length;
  report.summary.critical_issues = allIssues.filter(i => i.severity === 'critical').length;
  report.summary.warnings = allIssues.filter(i => i.severity === 'warning').length;
}

/**
 * Format and display report
 */
function displayReport(report: DiagnosticReport): void {
  console.log('\n' + '='.repeat(80));
  console.log('SHORT-CODE SYSTEM DIAGNOSTIC REPORT');
  console.log('='.repeat(80));

  // Summary
  console.log('\n📊 SUMMARY');
  console.log('─'.repeat(80));
  console.log(`Total Short Codes: ${report.summary.total_short_codes}`);
  console.log(`Total Templates: ${report.summary.total_templates}`);
  console.log(`Total Issues Found: ${report.summary.issues_found}`);
  console.log(`  - Critical: ${report.summary.critical_issues}`);
  console.log(`  - Warnings: ${report.summary.warnings}`);
  console.log(`  - Info: ${report.summary.issues_found - report.summary.critical_issues - report.summary.warnings}`);

  // Registry Issues
  if (report.registry_issues.length > 0) {
    console.log('\n❗ REGISTRY ISSUES');
    console.log('─'.repeat(80));
    for (const issue of report.registry_issues) {
      console.log(`[${issue.severity.toUpperCase()}] ${issue.message}`);
      if (issue.notes) console.log(`  Note: ${issue.notes}`);
    }
  }

  // Resolver Issues
  if (report.resolver_issues.length > 0) {
    console.log('\n❗ RESOLVER ISSUES');
    console.log('─'.repeat(80));
    for (const issue of report.resolver_issues) {
      console.log(`[${issue.severity.toUpperCase()}] ${issue.message}`);
      if (issue.details) console.log(`  Details: ${issue.details}`);
    }
  }

  // Template Issues
  if (report.template_issues.length > 0) {
    console.log('\n❗ TEMPLATE ISSUES');
    console.log('─'.repeat(80));
    for (const issue of report.template_issues) {
      console.log(`[${issue.severity.toUpperCase()}] ${issue.template_name} (${issue.template_type})`);
      console.log(`  ${issue.message}`);
    }
  }

  // Render Issues
  if (report.render_issues.length > 0) {
    console.log('\n❗ RENDER ISSUES');
    console.log('─'.repeat(80));
    for (const issue of report.render_issues) {
      console.log(`[${issue.severity.toUpperCase()}] ${issue.message}`);
      if (issue.error) console.log(`  Error: ${issue.error}`);
      if (issue.output) console.log(`  Output: ${JSON.stringify(issue.output).substring(0, 100)}`);
    }
  }

  // UI Issues
  if (report.ui_issues.length > 0) {
    console.log('\n❗ UI ISSUES');
    console.log('─'.repeat(80));
    for (const issue of report.ui_issues) {
      console.log(`[${issue.severity.toUpperCase()}] ${issue.message}`);
      if (issue.expected && issue.actual) {
        console.log(`  Expected: ${issue.expected}`);
        console.log(`  Actual: ${issue.actual}`);
      }
    }
  }

  if (report.summary.issues_found === 0) {
    console.log('\n✅ No issues found! The short-code system is functioning correctly.');
  }

  console.log('\n' + '='.repeat(80));
}

/**
 * Execute diagnostic and save report
 */
async function main() {
  try {
    const report = await runDiagnostic();

    // Display in console
    displayReport(report);

    // Save to JSON file
    const fs = await import('fs');
    const reportPath = './shortcode-diagnostic-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n💾 Full report saved to: ${reportPath}`);

    // Exit with code based on critical issues
    if (report.summary.critical_issues > 0) {
      console.log('\n❌ Diagnostic failed with critical issues.');
      process.exit(1);
    } else if (report.summary.warnings > 0) {
      console.log('\n⚠️  Diagnostic completed with warnings.');
      process.exit(0);
    } else {
      console.log('\n✅ Diagnostic passed successfully!');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n💥 Fatal error during diagnostic:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { runDiagnostic, type DiagnosticReport };
