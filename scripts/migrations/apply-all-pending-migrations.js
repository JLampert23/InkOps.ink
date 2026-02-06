import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Already applied migrations
const appliedMigrations = [
  '20260116205322_remote_schema.sql',
  '20260119130951_remote_schema.sql',
  '20260121161526_remote_schema.sql',
  '20260128154423_fix_signup_trigger_no_company_id.sql',
  '20260128154837_recreate_company_settings_with_all_columns.sql',
  '20260128154909_force_schema_cache_update.sql',
  '20260128155227_force_postgrest_schema_reload.sql',
  '20260128160029_force_hard_schema_reload.sql',
  '20260128162715_create_printavo_cache_tables.sql',
  '20260128165630_reset_jamie_password.sql'
];

const pendingMigrations = [
  '20260121164437_fix_remaining_security_issues_v2.sql',
  '20260121212934_create_customer_fundraising_credits_table.sql',
  '20260121213400_allow_negative_fundraising_credits.sql',
  '20260122014610_add_fundraising_report_upload.sql',
  '20260122133536_add_report_url_to_fundraising_credits.sql',
  '20260122153254_fix_comprehensive_security_issues.sql',
  '20260122163807_fix_user_profiles_infinite_recursion.sql',
  '20260122173146_auto_unlock_invoices_with_outstanding_balance.sql',
  '20260122183813_add_trigger_recalculate_invoice_on_payment_change.sql',
  '20260122190041_fix_payment_calculation_and_billing_queue_sync.sql',
  '20260122190122_fix_reversed_payment_calculation.sql',
  '20260122204652_create_customer_payment_methods_table.sql',
  '20260122204709_create_customer_tax_exemptions_table.sql',
  '20260123004139_add_fundraising_credit_payment_type.sql',
  '20260123154858_rebuild_quotes_module_complete.sql',
  '20260123155649_create_quote_auto_approval_cron.sql',
  '20260123190717_add_printavo_fields_to_quotes.sql',
  '20260123200636_add_quote_discount_and_tax_fields.sql',
  '20260123202906_create_invoice_fees_table.sql',
  '20260123204236_fix_invoice_fees_column_names.sql',
  '20260123232232_create_quote_imprints_table.sql',
  '20260123234108_create_price_matrices_table.sql',
  '20260123234715_create_imprints_and_proofs_tables.sql',
  '20260123234735_add_type_and_setup_fees_to_price_matrices.sql',
  '20260123235132_create_imprint_proofs_storage_bucket.sql',
  '20260124002136_add_location_and_price_matrix_to_quote_imprints.sql',
  '20260124002839_create_customer_locations_table.sql',
  '20260124003455_rename_customer_locations_to_decoration_locations.sql',
  '20260124004429_create_color_stitch_options_table.sql',
  '20260124010051_add_thread_ink_color_to_quote_imprints.sql',
  '20260124185919_update_type_of_work_color_type.sql',
  '20260124213054_seed_default_production_colors_for_all_companies.sql',
  '20260125132414_add_missing_quote_fields.sql',
  '20260125132510_fix_quote_fees_columns.sql',
  '20260125141041_add_quote_numbering_settings.sql',
  '20260125141600_unify_quote_invoice_numbering.sql',
  '20260125150826_create_proofs_module.sql',
  '20260125150840_create_proof_storage_buckets.sql',
  '20260125154913_add_composite_image_to_proofs.sql',
  '20260125154940_add_composite_image_to_proofs.sql',
  '20260125155816_create_production_colors_table.sql',
  '20260125181450_add_imprint_fields_to_proofs.sql',
  '20260125232703_add_line_item_groups.sql',
  '20260125235650_add_custom_line_item_options_to_company_settings.sql',
  '20260126003914_add_custom_size_option_to_quotes.sql',
  '20260126012654_create_garment_supplier_integrations.sql',
  '20260126012718_add_supplier_metadata_to_quote_line_items.sql',
  '20260126014518_add_size_mode_to_quote_line_items.sql',
  '20260126014917_add_double_size_columns_to_quote_line_items.sql',
  '20260126191644_backfill_quote_zip_codes_from_customers.sql',
  '20260126232240_create_customer_artwork_library.sql',
  '20260126232258_create_customer_artwork_storage_bucket.sql',
  '20260126235522_add_group_label_to_quote_imprints.sql',
  '20260126235647_add_group_label_to_proofs.sql',
  '20260127004000_add_selected_colors_to_proofs.sql',
  '20260127142442_update_ssactivewear_to_promostandards.sql',
  '20260127150526_add_supplier_integration_credentials.sql',
  '20260127181806_create_work_type_workflows_table.sql',
  '20260127183525_create_production_schedule_entries.sql',
  '20260127183858_create_schedule_entries_on_quote_approval.sql',
  '20260127192156_create_production_stations_table.sql',
  '20260127193223_fix_companies_table_sync.sql',
  '20260127195629_fix_screen_print_step_statuses_key.sql',
  '20260127200543_create_scheduler_tabs_table.sql',
  '20260128154317_fix_schema_cache_reload.sql'
];

async function applyMigrations() {
  console.log(`Applying ${pendingMigrations.length} pending migrations...\n`);

  const migrationsDir = './supabase/migrations';
  let successCount = 0;
  let errorCount = 0;
  let errors = [];

  for (const filename of pendingMigrations) {
    const filePath = join(migrationsDir, filename);

    try {
      const sql = readFileSync(filePath, 'utf-8');

      console.log(`[${successCount + errorCount + 1}/${pendingMigrations.length}] Applying: ${filename}`);

      // Execute SQL directly
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey
        },
        body: JSON.stringify({ sql_string: sql })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`  ❌ Failed: ${errorText.substring(0, 200)}`);
        errors.push({ filename, error: errorText.substring(0, 500) });
        errorCount++;
      } else {
        console.log(`  ✅ Applied successfully`);
        successCount++;
      }

    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
      errors.push({ filename, error: error.message });
      errorCount++;
    }
  }

  console.log(`\n=== Migration Summary ===`);
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);
  console.log(`Total: ${pendingMigrations.length}`);

  if (errors.length > 0) {
    console.log(`\n=== Errors ===`);
    errors.forEach(({ filename, error }) => {
      console.log(`\n${filename}:`);
      console.log(error);
    });
  }
}

applyMigrations();
