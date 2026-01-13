export interface ParsedGarmentData {
  style: string | null;
  color: string | null;
  sizes: Record<string, number>;
  sku: string | null;
  notes: string[];
}

const COMMON_STYLES = [
  /\b(G|Gildan)\s*[-\s]?\s*(\d{3,5}[A-Z]*)\b/i,
  /\b(BC|Bella\s*Canvas)\s*[-\s]?\s*(\d{3,5})\b/i,
  /\b(NL|Next\s*Level)\s*[-\s]?\s*(\d{3,5})\b/i,
  /\b(Hanes)\s*[-\s]?\s*(\d{3,5}[A-Z]*)\b/i,
  /\b(PC|Port\s*&\s*Company)\s*[-\s]?\s*(\d{2,5}[A-Z]*)\b/i,
  /\b([A-Z]{2,4})[-\s]?(\d{3,5}[A-Z]*)\b/,
];

const SIZE_PATTERNS = [
  /\b([Y]?[2-9]?X*[S|M|L|XL]+)\s*[-:]\s*(\d+)/gi,
  /\b(Small|Medium|Large|X-*Large|XX-*Large|XXX-*Large)\s*\(?(\d+)\)?/gi,
  /\b(Youth|YS|YM|YL|YXL)\s*[-:]\s*(\d+)/gi,
];

const COLOR_KEYWORDS = [
  'black', 'white', 'navy', 'red', 'blue', 'green', 'grey', 'gray',
  'heather', 'sport', 'royal', 'charcoal', 'maroon', 'purple', 'orange',
  'yellow', 'pink', 'tan', 'brown', 'olive', 'burgundy', 'teal', 'aqua',
  'cardinal', 'forest', 'kelly', 'lime', 'mint', 'coral', 'sapphire',
  'vintage', 'athletic', 'ash', 'cream', 'sand', 'stone', 'slate',
];

const normalizeSize = (size: string): string => {
  size = size.toUpperCase().trim();

  const sizeMap: Record<string, string> = {
    'SMALL': 'S',
    'MEDIUM': 'M',
    'LARGE': 'L',
    'X-LARGE': 'XL',
    'XX-LARGE': '2XL',
    'XXX-LARGE': '3XL',
    'XLARGE': 'XL',
    'XXLARGE': '2XL',
    'XXXLARGE': '3XL',
  };

  return sizeMap[size] || size;
};

export function parseGarmentDescription(description: string): ParsedGarmentData {
  if (!description) {
    return {
      style: null,
      color: null,
      sizes: {},
      sku: null,
      notes: [],
    };
  }

  const result: ParsedGarmentData = {
    style: null,
    color: null,
    sizes: {},
    sku: null,
    notes: [],
  };

  const cleanDesc = description.trim();

  for (const pattern of COMMON_STYLES) {
    const match = cleanDesc.match(pattern);
    if (match) {
      if (match[1] && match[2]) {
        result.style = `${match[1].toUpperCase().replace(/\s+/g, '')} ${match[2].toUpperCase()}`;
      } else if (match[0]) {
        result.style = match[0].trim().toUpperCase();
      }
      break;
    }
  }

  const lowerDesc = cleanDesc.toLowerCase();
  for (const colorKeyword of COLOR_KEYWORDS) {
    const colorRegex = new RegExp(`\\b${colorKeyword}[a-z]*\\b`, 'i');
    const match = lowerDesc.match(colorRegex);
    if (match) {
      const startIndex = match.index || 0;
      const words = cleanDesc.substring(startIndex).split(/\s+/).slice(0, 3);

      result.color = words.join(' ').replace(/[,;:].*$/, '').trim();
      break;
    }
  }

  for (const sizePattern of SIZE_PATTERNS) {
    let match;
    while ((match = sizePattern.exec(cleanDesc)) !== null) {
      const sizeName = normalizeSize(match[1]);
      const quantity = parseInt(match[2], 10);

      if (!isNaN(quantity) && quantity > 0) {
        result.sizes[sizeName] = (result.sizes[sizeName] || 0) + quantity;
      }
    }
  }

  const skuPatterns = [
    /\bSKU\s*[:#]?\s*([A-Z0-9-]+)/i,
    /\bItem\s*#\s*([A-Z0-9-]+)/i,
    /\bCode\s*[:#]?\s*([A-Z0-9-]+)/i,
  ];

  for (const skuPattern of skuPatterns) {
    const match = cleanDesc.match(skuPattern);
    if (match && match[1]) {
      result.sku = match[1].trim();
      break;
    }
  }

  if (!result.style && !result.color && Object.keys(result.sizes).length === 0) {
    result.notes.push('Could not parse garment details from description');
  }

  if (result.style) {
    result.notes.push(`Detected style: ${result.style}`);
  }
  if (result.color) {
    result.notes.push(`Detected color: ${result.color}`);
  }
  if (Object.keys(result.sizes).length > 0) {
    const totalQty = Object.values(result.sizes).reduce((sum, qty) => sum + qty, 0);
    result.notes.push(`Detected ${Object.keys(result.sizes).length} sizes (${totalQty} total items)`);
  }

  return result;
}
