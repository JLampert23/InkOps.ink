import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read .env file manually
const envContent = readFileSync(join(__dirname, '.env'), 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearAllPrintavoData() {
  console.log('🗑️  Clearing ALL Printavo data from database...\n');

  try {
    // Delete in order to respect foreign key constraints
    console.log('Deleting line items...');
    const { error: lineItemsError } = await supabase
      .from('printavo_line_items')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows

    if (lineItemsError) {
      console.error('Error deleting line items:', lineItemsError);
    } else {
      console.log('✓ Line items deleted');
    }

    console.log('Deleting payments...');
    const { error: paymentsError } = await supabase
      .from('printavo_payments')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows

    if (paymentsError) {
      console.error('Error deleting payments:', paymentsError);
    } else {
      console.log('✓ Payments deleted');
    }

    console.log('Deleting invoices...');
    const { error: invoicesError } = await supabase
      .from('printavo_invoices')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows

    if (invoicesError) {
      console.error('Error deleting invoices:', invoicesError);
    } else {
      console.log('✓ Invoices deleted');
    }

    console.log('Deleting customers...');
    const { error: customersError } = await supabase
      .from('customers')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows

    if (customersError) {
      console.error('Error deleting customers:', customersError);
    } else {
      console.log('✓ Customers deleted');
    }

    console.log('Deleting billing queue...');
    const { error: billingQueueError } = await supabase
      .from('billing_queue')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows

    if (billingQueueError) {
      console.error('Error deleting billing queue:', billingQueueError);
    } else {
      console.log('✓ Billing queue deleted');
    }

    console.log('\n✅ All Printavo data has been cleared!');
    console.log('You can now trigger a fresh sync with the new status filters.');
  } catch (error) {
    console.error('Error clearing data:', error);
    process.exit(1);
  }
}

clearAllPrintavoData();
