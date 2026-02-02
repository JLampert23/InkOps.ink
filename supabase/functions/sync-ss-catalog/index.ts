import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SyncResult {
  totalCompanies: number;
  totalStyles: number;
  successCount: number;
  failureCount: number;
  errors: Array<{ styleNumber: string; error: string }>;
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

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('🔄 Starting S&S Catalog Sync...');

    const result: SyncResult = {
      totalCompanies: 0,
      totalStyles: 0,
      successCount: 0,
      failureCount: 0,
      errors: []
    };

    // Get all companies with SSActivewear enabled
    const { data: companies, error: companiesError } = await supabase
      .from("company_settings")
      .select("id, ssactivewear_enabled, ssactivewear_username, ssactivewear_api_key_encrypted")
      .eq("ssactivewear_enabled", true);

    if (companiesError) {
      throw new Error(`Failed to fetch companies: ${companiesError.message}`);
    }

    if (!companies || companies.length === 0) {
      console.log('⚠️ No companies with SSActivewear enabled found');
      return new Response(
        JSON.stringify({
          success: true,
          message: "No companies to sync",
          result
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    result.totalCompanies = companies.length;
    console.log(`📊 Found ${companies.length} companies to sync`);

    // Process each company
    for (const company of companies) {
      if (!company.ssactivewear_username || !company.ssactivewear_api_key_encrypted) {
        console.log(`⚠️ Skipping company ${company.id} - missing credentials`);
        continue;
      }

      console.log(`🏢 Processing company: ${company.id}`);

      // Get unique style numbers from quote line items for this company
      const { data: styleNumbers, error: stylesError } = await supabase
        .from("quote_line_items")
        .select("supplier_style_number")
        .eq("company_id", company.id)
        .not("supplier_style_number", "is", null)
        .order("supplier_style_number");

      if (stylesError) {
        console.error(`❌ Error fetching styles for company ${company.id}:`, stylesError);
        continue;
      }

      if (!styleNumbers || styleNumbers.length === 0) {
        console.log(`⚠️ No styles found for company ${company.id}`);
        continue;
      }

      // Get unique style numbers
      const uniqueStyles = [...new Set(
        styleNumbers
          .map(item => item.supplier_style_number?.trim())
          .filter(Boolean)
      )];

      result.totalStyles += uniqueStyles.length;
      console.log(`📦 Found ${uniqueStyles.length} unique styles for company ${company.id}`);

      // Process each style
      for (const styleNumber of uniqueStyles) {
        try {
          console.log(`🔍 Syncing style: ${styleNumber}`);

          // Call the PromoStandards unified endpoint
          const promoResponse = await fetch(
            `${supabaseUrl}/functions/v1/promostandards-unified?styleNumber=${encodeURIComponent(styleNumber!)}&companyId=${company.id}`,
            {
              method: "GET",
              headers: {
                "Authorization": `Bearer ${supabaseServiceRoleKey}`,
                "Content-Type": "application/json"
              }
            }
          );

          if (!promoResponse.ok) {
            throw new Error(`PromoStandards API failed: ${promoResponse.status}`);
          }

          const promoData = await promoResponse.json();

          // Upsert style data
          const { data: styleData, error: styleError } = await supabase
            .from("styles")
            .upsert({
              company_id: company.id,
              style_number: styleNumber,
              brand: promoData.product?.productBrand || null,
              name: promoData.product?.productName || null,
              description: promoData.product?.description || null,
              category: null,
              primary_image: promoData.media?.views?.front || null,
              last_synced: new Date().toISOString(),
            }, {
              onConflict: "company_id,style_number",
              ignoreDuplicates: false
            })
            .select("id")
            .single();

          if (styleError) {
            throw new Error(`Failed to upsert style: ${styleError.message}`);
          }

          const styleId = styleData.id;

          // Upsert parts data
          if (promoData.product?.parts && Array.isArray(promoData.product.parts)) {
            for (const part of promoData.product.parts) {
              if (!part.partId) continue;

              const { data: partData, error: partError } = await supabase
                .from("parts")
                .upsert({
                  company_id: company.id,
                  style_id: styleId,
                  part_id: part.partId,
                  color_name: part.colorName || null,
                  hex: part.hex || null,
                  size: part.labelSize || null,
                  weight: null,
                  gtin: null,
                }, {
                  onConflict: "company_id,part_id",
                  ignoreDuplicates: false
                })
                .select("id")
                .single();

              if (partError) {
                console.error(`❌ Failed to upsert part ${part.partId}:`, partError);
                continue;
              }

              const partDbId = partData.id;

              // Upsert inventory data
              if (promoData.inventory?.items && Array.isArray(promoData.inventory.items)) {
                const inventoryForPart = promoData.inventory.items.filter(
                  (inv: any) => inv.partId === part.partId
                );

                for (const inv of inventoryForPart) {
                  await supabase
                    .from("inventory")
                    .upsert({
                      company_id: company.id,
                      part_id: partDbId,
                      warehouse: inv.warehouseName || 'Unknown',
                      quantity: inv.quantityAvailable || 0,
                      updated_at: new Date().toISOString(),
                    }, {
                      onConflict: "company_id,part_id,warehouse",
                      ignoreDuplicates: false
                    });
                }
              }

              // Upsert images data
              if (promoData.media?.images && Array.isArray(promoData.media.images)) {
                const imagesForPart = promoData.media.images.filter(
                  (img: any) => img.partId === part.partId || !img.partId
                );

                for (const img of imagesForPart) {
                  if (!img.url) continue;

                  await supabase
                    .from("images")
                    .upsert({
                      company_id: company.id,
                      part_id: partDbId,
                      class_type: img.classTypeName || null,
                      url: img.url,
                      size: null,
                      color: img.color || null,
                      single_part: img.singlePart !== false,
                    }, {
                      onConflict: "company_id,part_id,url",
                      ignoreDuplicates: false
                    });
                }
              }
            }
          }

          result.successCount++;
          console.log(`✅ Successfully synced style: ${styleNumber}`);

        } catch (error: any) {
          result.failureCount++;
          const errorMessage = error.message || error.toString();
          result.errors.push({ styleNumber: styleNumber!, error: errorMessage });
          console.error(`❌ Failed to sync style ${styleNumber}:`, errorMessage);
          // Continue processing remaining styles
        }
      }
    }

    console.log('✅ Sync completed:', result);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Catalog sync completed",
        result
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error: any) {
    console.error("❌ Sync catalog error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Internal server error",
        details: error.toString(),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
