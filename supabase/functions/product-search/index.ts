import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Max-Age": "86400",
};

interface ColorOption {
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

interface ProductResult {
  supplier: "sanmar" | "ssactivewear";
  style: string;
  brand: string;
  description: string;
  category?: string;
  colors: ColorOption[];
  cached: boolean;
  last_synced?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const authHeader = req.headers.get("Authorization");
    let companyId: string | null = null;

    if (authHeader) {
      try {
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader } },
          auth: { persistSession: false }
        });

        const { data: { user } } = await supabaseClient.auth.getUser();

        if (user) {
          const { data: profileData } = await supabaseAdmin
            .from("user_profiles")
            .select("company_id")
            .eq("id", user.id)
            .maybeSingle();

          companyId = profileData?.company_id || null;
        }
      } catch {
        // Continue without auth
      }
    }

    if (!companyId) {
      const url = new URL(req.url);
      const companyIdParam = url.searchParams.get("companyId");

      if (companyIdParam) {
        companyId = companyIdParam;
      } else {
        const { data: firstCompany } = await supabaseAdmin
          .from("company_settings")
          .select("id")
          .limit(1)
          .maybeSingle();

        companyId = firstCompany?.id || null;
      }
    }

    if (!companyId) {
      return new Response(
        JSON.stringify({ error: "No company found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const rawStyle = url.searchParams.get("style");

    if (!rawStyle) {
      return new Response(
        JSON.stringify({ error: "Style number required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const style = rawStyle.trim();
    const results: ProductResult[] = [];

    // ONLY search caches - no live API calls
    const { data: settings } = await supabaseAdmin
      .from("company_settings")
      .select("sanmar_enabled, ssactivewear_enabled")
      .eq("id", companyId)
      .maybeSingle();

    // Search SSActivewear cache
    if (settings?.ssactivewear_enabled) {
      const ssaResult = await searchSSActivewearCache(supabaseAdmin, companyId, style);
      if (ssaResult) {
        results.push(ssaResult);
      }
    }

    // Search SanMar cache
    if (settings?.sanmar_enabled) {
      const sanmarResult = await searchSanMarCache(supabaseAdmin, companyId, style);
      if (sanmarResult) {
        results.push(sanmarResult);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        style,
        results,
        count: results.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error: any) {
    console.error("Product search error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function searchSSActivewearCache(
  supabaseAdmin: any,
  companyId: string,
  style: string
): Promise<ProductResult | null> {
  try {
    const { data: styleData } = await supabaseAdmin
      .from("styles")
      .select("id, style_number, brand, name, description, category, last_synced")
      .eq("company_id", companyId)
      .ilike("style_number", style)
      .maybeSingle();

    if (!styleData) return null;

    const { data: partsData } = await supabaseAdmin
      .from("parts")
      .select("id, part_id, color_name, size")
      .eq("style_id", styleData.id)
      .order("color_name", { ascending: true });

    const colorMap = new Map<string, ColorOption>();

    for (const part of partsData || []) {
      const colorName = part.color_name || "Default";

      if (!colorMap.has(colorName)) {
        colorMap.set(colorName, {
          name: colorName,
          code: part.part_id || "",
          partIds: [],
          sizes: [],
          image_url: "",
          pricing: { wholesale: 0, retail: 0 },
          stock: {},
        });
      }

      const color = colorMap.get(colorName)!;
      if (part.part_id && !color.partIds?.includes(part.part_id)) {
        color.partIds?.push(part.part_id);
      }
      if (part.size && !color.sizes?.includes(part.size)) {
        color.sizes?.push(part.size);
      }
    }

    // Get images for first part of each color
    for (const [_, color] of colorMap) {
      if (color.partIds && color.partIds.length > 0) {
        const firstPart = partsData?.find(p => p.part_id === color.partIds![0]);
        if (firstPart) {
          const { data: imageData } = await supabaseAdmin
            .from("images")
            .select("url")
            .eq("part_id", firstPart.id)
            .limit(1)
            .maybeSingle();

          if (imageData?.url) {
            color.image_url = imageData.url;
          }
        }
      }
    }

    return {
      supplier: "ssactivewear",
      style: styleData.style_number,
      brand: styleData.brand || "",
      description: styleData.name || styleData.description || "",
      category: styleData.category || "",
      colors: Array.from(colorMap.values()),
      cached: true,
      last_synced: styleData.last_synced,
    };
  } catch (error) {
    console.error("SSActivewear cache error:", error);
    return null;
  }
}

async function searchSanMarCache(
  supabaseAdmin: any,
  companyId: string,
  style: string
): Promise<ProductResult | null> {
  try {
    const { data: styleData } = await supabaseAdmin
      .from("sanmar_catalog_styles")
      .select(`
        id,
        style_number,
        style_name,
        brand_name,
        category,
        updated_at
      `)
      .eq("company_id", companyId)
      .ilike("style_number", style)
      .eq("is_active", true)
      .maybeSingle();

    if (!styleData) return null;

    const { data: productsData } = await supabaseAdmin
      .from("sanmar_catalog_products")
      .select("sku, color_name, color_code, size_name, image_front")
      .eq("style_id", styleData.id)
      .order("color_name", { ascending: true });

    const colorMap = new Map<string, ColorOption>();

    for (const product of productsData || []) {
      const colorName = product.color_name || "Default";

      if (!colorMap.has(colorName)) {
        colorMap.set(colorName, {
          name: colorName,
          code: product.color_code || "",
          partIds: [],
          sizes: [],
          image_url: product.image_front || "",
          pricing: { wholesale: 0, retail: 0 },
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
      description: styleData.style_name || "",
      category: styleData.category || "",
      colors: Array.from(colorMap.values()),
      cached: true,
      last_synced: styleData.updated_at,
    };
  } catch (error) {
    console.error("SanMar cache error:", error);
    return null;
  }
}
