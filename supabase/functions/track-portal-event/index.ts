import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TrackEventRequest {
  company_id: string;
  customer_id?: string;
  event_type: string;
  resource_type: string;
  resource_id: string;
  metadata?: Record<string, any>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      company_id,
      customer_id,
      event_type,
      resource_type,
      resource_id,
      metadata = {}
    } = await req.json() as TrackEventRequest;

    if (!company_id || !event_type || !resource_type || !resource_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const clientInfo = req.headers.get("user-agent") || "unknown";
    const forwardedFor = req.headers.get("x-forwarded-for");
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : "unknown";

    const enrichedMetadata = {
      ...metadata,
      user_agent: clientInfo,
      ip_address: ipAddress,
    };

    const result = await supabase.rpc("track_portal_event", {
      p_company_id: company_id,
      p_customer_id: customer_id || null,
      p_event_type: event_type,
      p_resource_type: resource_type,
      p_resource_id: resource_id,
      p_metadata: enrichedMetadata,
    });

    if (result.error) {
      throw result.error;
    }

    return new Response(
      JSON.stringify({
        success: true,
        event_id: result.data
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error tracking event:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
