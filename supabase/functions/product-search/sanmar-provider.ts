/**
 * SanMar Search Provider - PromoStandards API
 *
 * Uses SanMar's PromoStandards Web Services API directly
 * Caches results in database for faster subsequent searches
 */

import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import {
  fetchUnifiedSanMarData,
  type SanMarCredentials,
} from "../_shared/sanmar-promostandards-client.ts";

/**
 * Decrypt password using Web Crypto API
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

async function decryptPassword(encryptedPassword: string, encryptionKey: string): Promise<string> {
  try {
    const combined = new Uint8Array(
      atob(encryptedPassword).split('').map(c => c.charCodeAt(0))
    );

    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const encryptedData = combined.slice(28);

    const key = await deriveKey(encryptionKey, salt);

    const decryptedData = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encryptedData
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedData);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt password');
  }
}

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

/**
 * Search SanMar catalog using PromoStandards API
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
    console.log(`🔍 Searching SanMar via PromoStandards API for: ${style}`);

    // Get SanMar credentials from company settings
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("company_settings")
      .select("sanmar_enabled, sanmar_promo_username, sanmar_promo_password_encrypted")
      .eq("id", companyId)
      .single();

    if (settingsError || !settings) {
      console.error("Failed to get company settings:", settingsError);
      errors.push("SanMar integration not configured");
      return { results, errors };
    }

    if (!settings.sanmar_enabled) {
      errors.push("SanMar integration is disabled");
      return { results, errors };
    }

    if (!settings.sanmar_promo_username || !settings.sanmar_promo_password_encrypted) {
      errors.push("SanMar credentials not configured");
      return { results, errors };
    }

    // Decrypt the password using inline crypto
    let decryptedPassword = "";
    try {
      const encryptionKey = Deno.env.get("ENCRYPTION_KEY");
      if (!encryptionKey) {
        throw new Error("ENCRYPTION_KEY not configured");
      }

      decryptedPassword = await decryptPassword(settings.sanmar_promo_password_encrypted, encryptionKey);
    } catch (decryptError: any) {
      console.error("Password decryption failed:", decryptError);
      errors.push("Failed to decrypt SanMar credentials");
      return { results, errors };
    }

    const credentials: SanMarCredentials = {
      id: settings.sanmar_promo_username,
      password: decryptedPassword,
    };

    // Check cache first (if exists)
    const cachedData = await getCachedProduct(supabaseAdmin, companyId, style);
    if (cachedData) {
      console.log(`✅ Found cached SanMar data for ${style}`);
      results.push(cachedData);
      return { results, errors };
    }

    // Fetch from live API - only fetch product data for faster search
    console.log(`📞 Fetching live data from SanMar PromoStandards API...`);

    // Import individual functions for more control
    const { fetchSanMarProductData, fetchSanMarMedia } = await import("../_shared/sanmar-promostandards-client.ts");

    // Only fetch product data and media (skip slow inventory/pricing calls)
    const [productResult, mediaResult] = await Promise.allSettled([
      fetchSanMarProductData(credentials, style),
      fetchSanMarMedia(credentials, style),
    ]);

    if (productResult.status === 'rejected') {
      const errorMessage = productResult.reason?.message || 'Product not found';
      errors.push(`SanMar error: ${errorMessage}`);
      return { results, errors };
    }

    const productData = productResult.value;

    // Check if product has no parts/colors
    if (!productData.parts || productData.parts.length === 0) {
      errors.push(`SanMar: Style ${style} not found or has no variants`);
      return { results, errors };
    }

    const mediaData = mediaResult.status === 'fulfilled' ? mediaResult.value : null;

    // Build simplified API data structure
    const apiData = {
      success: true,
      styleNumber: style,
      partId: null,
      style: productData,
      inventory: { items: [] },
      pricing: { parts: [] },
      media: mediaData || {
        images: [],
        views: {
          front: null,
          rear: null,
          side: null,
          lifestyle: null,
          frontImages: [],
          rearImages: [],
          sideImages: [],
          lifestyleImages: [],
          otherImages: [],
        }
      },
    };

    // Transform API response to ProductResult
    const product = transformSanMarData(apiData);
    results.push(product);

    // Cache the result for future searches
    await cacheProduct(supabaseAdmin, companyId, apiData);

    console.log(`✅ Successfully fetched ${product.colors.length} colors from SanMar API`);

  } catch (error: any) {
    console.error("SanMar search error:", error);
    errors.push(`SanMar error: ${error.message}`);
  }

  return { results, errors };
}

/**
 * Get cached product from database
 */
async function getCachedProduct(
  supabaseAdmin: any,
  companyId: string,
  style: string
): Promise<ProductResult | null> {
  try {
    const { data: styleData, error } = await supabaseAdmin
      .from("sanmar_catalog_styles")
      .select(`
        *,
        sanmar_catalog_products (
          *
        ),
        sanmar_catalog_pricing (
          *
        )
      `)
      .eq("company_id", companyId)
      .ilike("style_number", style)
      .eq("is_active", true)
      .maybeSingle();

    if (error || !styleData || !styleData.sanmar_catalog_products) {
      return null;
    }

    // Check if data is recent (less than 24 hours old)
    const updatedAt = new Date(styleData.updated_at);
    const now = new Date();
    const hoursSinceUpdate = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60);

    if (hoursSinceUpdate > 24) {
      console.log(`⏰ Cached data for ${style} is ${hoursSinceUpdate.toFixed(1)} hours old, refreshing...`);
      return null;
    }

    // Build color map from products
    const colorMap = new Map<string, ColorOption>();
    const pricingMap = new Map<string, any>();

    // Index pricing by SKU
    if (styleData.sanmar_catalog_pricing) {
      for (const price of styleData.sanmar_catalog_pricing) {
        pricingMap.set(price.sku, price);
      }
    }

    for (const product of styleData.sanmar_catalog_products) {
      const colorName = product.color_name || "Default";

      if (!colorMap.has(colorName)) {
        const pricing = pricingMap.get(product.sku);

        colorMap.set(colorName, {
          name: colorName,
          code: product.color_code || "",
          partIds: [],
          sizes: [],
          image_url: product.image_front || "",
          pricing: pricing
            ? {
                wholesale: pricing.piece_price || 0,
                retail: pricing.piece_price || 0,
              }
            : undefined,
          stock: {},
        });
      }

      const color = colorMap.get(colorName)!;
      if (product.sku && !color.partIds?.includes(product.sku)) {
        color.partIds?.push(product.sku);
      }
      if (product.size_name && !color.sizes?.includes(product.size_name)) {
        color.sizes?.push(product.size_name);
      }
    }

    return {
      supplier: "sanmar",
      style: styleData.style_number,
      brand: styleData.brand_name || "",
      description: styleData.style_name || styleData.product_description || "",
      category: styleData.category || "",
      colors: Array.from(colorMap.values()),
      cached: true,
      last_synced: styleData.updated_at,
    };
  } catch (error) {
    console.error("Error getting cached product:", error);
    return null;
  }
}

/**
 * Cache product data in database
 */
async function cacheProduct(
  supabaseAdmin: any,
  companyId: string,
  apiData: any
): Promise<void> {
  try {
    const style = apiData.style;

    // Upsert style
    const { data: styleRow, error: styleError } = await supabaseAdmin
      .from("sanmar_catalog_styles")
      .upsert(
        {
          company_id: companyId,
          style_number: style.styleNumber,
          style_name: style.productName,
          brand_name: style.productBrand,
          category: style.productCategory,
          product_description: style.description,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "company_id,style_number",
        }
      )
      .select()
      .single();

    if (styleError || !styleRow) {
      console.error("Failed to cache style:", styleError);
      return;
    }

    // Cache products (SKUs)
    const products = [];
    for (const part of style.parts) {
      products.push({
        company_id: companyId,
        style_id: styleRow.id,
        unique_key: part.partId,
        style_number: style.styleNumber,
        color_name: part.colorName,
        color_code: part.hex,
        size_name: part.labelSize,
        sku: part.partId,
        image_front: apiData.media?.views?.front || "",
      });
    }

    if (products.length > 0) {
      await supabaseAdmin.from("sanmar_catalog_products").upsert(products, {
        onConflict: "company_id,unique_key",
      });
    }

    // Cache pricing
    if (apiData.pricing?.parts) {
      const pricing = [];
      for (const part of apiData.pricing.parts) {
        if (part.prices && part.prices.length > 0) {
          pricing.push({
            company_id: companyId,
            style_id: styleRow.id,
            sku: part.partId,
            piece_price: part.prices[0].price,
            case_price: part.prices[0].price,
          });
        }
      }

      if (pricing.length > 0) {
        await supabaseAdmin.from("sanmar_catalog_pricing").upsert(pricing, {
          onConflict: "company_id,sku",
        });
      }
    }

    console.log(`💾 Cached ${products.length} products for ${style.styleNumber}`);
  } catch (error) {
    console.error("Error caching product:", error);
  }
}

/**
 * Transform PromoStandards API response to ProductResult
 */
function transformSanMarData(apiData: any): ProductResult {
  const style = apiData.style;
  const colors: ColorOption[] = [];

  if (style.colors && Array.isArray(style.colors)) {
    for (const color of style.colors) {
      const partIds = (color.partIds || []).map((p: any) => p.partId);
      const sizes = (color.partIds || []).map((p: any) => p.size).filter(Boolean);

      let pricing = { wholesale: 0, retail: 0 };
      if (apiData.pricing?.parts) {
        const firstPartId = partIds[0];
        const partPricing = apiData.pricing.parts.find((p: any) => p.partId === firstPartId);
        if (partPricing?.prices && partPricing.prices.length > 0) {
          pricing.wholesale = partPricing.prices[0].price || 0;
          pricing.retail = partPricing.prices[0].price || 0;
        }
      }

      let stock = {};
      if (apiData.inventory?.items) {
        for (const inv of apiData.inventory.items) {
          if (partIds.includes(inv.partId)) {
            stock[inv.partId] = inv.quantityAvailable || 0;
          }
        }
      }

      const imageUrl =
        apiData.media?.views?.front ||
        apiData.media?.views?.lifestyle ||
        (apiData.media?.views?.frontImages?.[0]) ||
        "";

      colors.push({
        name: color.colorName,
        code: color.hex || "",
        partIds,
        sizes,
        image_url: imageUrl,
        pricing,
        stock,
      });
    }
  }

  return {
    supplier: "sanmar",
    style: style.styleNumber,
    brand: style.productBrand || "",
    description: style.productName || style.description || "",
    category: style.productCategory || "",
    colors,
    cached: false,
    raw_data: apiData,
  };
}
