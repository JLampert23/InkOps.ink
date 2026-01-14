import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAuth = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);

    if (userError || !user) {
      console.error("Error getting user:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: userError?.message }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: profile } = await supabaseAuth
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || profile.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Forbidden - Admin access required" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { invoiceId, reason } = await req.json();

    if (!invoiceId) {
      return new Response(
        JSON.stringify({ error: "Missing invoiceId" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: invoice, error: fetchError } = await supabaseAuth
      .from("printavo_invoices")
      .select("id, invoice_number, is_financially_locked, locked_at, locked_by")
      .eq("id", invoiceId)
      .maybeSingle();

    if (fetchError || !invoice) {
      return new Response(
        JSON.stringify({ error: "Invoice not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!invoice.is_financially_locked) {
      return new Response(
        JSON.stringify({
          message: "Invoice is not locked",
          invoice: invoice
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { error: updateError } = await supabaseAuth
      .from("printavo_invoices")
      .update({
        is_financially_locked: false,
        locked_at: null,
        locked_by: null,
      })
      .eq("id", invoiceId);

    if (updateError) {
      console.error("Error unlocking invoice:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to unlock invoice", details: updateError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Invoice ${invoice.invoice_number} unlocked by admin ${user.email}. Reason: ${reason || 'No reason provided'}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Invoice ${invoice.invoice_number} unlocked successfully`,
        invoice: {
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          was_locked_by: invoice.locked_by,
          was_locked_at: invoice.locked_at,
          unlocked_by: user.email,
          unlocked_at: new Date().toISOString(),
          reason: reason || 'No reason provided'
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in unlock-invoice function:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
