import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TemplateType {
  type: 'quote_email_default' | 'invoice_email_default' | 'invoice_reminder' |
        'payment_confirmation' | 'approval_email' | 'internal_notification' |
        'ar_report' | 'custom';
}

interface CommunicationTemplate {
  id?: string;
  company_id?: string;
  template_type: string;
  template_name: string;
  subject_template: string;
  body_template: string;
  auto_attach_quote_link?: boolean;
  auto_attach_pdf?: boolean;
  auto_attach_mockups?: boolean;
  auto_attach_terms?: boolean;
  is_active?: boolean;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization")!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get user's company_id and role
    const { data: userProfile, error: profileError } = await supabase
      .from("user_profiles")
      .select("company_id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !userProfile) {
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { company_id, role } = userProfile;
    const isAdmin = role === "super_admin" || role === "admin";

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const templateId = pathParts[pathParts.length - 1];

    // Handle different HTTP methods
    switch (req.method) {
      case "GET": {
        // GET /communication-templates - List all templates for company
        // GET /communication-templates/:id - Get specific template

        if (templateId && templateId !== "communication-templates") {
          // Get specific template
          const { data, error } = await supabase
            .from("communication_templates")
            .select("*")
            .eq("id", templateId)
            .eq("company_id", company_id)
            .single();

          if (error) {
            return new Response(
              JSON.stringify({ error: error.message }),
              {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }

          return new Response(
            JSON.stringify(data),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        } else {
          // List all templates for company
          const templateType = url.searchParams.get("type");
          const activeOnly = url.searchParams.get("active_only") === "true";

          let query = supabase
            .from("communication_templates")
            .select("*")
            .eq("company_id", company_id)
            .order("template_type", { ascending: true })
            .order("created_at", { ascending: false });

          if (templateType) {
            query = query.eq("template_type", templateType);
          }

          if (activeOnly) {
            query = query.eq("is_active", true);
          }

          const { data, error } = await query;

          if (error) {
            return new Response(
              JSON.stringify({ error: error.message }),
              {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }

          return new Response(
            JSON.stringify(data || []),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }

      case "POST": {
        // Create new template (admin only)
        if (!isAdmin) {
          return new Response(
            JSON.stringify({ error: "Insufficient permissions. Admin role required." }),
            {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const body: CommunicationTemplate = await req.json();

        // Validate required fields
        if (!body.template_type || !body.template_name || !body.subject_template || !body.body_template) {
          return new Response(
            JSON.stringify({ error: "Missing required fields: template_type, template_name, subject_template, body_template" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Check if active template of this type already exists
        const { data: existing } = await supabase
          .from("communication_templates")
          .select("id")
          .eq("company_id", company_id)
          .eq("template_type", body.template_type)
          .eq("is_active", true)
          .maybeSingle();

        if (existing) {
          return new Response(
            JSON.stringify({ error: `Active template of type '${body.template_type}' already exists. Deactivate it first or update the existing one.` }),
            {
              status: 409,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const { data, error } = await supabase
          .from("communication_templates")
          .insert({
            company_id,
            template_type: body.template_type,
            template_name: body.template_name,
            subject_template: body.subject_template,
            body_template: body.body_template,
            auto_attach_quote_link: body.auto_attach_quote_link ?? true,
            auto_attach_pdf: body.auto_attach_pdf ?? false,
            auto_attach_mockups: body.auto_attach_mockups ?? false,
            auto_attach_terms: body.auto_attach_terms ?? false,
            is_active: body.is_active ?? true,
            created_by: user.id,
            updated_by: user.id,
          })
          .select()
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        return new Response(
          JSON.stringify(data),
          {
            status: 201,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      case "PUT": {
        // Update existing template (admin only)
        if (!isAdmin) {
          return new Response(
            JSON.stringify({ error: "Insufficient permissions. Admin role required." }),
            {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        if (!templateId || templateId === "communication-templates") {
          return new Response(
            JSON.stringify({ error: "Template ID required for update" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const body: Partial<CommunicationTemplate> = await req.json();

        // If activating this template, check for conflicts
        if (body.is_active === true) {
          const { data: currentTemplate } = await supabase
            .from("communication_templates")
            .select("template_type")
            .eq("id", templateId)
            .eq("company_id", company_id)
            .single();

          if (currentTemplate) {
            const { data: existing } = await supabase
              .from("communication_templates")
              .select("id")
              .eq("company_id", company_id)
              .eq("template_type", currentTemplate.template_type)
              .eq("is_active", true)
              .neq("id", templateId)
              .maybeSingle();

            if (existing) {
              return new Response(
                JSON.stringify({ error: `Another active template of type '${currentTemplate.template_type}' already exists.` }),
                {
                  status: 409,
                  headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
              );
            }
          }
        }

        const { data, error } = await supabase
          .from("communication_templates")
          .update({
            ...body,
            updated_by: user.id,
          })
          .eq("id", templateId)
          .eq("company_id", company_id)
          .select()
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        return new Response(
          JSON.stringify(data),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      case "DELETE": {
        // Delete template (admin only)
        if (!isAdmin) {
          return new Response(
            JSON.stringify({ error: "Insufficient permissions. Admin role required." }),
            {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        if (!templateId || templateId === "communication-templates") {
          return new Response(
            JSON.stringify({ error: "Template ID required for deletion" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const { error } = await supabase
          .from("communication_templates")
          .delete()
          .eq("id", templateId)
          .eq("company_id", company_id);

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        return new Response(
          JSON.stringify({ message: "Template deleted successfully" }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Method not allowed" }),
          {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }
  } catch (error) {
    console.error("Error in communication-templates function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
