const VALID_SS_FOB_IDS = ['IL', 'KS', 'NJ', 'TX', 'GA', 'NV', 'DS'];

export function normalizeSsPromoStandardsProductId(input: string): string {
  if (!input) return '';

  let cleaned = input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

  if (cleaned.startsWith('B') && cleaned.length > 1) {
    cleaned = cleaned.substring(1);
  }

  if (cleaned.startsWith('G') && /^G\d+$/.test(cleaned)) {
    cleaned = cleaned.substring(1);
  }

  if (/^\d+$/.test(cleaned)) {
    cleaned = cleaned.padStart(5, '0');
  }

  return 'B' + cleaned;
}

export function validateSsFobId(fobId: string | null): string {
  if (!fobId) return 'NJ';
  const upperFob = fobId.toUpperCase();
  return VALID_SS_FOB_IDS.includes(upperFob) ? upperFob : 'NJ';
}

export { VALID_SS_FOB_IDS };
