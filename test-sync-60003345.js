const supabaseUrl = 'https://cuaukcvccxvfpuxaciac.supabase.co';

async function triggerSync() {
  try {
    console.log('Triggering sync...');
    const response = await fetch(`${supabaseUrl}/functions/v1/printavo-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mode: 'quick' })
    });

    const result = await response.json();
    console.log('Sync response:', result);

    if (result.syncId) {
      console.log('\nWaiting for sync to complete...');
      await new Promise(resolve => setTimeout(resolve, 10000));

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        supabaseUrl,
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1YXVrY3ZjY3h2ZnB1eGFjaWFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1NjA4NTQsImV4cCI6MjA4MjEzNjg1NH0.I-FDsR0oezVPxKcWgFmV-MMolV6E-lYcoA7Ew8ZgKYU'
      );

      const { data: invoice } = await supabase
        .from('printavo_invoices')
        .select('invoice_number, customer_name, customer_company, customer_id, customer_email')
        .eq('invoice_number', '60003345')
        .single();

      console.log('\nInvoice 60003345 after sync:');
      console.log(JSON.stringify(invoice, null, 2));
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

triggerSync();
