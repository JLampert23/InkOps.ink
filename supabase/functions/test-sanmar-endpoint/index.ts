import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const style = url.searchParams.get("style") || "PC61";
    const companyId = url.searchParams.get("company_id");
    const service = url.searchParams.get("service") || "product-data";

    if (!companyId) {
      return new Response(
        JSON.stringify({ error: "company_id parameter required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if credentials exist
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: settings, error: settingsError } = await supabase
      .from("company_settings")
      .select("sanmar_promo_username, sanmar_promo_password_encrypted")
      .eq("id", companyId)
      .single();

    if (settingsError || !settings) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to get credentials",
          details: settingsError,
          style,
          service
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if credentials are configured
    if (!settings.sanmar_promo_username || !settings.sanmar_promo_password_encrypted) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "SanMar credentials not configured",
          style,
          service,
          info: {
            hasUsername: !!settings.sanmar_promo_username,
            hasPassword: !!settings.sanmar_promo_password_encrypted
          }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return success response without actually making the API call
    // This avoids the worker limit issue
    if (service === "product-data") {
      return new Response(
        JSON.stringify({
          success: true,
          style: style.toUpperCase(),
          service: "ProductDataService v2.0.0",
          message: "Credentials configured and ready",
          info: {
            endpoint: "https://ws.sanmar.com:8080/promostandards/ProductDataServiceBindingV2?WSDL",
            note: "SanMar implements ProductDataService which returns all product variants",
            usernameConfigured: true,
            passwordConfigured: true
          },
          mock: true,
          reason: "Avoiding worker limit by not making actual SOAP call"
        }, null, 2),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          style: style.toUpperCase(),
          service: "ProductSellableService",
          error: "SanMar does NOT implement ProductSellableService",
          info: {
            implemented: false,
            note: "SanMar ONLY implements ProductDataService v2.0.0",
            alternative: "Use ProductDataService instead - it returns all variants"
          },
          mock: true
        }, null, 2),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
