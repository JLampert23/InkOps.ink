/**
 * Short-code engine for replacing placeholders in email templates
 * Server-side implementation for Supabase Edge Functions
 */

export interface ShortCodeData {
  // Customer data
  customer_first_name?: string;
  customer_last_name?: string;
  customer_full_name?: string;
  customer_company?: string;
  customer_email?: string;
  customer_phone?: string;
  customer_address?: string;
  customer_city?: string;
  customer_state?: string;
  customer_zip?: string;

  // Quote data
  quote_number?: string;
  quote_total?: string;
  quote_subtotal?: string;
  quote_tax?: string;
  quote_discount?: string;
  quote_date?: string;
  quote_expiry_date?: string;
  quote_link?: string;
  quote_status?: string;

  // Invoice data
  invoice_number?: string;
  invoice_total?: string;
  invoice_subtotal?: string;
  invoice_tax?: string;
  invoice_balance?: string;
  invoice_date?: string;
  invoice_due_date?: string;
  invoice_link?: string;
  invoice_status?: string;

  // Company/Organization data
  company_name?: string;
  company_address?: string;
  company_city?: string;
  company_state?: string;
  company_zip?: string;
  company_phone?: string;
  company_email?: string;
  company_website?: string;

  // User data (sender)
  user_name?: string;
  user_first_name?: string;
  user_last_name?: string;
  user_email?: string;
  user_phone?: string;

  // Payment data
  payment_amount?: string;
  payment_method?: string;
  payment_date?: string;
  payment_link?: string;

  // General
  current_date?: string;
  current_year?: string;
}

/**
 * Renders a template by replacing all short codes with actual values
 * @param template - The template string containing {{shortcodes}}
 * @param data - The data dictionary with values for replacement
 * @returns The rendered template with all short codes replaced
 */
export function renderTemplate(
  template: string,
  data: ShortCodeData
): string {
  if (!template) return '';

  let rendered = template;
  const maxIterations = 100;
  let iterations = 0;
  const shortCodePattern = /\{\{([a-z_]+)\}\}/gi;

  // Find all short codes in the template
  const matches = [...template.matchAll(shortCodePattern)];

  // Track which short codes we've seen to prevent infinite loops
  const processedCodes = new Set<string>();

  // Replace each short code with its value
  for (const match of matches) {
    const fullMatch = match[0]; // e.g., "{{customer_first_name}}"
    const key = match[1] as keyof ShortCodeData;

    if (processedCodes.has(key)) {
      continue;
    }
    processedCodes.add(key);

    const value = data[key];

    if (value !== undefined && value !== null) {
      // Ensure the value is a primitive (string or number), not an object
      let stringValue: string;

      if (typeof value === 'object') {
        // If someone accidentally passed an object, log a warning and use empty string
        console.warn(`Short code '${key}' received an object value instead of a string. Using empty string.`);
        stringValue = '';
      } else {
        // Convert to string (handles numbers, booleans, etc.)
        stringValue = String(value);
      }

      const escapedMatch = fullMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedMatch, 'g');
      rendered = rendered.replace(regex, stringValue);
    } else {
      const escapedMatch = fullMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedMatch, 'g');
      rendered = rendered.replace(regex, '');
    }

    iterations++;
    if (iterations > maxIterations) {
      console.warn('Short code rendering exceeded maximum iterations');
      break;
    }
  }

  return rendered;
}

/**
 * Extracts all short codes found in a template
 * @param template - The template string to analyze
 * @returns Array of short code keys found in the template
 */
export function extractShortCodes(template: string): string[] {
  if (!template) return [];

  const shortCodePattern = /\{\{([a-z_]+)\}\}/gi;
  const matches = [...template.matchAll(shortCodePattern)];

  return [...new Set(matches.map(match => match[1]))];
}

/**
 * Validates that all short codes in a template have corresponding data
 * @param template - The template string to validate
 * @param data - The data dictionary to check against
 * @returns Object with validation result and missing codes
 */
export function validateTemplate(
  template: string,
  data: ShortCodeData
): { valid: boolean; missingCodes: string[] } {
  const shortCodes = extractShortCodes(template);
  const missingCodes = shortCodes.filter(code => {
    const value = data[code as keyof ShortCodeData];
    return value === undefined || value === null || value === '';
  });

  return {
    valid: missingCodes.length === 0,
    missingCodes,
  };
}

/**
 * Formats a currency value for display
 */
export function formatCurrency(value: number | string, currency: string = 'USD'): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(numValue)) return '$0.00';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(numValue);
}

/**
 * Formats a date value for display
 */
export function formatDate(
  value: string | Date,
  format: 'short' | 'medium' | 'long' = 'medium'
): string {
  const date = typeof value === 'string' ? new Date(value) : value;

  if (isNaN(date.getTime())) return '';

  const options: Intl.DateTimeFormatOptions = {
    short: { year: 'numeric', month: 'numeric', day: 'numeric' },
    medium: { year: 'numeric', month: 'short', day: 'numeric' },
    long: { year: 'numeric', month: 'long', day: 'numeric' },
  }[format];

  return new Intl.DateTimeFormat('en-US', options).format(date);
}
