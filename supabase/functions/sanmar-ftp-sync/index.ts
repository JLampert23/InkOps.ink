import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import {
  downloadSanMarFiles,
  validateDownloadResults,
  type FileDownloadResult,
  type SanMarFTPCredentials,
} from "../_shared/sanmar-ftp-client.ts";
import {
  parseSDL,
  parseEPDD,
  parsePDD,
  parseDIP,
  parseCatalog,
  mergeStyleData,
  type SDLRow,
  type EPDDRow,
  type DIPInventoryRow,
  type DIPPricingRow,
} from "../_shared/sanmar-file-parsers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SyncRequest {
  companyId: string;
  syncType?: "full" | "inventory";
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
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    let companyId: string;
    let syncType: "full" | "inventory" = "full";

    if (req.method === "POST") {
      const body = await req.json();
      companyId = body.companyId;
      syncType = body.syncType || "full";
    } else {
      const url = new URL(req.url);
      companyId = url.searchParams.get("companyId") || "";
      syncType = (url.searchParams.get("syncType") as "full" | "inventory") || "full";
    }

    if (!companyId) {
      return new Response(
        JSON.stringify({ error: "Company ID required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🔄 Starting SanMar ${syncType} sync for company ${companyId}`);

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("company_settings")
      .select("sanmar_account_number, sanmar_username, sanmar_password_encrypted, sanmar_enabled")
      .eq("id", companyId)
      .maybeSingle();

    if (settingsError || !settings) {
      return new Response(
        JSON.stringify({ error: "Company settings not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!settings.sanmar_enabled) {
      return new Response(
        JSON.stringify({ error: "SanMar integration is not enabled" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!settings.sanmar_username || !settings.sanmar_password_encrypted) {
      return new Response(
        JSON.stringify({ error: "SanMar FTP credentials not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const decryptResponse = await fetch(`${supabaseUrl}/functions/v1/crypto-service`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceRoleKey}`,
      },
      body: JSON.stringify({
        action: "decrypt",
        token: settings.sanmar_password_encrypted,
      }),
    });

    if (!decryptResponse.ok) {
      console.error("Failed to decrypt SanMar FTP password");
      return new Response(
        JSON.stringify({ error: "Failed to decrypt FTP credentials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { result: decryptedPassword } = await decryptResponse.json();

    const ftpCredentials: SanMarFTPCredentials = {
      username: settings.sanmar_username,
      password: decryptedPassword,
    };

    console.log(`📦 Downloading files from SanMar SFTP...`);
    const downloadResults = await downloadSanMarFiles(ftpCredentials);
    const validation = validateDownloadResults(downloadResults);

    if (!validation.valid) {
      console.error("❌ Failed to download required files:", validation.missingFiles);
      return new Response(
        JSON.stringify({
          error: "Failed to download required files",
          missingFiles: validation.missingFiles,
          downloadErrors: validation.errors,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fileMap = new Map<string, string>();
    for (const result of downloadResults) {
      if (result.success) {
        fileMap.set(result.filename, result.content);
      }
    }

    if (syncType === "inventory") {
      console.log("📊 Processing inventory-only sync...");
      const dipContent = fileMap.get("sanmar_dip.txt");

      if (!dipContent) {
        return new Response(
          JSON.stringify({ error: "DIP file not found" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { inventory, pricing } = parseDIP(dipContent);
      await syncInventoryData(supabaseAdmin, companyId, inventory);
      await syncPricingData(supabaseAdmin, companyId, pricing);

      return new Response(
        JSON.stringify({
          success: true,
          syncType: "inventory",
          stats: {
            inventoryRows: inventory.length,
            pricingRows: pricing.length,
          }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("📊 Processing full catalog sync...");

    const sdlContent = fileMap.get("SanMar_SDL_N.csv");
    const epddContent = fileMap.get("SanMar_EPDD.csv");
    const pddContent = fileMap.get("sanmar_pdd.txt");
    const dipContent = fileMap.get("sanmar_dip.txt");
    const catalogContent = fileMap.get("Catalog.txt");

    if (!sdlContent || !epddContent || !dipContent) {
      return new Response(
        JSON.stringify({ error: "Required data files missing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sdlRows = parseSDL(sdlContent);
    const epddRows = parseEPDD(epddContent);
    const pddRows = pddContent ? parsePDD(pddContent) : [];
    const catalogRows = catalogContent ? parseCatalog(catalogContent) : [];
    const { inventory, pricing } = parseDIP(dipContent);

    const { styles, products } = mergeStyleData(sdlRows, epddRows, pddRows, catalogRows);

    console.log("💾 Syncing data to database...");

    await syncStyleData(supabaseAdmin, companyId, Array.from(styles.values()));
    await syncProductData(supabaseAdmin, companyId, products);
    await syncInventoryData(supabaseAdmin, companyId, inventory);
    await syncPricingData(supabaseAdmin, companyId, pricing);

    console.log("✅ Sync complete!");

    return new Response(
      JSON.stringify({
        success: true,
        syncType: "full",
        stats: {
          styles: styles.size,
          products: products.length,
          inventoryRows: inventory.length,
          pricingRows: pricing.length,
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("❌ SanMar FTP sync error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Internal server error",
        details: error.stack
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function syncStyleData(
  supabase: any,
  companyId: string,
  styles: Array<SDLRow & { extendedDescription?: string }>
) {
  console.log(`💾 Syncing ${styles.length} styles...`);

  for (const style of styles) {
    await supabase
      .from("sanmar_catalog_styles")
      .upsert({
        company_id: companyId,
        style_number: style.styleNumber,
        style_name: style.styleName,
        brand_name: style.brandName,
        category: style.category,
        product_description: style.extendedDescription || style.description,
        fabric_content: style.fabricContent,
        construction: style.construction,
        weight: style.weight,
        gender: style.gender,
        fit: style.fit,
        country_of_origin: style.countryOfOrigin,
        is_closeout: style.isCloseout,
        is_new: style.isNew,
        is_active: true,
        raw_data: style,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "company_id,style_number"
      });
  }

  console.log(`✅ Synced ${styles.length} styles`);
}

async function syncProductData(
  supabase: any,
  companyId: string,
  products: EPDDRow[]
) {
  console.log(`💾 Syncing ${products.length} products...`);

  const { data: styles } = await supabase
    .from("sanmar_catalog_styles")
    .select("id, style_number")
    .eq("company_id", companyId);

  const styleMap = new Map(styles?.map((s: any) => [s.style_number, s.id]) || []);

  for (const product of products) {
    const styleId = styleMap.get(product.styleNumber);

    await supabase
      .from("sanmar_catalog_products")
      .upsert({
        company_id: companyId,
        unique_key: product.uniqueKey,
        style_id: styleId || null,
        style_number: product.styleNumber,
        color_name: product.colorName,
        color_code: product.colorCode,
        size_name: product.sizeName,
        sku: product.sku,
        upc: product.upc,
        piece_weight: product.pieceWeight,
        case_weight: product.caseWeight,
        case_quantity: product.caseQuantity,
        image_front: product.imageFront,
        image_back: product.imageBack,
        image_side: product.imageSide,
        image_lifestyle: product.imageLifestyle,
        raw_data: product,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "company_id,unique_key"
      });
  }

  console.log(`✅ Synced ${products.length} products`);
}

async function syncInventoryData(
  supabase: any,
  companyId: string,
  inventory: DIPInventoryRow[]
) {
  console.log(`💾 Syncing ${inventory.length} inventory records...`);

  const { data: products } = await supabase
    .from("sanmar_catalog_products")
    .select("id, unique_key")
    .eq("company_id", companyId);

  const productMap = new Map(products?.map((p: any) => [p.unique_key, p.id]) || []);

  for (const inv of inventory) {
    const productId = productMap.get(inv.uniqueKey);

    await supabase
      .from("sanmar_catalog_inventory")
      .upsert({
        company_id: companyId,
        unique_key: inv.uniqueKey,
        product_id: productId || null,
        warehouse_code: inv.warehouseCode,
        warehouse_name: inv.warehouseName,
        quantity_available: inv.quantityAvailable,
        quantity_on_order: inv.quantityOnOrder,
        eta_date: inv.etaDate,
        last_updated: new Date().toISOString(),
      }, {
        onConflict: "company_id,unique_key,warehouse_code"
      });
  }

  console.log(`✅ Synced ${inventory.length} inventory records`);
}

async function syncPricingData(
  supabase: any,
  companyId: string,
  pricing: DIPPricingRow[]
) {
  console.log(`💾 Syncing ${pricing.length} pricing records...`);

  const { data: products } = await supabase
    .from("sanmar_catalog_products")
    .select("id, unique_key")
    .eq("company_id", companyId);

  const productMap = new Map(products?.map((p: any) => [p.unique_key, p.id]) || []);

  for (const price of pricing) {
    const productId = productMap.get(price.uniqueKey);

    await supabase
      .from("sanmar_catalog_pricing")
      .upsert({
        company_id: companyId,
        unique_key: price.uniqueKey,
        product_id: productId || null,
        price_type: price.priceType,
        quantity_min: price.quantityMin,
        quantity_max: price.quantityMax,
        unit_price: price.unitPrice,
        is_sale: price.isSale,
        sale_price: price.salePrice,
        sale_end_date: price.saleEndDate,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "company_id,unique_key,price_type,quantity_min"
      });
  }

  console.log(`✅ Synced ${pricing.length} pricing records`);
}
