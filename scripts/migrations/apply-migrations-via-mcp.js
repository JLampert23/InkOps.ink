import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// This script shows which migrations need to be applied
// The actual application needs to be done via MCP tools

const appliedMigrations = [
  "20260116205322_remote_schema.sql",
  "20260119130951_remote_schema.sql",
  "20260121161526_remote_schema.sql",
  "20260128154423_fix_signup_trigger_no_company_id.sql",
  "20260128154837_recreate_company_settings_with_all_columns.sql",
  "20260128154909_force_schema_cache_update.sql",
  "20260128155227_force_postgrest_schema_reload.sql",
  "20260128160029_force_hard_schema_reload.sql",
  "20260128162715_create_printavo_cache_tables.sql",
  "20260128165630_reset_jamie_password.sql"
];

const migrationsDir = './supabase/migrations';
const allMigrations = readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

const pendingMigrations = allMigrations.filter(m => !appliedMigrations.includes(m));

console.log(`\n📊 Migration Status:`);
console.log(`   Total migrations: ${allMigrations.length}`);
console.log(`   Applied: ${appliedMigrations.length}`);
console.log(`   Pending: ${pendingMigrations.length}\n`);

console.log(`📝 Pending migrations (first 20):`);
pendingMigrations.slice(0, 20).forEach((m, i) => {
  console.log(`   ${i + 1}. ${m}`);
});

if (pendingMigrations.length > 20) {
  console.log(`   ... and ${pendingMigrations.length - 20} more\n`);
}

console.log(`\n💡 To apply all migrations, use the combined migration file:`);
console.log(`   File: PRODUCTION_COMPLETE_MIGRATION.sql`);
console.log(`   Size: ${readFileSync('./PRODUCTION_COMPLETE_MIGRATION.sql', 'utf8').length} characters`);
