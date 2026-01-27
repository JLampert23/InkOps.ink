import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
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

    // GET /production-schedule?type_of_work=Screen%20Printing&start_date=2024-01-01&end_date=2024-12-31
    if (method === "GET") {
      const typeOfWork = url.searchParams.get("type_of_work");
      const startDate = url.searchParams.get("start_date");
      const endDate = url.searchParams.get("end_date");
      const station = url.searchParams.get("station");
      const customer = url.searchParams.get("customer");

      let query = supabase
        .from("production_schedule_entries")
        .select("*")
        .eq("company_id", profile.company_id)
        .order("production_due_date", { ascending: true })
        .order("priority_order", { ascending: true });

      if (typeOfWork) {
        query = query.eq("type_of_work", typeOfWork);
      }
      if (startDate) {
        query = query.gte("production_due_date", startDate);
      }
      if (endDate) {
        query = query.lte("production_due_date", endDate);
      }
      if (station) {
        query = query.eq("station", station);
      }
      if (customer) {
        query = query.ilike("customer_name", `%${customer}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      return new Response(JSON.stringify(data || []), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /production-schedule - Create new entry
    if (method === "POST") {
      const body = await req.json();

      const { data, error } = await supabase
        .from("production_schedule_entries")
        .insert({
          ...body,
          company_id: profile.company_id,
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify(data), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PATCH /production-schedule/:id - Update entry
    if (method === "PATCH" && pathParts.length >= 2) {
      const entryId = pathParts[pathParts.length - 1];
      const body = await req.json();

      // Verify entry belongs to user's company
      const { data: existing } = await supabase
        .from("production_schedule_entries")
        .select("id")
        .eq("id", entryId)
        .eq("company_id", profile.company_id)
        .maybeSingle();

      if (!existing) {
        return new Response(JSON.stringify({ error: "Entry not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("production_schedule_entries")
        .update(body)
        .eq("id", entryId)
        .eq("company_id", profile.company_id)
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE /production-schedule/:id - Delete entry
    if (method === "DELETE" && pathParts.length >= 2) {
      const entryId = pathParts[pathParts.length - 1];

      const { error } = await supabase
        .from("production_schedule_entries")
        .delete()
        .eq("id", entryId)
        .eq("company_id", profile.company_id);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Production schedule error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
