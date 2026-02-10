/**
 * SanMar Search Provider - PromoStandards API
 *
 * Uses SanMar's PromoStandards Web Services API directly
 * Caches results in sanmar_product_cache and sanmar_media_cache tables
 */

import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import {
  fetchUnifiedSanMarData,
  type SanMarCredentials,
} from "../_shared/sanmar-promostandards-client.ts";

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

    const cachedData = await getCachedProduct(supabaseAdmin, companyId, style);
    if (cachedData) {
      console.log(`✅ Found cached SanMar data for ${style}`);
      results.push(cachedData);
      return { results, errors };
    }

    console.log(`📞 Fetching live data from SanMar PromoStandards API...`);

    const { fetchSanMarProductData, fetchSanMarMedia } = await import("../_shared/sanmar-promostandards-client.ts");

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

    if (!productData.parts || productData.parts.length === 0) {
      errors.push(`SanMar: Style ${style} not found or has no variants`);
      return { results, errors };
    }

    const mediaData = mediaResult.status === 'fulfilled' ? mediaResult.value : null;

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

    const product = transformSanMarData(apiData);
    results.push(product);

    await cacheProduct(supabaseAdmin, companyId, style, productData, mediaData);

    console.log(`✅ Successfully fetched ${product.colors.length} colors from SanMar API`);

  } catch (error: any) {
    console.error("SanMar search error:", error);
    errors.push(`SanMar error: ${error.message}`);
  }

  return { results, errors };
}

async function getCachedProduct(
  supabaseAdmin: any,
  companyId: string,
  style: string
): Promise<ProductResult | null> {
  try {
    const cacheKey = `style:${style.toUpperCase()}`;

    const { data: productCache } = await supabaseAdmin
      .from("sanmar_product_cache")
      .select("data, expires_at")
      .eq("company_id", companyId)
      .eq("cache_key", cacheKey)
      .eq("cache_type", "style")
      .maybeSingle();

    if (!productCache) {
      return null;
    }

    if (new Date(productCache.expires_at) < new Date()) {
      console.log(`⏰ Cache expired for ${style}`);
      return null;
    }

    const { data: mediaCache } = await supabaseAdmin
      .from("sanmar_media_cache")
      .select("data, expires_at")
      .eq("company_id", companyId)
      .eq("cache_key", cacheKey)
      .eq("cache_type", "style")
      .maybeSingle();

    const productData = productCache.data;
    const mediaData = mediaCache?.data || null;

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

    const product = transformSanMarData(apiData);
    product.cached = true;
    product.last_synced = productCache.expires_at;

    return product;
  } catch (error) {
    console.error("Error getting cached product:", error);
    return null;
  }
}

async function cacheProduct(
  supabaseAdmin: any,
  companyId: string,
  style: string,
  productData: any,
  mediaData: any
): Promise<void> {
  try {
    const cacheKey = `style:${style.toUpperCase()}`;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await supabaseAdmin
      .from("sanmar_product_cache")
      .upsert({
        company_id: companyId,
        cache_key: cacheKey,
        cache_type: "style",
        data: productData,
        expires_at: expiresAt.toISOString(),
      }, {
        onConflict: "company_id,cache_key"
      });

    if (mediaData) {
      await supabaseAdmin
        .from("sanmar_media_cache")
        .upsert({
          company_id: companyId,
          cache_key: cacheKey,
          cache_type: "style",
          data: mediaData,
          expires_at: expiresAt.toISOString(),
        }, {
          onConflict: "company_id,cache_key"
        });
    }

    console.log(`💾 Cached product and media data for ${style}`);
  } catch (error) {
    console.error("Error caching product:", error);
  }
}

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
