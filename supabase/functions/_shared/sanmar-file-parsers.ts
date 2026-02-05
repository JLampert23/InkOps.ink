/**
 * SanMar File Parsers
 *
 * Parses various SanMar data file formats:
 * - SDL: CSV format with style-level data
 * - EPDD: CSV format with SKU-level data and inventory
 * - PDD: Pipe-delimited with GTIN and extended descriptions
 * - DIP: Pipe-delimited with inventory and pricing
 * - Catalog: Tab-delimited with extended descriptions
 */

export interface SDLRow {
  styleNumber: string;
  styleName: string;
  brandName: string;
  category: string;
  description: string;
  fabricContent: string;
  construction: string;
  weight: string;
  gender: string;
  fit: string;
  countryOfOrigin: string;
  isCloseout: boolean;
  isNew: boolean;
}

export interface EPDDRow {
  uniqueKey: string;
  styleNumber: string;
  colorName: string;
  colorCode: string;
  sizeName: string;
  sku: string;
  upc: string;
  pieceWeight: number;
  caseWeight: number;
  caseQuantity: number;
  imageFront: string;
  imageBack: string;
  imageSide: string;
  imageLifestyle: string;
  inventoryAvailable: number;
}

export interface PDDRow {
  styleNumber: string;
  sku: string;
  gtin: string;
  extendedDescription: string;
}

export interface DIPInventoryRow {
  uniqueKey: string;
  styleNumber: string;
  colorName: string;
  sizeName: string;
  warehouseCode: string;
  warehouseName: string;
  quantityAvailable: number;
  quantityOnOrder: number;
  etaDate: string | null;
}

export interface DIPPricingRow {
  uniqueKey: string;
  styleNumber: string;
  priceType: string;
  quantityMin: number;
  quantityMax: number;
  unitPrice: number;
  isSale: boolean;
  salePrice: number | null;
  saleEndDate: string | null;
}

export interface CatalogRow {
  styleNumber: string;
  description: string;
  extendedDescription: string;
}

/**
 * Generic CSV parser
 */
function parseCSV(content: string, hasHeader: boolean = true): string[][] {
  const lines = content.split('\n').filter(line => line.trim().length > 0);
  const rows: string[][] = [];

  for (const line of lines) {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current.trim());
    rows.push(values);
  }

  return hasHeader ? rows.slice(1) : rows;
}

/**
 * Parse SDL (Style Data Library) CSV file
 */
export function parseSDL(content: string): SDLRow[] {
  const rows = parseCSV(content, true);
  const parsed: SDLRow[] = [];

  for (const row of rows) {
    if (row.length < 5) continue;

    parsed.push({
      styleNumber: row[0] || '',
      styleName: row[1] || '',
      brandName: row[2] || '',
      category: row[3] || '',
      description: row[4] || '',
      fabricContent: row[5] || '',
      construction: row[6] || '',
      weight: row[7] || '',
      gender: row[8] || '',
      fit: row[9] || '',
      countryOfOrigin: row[10] || '',
      isCloseout: (row[11] || '').toLowerCase() === 'true' || row[11] === '1',
      isNew: (row[12] || '').toLowerCase() === 'true' || row[12] === '1',
    });
  }

  console.log(`✅ Parsed ${parsed.length} SDL rows`);
  return parsed;
}

/**
 * Parse EPDD (Enhanced Product Data Download) CSV file
 */
export function parseEPDD(content: string): EPDDRow[] {
  const rows = parseCSV(content, true);
  const parsed: EPDDRow[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (row.length < 10) continue;

    const styleNumber = row[0] || '';
    const colorName = row[1] || '';
    const sizeName = row[2] || '';
    const uniqueKey = `${styleNumber}_${colorName}_${sizeName}`;

    if (seen.has(uniqueKey)) {
      console.log(`⚠️ Duplicate EPDD row skipped: ${uniqueKey}`);
      continue;
    }

    seen.add(uniqueKey);

    parsed.push({
      uniqueKey,
      styleNumber,
      colorName,
      colorCode: row[3] || '',
      sizeName,
      sku: row[4] || '',
      upc: row[5] || '',
      pieceWeight: parseFloat(row[6]) || 0,
      caseWeight: parseFloat(row[7]) || 0,
      caseQuantity: parseInt(row[8]) || 0,
      imageFront: row[9] || '',
      imageBack: row[10] || '',
      imageSide: row[11] || '',
      imageLifestyle: row[12] || '',
      inventoryAvailable: parseInt(row[13]) || 0,
    });
  }

  console.log(`✅ Parsed ${parsed.length} unique EPDD rows`);
  return parsed;
}

/**
 * Parse PDD (Product Data Download) pipe-delimited file
 */
export function parsePDD(content: string): PDDRow[] {
  const lines = content.split('\n').filter(line => line.trim().length > 0);
  const parsed: PDDRow[] = [];

  for (const line of lines.slice(1)) {
    const parts = line.split('|');
    if (parts.length < 4) continue;

    parsed.push({
      styleNumber: parts[0]?.trim() || '',
      sku: parts[1]?.trim() || '',
      gtin: parts[2]?.trim() || '',
      extendedDescription: parts[3]?.trim() || '',
    });
  }

  console.log(`✅ Parsed ${parsed.length} PDD rows`);
  return parsed;
}

/**
 * Parse DIP (Daily Inventory and Pricing) pipe-delimited file
 */
export function parseDIP(content: string): {
  inventory: DIPInventoryRow[];
  pricing: DIPPricingRow[];
} {
  const lines = content.split('\n').filter(line => line.trim().length > 0);
  const inventory: DIPInventoryRow[] = [];
  const pricing: DIPPricingRow[] = [];

  for (const line of lines.slice(1)) {
    const parts = line.split('|');
    if (parts.length < 8) continue;

    const recordType = parts[0]?.trim();
    const styleNumber = parts[1]?.trim() || '';
    const colorName = parts[2]?.trim() || '';
    const sizeName = parts[3]?.trim() || '';
    const uniqueKey = `${styleNumber}_${colorName}_${sizeName}`;

    if (recordType === 'I') {
      inventory.push({
        uniqueKey,
        styleNumber,
        colorName,
        sizeName,
        warehouseCode: parts[4]?.trim() || '',
        warehouseName: parts[5]?.trim() || '',
        quantityAvailable: parseInt(parts[6]) || 0,
        quantityOnOrder: parseInt(parts[7]) || 0,
        etaDate: parts[8]?.trim() || null,
      });
    } else if (recordType === 'P') {
      pricing.push({
        uniqueKey,
        styleNumber,
        priceType: parts[4]?.trim() || 'standard',
        quantityMin: parseInt(parts[5]) || 1,
        quantityMax: parseInt(parts[6]) || 999999,
        unitPrice: parseFloat(parts[7]) || 0,
        isSale: (parts[8]?.trim() || '').toLowerCase() === 'true',
        salePrice: parts[9] ? parseFloat(parts[9]) : null,
        saleEndDate: parts[10]?.trim() || null,
      });
    }
  }

  console.log(`✅ Parsed ${inventory.length} inventory rows, ${pricing.length} pricing rows from DIP`);
  return { inventory, pricing };
}

/**
 * Parse Catalog tab-delimited file
 */
export function parseCatalog(content: string): CatalogRow[] {
  const lines = content.split('\n').filter(line => line.trim().length > 0);
  const parsed: CatalogRow[] = [];

  for (const line of lines.slice(1)) {
    const parts = line.split('\t');
    if (parts.length < 3) continue;

    parsed.push({
      styleNumber: parts[0]?.trim() || '',
      description: parts[1]?.trim() || '',
      extendedDescription: parts[2]?.trim() || '',
    });
  }

  console.log(`✅ Parsed ${parsed.length} Catalog rows`);
  return parsed;
}

/**
 * Merge SDL and EPDD data to create complete product records
 */
export function mergeStyleData(
  sdlRows: SDLRow[],
  epddRows: EPDDRow[],
  pddRows: PDDRow[],
  catalogRows: CatalogRow[]
): {
  styles: Map<string, SDLRow & { extendedDescription?: string }>;
  products: EPDDRow[];
} {
  const styleMap = new Map<string, SDLRow & { extendedDescription?: string }>();
  const catalogMap = new Map<string, string>();
  const pddMap = new Map<string, string>();

  for (const catalog of catalogRows) {
    catalogMap.set(catalog.styleNumber, catalog.extendedDescription);
  }

  for (const pdd of pddRows) {
    if (pdd.gtin) {
      pddMap.set(pdd.styleNumber, pdd.extendedDescription);
    }
  }

  for (const sdl of sdlRows) {
    const extendedDesc = catalogMap.get(sdl.styleNumber) || pddMap.get(sdl.styleNumber);
    styleMap.set(sdl.styleNumber, {
      ...sdl,
      extendedDescription: extendedDesc,
    });
  }

  console.log(`✅ Merged ${styleMap.size} styles with extended descriptions`);

  return {
    styles: styleMap,
    products: epddRows,
  };
}
