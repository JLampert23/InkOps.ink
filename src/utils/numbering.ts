import { supabase } from '../lib/supabase-client';

/**
 * Generates the next quote number based on company settings
 * Uses QTE- prefix if enabled, otherwise just the number
 */
export async function generateNextQuoteNumber(companyId: string): Promise<string> {
  try {
    const { data: settings } = await supabase
      .from('company_settings')
      .select('use_number_prefix, number_start_number, next_number')
      .eq('id', companyId)
      .maybeSingle();

    let nextNumber = settings?.next_number || settings?.number_start_number || 1;

    await supabase
      .from('company_settings')
      .update({ next_number: nextNumber + 1 })
      .eq('id', companyId);

    const formattedNumber = nextNumber.toString().padStart(4, '0');
    const prefix = settings?.use_number_prefix ? 'QTE-' : '';

    return `${prefix}${formattedNumber}`;
  } catch (err) {
    console.error('Error generating quote number:', err);
    return `Q${Date.now()}`;
  }
}

/**
 * Generates the next invoice number based on company settings
 * Uses INV- prefix if enabled, otherwise just the number
 *
 * NOTE: Currently invoices are synced from Printavo and use Printavo's visual_id
 * This function is prepared for future use when invoices may be created directly in the app
 */
export async function generateNextInvoiceNumber(companyId: string): Promise<string> {
  try {
    const { data: settings } = await supabase
      .from('company_settings')
      .select('use_number_prefix, number_start_number, next_number')
      .eq('id', companyId)
      .maybeSingle();

    let nextNumber = settings?.next_number || settings?.number_start_number || 1;

    await supabase
      .from('company_settings')
      .update({ next_number: nextNumber + 1 })
      .eq('id', companyId);

    const formattedNumber = nextNumber.toString().padStart(4, '0');
    const prefix = settings?.use_number_prefix ? 'INV-' : '';

    return `${prefix}${formattedNumber}`;
  } catch (err) {
    console.error('Error generating invoice number:', err);
    return `INV${Date.now()}`;
  }
}
