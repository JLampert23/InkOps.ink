import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Use service role for public access
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const token = pathParts[pathParts.length - 1];

    if (!token) {
      throw new Error("Approval token is required");
    }

    // GET /quote-approval/:token - View quote for approval
    if (req.method === "GET") {
      // Get approval record
      const { data: approval, error: approvalError } = await supabase
        .from("quote_approvals")
        .select("*, quote:quotes(*)")
        .eq("approval_token", token)
        .maybeSingle();

      if (approvalError) throw approvalError;
      if (!approval) {
        throw new Error("Invalid or expired approval link");
      }

      // Check if expired
      if (approval.expires_at && new Date(approval.expires_at) < new Date()) {
        throw new Error("This approval link has expired");
      }

      // Check if already used (for single-use links)
      if (approval.single_use && approval.is_used) {
        throw new Error("This approval link has already been used");
      }

      // Get line items
      const { data: lineItems } = await supabase
        .from("quote_line_items")
        .select("*")
        .eq("quote_id", approval.quote_id)
        .order("line_number");

      // Get company settings for branding
      const { data: companySettings } = await supabase
        .from("company_settings")
        .select("company_name, logo_url, company_logo_primary_url, company_email, company_phone, company_website")
        .eq("id", approval.company_id)
        .maybeSingle();

      return new Response(
        JSON.stringify({
          quote: approval.quote,
          lineItems: lineItems || [],
          companySettings: companySettings || {},
          approval: {
            id: approval.id,
            expires_at: approval.expires_at,
            single_use: approval.single_use,
          },
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // POST /quote-approval/:token/respond - Submit approval/rejection
    if (req.method === "POST") {
      const body = await req.json();
      const action = pathParts[pathParts.length - 1];

      if (action !== "respond") {
        throw new Error("Invalid endpoint");
      }

      // Validate required fields
      if (!body.approved === undefined) {
        throw new Error("approved field is required");
      }
      if (!body.approver_name || !body.approver_email) {
        throw new Error("Approver name and email are required");
      }

      // Get approval record
      const { data: approval, error: approvalError } = await supabase
        .from("quote_approvals")
        .select("*")
        .eq("approval_token", token)
        .maybeSingle();

      if (approvalError) throw approvalError;
      if (!approval) {
        throw new Error("Invalid approval link");
      }

      // Check if expired
      if (approval.expires_at && new Date(approval.expires_at) < new Date()) {
        throw new Error("This approval link has expired");
      }

      // Check if already used
      if (approval.single_use && approval.is_used) {
        throw new Error("This approval link has already been used");
      }

      // Get client info
      const ipAddress = req.headers.get("x-forwarded-for") ||
                        req.headers.get("x-real-ip") ||
                        "unknown";
      const userAgent = req.headers.get("user-agent") || "unknown";

      // Create approval response
      const { data: response, error: responseError } = await supabase
        .from("quote_approval_responses")
        .insert([{
          approval_id: approval.id,
          company_id: approval.company_id,
          approved: body.approved,
          approver_name: body.approver_name,
          approver_email: body.approver_email,
          notes: body.notes || null,
          ip_address: ipAddress,
          user_agent: userAgent,
        }])
        .select()
        .single();

      if (responseError) throw responseError;

      // Update quote status
      // Note: The database trigger 'process_quote_approval()' will automatically:
      // - Lock the quote
      // - Capture approval metadata
      // - Create work order
      // - Create invoice
      // - Stage garment requirements for POs
      // - Create production schedule entries
      const newStatus = body.approved ? "approved" : "rejected";
      const statusField = body.approved ? "approved_at" : "rejected_at";

      await supabase
        .from("quotes")
        .update({
          status: newStatus,
          [statusField]: new Date().toISOString(),
        })
        .eq("id", approval.quote_id);

      // Mark approval as used if single-use
      if (approval.single_use) {
        await supabase
          .from("quote_approvals")
          .update({ is_used: true })
          .eq("id", approval.id);
      }

      // Log initial activity (additional logs will be created by the trigger)
      await supabase
        .from("quote_activity_log")
        .insert([{
          quote_id: approval.quote_id,
          company_id: approval.company_id,
          action: body.approved ? "approved_by_customer" : "rejected_by_customer",
          performed_by: null,
          performed_by_name: body.approver_name,
          meta: {
            approver_email: body.approver_email,
            notes: body.notes,
            ip_address: ipAddress,
          },
        }]);

      // TODO: Send notification email to company
      // This would integrate with the send-email function

      return new Response(
        JSON.stringify({
          success: true,
          message: body.approved
            ? "Quote approved successfully!"
            : "Quote rejected. Thank you for your response.",
          response,
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
