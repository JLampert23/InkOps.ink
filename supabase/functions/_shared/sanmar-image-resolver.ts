/**
 * SanMar Image Resolver
 *
 * Resolves product images from the sanmar_image_map table.
 * Provides fallback logic: EPDD images take priority over SDL images.
 *
 * ISOLATED from SSActivewear image logic - do not modify global utilities.
 */

import { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export interface SanMarImageUrls {
  frontModel: string | null;
  backModel: string | null;
  frontFlat: string | null;
  backFlat: string | null;
  colorSwatch: string | null;
  thumbnail: string | null;
  brandLogo: string | null;
}

export interface SanMarImageRecord {
  style: string;
  color_code: string | null;
  image_type: string;
  cdn_url: string;
  original_filename: string;
}

/**
 * Resolves all image URLs for a given style and color
 */
export async function resolveSanMarImages(
  supabase: SupabaseClient,
  companyId: string,
  style: string,
  colorCode?: string
): Promise<SanMarImageUrls> {
  const result: SanMarImageUrls = {
    frontModel: null,
    backModel: null,
    frontFlat: null,
    backFlat: null,
    colorSwatch: null,
    thumbnail: null,
    brandLogo: null,
  };

  try {
    // Query all images for this style
    const query = supabase
      .from('sanmar_image_map')
      .select('style, color_code, image_type, cdn_url, original_filename')
      .eq('company_id', companyId)
      .eq('style', style);

    if (colorCode) {
      query.eq('color_code', colorCode);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching SanMar images:', error);
      return result;
    }

    if (!data || data.length === 0) {
      return result;
    }

    const records = data as SanMarImageRecord[];

    // Map image types to result properties
    // EPDD images (model/flat) take priority
    for (const record of records) {
      const url = record.cdn_url;

      switch (record.image_type) {
        case 'front_model':
          if (!result.frontModel) result.frontModel = url;
          break;
        case 'back_model':
          if (!result.backModel) result.backModel = url;
          break;
        case 'front_flat':
          if (!result.frontFlat) result.frontFlat = url;
          break;
        case 'back_flat':
          if (!result.backFlat) result.backFlat = url;
          break;
        case 'color_swatch':
          if (!result.colorSwatch) result.colorSwatch = url;
          break;
        case 'thumbnail':
          if (!result.thumbnail) result.thumbnail = url;
          break;
        case 'brand_logo':
          if (!result.brandLogo) result.brandLogo = url;
          break;
      }
    }

    return result;
  } catch (err) {
    console.error('Exception in resolveSanMarImages:', err);
    return result;
  }
}

/**
 * Resolves a single image URL by type
 */
export async function resolveSanMarImage(
  supabase: SupabaseClient,
  companyId: string,
  style: string,
  imageType: string,
  colorCode?: string
): Promise<string | null> {
  try {
    const query = supabase
      .from('sanmar_image_map')
      .select('cdn_url')
      .eq('company_id', companyId)
      .eq('style', style)
      .eq('image_type', imageType)
      .limit(1)
      .single();

    if (colorCode) {
      query.eq('color_code', colorCode);
    }

    const { data, error } = await query;

    if (error || !data) {
      return null;
    }

    return data.cdn_url;
  } catch (err) {
    console.error('Exception in resolveSanMarImage:', err);
    return null;
  }
}

/**
 * Gets the best available front image (prioritizes model over flat)
 */
export async function getSanMarFrontImage(
  supabase: SupabaseClient,
  companyId: string,
  style: string,
  colorCode?: string
): Promise<string | null> {
  const images = await resolveSanMarImages(supabase, companyId, style, colorCode);
  return images.frontModel || images.frontFlat || images.thumbnail || null;
}

/**
 * Gets the best available back image (prioritizes model over flat)
 */
export async function getSanMarBackImage(
  supabase: SupabaseClient,
  companyId: string,
  style: string,
  colorCode?: string
): Promise<string | null> {
  const images = await resolveSanMarImages(supabase, companyId, style, colorCode);
  return images.backModel || images.backFlat || null;
}

/**
 * Checks if images exist for a given style
 */
export async function sanMarImagesExist(
  supabase: SupabaseClient,
  companyId: string,
  style: string
): Promise<boolean> {
  try {
    const { count, error } = await supabase
      .from('sanmar_image_map')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('style', style);

    if (error) {
      console.error('Error checking SanMar images:', error);
      return false;
    }

    return (count ?? 0) > 0;
  } catch (err) {
    console.error('Exception in sanMarImagesExist:', err);
    return false;
  }
}
