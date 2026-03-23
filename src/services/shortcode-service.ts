import DOMPurify from 'dompurify';
import { ShortCodeData } from '../types/shortcode';

/**
 * Short-code engine for replacing placeholders in email templates
 * with actual data at runtime.
 */
export class ShortCodeEngine {
  /**
   * Renders a template by replacing all short codes with actual values
   * @param template - The template string containing {{shortcodes}}
   * @param data - The data dictionary with values for replacement
   * @param sanitize - Whether to sanitize output (default: true)
   * @returns The rendered template with all short codes replaced
   */
  static renderTemplate(
    template: string,
    data: ShortCodeData,
    sanitize: boolean = true
  ): string {
    if (!template) return '';

    let rendered = template;
    const maxIterations = 100; // Prevent infinite loops
    let iterations = 0;
    const shortCodePattern = /\{\{([a-z_]+)\}\}/gi;

    // Find all short codes in the template
    const matches = [...template.matchAll(shortCodePattern)];

    // Track which short codes we've seen to prevent infinite loops
    const processedCodes = new Set<string>();

    // Replace each short code with its value
    for (const match of matches) {
      const fullMatch = match[0]; // e.g., "{{customer_first_name}}"
      const key = match[1] as keyof ShortCodeData; // e.g., "customer_first_name"

      // Prevent processing the same code multiple times
      if (processedCodes.has(key)) {
        continue;
      }
      processedCodes.add(key);

      // Get the value from the data dictionary
      const value = data[key];

      // Replace all occurrences of this short code
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

        // Escape special regex characters in the short code
        const escapedMatch = fullMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedMatch, 'g');
        rendered = rendered.replace(regex, stringValue);
      } else {
        // Replace with empty string if value is missing
        const escapedMatch = fullMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedMatch, 'g');
        rendered = rendered.replace(regex, '');
      }

      // Safety check for infinite loops
      iterations++;
      if (iterations > maxIterations) {
        console.warn('Short code rendering exceeded maximum iterations');
        break;
      }
    }

    // Sanitize the output to prevent XSS attacks
    if (sanitize) {
      rendered = this.sanitizeHTML(rendered);
    }

    return rendered;
  }

  /**
   * Sanitizes HTML to prevent XSS attacks while preserving safe formatting
   * @param html - The HTML string to sanitize
   * @returns Sanitized HTML
   */
  static sanitizeHTML(html: string): string {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'a', 'span', 'div', 'table', 'thead', 'tbody',
        'tr', 'th', 'td', 'img', 'blockquote', 'code', 'pre'
      ],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'style', 'target'],
      ALLOW_DATA_ATTR: false,
    });
  }

  /**
   * Extracts all short codes found in a template
   * @param template - The template string to analyze
   * @returns Array of short code keys found in the template
   */
  static extractShortCodes(template: string): string[] {
    if (!template) return [];

    const shortCodePattern = /\{\{([a-z_]+)\}\}/gi;
    const matches = [...template.matchAll(shortCodePattern)];

    // Return unique short code keys
    return [...new Set(matches.map(match => match[1]))];
  }

  /**
   * Validates that all short codes in a template have corresponding data
   * @param template - The template string to validate
   * @param data - The data dictionary to check against
   * @returns Object with validation result and missing codes
   */
  static validateTemplate(
    template: string,
    data: ShortCodeData
  ): { valid: boolean; missingCodes: string[] } {
    const shortCodes = this.extractShortCodes(template);
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
   * @param value - The numeric value
   * @param currency - The currency code (default: USD)
   * @returns Formatted currency string
   */
  static formatCurrency(value: number | string, currency: string = 'USD'): string {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;

    if (isNaN(numValue)) return '$0.00';

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(numValue);
  }

  /**
   * Formats a date value for display
   * @param value - The date value (string or Date object)
   * @param format - The format style (default: 'long')
   * @returns Formatted date string
   */
  static formatDate(
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

  /**
   * Generates sample data for testing and previews
   * @returns Sample ShortCodeData object with realistic test values
   */
  static generateSampleData(): ShortCodeData {
    return {
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

      quote_number: 'Quote 1234',
      quote_total: '$1,250.00',
      quote_subtotal: '$1,000.00',
      quote_tax: '$62.50',
      quote_discount: '$50.00',
      quote_date: 'January 15, 2024',
      quote_expiry_date: 'January 30, 2024',
      quote_link: 'https://example.com/quotes/approve/abc123',
      quote_status: 'Sent',
      art_approval_link: 'https://example.com/art/approve/xyz789',

      invoice_number: 'Invoice 1234',
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
  }

  /**
   * Generates a preview of a template with sample data
   * @param template - The template string
   * @returns Rendered template with sample data
   */
  static generatePreview(template: string): string {
    return this.renderTemplate(template, this.generateSampleData());
  }
}

export default ShortCodeEngine;
