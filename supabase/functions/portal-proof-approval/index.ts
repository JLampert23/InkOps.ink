import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

interface ProofApprovalRequest {
  proofId: string;
  customerId: string;
  companyId: string;
  action: "approve" | "reject";
  notes?: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const requestData: ProofApprovalRequest = await req.json();

    const { proofId, customerId, companyId, action, notes } = requestData;

    if (!proofId || !customerId || !companyId || !action) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (action !== "approve" && action !== "reject") {
      return new Response(
        JSON.stringify({ error: "Invalid action. Must be 'approve' or 'reject'" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: proof, error: proofError } = await supabase
      .from("proofs")
      .select("id, company_id, customer_id, status, proof_number, quote_id")
      .eq("id", proofId)
      .eq("company_id", companyId)
      .eq("customer_id", customerId)
      .maybeSingle();

    if (proofError || !proof) {
      return new Response(
        JSON.stringify({ error: "Proof not found or access denied" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const currentStatus = proof.status?.toLowerCase();
    if (currentStatus === "approved" || currentStatus === "rejected") {
      return new Response(
        JSON.stringify({ error: "This proof has already been processed" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = {
      status: action === "approve" ? "approved" : "rejected",
      updated_at: now,
    };

    if (action === "approve") {
      updateData.approved_at = now;
    } else {
      updateData.rejected_at = now;
      if (notes) {
        updateData.notes = notes;
      }
    }

    const { error: updateError } = await supabase
      .from("proofs")
      .update(updateData)
      .eq("id", proofId);

    if (updateError) {
      console.error("Error updating proof:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update proof status" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    try {
      const { data: customer } = await supabase
        .from("customers")
        .select("company_name, contact_name")
        .eq("id", customerId)
        .maybeSingle();

      const customerName = customer?.contact_name || customer?.company_name || "Customer";

      await supabase.from("automation_queue").insert({
        company_id: companyId,
        trigger_type: action === "approve" ? "proof_approved" : "proof_rejected",
        entity_type: "proof",
        entity_id: proofId,
        payload: {
          proof_id: proofId,
          proof_number: proof.proof_number,
          quote_id: proof.quote_id,
          customer_id: customerId,
          customer_name: customerName,
          action: action,
          notes: notes || null,
          timestamp: now,
          source: "customer_portal",
        },
        status: "pending",
      });
    } catch (notificationError) {
      console.error("Error creating notification:", notificationError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: action === "approve" ? "Proof approved successfully" : "Change request submitted",
        proofId,
        status: action === "approve" ? "approved" : "rejected",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Portal proof approval error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
