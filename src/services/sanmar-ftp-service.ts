/**
 * SanMar FTP Service
 *
 * Handles downloading, parsing, and normalizing SanMar product data from FTP files.
 *
 * Files downloaded from ftp.sanmar.com:2200/SanMarPDD/:
 * - SanMar_SDL_N.csv (Style/Color/Size data - CSV)
 * - SanMar_EPDD.csv (Enhanced Product Data - CSV)
 * - sanmar_pdd.txt (Product Detail Data - Pipe-delimited)
 * - sanmar_dip.txt (Product Images - Pipe-delimited)
 */

import { supabase } from '../lib/supabase-client';

export interface SanMarFTPCredentials {
  username: string; // Customer number
  password: string; // FTP password
}

export interface UnifiedGarment {
  uniqueKey: string;
  inventoryKey: string;
  sizeIndex: number;
  style: string;
  color: string;
  size: string;
  productTitle: string;
  description: string;
  extendedDescription: string;
  category: string;
  subcategory: string;
  msrp: number;
  mapPricing: number;
  piecePrice: number;
  casePrice: number;
  weight: number;
  qty: number;
  gtin: string;
  images: {
    frontModel: string;
    backModel: string;
    frontFlat: string;
    backFlat: string;
    colorSwatch: string;
    thumbnail: string;
  };
}

interface ParsedSDL {
  style: string;
  color: string;
  colorName: string;
  size: string;
  sizeIndex: number;
  inventoryKey: string;
  gtin: string;
  qty: number;
  piecePrice: number;
  casePrice: number;
  weight: number;
}

interface ParsedEPDD {
  style: string;
  productTitle: string;
  description: string;
  extendedDescription: string;
  category: string;
  subcategory: string;
  msrp: number;
  mapPricing: number;
}

interface ParsedPDD {
  style: string;
  colorCode: string;
  colorName: string;
  description: string;
  category: string;
  brand: string;
}

interface ParsedDIP {
  style: string;
  colorCode: string;
  images: {
    frontModel: string;
    backModel: string;
    frontFlat: string;
    backFlat: string;
    colorSwatch: string;
    thumbnail: string;
  };
}

/**
 * Parse CSV file (comma-delimited, quote-encapsulated)
 */
function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];

  const headers = parseCSVLine(lines[0]);
  const records: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header.trim()] = values[index]?.trim() || '';
    });
    records.push(record);
  }

  return records;
}

/**
 * Parse a single CSV line handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

/**
 * Parse pipe-delimited file
 */
function parsePipeDelimited(content: string): Record<string, string>[] {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];

  const headers = lines[0].split('|').map(h => h.trim());
  const records: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split('|');
    if (values.length === 0) continue;

    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = values[index]?.trim() || '';
    });
    records.push(record);
  }

  return records;
}

/**
 * Parse SanMar_SDL_N.csv (Style/Color/Size data)
 */
function parseSDL(content: string): ParsedSDL[] {
  const records = parseCSV(content);
  return records.map(r => ({
    style: r.StyleNumber || r.Style || '',
    color: r.ColorCode || r.Color || '',
    colorName: r.ColorName || '',
    size: r.Size || '',
    sizeIndex: parseInt(r.SizeIndex || r.SizeOrder || '0'),
    inventoryKey: r.InventoryKey || r.SKU || '',
    gtin: r.GTIN || r.UPC || '',
    qty: parseInt(r.Quantity || r.Qty || '0'),
    piecePrice: parseFloat(r.PiecePrice || r.Price || '0'),
    casePrice: parseFloat(r.CasePrice || '0'),
    weight: parseFloat(r.Weight || '0'),
  }));
}

/**
 * Parse SanMar_EPDD.csv (Enhanced Product Data)
 */
function parseEPDD(content: string): ParsedEPDD[] {
  const records = parseCSV(content);
  return records.map(r => ({
    style: r.StyleNumber || r.Style || '',
    productTitle: r.ProductTitle || r.Title || '',
    description: r.Description || '',
    extendedDescription: r.ExtendedDescription || r.LongDescription || '',
    category: r.Category || '',
    subcategory: r.Subcategory || r.SubCategory || '',
    msrp: parseFloat(r.MSRP || r.RetailPrice || '0'),
    mapPricing: parseFloat(r.MAP || r.MinimumAdvertisedPrice || '0'),
  }));
}

/**
 * Parse sanmar_pdd.txt (Product Detail Data - pipe-delimited)
 */
function parsePDD(content: string): ParsedPDD[] {
  const records = parsePipeDelimited(content);
  return records.map(r => ({
    style: r.StyleNumber || r.Style || '',
    colorCode: r.ColorCode || r.Color || '',
    colorName: r.ColorName || '',
    description: r.Description || '',
    category: r.Category || '',
    brand: r.Brand || '',
  }));
}

/**
 * Parse sanmar_dip.txt (Product Images - pipe-delimited)
 */
function parseDIP(content: string): ParsedDIP[] {
  const records = parsePipeDelimited(content);
  return records.map(r => ({
    style: r.StyleNumber || r.Style || '',
    colorCode: r.ColorCode || r.Color || '',
    images: {
      frontModel: r.FrontModelImage || r.FrontImage || '',
      backModel: r.BackModelImage || r.BackImage || '',
      frontFlat: r.FrontFlatImage || r.FlatFront || '',
      backFlat: r.BackFlatImage || r.FlatBack || '',
      colorSwatch: r.SwatchImage || r.Swatch || '',
      thumbnail: r.ThumbnailImage || r.Thumbnail || '',
    },
  }));
}

/**
 * Normalize all parsed data into unified garment model
 */
function normalizeGarments(
  sdlData: ParsedSDL[],
  epddData: ParsedEPDD[],
  pddData: ParsedPDD[],
  dipData: ParsedDIP[]
): UnifiedGarment[] {
  const garments: UnifiedGarment[] = [];

  // Create lookup maps for efficient merging
  const epddMap = new Map(epddData.map(e => [e.style, e]));
  const pddMap = new Map(pddData.map(p => [`${p.style}-${p.colorCode}`, p]));
  const dipMap = new Map(dipData.map(d => [`${d.style}-${d.colorCode}`, d]));

  // SDL is the primary source - each row is a unique garment variant
  for (const sdl of sdlData) {
    const epdd = epddMap.get(sdl.style);
    const pddKey = `${sdl.style}-${sdl.color}`;
    const pdd = pddMap.get(pddKey);
    const dip = dipMap.get(pddKey);

    const uniqueKey = `${sdl.style}-${sdl.color}-${sdl.size}`;

    garments.push({
      uniqueKey,
      inventoryKey: sdl.inventoryKey,
      sizeIndex: sdl.sizeIndex,
      style: sdl.style,
      color: sdl.colorName || pdd?.colorName || sdl.color,
      size: sdl.size,
      productTitle: epdd?.productTitle || pdd?.description || sdl.style,
      description: epdd?.description || pdd?.description || '',
      extendedDescription: epdd?.extendedDescription || '',
      category: epdd?.category || pdd?.category || '',
      subcategory: epdd?.subcategory || '',
      msrp: epdd?.msrp || 0,
      mapPricing: epdd?.mapPricing || 0,
      piecePrice: sdl.piecePrice,
      casePrice: sdl.casePrice,
      weight: sdl.weight,
      qty: sdl.qty,
      gtin: sdl.gtin,
      images: dip?.images || {
        frontModel: '',
        backModel: '',
        frontFlat: '',
        backFlat: '',
        colorSwatch: '',
        thumbnail: '',
      },
    });
  }

  return garments;
}

/**
 * Fetch all files from SanMar FTP server
 *
 * Note: This requires SFTP access which is not directly supported in browser/Edge environments.
 * This function should be called from a server-side Edge Function.
 */
export async function fetchAllFiles(
  credentials: SanMarFTPCredentials,
  companyId: string
): Promise<{
  success: boolean;
  files: Record<string, string>;
  errors: string[];
}> {
  const errors: string[] = [];
  const files: Record<string, string> = {};

  try {
    // Log sync start
    const { data: syncLog } = await supabase
      .from('sanmar_ftp_sync_log')
      .insert({
        company_id: companyId,
        status: 'in_progress',
        sync_started: new Date().toISOString(),
      })
      .select()
      .single();

    // Call Edge Function to download files
    const { data: downloadResult, error: downloadError } = await supabase.functions.invoke(
      'sanmar-ftp-sync',
      {
        body: {
          companyId,
          credentials,
        },
      }
    );

    if (downloadError) {
      errors.push(`Download failed: ${downloadError.message}`);

      if (syncLog) {
        await supabase
          .from('sanmar_ftp_sync_log')
          .update({
            status: 'failed',
            sync_completed: new Date().toISOString(),
            error_message: downloadError.message,
          })
          .eq('id', syncLog.id);
      }

      return { success: false, files, errors };
    }

    // Extract downloaded files
    if (downloadResult?.files) {
      Object.assign(files, downloadResult.files);
    }

    // Update sync log
    if (syncLog) {
      await supabase
        .from('sanmar_ftp_sync_log')
        .update({
          status: 'completed',
          sync_completed: new Date().toISOString(),
          files_downloaded: Object.keys(files),
        })
        .eq('id', syncLog.id);
    }

    return { success: true, files, errors };
  } catch (error: any) {
    errors.push(`Exception: ${error.message}`);
    return { success: false, files, errors };
  }
}

/**
 * Parse all downloaded files and return unified garments
 */
export async function parseAllFiles(files: Record<string, string>): Promise<{
  garments: UnifiedGarment[];
  errors: string[];
}> {
  const errors: string[] = [];
  let sdlData: ParsedSDL[] = [];
  let epddData: ParsedEPDD[] = [];
  let pddData: ParsedPDD[] = [];
  let dipData: ParsedDIP[] = [];

  try {
    // Parse SDL_N (required)
    if (files['SanMar_SDL_N.csv']) {
      sdlData = parseSDL(files['SanMar_SDL_N.csv']);
    } else {
      errors.push('Missing required file: SanMar_SDL_N.csv');
    }

    // Parse EPDD (required)
    if (files['SanMar_EPDD.csv']) {
      epddData = parseEPDD(files['SanMar_EPDD.csv']);
    } else {
      errors.push('Missing required file: SanMar_EPDD.csv');
    }

    // Parse PDD (required)
    if (files['sanmar_pdd.txt']) {
      pddData = parsePDD(files['sanmar_pdd.txt']);
    } else {
      errors.push('Missing required file: sanmar_pdd.txt');
    }

    // Parse DIP (required)
    if (files['sanmar_dip.txt']) {
      dipData = parseDIP(files['sanmar_dip.txt']);
    } else {
      errors.push('Missing required file: sanmar_dip.txt');
    }

    // Normalize all data
    const garments = normalizeGarments(sdlData, epddData, pddData, dipData);

    return { garments, errors };
  } catch (error: any) {
    errors.push(`Parse error: ${error.message}`);
    return { garments: [], errors };
  }
}

/**
 * Get a unified garment by unique key
 */
export async function getUnifiedGarment(
  companyId: string,
  uniqueKey: string
): Promise<UnifiedGarment | null> {
  const { data, error } = await supabase
    .from('sanmar_ftp_unified_garments')
    .select('*')
    .eq('company_id', companyId)
    .eq('unique_key', uniqueKey)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    uniqueKey: data.unique_key,
    inventoryKey: data.inventory_key,
    sizeIndex: data.size_index,
    style: data.style,
    color: data.color,
    size: data.size,
    productTitle: data.product_title,
    description: data.description,
    extendedDescription: data.extended_description,
    category: data.category,
    subcategory: data.subcategory,
    msrp: parseFloat(data.msrp || '0'),
    mapPricing: parseFloat(data.map_pricing || '0'),
    piecePrice: parseFloat(data.piece_price || '0'),
    casePrice: parseFloat(data.case_price || '0'),
    weight: parseFloat(data.weight || '0'),
    qty: data.qty,
    gtin: data.gtin,
    images: data.images || {
      frontModel: '',
      backModel: '',
      frontFlat: '',
      backFlat: '',
      colorSwatch: '',
      thumbnail: '',
    },
  };
}

/**
 * Get all garments for a company
 */
export async function getAllGarments(
  companyId: string,
  filters?: {
    style?: string;
    category?: string;
    limit?: number;
    offset?: number;
  }
): Promise<UnifiedGarment[]> {
  let query = supabase
    .from('sanmar_ftp_unified_garments')
    .select('*')
    .eq('company_id', companyId);

  if (filters?.style) {
    query = query.eq('style', filters.style);
  }

  if (filters?.category) {
    query = query.eq('category', filters.category);
  }

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 100) - 1);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  return data.map(d => ({
    uniqueKey: d.unique_key,
    inventoryKey: d.inventory_key,
    sizeIndex: d.size_index,
    style: d.style,
    color: d.color,
    size: d.size,
    productTitle: d.product_title,
    description: d.description,
    extendedDescription: d.extended_description,
    category: d.category,
    subcategory: d.subcategory,
    msrp: parseFloat(d.msrp || '0'),
    mapPricing: parseFloat(d.map_pricing || '0'),
    piecePrice: parseFloat(d.piece_price || '0'),
    casePrice: parseFloat(d.case_price || '0'),
    weight: parseFloat(d.weight || '0'),
    qty: d.qty,
    gtin: d.gtin,
    images: d.images || {
      frontModel: '',
      backModel: '',
      frontFlat: '',
      backFlat: '',
      colorSwatch: '',
      thumbnail: '',
    },
  }));
}

/**
 * Save parsed garments to database
 */
export async function saveGarmentsToDatabase(
  companyId: string,
  garments: UnifiedGarment[],
  sourceFile: string
): Promise<{ success: boolean; savedCount: number; errors: string[] }> {
  const errors: string[] = [];
  let savedCount = 0;

  try {
    // Batch insert/update garments
    const batchSize = 500;
    for (let i = 0; i < garments.length; i += batchSize) {
      const batch = garments.slice(i, i + batchSize);

      const records = batch.map(g => ({
        company_id: companyId,
        unique_key: g.uniqueKey,
        inventory_key: g.inventoryKey,
        size_index: g.sizeIndex,
        style: g.style,
        color: g.color,
        size: g.size,
        product_title: g.productTitle,
        description: g.description,
        extended_description: g.extendedDescription,
        category: g.category,
        subcategory: g.subcategory,
        msrp: g.msrp,
        map_pricing: g.mapPricing,
        piece_price: g.piecePrice,
        case_price: g.casePrice,
        weight: g.weight,
        qty: g.qty,
        gtin: g.gtin,
        images: g.images,
        source_file: sourceFile,
        last_synced: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('sanmar_ftp_unified_garments')
        .upsert(records, {
          onConflict: 'company_id,unique_key',
        });

      if (error) {
        errors.push(`Batch ${i / batchSize + 1} failed: ${error.message}`);
      } else {
        savedCount += batch.length;
      }
    }

    return { success: errors.length === 0, savedCount, errors };
  } catch (error: any) {
    errors.push(`Save error: ${error.message}`);
    return { success: false, savedCount, errors };
  }
}

/**
 * Complete sync workflow: fetch, parse, and save
 */
export async function syncSanMarFTPData(
  credentials: SanMarFTPCredentials,
  companyId: string
): Promise<{
  success: boolean;
  totalGarments: number;
  errors: string[];
}> {
  const allErrors: string[] = [];

  // Fetch files
  const { success: fetchSuccess, files, errors: fetchErrors } = await fetchAllFiles(
    credentials,
    companyId
  );

  allErrors.push(...fetchErrors);

  if (!fetchSuccess || Object.keys(files).length === 0) {
    return { success: false, totalGarments: 0, errors: allErrors };
  }

  // Parse files
  const { garments, errors: parseErrors } = await parseAllFiles(files);
  allErrors.push(...parseErrors);

  if (garments.length === 0) {
    allErrors.push('No garments parsed from files');
    return { success: false, totalGarments: 0, errors: allErrors };
  }

  // Save to database
  const { success: saveSuccess, savedCount, errors: saveErrors } = await saveGarmentsToDatabase(
    companyId,
    garments,
    'ftp_sync'
  );

  allErrors.push(...saveErrors);

  return {
    success: saveSuccess,
    totalGarments: savedCount,
    errors: allErrors,
  };
}
