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
    console.log(`SanMar search for: ${style}`);

    const cachedData = await getCachedProduct(supabaseAdmin, companyId, style);
    if (cachedData) {
      console.log(`Cache hit for ${style}`);
      results.push(cachedData);
      return { results, errors };
    }

    console.log(`Cache miss, calling sanmar-api edge function for ${style}`);

    const apiUrl = `${supabaseUrl}/functions/v1/sanmar-api?action=product&style=${encodeURIComponent(style)}&companyId=${encodeURIComponent(companyId)}`;
    const productResponse = await fetch(apiUrl, {
      headers: { "Authorization": `Bearer ${supabaseServiceKey}` },
    });

    if (!productResponse.ok) {
      const errText = await productResponse.text();
      console.error(`sanmar-api returned ${productResponse.status}: ${errText}`);
      errors.push(`SanMar API error: ${productResponse.status}`);
      return { results, errors };
    }

    const productData = await productResponse.json();

    if (!productData?.data?.parts || productData.data.parts.length === 0) {
      console.log(`No parts found for ${style}`);
      return { results, errors };
    }

    let mediaData = null;
    let pricingData = null;

    try {
      const mediaUrl = `${supabaseUrl}/functions/v1/sanmar-api?action=media&style=${encodeURIComponent(style)}&companyId=${encodeURIComponent(companyId)}`;
      const mediaResponse = await fetch(mediaUrl, {
        headers: { "Authorization": `Bearer ${supabaseServiceKey}` },
      });
      if (mediaResponse.ok) {
        const mediaJson = await mediaResponse.json();
        mediaData = mediaJson.data || null;
      }
    } catch (mediaError: any) {
      console.warn(`Media fetch failed (non-critical): ${mediaError.message}`);
    }

    // Fetch pricing for the first part to get wholesale price
    const firstPartId = productData.data.parts?.[0]?.partId;
    if (firstPartId) {
      try {
        const pricingUrl = `${supabaseUrl}/functions/v1/sanmar-api?action=pricing&partId=${encodeURIComponent(firstPartId)}&companyId=${encodeURIComponent(companyId)}`;
        const pricingResponse = await fetch(pricingUrl, {
          headers: { "Authorization": `Bearer ${supabaseServiceKey}` },
        });
        if (pricingResponse.ok) {
          const pricingJson = await pricingResponse.json();
          pricingData = pricingJson.data || null;
          console.log(`Fetched pricing for part ${firstPartId}:`, pricingData?.parts?.[0]?.prices?.[0]?.price);
        }
      } catch (pricingError: any) {
        console.warn(`Pricing fetch failed (non-critical): ${pricingError.message}`);
      }
    }

    const apiDataForTransform = {
      success: true,
      styleNumber: style,
      partId: null,
      style: productData.data,
      inventory: { items: [] },
      pricing: pricingData || { parts: [] },
      media: mediaData || {
        images: [],
        views: {
          front: null, rear: null, side: null, lifestyle: null,
          frontImages: [], rearImages: [], sideImages: [],
          lifestyleImages: [], otherImages: [],
        }
      },
    };

    const product = transformSanMarData(apiDataForTransform);
    if (productData.data?._debug) {
      product.raw_data = { _debug: productData.data._debug };
    }
    results.push(product);

    await cacheProduct(supabaseAdmin, companyId, style, productData.data, mediaData);
    console.log(`Found ${product.colors.length} colors from SanMar`);

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

    if (!productCache) return null;

    if (new Date(productCache.expires_at) < new Date()) {
      console.log(`Cache expired for ${style}`);
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
          front: null, rear: null, side: null, lifestyle: null,
          frontImages: [], rearImages: [], sideImages: [],
          lifestyleImages: [], otherImages: [],
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
      }, { onConflict: "company_id,cache_key" });

    if (mediaData) {
      await supabaseAdmin
        .from("sanmar_media_cache")
        .upsert({
          company_id: companyId,
          cache_key: cacheKey,
          cache_type: "style",
          data: mediaData,
          expires_at: expiresAt.toISOString(),
        }, { onConflict: "company_id,cache_key" });
    }

    console.log(`Cached product data for ${style}`);
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

      const stock: Record<string, number> = {};
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
        code: partIds[0] || color.hex || "",
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
