/**
 * SanMar Image Resolver
 *
 * Resolves product images from the sanmar_image_map table and media cache.
 * Provides fallback logic: EPDD images take priority over SDL images.
 * Returns images in the format expected by the mockup generator.
 *
 * ISOLATED from SSActivewear image logic - do not modify global utilities.
 */

import { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  getSanMarImageCache,
  setSanMarImageCache,
  buildSanMarCdnFallbackUrl,
  categorizeSanMarImages,
  logImageOperation,
  type MockupImageResult,
} from './image-cache.ts';

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

export async function resolveSanMarImagesForMockup(
  supabase: SupabaseClient,
  companyId: string,
  styleId: string,
  colorId?: string
): Promise<MockupImageResult> {
  const empty: MockupImageResult = { front: [], back: [], side: [], detail: [] };

  console.log(`[SanMar Resolver] supplier=sanmar, styleId=${styleId}, colorId=${colorId || 'none'}`);

  try {
    const cached = await getSanMarImageCache(supabase, companyId, styleId, colorId);

    if (cached && cached.rawImages && cached.rawImages.length > 0) {
      const { mockupImages } = categorizeSanMarImages(cached.rawImages, colorId);
      const total = mockupImages.front.length + mockupImages.back.length + mockupImages.side.length + mockupImages.detail.length;
      console.log(`[SanMar Resolver] supplier=sanmar, styleId=${styleId}, colorId=${colorId || 'none'}, cache=hit, images=${total}, fallback=false`);
      return mockupImages;
    }

    console.log(`[SanMar Resolver] supplier=sanmar, styleId=${styleId}, colorId=${colorId || 'none'}, cache=miss`);

    const mapImages = await fetchFromImageMap(supabase, companyId, styleId, colorId);

    if (mapImages.length > 0) {
      const mediaData = { images: mapImages };
      await setSanMarImageCache(supabase, companyId, styleId, mediaData, colorId);

      const { mockupImages } = categorizeSanMarImages(mapImages, colorId);
      const total = mockupImages.front.length + mockupImages.back.length + mockupImages.side.length + mockupImages.detail.length;
      console.log(`[SanMar Resolver] supplier=sanmar, styleId=${styleId}, colorId=${colorId || 'none'}, cache=miss, images=${total}, fallback=false`);
      return mockupImages;
    }

    const fallbackUrls = buildSanMarCdnFallbackUrl(styleId, colorId);
    if (fallbackUrls.length > 0) {
      const fallbackImages = fallbackUrls.map(url => ({
        url,
        productId: styleId,
        partId: "",
        classTypeName: url.includes("_fm") ? "Front" : url.includes("_bm") ? "Back" : "Other",
        color: colorId || "",
        singlePart: false,
      }));

      await setSanMarImageCache(supabase, companyId, styleId, { images: fallbackImages }, colorId);

      const { mockupImages } = categorizeSanMarImages(fallbackImages);
      console.log(`[SanMar Resolver] supplier=sanmar, styleId=${styleId}, colorId=${colorId || 'none'}, cache=miss, images=${mockupImages.front.length + mockupImages.back.length}, fallback=true`);
      return mockupImages;
    }

    console.log(`[SanMar Resolver] supplier=sanmar, styleId=${styleId}, colorId=${colorId || 'none'}, cache=miss, images=0, fallback=false`);
    return empty;
  } catch (err) {
    console.error(`[SanMar Resolver] Exception:`, err);
    return empty;
  }
}

async function fetchFromImageMap(
  supabase: SupabaseClient,
  companyId: string,
  style: string,
  colorCode?: string
): Promise<any[]> {
  try {
    let query = supabase
      .from('sanmar_image_map')
      .select('style, color_code, image_type, cdn_url, original_filename')
      .eq('company_id', companyId)
      .eq('style', style);

    if (colorCode) {
      query = query.eq('color_code', colorCode);
    }

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      return [];
    }

    return (data as SanMarImageRecord[]).map(record => {
      let classTypeName = "Other";
      const imageType = record.image_type || "";
      if (imageType.includes("front")) classTypeName = "Front";
      else if (imageType.includes("back")) classTypeName = "Back";
      else if (imageType.includes("side") || imageType.includes("sleeve")) classTypeName = "Side";
      else if (imageType.includes("swatch")) classTypeName = "Swatch";

      return {
        url: record.cdn_url,
        productId: record.style,
        partId: "",
        classTypeName,
        color: record.color_code || "",
        singlePart: false,
      };
    });
  } catch (err) {
    console.error('Exception in fetchFromImageMap:', err);
    return [];
  }
}

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
    let query = supabase
      .from('sanmar_image_map')
      .select('style, color_code, image_type, cdn_url, original_filename')
      .eq('company_id', companyId)
      .eq('style', style);

    if (colorCode) {
      query = query.eq('color_code', colorCode);
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

export async function resolveSanMarImage(
  supabase: SupabaseClient,
  companyId: string,
  style: string,
  imageType: string,
  colorCode?: string
): Promise<string | null> {
  try {
    let query = supabase
      .from('sanmar_image_map')
      .select('cdn_url')
      .eq('company_id', companyId)
      .eq('style', style)
      .eq('image_type', imageType)
      .limit(1);

    if (colorCode) {
      query = query.eq('color_code', colorCode);
    }

    const { data, error } = await query.maybeSingle();

    if (error || !data) {
      return null;
    }

    return data.cdn_url;
  } catch (err) {
    console.error('Exception in resolveSanMarImage:', err);
    return null;
  }
}

export async function getSanMarFrontImage(
  supabase: SupabaseClient,
  companyId: string,
  style: string,
  colorCode?: string
): Promise<string | null> {
  const images = await resolveSanMarImages(supabase, companyId, style, colorCode);
  return images.frontModel || images.frontFlat || images.thumbnail || null;
}

export async function getSanMarBackImage(
  supabase: SupabaseClient,
  companyId: string,
  style: string,
  colorCode?: string
): Promise<string | null> {
  const images = await resolveSanMarImages(supabase, companyId, style, colorCode);
  return images.backModel || images.backFlat || null;
}

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
