import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, apikey, x-client-info",
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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");

    // Use service role to validate the token
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Not authenticated");
    }

    // Create client with user's token for RLS
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get user profile and company_id
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("company_id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || !profile.company_id) {
      throw new Error("User profile not found or company not set");
    }

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const lastPath = pathParts[pathParts.length - 1];
    const quoteId = lastPath && lastPath.match(/^[0-9a-f-]{36}$/i) ? lastPath : null;

    // POST /draft - Create minimal draft quote
    if (req.method === "POST" && (lastPath === "draft" || url.pathname.endsWith("/draft"))) {
      // Generate quote number
      const { data: quoteNumber } = await supabase.rpc("generate_quote_number");

      const quoteData = {
        quote_number: quoteNumber,
        company_id: profile.company_id,
        customer_id: null,
        customer_name: "Draft Quote",
        status: "draft",
        subtotal: 0,
        tax_rate: 0,
        tax_amount: 0,
        total: 0,
        autosave_enabled: true,
        created_by: user.id,
      };

      const { data: quote, error: quoteError } = await supabase
        .from("quotes")
        .insert([quoteData])
        .select()
        .single();

      if (quoteError) throw quoteError;

      return new Response(
        JSON.stringify({ quote }),
        {
          status: 201,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // GET /quotes - List quotes with filters
    if (req.method === "GET" && !quoteId) {
      const status = url.searchParams.get("status");
      const customerId = url.searchParams.get("customer_id");
      const search = url.searchParams.get("search");
      const dateFrom = url.searchParams.get("date_from");
      const dateTo = url.searchParams.get("date_to");
      const limit = parseInt(url.searchParams.get("limit") || "50");
      const offset = parseInt(url.searchParams.get("offset") || "0");

      let query = supabase
        .from("quotes")
        .select("*, customer:customers(company_name, contact_name, email)", { count: "exact" })
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) {
        query = query.eq("status", status);
      }
      if (customerId) {
        query = query.eq("customer_id", customerId);
      }
      if (search) {
        query = query.or(`quote_number.ilike.%${search}%,customer_name.ilike.%${search}%,customer_email.ilike.%${search}%`);
      }
      if (dateFrom) {
        query = query.gte("created_at", dateFrom);
      }
      if (dateTo) {
        query = query.lte("created_at", dateTo);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      return new Response(
        JSON.stringify({ quotes: data, count }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // GET /quotes/:id - Get quote details
    if (req.method === "GET" && quoteId) {
      const { data: quote, error: quoteError } = await supabase
        .from("quotes")
        .select("*, customer:customers(*)")
        .eq("id", quoteId)
        .eq("company_id", profile.company_id)
        .maybeSingle();

      if (quoteError) throw quoteError;
      if (!quote) {
        throw new Error("Quote not found");
      }

      // Get line items
      const { data: lineItems, error: lineItemsError } = await supabase
        .from("quote_line_items")
        .select("*")
        .eq("quote_id", quoteId)
        .order("sort_order");

      if (lineItemsError) {
        console.error("Error fetching line items:", lineItemsError);
      }

      // Get activity log
      const { data: activityLog, error: activityError } = await supabase
        .from("quote_activity_log")
        .select("*")
        .eq("quote_id", quoteId)
        .order("performed_at", { ascending: false })
        .limit(50);

      if (activityError) {
        console.error("Error fetching activity log:", activityError);
      }

      // Get approvals
      const { data: approvals, error: approvalsError } = await supabase
        .from("quote_approvals")
        .select("*, responses:quote_approval_responses(*)")
        .eq("quote_id", quoteId)
        .order("created_at", { ascending: false});

      if (approvalsError) {
        console.error("Error fetching approvals:", approvalsError);
      }

      return new Response(
        JSON.stringify({
          quote,
          lineItems: lineItems || [],
          activityLog: activityLog || [],
          approvals: approvals || [],
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // POST /quotes - Create new quote
    if (req.method === "POST") {
      const body = await req.json();

      // Generate quote number
      const { data: quoteNumber } = await supabase.rpc("generate_quote_number");

      const quoteData = {
        quote_number: quoteNumber,
        company_id: profile.company_id,
        customer_id: body.customer_id || null,
        customer_name: body.customer_name,
        customer_email: body.customer_email || null,
        customer_phone: body.customer_phone || null,
        customer_company: body.customer_company || null,
        billing_address: body.billing_address || {},
        shipping_address: body.shipping_address || {},
        tax_rate: body.tax_rate || 0,
        valid_until: body.valid_until || null,
        pricing_reference: body.pricing_reference || null,
        notes: body.notes || null,
        customer_notes: body.customer_notes || null,
        status: "draft",
        created_by: user.id,
      };

      const { data: quote, error: quoteError } = await supabase
        .from("quotes")
        .insert([quoteData])
        .select()
        .single();

      if (quoteError) throw quoteError;

      // Insert line items if provided
      if (body.line_items && body.line_items.length > 0) {
        const lineItems = body.line_items.map((item: any, index: number) => ({
          quote_id: quote.id,
          company_id: profile.company_id,
          line_number: index + 1,
          sku: item.sku || null,
          description: item.description,
          quantity: item.quantity || 1,
          unit_price: item.unit_price || 0,
          total_price: (item.quantity || 1) * (item.unit_price || 0),
          decoration_method: item.decoration_method || null,
          decoration_location: item.decoration_location || null,
          artwork_url: item.artwork_url || null,
          notes: item.notes || null,
        }));

        const { error: lineItemsError } = await supabase
          .from("quote_line_items")
          .insert(lineItems);

        if (lineItemsError) throw lineItemsError;
      }

      return new Response(
        JSON.stringify({ quote }),
        {
          status: 201,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // PUT /quotes/:id - Update quote
    if (req.method === "PUT" && quoteId) {
      const body = await req.json();

      // Check if quote exists and belongs to company
      const { data: existing } = await supabase
        .from("quotes")
        .select("id, status")
        .eq("id", quoteId)
        .eq("company_id", profile.company_id)
        .maybeSingle();

      if (!existing) {
        throw new Error("Quote not found");
      }

      // Only allow updates to draft or sent quotes
      if (!["draft", "sent"].includes(existing.status) && profile.role !== "super_admin") {
        throw new Error("Cannot update quote in current status");
      }

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      // Update allowed fields
      if (body.customer_id !== undefined) updateData.customer_id = body.customer_id;
      if (body.customer_name) updateData.customer_name = body.customer_name;
      if (body.customer_email !== undefined) updateData.customer_email = body.customer_email;
      if (body.customer_phone !== undefined) updateData.customer_phone = body.customer_phone;
      if (body.customer_company !== undefined) updateData.customer_company = body.customer_company;
      if (body.billing_address) updateData.billing_address = body.billing_address;
      if (body.shipping_address) updateData.shipping_address = body.shipping_address;
      if (body.tax_rate !== undefined) updateData.tax_rate = body.tax_rate;
      if (body.valid_until !== undefined) updateData.valid_until = body.valid_until;
      if (body.pricing_reference !== undefined) updateData.pricing_reference = body.pricing_reference;
      if (body.notes !== undefined) updateData.notes = body.notes;
      if (body.customer_notes !== undefined) updateData.customer_notes = body.customer_notes;
      if (body.status && ["draft", "sent"].includes(body.status)) updateData.status = body.status;

      const { data: quote, error: updateError } = await supabase
        .from("quotes")
        .update(updateData)
        .eq("id", quoteId)
        .select()
        .single();

      if (updateError) throw updateError;

      // Update line items if provided
      if (body.line_items) {
        // Delete existing line items
        await supabase
          .from("quote_line_items")
          .delete()
          .eq("quote_id", quoteId);

        // Insert new line items
        if (body.line_items.length > 0) {
          const lineItems = body.line_items.map((item: any, index: number) => ({
            quote_id: quoteId,
            company_id: profile.company_id,
            line_number: index + 1,
            sku: item.sku || null,
            description: item.description,
            quantity: item.quantity || 1,
            unit_price: item.unit_price || 0,
            total_price: (item.quantity || 1) * (item.unit_price || 0),
            decoration_method: item.decoration_method || null,
            decoration_location: item.decoration_location || null,
            artwork_url: item.artwork_url || null,
            notes: item.notes || null,
          }));

          await supabase
            .from("quote_line_items")
            .insert(lineItems);
        }
      }

      return new Response(
        JSON.stringify({ quote }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // DELETE /quotes/:id - Delete quote
    if (req.method === "DELETE" && quoteId) {
      // Only admins can delete
      if (!["super_admin", "admin"].includes(profile.role)) {
        throw new Error("Only admins can delete quotes");
      }

      const { error: deleteError } = await supabase
        .from("quotes")
        .delete()
        .eq("id", quoteId)
        .eq("company_id", profile.company_id);

      if (deleteError) throw deleteError;

      return new Response(
        JSON.stringify({ success: true }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Method not allowed
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
