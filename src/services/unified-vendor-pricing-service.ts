import { supabase } from '../lib/supabase-client';

export interface NormalizedVendorPricing {
  vendor: string;
  style_id: string;
  part_id: string;
  color: string | null;
  size: string | null;
  warehouse: string | null;
  piece_price: number;
  currency: string;
  effective_date: string | null;
  expires: string | null;
}

const SUPPORTED_VENDORS = ['ssactivewear', 'sanmar'] as const;
type SupportedVendor = typeof SUPPORTED_VENDORS[number];

function isSupportedVendor(vendor: string): vendor is SupportedVendor {
  return SUPPORTED_VENDORS.includes(vendor.toLowerCase() as SupportedVendor);
}

async function getSSActivewearPricing(styleId: string): Promise<NormalizedVendorPricing[]> {
  const { data: companySettings } = await supabase
    .from('company_settings')
    .select('id')
    .maybeSingle();

  if (!companySettings) {
    throw new Error('Company settings not found');
  }

  const { data: pricingData, error } = await supabase
    .from('ss_catalog_pricing')
    .select(`
      part_number,
      quantity_min,
      quantity_max,
      unit_price,
      discount_code,
      price_type,
      currency,
      price_effective_date,
      price_expiry_date,
      parts!ss_catalog_pricing_part_id_fkey(
        part_id,
        color_name,
        size
      )
    `)
    .eq('company_id', companySettings.id)
    .or(`price_expiry_date.gte.${new Date().toISOString().split('T')[0]},price_expiry_date.is.null`)
    .order('part_number')
    .order('quantity_min');

  if (error) {
    throw new Error(`Failed to fetch SSActivewear pricing: ${error.message}`);
  }

  if (!pricingData || pricingData.length === 0) {
    return [];
  }

  return pricingData.map(row => ({
    vendor: 'SSActivewear',
    style_id: styleId,
    part_id: row.part_number,
    color: (row.parts as any)?.color_name || null,
    size: (row.parts as any)?.size || null,
    warehouse: null,
    piece_price: parseFloat(row.unit_price),
    currency: row.currency || 'USD',
    effective_date: row.price_effective_date || null,
    expires: row.price_expiry_date || null,
  }));
}

async function getSanMarPricing(styleId: string): Promise<NormalizedVendorPricing[]> {
  const { data: companySettings } = await supabase
    .from('company_settings')
    .select('id')
    .maybeSingle();

  if (!companySettings) {
    throw new Error('Company settings not found');
  }

  const { data: pricingData, error } = await supabase
    .from('sanmar_catalog_pricing')
    .select(`
      unique_key,
      quantity_min,
      quantity_max,
      unit_price,
      price_type,
      is_sale,
      sale_price,
      sale_end_date,
      product_id,
      sanmar_catalog_products!inner(
        unique_key,
        style_number,
        color_name,
        size_name
      )
    `)
    .eq('company_id', companySettings.id)
    .order('unique_key')
    .order('quantity_min');

  if (error) {
    throw new Error(`Failed to fetch SanMar pricing: ${error.message}`);
  }

  if (!pricingData || pricingData.length === 0) {
    return [];
  }

  return pricingData.map(row => {
    const product = row.sanmar_catalog_products as any;
    const effectivePrice = row.is_sale && row.sale_price ? parseFloat(row.sale_price) : parseFloat(row.unit_price);

    return {
      vendor: 'SanMar',
      style_id: styleId,
      part_id: row.unique_key,
      color: product?.color_name || null,
      size: product?.size_name || null,
      warehouse: null,
      piece_price: effectivePrice,
      currency: 'USD',
      effective_date: null,
      expires: row.is_sale ? row.sale_end_date : null,
    };
  });
}

export async function getVendorPricing(
  vendor: string,
  styleId: string
): Promise<NormalizedVendorPricing[]> {
  const normalizedVendor = vendor.toLowerCase().trim();

  if (!isSupportedVendor(normalizedVendor)) {
    throw new Error(
      `Unsupported vendor: "${vendor}". Supported vendors are: ${SUPPORTED_VENDORS.join(', ')}`
    );
  }

  switch (normalizedVendor) {
    case 'ssactivewear':
      return await getSSActivewearPricing(styleId);

    case 'sanmar':
      return await getSanMarPricing(styleId);

    default:
      throw new Error(`Vendor routing not implemented for: ${vendor}`);
  }
}
