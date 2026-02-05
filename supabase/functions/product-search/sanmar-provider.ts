/**
 * SanMar Search Provider
 *
 * Searches SanMar catalog cache and enriches with live SOAP data
 * Completely isolated from SSActivewear provider
 */

import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { resolveSanMarImages } from "../_shared/sanmar-image-resolver.ts";

export interface ColorOption {
  name: string;
  code: string;
  partIds?: string[];
  image_url?: string;
  pricing?: {
    wholesale?: number;
    retail?: number;
  };
  stock?: Record<string, number>;
  sizes?: string[];
}

export interface ProductResult {
  supplier: "sanmar" | "ssactivewear";
  style: string;
  brand: string;
  description: string;
  category?: string;
  colors: ColorOption[];
  cached: boolean;
  last_synced?: string;
  raw_data?: any;
}

const SANMAR_CDN_BASE = "https://cdn.ssactivewear.com/";

/**
 * Search SanMar catalog cache and enrich with live SOAP data
 */
export async function searchSanMarCatalog(
  supabaseAdmin: any,
  supabaseUrl: string,
  supabaseServiceKey: string,
  companyId: string,
  style: string
): Promise<{
  results: ProductResult[];
  errors: string[];
}> {
  const results: ProductResult[] = [];
  const errors: string[] = [];

  try {
    console.log(`🔍 Searching SanMar catalog cache for style: ${style}`);

    // Search sanmar_catalog_styles table
    const { data: styleData, error: styleError } = await supabaseAdmin
      .from("sanmar_catalog_styles")
      .select(`
        id,
        style_number,
        style_name,
        brand_name,
        category,
        product_description,
        is_active,
        updated_at
      `)
      .eq("company_id", companyId)
      .ilike("style_number", style)
      .eq("is_active", true)
      .maybeSingle();

    if (styleError) {
      console.error("SanMar style lookup error:", styleError);
      errors.push(`SanMar cache error: ${styleError.message}`);
      return { results, errors };
    }

    if (!styleData) {
      console.log(`❌ Style ${style} not found in SanMar cache`);

      // Try live SOAP API as fallback
      console.log(`📞 Falling back to SanMar SOAP API...`);
      const liveResult = await fetchSanMarLiveData(
        supabaseUrl,
        supabaseServiceKey,
        companyId,
        style
      );

      if (liveResult.success && liveResult.data) {
        const transformedProducts = transformSanMarLiveData(liveResult.data, style);
        if (transformedProducts.length > 0) {
          results.push(...transformedProducts);
        } else {
          // Data was returned but couldn't be transformed (invalid structure)
          errors.push(`SanMar: Style ${style} not found or invalid data returned`);
        }
      } else if (liveResult.error) {
        errors.push(`SanMar: ${liveResult.error}`);
      } else {
        // No success, no error, no data - unexpected state
        errors.push(`SanMar: Style ${style} not found`);
      }

      return { results, errors };
    }

    console.log(`✅ Found style in SanMar cache: ${styleData.style_number}`);

    // Get all products (SKUs) for this style
    const { data: productsData, error: productsError } = await supabaseAdmin
      .from("sanmar_catalog_products")
      .select(`
        id,
        unique_key,
        style_number,
        color_name,
        color_code,
        size_name,
        sku,
        upc,
        image_front,
        image_back,
        image_side,
        image_lifestyle
      `)
      .eq("company_id", companyId)
      .eq("style_id", styleData.id)
      .order("color_name", { ascending: true })
      .order("size_name", { ascending: true });

    if (productsError) {
      console.error("SanMar products lookup error:", productsError);
      errors.push(`SanMar products error: ${productsError.message}`);
      return { results, errors };
    }

    if (!productsData || productsData.length === 0) {
      console.log(`⚠️ No products found for style ${style} in cache`);
      errors.push(`No products found for style ${style}`);
      return { results, errors };
    }

    console.log(`📦 Found ${productsData.length} products in cache`);

    // Fetch live pricing and inventory from SOAP API
    const liveData = await fetchSanMarLiveData(
      supabaseUrl,
      supabaseServiceKey,
      companyId,
      style
    );

    const livePricingMap = new Map<string, any>();
    const liveInventoryMap = new Map<string, number>();

    if (liveData.success && liveData.data) {
      // Extract pricing
      if (liveData.data.pricing?.parts) {
        for (const part of liveData.data.pricing.parts) {
          if (part.partId && part.prices && part.prices.length > 0) {
            livePricingMap.set(part.partId, part.prices[0]);
          }
        }
      }

      // Extract inventory
      if (liveData.data.inventory?.items) {
        for (const item of liveData.data.inventory.items) {
          if (item.partId) {
            liveInventoryMap.set(item.partId, item.quantityAvailable || 0);
          }
        }
      }

      console.log(`💰 Fetched live pricing for ${livePricingMap.size} parts`);
      console.log(`📊 Fetched live inventory for ${liveInventoryMap.size} parts`);
    }

    // Group products by color
    const colorMap = new Map<string, ColorOption>();

    for (const product of productsData) {
      const colorName = product.color_name || "Default";
      const partId = product.sku || product.unique_key;

      if (!colorMap.has(colorName)) {
        // Get pricing from live data or cache
        let pricingInfo = { wholesale: 0, retail: 0 };
        const livePricing = livePricingMap.get(partId);
        if (livePricing) {
          pricingInfo.wholesale = livePricing.price || 0;
          pricingInfo.retail = livePricing.price || 0;
        }

        // Resolve image URL from sanmar_image_map (CDN)
        let imageUrl = "";
        try {
          const imageUrls = await resolveSanMarImages(
            supabaseAdmin,
            companyId,
            styleData.style_number,
            product.color_code
          );
          // Use front model, then front flat, then thumbnail as fallback
          imageUrl = imageUrls.frontModel || imageUrls.frontFlat || imageUrls.thumbnail || "";
        } catch (err) {
          console.error(`Failed to resolve images for ${styleData.style_number}:`, err);
          // Fallback to building URL from filename if image resolver fails
          imageUrl = buildImageUrl(
            product.image_front,
            product.image_back,
            product.image_side,
            product.image_lifestyle
          );
        }

        colorMap.set(colorName, {
          name: colorName,
          code: product.color_code || "",
          partIds: [],
          sizes: [],
          image_url: imageUrl,
          pricing: pricingInfo,
          stock: {},
        });
      }

      const colorOption = colorMap.get(colorName)!;

      // Add part ID
      if (partId && !colorOption.partIds?.includes(partId)) {
        colorOption.partIds?.push(partId);
      }

      // Add size
      if (product.size_name && !colorOption.sizes?.includes(product.size_name)) {
        colorOption.sizes?.push(product.size_name);
      }

      // Add inventory
      const inventory = liveInventoryMap.get(partId);
      if (inventory !== undefined && colorOption.stock) {
        colorOption.stock[partId] = inventory;
      }
    }

    const colors = Array.from(colorMap.values());

    results.push({
      supplier: "sanmar",
      style: styleData.style_number,
      brand: styleData.brand_name || "",
      description: styleData.style_name || styleData.product_description || "",
      category: styleData.category || "",
      colors,
      cached: true,
      last_synced: styleData.updated_at,
    });

    console.log(`✅ Successfully loaded ${colors.length} colors from SanMar cache`);

  } catch (error: any) {
    console.error("SanMar search error:", error);
    errors.push(`SanMar search error: ${error.message}`);
  }

  return { results, errors };
}

/**
 * Fetch live data from SanMar SOAP API
 */
async function fetchSanMarLiveData(
  supabaseUrl: string,
  supabaseServiceKey: string,
  companyId: string,
  style: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const sanmarUrl = `${supabaseUrl}/functions/v1/sanmar-api?action=unified&style=${encodeURIComponent(style)}&companyId=${encodeURIComponent(companyId)}`;

    const response = await fetch(sanmarUrl, {
      headers: {
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`SanMar API failed: ${response.status} - ${errorText}`);
      return {
        success: false,
        error: `API returned ${response.status}`,
      };
    }

    const data = await response.json();

    if (data.success) {
      return { success: true, data: data.data };
    } else {
      return {
        success: false,
        error: data.error || "Unknown error",
      };
    }
  } catch (error: any) {
    console.error("SanMar API fetch error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Transform live SOAP data into ProductResult format
 */
function transformSanMarLiveData(data: any, style: string): ProductResult[] {
  const products: ProductResult[] = [];

  if (!data || !data.style) {
    console.error("Invalid SanMar data structure:", data);
    return products;
  }

  const styleData = data.style;
  const mediaData = data.media;
  const pricingData = data.pricing;
  const inventoryData = data.inventory;

  const colors: ColorOption[] = [];

  if (styleData.colors && Array.isArray(styleData.colors)) {
    for (const color of styleData.colors) {
      const partIds = color.partIds || [];
      const sizes = partIds.map((p: any) => p.size).filter(Boolean);

      const firstPartId = partIds.length > 0 ? partIds[0].partId : "";

      let pricingInfo = { wholesale: 0, retail: 0 };
      if (pricingData?.parts && Array.isArray(pricingData.parts)) {
        const partPricing = pricingData.parts.find((p: any) => p.partId === firstPartId);
        if (partPricing?.prices && partPricing.prices.length > 0) {
          pricingInfo.wholesale = partPricing.prices[0].price || 0;
          pricingInfo.retail = partPricing.prices[0].price || 0;
        }
      }

      let inventoryInfo = {};
      if (inventoryData?.items && Array.isArray(inventoryData.items)) {
        const partInventory = inventoryData.items.filter((inv: any) =>
          partIds.some((p: any) => p.partId === inv.partId)
        );
        if (partInventory.length > 0) {
          inventoryInfo = partInventory.reduce((acc: any, inv: any) => {
            acc[inv.partId] = inv.quantityAvailable;
            return acc;
          }, {});
        }
      }

      let imageUrl = "";
      if (mediaData?.views) {
        imageUrl = mediaData.views.front ||
                   mediaData.views.lifestyle ||
                   (mediaData.views.frontImages?.[0]) ||
                   "";
      }

      colors.push({
        name: color.colorName,
        code: color.hex || "",
        partIds: partIds.map((p: any) => p.partId),
        image_url: imageUrl,
        pricing: pricingInfo,
        sizes: sizes,
        stock: inventoryInfo,
      });
    }
  }

  products.push({
    supplier: "sanmar",
    style: styleData.styleNumber || style,
    brand: styleData.productBrand || "",
    description: styleData.productName || styleData.description || "",
    category: styleData.productCategory || "",
    colors: colors,
    cached: false,
    raw_data: data,
  });

  return products;
}

/**
 * Build image URL from EPDD filename or fallback
 */
function buildImageUrl(
  imageFront?: string,
  imageBack?: string,
  imageSide?: string,
  imageLifestyle?: string
): string {
  // Prefer front image, then lifestyle, then back, then side
  const imageFilename = imageFront || imageLifestyle || imageBack || imageSide;

  if (!imageFilename) {
    return "";
  }

  // If already a full URL, return as-is
  if (imageFilename.startsWith("http://") || imageFilename.startsWith("https://")) {
    return imageFilename;
  }

  // Otherwise, build CDN URL
  // SanMar images are typically in format: "stylename_colorcode_view.jpg"
  return `${SANMAR_CDN_BASE}${imageFilename}`;
}
