import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-User-Token",
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
        .select("item_number")
        .eq("company_id", company.id)
        .not("item_number", "is", null)
        .order("item_number");

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
          .map(item => item.item_number?.trim())
          .filter(Boolean)
      )];

      result.totalStyles += uniqueStyles.length;
      console.log(`📦 Found ${uniqueStyles.length} unique styles for company ${company.id}`);

      // Process each style
      for (const styleNumber of uniqueStyles) {
        try {
          console.log(`🔍 Syncing style: ${styleNumber}`);

          // Call the SSActivewear API endpoint
          const ssaResponse = await fetch(
            `${supabaseUrl}/functions/v1/ssactivewear-api?action=product&productId=${encodeURIComponent(styleNumber!)}&companyId=${company.id}`,
            {
              method: "GET",
              headers: {
                "Authorization": `Bearer ${supabaseServiceRoleKey}`,
                "Content-Type": "application/json"
              }
            }
          );

          if (!ssaResponse.ok) {
            const errorText = await ssaResponse.text();
            console.error(`❌ SSActivewear API failed:`, {
              status: ssaResponse.status,
              statusText: ssaResponse.statusText,
              body: errorText
            });
            throw new Error(`SSActivewear API failed: ${ssaResponse.status} - ${errorText}`);
          }

          const ssaData = await ssaResponse.json();

          console.log(`📦 SSActivewear response structure:`, {
            success: ssaData.success,
            hasData: !!ssaData.data,
            dataLength: Array.isArray(ssaData.data) ? ssaData.data.length : 0,
            firstProduct: ssaData.data?.[0],
          });

          const productData = ssaData.data?.[0];
          if (!productData) {
            throw new Error('No product data returned from SSActivewear API');
          }

          // Extract the internal styleID from the REST API response
          // This is required for the S&S Pricing API (format: B + 5-digit padded number)
          const ssInternalId = productData.styleID ? String(productData.styleID) : null;
          if (ssInternalId) {
            console.log(`🔑 Found internal styleID: ${ssInternalId} -> Pricing ID: B${ssInternalId.padStart(5, '0')}`);
          } else {
            console.warn(`⚠️ No styleID found in REST API response for ${styleNumber}`);
          }

          // Upsert style data including the internal styleID
          const { data: styleData, error: styleError } = await supabase
            .from("styles")
            .upsert({
              company_id: company.id,
              style_number: styleNumber,
              ss_internal_id: ssInternalId,
              brand: productData.productBrand || null,
              name: productData.productName || null,
              description: productData.description || null,
              category: null,
              primary_image: null,
              last_synced: new Date().toISOString(),
            }, {
              onConflict: "company_id,style_number"
            })
            .select("id")
            .maybeSingle();

          if (styleError) {
            console.error(`❌ Style upsert error:`, styleError);
            throw new Error(`Failed to upsert style: ${styleError.message}`);
          }

          if (!styleData) {
            throw new Error(`Failed to retrieve style data after upsert`);
          }

          const styleId = styleData.id;
          console.log(`✅ Style upserted with id: ${styleId}`);

          // Upsert parts data
          if (productData.parts && Array.isArray(productData.parts)) {
            console.log(`📦 Processing ${productData.parts.length} parts...`);

            for (const part of productData.parts) {
              if (!part.partId) {
                console.warn(`⚠️ Skipping part with no partId`);
                continue;
              }

              const { data: partData, error: partError } = await supabase
                .from("parts")
                .upsert({
                  company_id: company.id,
                  style_id: styleId,
                  part_id: part.partId,
                  color_name: part.colorName || null,
                  hex: null,
                  size: part.labelSize || null,
                  weight: null,
                  gtin: null,
                }, {
                  onConflict: "company_id,part_id"
                })
                .select("id")
                .maybeSingle();

              if (partError) {
                console.error(`❌ Failed to upsert part ${part.partId}:`, partError);
                continue;
              }

              if (!partData) {
                console.error(`❌ No data returned after upserting part ${part.partId}`);
                continue;
              }

              const partDbId = partData.id;
              console.log(`✅ Part upserted: ${part.partId} (${part.colorName} - ${part.labelSize})`);
            }
          }

          // Fetch and sync media/images
          console.log(`📸 Fetching media for style: ${styleNumber}`);
          const mediaResponse = await fetch(
            `${supabaseUrl}/functions/v1/ssactivewear-api?action=media&productId=${encodeURIComponent(styleNumber!)}&companyId=${company.id}`,
            {
              method: "GET",
              headers: {
                "Authorization": `Bearer ${supabaseServiceRoleKey}`,
                "Content-Type": "application/json"
              }
            }
          );

          if (mediaResponse.ok) {
            const mediaData = await mediaResponse.json();
            const mediaContent = mediaData.data?.mediaContent || [];

            console.log(`📸 Found ${mediaContent.length} images`);

            for (const media of mediaContent) {
              if (!media.url) continue;

              // Find the part for this image
              const { data: partForImage } = await supabase
                .from("parts")
                .select("id")
                .eq("company_id", company.id)
                .eq("style_id", styleId)
                .eq("part_id", media.partId || productData.parts?.[0]?.partId)
                .maybeSingle();

              if (partForImage) {
                const { error: imgError } = await supabase
                  .from("images")
                  .upsert({
                    company_id: company.id,
                    part_id: partForImage.id,
                    class_type: media.classTypeName || null,
                    url: media.url,
                    size: null,
                    color: media.color || null,
                    single_part: media.singlePart !== false,
                  }, {
                    onConflict: "company_id,part_id,url"
                  });

                if (imgError) {
                  console.error(`❌ Failed to upsert image:`, imgError);
                }
              }
            }

            console.log(`✅ Images synced for style: ${styleNumber}`);
          } else {
            console.warn(`⚠️ Failed to fetch media: ${mediaResponse.status}`);
          }

          // Fetch and sync pricing for all parts
          console.log(`💰 Fetching pricing for style: ${styleNumber}`);
          const pricingResponse = await fetch(
            `${supabaseUrl}/functions/v1/promostandards-unified?styleNumber=${encodeURIComponent(styleNumber!)}`,
            {
              method: "GET",
              headers: {
                "Authorization": `Bearer ${supabaseServiceRoleKey}`,
                "Content-Type": "application/json"
              }
            }
          );

          if (pricingResponse.ok) {
            const pricingData = await pricingResponse.json();
            const pricingParts = pricingData.pricing?.parts || [];

            console.log(`💰 Found pricing for ${pricingParts.length} parts`);

            for (const pricingPart of pricingParts) {
              if (!pricingPart.partId || !pricingPart.prices || pricingPart.prices.length === 0) {
                continue;
              }

              // Find the part in database
              const { data: partForPricing } = await supabase
                .from("parts")
                .select("id")
                .eq("company_id", company.id)
                .eq("style_id", styleId)
                .eq("part_id", pricingPart.partId)
                .maybeSingle();

              if (partForPricing) {
                // Insert all price tiers
                for (const priceEntry of pricingPart.prices) {
                  const { error: priceError } = await supabase
                    .from("ss_catalog_pricing")
                    .upsert({
                      company_id: company.id,
                      part_id: partForPricing.id,
                      part_number: pricingPart.partId,
                      price_type: 'net',
                      currency: pricingData.pricing?.currency || 'USD',
                      quantity_min: priceEntry.minQuantity || 1,
                      quantity_max: null,
                      unit_price: priceEntry.price,
                      discount_code: priceEntry.discountCode || null,
                      price_effective_date: priceEntry.priceEffectiveDate || null,
                      price_expiry_date: priceEntry.priceExpiryDate || null,
                      last_synced: new Date().toISOString(),
                    }, {
                      onConflict: "company_id,part_number,price_type,quantity_min"
                    });

                  if (priceError) {
                    console.error(`❌ Failed to upsert pricing for ${pricingPart.partId}:`, priceError);
                  }
                }
              }
            }

            console.log(`✅ Pricing synced for style: ${styleNumber}`);
          } else {
            console.warn(`⚠️ Failed to fetch pricing: ${pricingResponse.status}`);
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
