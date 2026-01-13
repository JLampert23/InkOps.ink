import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://cuaukcvccxvfpuxaciac.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1YXVrY3ZjY3h2ZnB1eGFjaWFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1NjA4NTQsImV4cCI6MjA4MjEzNjg1NH0.I-FDsR0oezVPxKcWgFmV-MMolV6E-lYcoA7Ew8ZgKYU'
);

async function debug() {
  console.log('=== Checking Billing-Eligible Statuses ===');
  const { data: statuses } = await supabase
    .from('printavo_statuses')
    .select('name, is_billing_eligible')
    .order('name');

  const eligibleStatuses = statuses?.filter(s => s.is_billing_eligible).map(s => s.name) || [];
  console.log('Billing-eligible statuses:', eligibleStatuses);

  console.log('\n=== Checking All Invoices with Outstanding Balance ===');
  const { data: allInvoices } = await supabase
    .from('printavo_invoices')
    .select('invoice_number, status, amount_outstanding, customer_name')
    .gt('amount_outstanding', 0)
    .order('invoice_number');

  console.log('Total invoices with balance > 0:', allInvoices?.length);

  console.log('\n=== Checking AR Tab Query ===');
  const { data: arInvoices } = await supabase
    .from('printavo_invoices')
    .select('invoice_number, status, amount_outstanding, customer_name')
    .in('status', eligibleStatuses)
    .gt('amount_outstanding', 0)
    .order('invoice_number');

  console.log('Invoices shown in AR tab:', arInvoices?.length);

  console.log('\n=== Missing Invoices (not in AR tab) ===');
  const missing = allInvoices?.filter(inv =>
    !arInvoices?.some(ar => ar.invoice_number === inv.invoice_number)
  );

  if (missing && missing.length > 0) {
    console.log('Found', missing.length, 'missing invoices:');
    missing.forEach(inv => {
      console.log(`  - Invoice ${inv.invoice_number}: Status="${inv.status}", Balance=$${inv.amount_outstanding}, Customer="${inv.customer_name}"`);
      console.log(`    → Status "${inv.status}" is ${eligibleStatuses.includes(inv.status) ? 'ELIGIBLE' : 'NOT ELIGIBLE'} for billing`);
    });
  } else {
    console.log('No missing invoices found!');
  }

  console.log('\n=== Invoices Shown in AR Tab ===');
  if (arInvoices && arInvoices.length > 0) {
    arInvoices.forEach(inv => {
      console.log(`  - Invoice ${inv.invoice_number}: Status="${inv.status}", Balance=$${inv.amount_outstanding}`);
    });
  }
}

debug().catch(console.error).finally(() => process.exit());
