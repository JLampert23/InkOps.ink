import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("Not authenticated");
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("company_id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || !profile.company_id) {
      throw new Error("User profile not found");
    }

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const method = req.method;

    // GET /proofs-api/line-items/:lineItemId - Get all proofs for a line item
    if (method === "GET" && pathParts[1] === "line-items" && pathParts[2]) {
      const lineItemId = pathParts[2];

      const { data: proofs, error } = await supabase
        .from("proofs")
        .select(`
          *,
          proof_artwork(*),
          proof_colors(*)
        `)
        .eq("line_item_id", lineItemId)
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return new Response(JSON.stringify({ proofs }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /proofs-api/:proofId - Get a specific proof
    if (method === "GET" && pathParts[1] && !pathParts[2]) {
      const proofId = pathParts[1];

      const { data: proof, error } = await supabase
        .from("proofs")
        .select(`
          *,
          proof_artwork(*),
          proof_colors(*)
        `)
        .eq("id", proofId)
        .eq("company_id", profile.company_id)
        .maybeSingle();

      if (error) throw error;
      if (!proof) throw new Error("Proof not found");

      return new Response(JSON.stringify({ proof }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /proofs-api - Create a new proof
    if (method === "POST" && pathParts.length === 1) {
      const body = await req.json();

      const { data: proof, error } = await supabase
        .from("proofs")
        .insert({
          company_id: profile.company_id,
          quote_id: body.quote_id,
          line_item_id: body.line_item_id,
          customer_id: body.customer_id,
          proof_version: body.proof_version || 1,
          garment_image_url: body.garment_image_url,
          garment_name: body.garment_name,
          composite_image_url: body.composite_image_url,
          print_width: body.print_width,
          print_height: body.print_height,
          print_depth: body.print_depth,
          print_unit: body.print_unit || 'inches',
          status: body.status || 'draft',
          notes: body.notes,
          type_of_work: body.type_of_work,
          decoration_location_id: body.decoration_location_id,
          pricing_matrix_id: body.pricing_matrix_id,
          pricing_matrix_column: body.pricing_matrix_column,
          imprint_unit_price: body.imprint_unit_price,
          imprint_setup_fee: body.imprint_setup_fee,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ proof }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PUT /proofs-api/:proofId - Update a proof
    if (method === "PUT" && pathParts[1]) {
      const proofId = pathParts[1];
      const body = await req.json();

      const { data: proof, error } = await supabase
        .from("proofs")
        .update({
          garment_image_url: body.garment_image_url,
          garment_name: body.garment_name,
          composite_image_url: body.composite_image_url,
          print_width: body.print_width,
          print_height: body.print_height,
          print_depth: body.print_depth,
          print_unit: body.print_unit,
          status: body.status,
          notes: body.notes,
          type_of_work: body.type_of_work,
          decoration_location_id: body.decoration_location_id,
          pricing_matrix_id: body.pricing_matrix_id,
          pricing_matrix_column: body.pricing_matrix_column,
          imprint_unit_price: body.imprint_unit_price,
          imprint_setup_fee: body.imprint_setup_fee,
          approved_at: body.status === 'approved' ? new Date().toISOString() : undefined,
          rejected_at: body.status === 'rejected' ? new Date().toISOString() : undefined,
        })
        .eq("id", proofId)
        .eq("company_id", profile.company_id)
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ proof }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE /proofs-api/:proofId - Delete a proof
    if (method === "DELETE" && pathParts[1]) {
      const proofId = pathParts[1];

      const { error } = await supabase
        .from("proofs")
        .delete()
        .eq("id", proofId)
        .eq("company_id", profile.company_id);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /proofs-api/:proofId/artwork - Add artwork to a proof
    if (method === "POST" && pathParts[1] && pathParts[2] === "artwork") {
      const proofId = pathParts[1];
      const body = await req.json();

      const { data: artwork, error } = await supabase
        .from("proof_artwork")
        .insert({
          proof_id: proofId,
          company_id: profile.company_id,
          artwork_url: body.artwork_url,
          artwork_name: body.artwork_name,
          artwork_version: body.artwork_version || 1,
          file_type: body.file_type,
          file_size: body.file_size,
          position_x: body.position_x || 0,
          position_y: body.position_y || 0,
          scale: body.scale || 1.0,
          rotation: body.rotation || 0,
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ artwork }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE /proofs-api/:proofId/artwork/:artworkId - Delete artwork
    if (method === "DELETE" && pathParts[1] && pathParts[2] === "artwork" && pathParts[3]) {
      const artworkId = pathParts[3];

      const { error } = await supabase
        .from("proof_artwork")
        .delete()
        .eq("id", artworkId)
        .eq("company_id", profile.company_id);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /proofs-api/:proofId/colors - Add colors to a proof
    if (method === "POST" && pathParts[1] && pathParts[2] === "colors") {
      const proofId = pathParts[1];
      const body = await req.json();

      // Delete existing colors
      await supabase
        .from("proof_colors")
        .delete()
        .eq("proof_id", proofId)
        .eq("company_id", profile.company_id);

      // Insert new colors
      if (body.colors && body.colors.length > 0) {
        const colorsToInsert = body.colors.map((color: any) => ({
          proof_id: proofId,
          company_id: profile.company_id,
          color_type: color.color_type,
          color_name: color.color_name,
          color_code: color.color_code,
        }));

        const { data: colors, error } = await supabase
          .from("proof_colors")
          .insert(colorsToInsert)
          .select();

        if (error) throw error;

        return new Response(JSON.stringify({ colors }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ colors: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid request");

  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
