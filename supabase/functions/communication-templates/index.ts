import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type TemplateTypeValue = 'quote_email_default' | 'invoice_email_default' | 'invoice_reminder' |
  'payment_confirmation' | 'approval_email' | 'internal_notification' |
  'ar_report' | 'custom';

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
  override_required_validation?: boolean;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  missingRequiredCodes: { code: string; reason: string }[];
  hasRequiredCodeViolations: boolean;
}

const REQUIRED_SHORT_CODES: Record<TemplateTypeValue, { code: string; reason: string }[]> = {
  quote_email_default: [
    { code: 'quote_link', reason: 'Required for customers to access and approve their quote' },
    { code: 'quote_number', reason: 'Required for quote identification and tracking' },
    { code: 'customer_first_name', reason: 'Required for personalized communication' },
  ],
  invoice_email_default: [
    { code: 'invoice_link', reason: 'Required for customers to view and pay their invoice online' },
    { code: 'invoice_number', reason: 'Required for invoice identification and payment reference' },
  ],
  invoice_reminder: [
    { code: 'invoice_link', reason: 'Required for customers to view and pay their invoice' },
    { code: 'invoice_number', reason: 'Required for invoice identification' },
    { code: 'invoice_balance', reason: 'Required to show the amount due' },
  ],
  payment_confirmation: [
    { code: 'payment_amount', reason: 'Required to show the amount paid' },
    { code: 'invoice_number', reason: 'Required for payment reference' },
  ],
  approval_email: [
    { code: 'quote_link', reason: 'Required for customers to review and approve' },
    { code: 'quote_number', reason: 'Required for quote identification' },
  ],
  internal_notification: [],
  ar_report: [
    { code: 'current_date', reason: 'Required for report identification' },
  ],
  custom: [],
};

function extractShortCodes(template: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g;
  const matches = [];
  let match;
  while ((match = regex.exec(template)) !== null) {
    matches.push(match[1].trim());
  }
  return [...new Set(matches)];
}

function validateTemplate(
  subjectTemplate: string,
  bodyTemplate: string,
  templateType: TemplateTypeValue
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const missingRequiredCodes: { code: string; reason: string }[] = [];

  if (!subjectTemplate.trim()) {
    errors.push('Subject template cannot be empty');
  }

  if (!bodyTemplate.trim()) {
    errors.push('Body template cannot be empty');
  }

  const subjectCodes = extractShortCodes(subjectTemplate);
  const bodyCodes = extractShortCodes(bodyTemplate);
  const allCodes = [...new Set([...subjectCodes, ...bodyCodes])];

  const malformedPattern = /\{\{[^}]*$/g;
  if (malformedPattern.test(subjectTemplate) || malformedPattern.test(bodyTemplate)) {
    errors.push('Template contains malformed short codes (unclosed brackets)');
  }

  const nestedPattern = /\{\{[^}]*\{\{/g;
  if (nestedPattern.test(subjectTemplate) || nestedPattern.test(bodyTemplate)) {
    errors.push('Template contains nested short codes (not supported)');
  }

  const requiredCodes = REQUIRED_SHORT_CODES[templateType] || [];
  for (const required of requiredCodes) {
    if (!allCodes.includes(required.code)) {
      missingRequiredCodes.push(required);
      warnings.push(`Missing required short code: {{${required.code}}} - ${required.reason}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    missingRequiredCodes,
    hasRequiredCodeViolations: missingRequiredCodes.length > 0,
  };
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
    console.log('Communication templates endpoint called');
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    console.log('Auth header present:', !!authHeader);

    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create client with service role key for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Extract JWT token from Authorization header
    const token = authHeader.replace('Bearer ', '');
    console.log('Token extracted, length:', token.length);

    // Verify the JWT and get the user
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    console.log('User verification result:', { userId: user?.id, hasError: !!authError });

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({
          error: "Unauthorized - Invalid or expired token",
          details: authError?.message,
          debugInfo: 'Token verification failed'
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log('User authenticated successfully:', user.id);

    // Use the admin client for all database operations (bypasses RLS)
    const supabase = supabaseAdmin;

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

        // Validate template content
        const validation = validateTemplate(
          body.subject_template,
          body.body_template,
          body.template_type as TemplateTypeValue
        );

        // If template has validation errors, reject
        if (!validation.isValid) {
          return new Response(
            JSON.stringify({
              error: "Template validation failed",
              validation,
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // If template has missing required codes and is being set as active without override
        if (validation.hasRequiredCodeViolations && body.is_active !== false && !body.override_required_validation) {
          return new Response(
            JSON.stringify({
              error: "Template is missing required short codes and cannot be activated",
              validation,
              message: "Add the required short codes or save as inactive template",
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Log validation event
        const validationStatus = validation.hasRequiredCodeViolations && body.override_required_validation
          ? 'override'
          : validation.hasRequiredCodeViolations
          ? 'warning'
          : !validation.isValid
          ? 'failed'
          : 'passed';

        // Log to console for immediate visibility
        if (validation.hasRequiredCodeViolations && body.override_required_validation && isAdmin) {
          console.warn(`[TEMPLATE_VALIDATION] Admin override: User ${user.id} created template with missing required codes`, {
            template_type: body.template_type,
            template_name: body.template_name,
            missing_codes: validation.missingRequiredCodes.map(c => c.code),
            user_id: user.id,
            company_id,
            timestamp: new Date().toISOString(),
          });
        }

        // Log to database for audit trail (fire and forget)
        supabase.rpc('log_template_validation', {
          p_company_id: company_id,
          p_template_id: null,
          p_template_type: body.template_type,
          p_template_name: body.template_name,
          p_action: 'created',
          p_validation_status: validationStatus,
          p_has_errors: !validation.isValid,
          p_has_missing_required_codes: validation.hasRequiredCodeViolations,
          p_missing_codes: JSON.stringify(validation.missingRequiredCodes),
          p_errors: JSON.stringify(validation.errors),
          p_warnings: JSON.stringify(validation.warnings),
          p_override_used: body.override_required_validation || false,
          p_user_id: user.id,
          p_user_role: role,
        }).then(({ error: logError }) => {
          if (logError) {
            console.error('[TEMPLATE_VALIDATION] Failed to log validation event:', logError);
          }
        });

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

        // Get current template for validation
        const { data: currentTemplate } = await supabase
          .from("communication_templates")
          .select("*")
          .eq("id", templateId)
          .eq("company_id", company_id)
          .single();

        if (!currentTemplate) {
          return new Response(
            JSON.stringify({ error: "Template not found" }),
            {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // If updating subject or body, validate the new content
        if (body.subject_template || body.body_template) {
          const subjectToValidate = body.subject_template ?? currentTemplate.subject_template;
          const bodyToValidate = body.body_template ?? currentTemplate.body_template;
          const typeToValidate = body.template_type ?? currentTemplate.template_type;

          const validation = validateTemplate(
            subjectToValidate,
            bodyToValidate,
            typeToValidate as TemplateTypeValue
          );

          // If template has validation errors, reject
          if (!validation.isValid) {
            return new Response(
              JSON.stringify({
                error: "Template validation failed",
                validation,
              }),
              {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }

          // Check if activating with missing required codes
          const isActivating = body.is_active === true || (body.is_active !== false && currentTemplate.is_active);
          if (validation.hasRequiredCodeViolations && isActivating && !body.override_required_validation) {
            return new Response(
              JSON.stringify({
                error: "Template is missing required short codes and cannot be activated",
                validation,
                message: "Add the required short codes or save as inactive template",
              }),
              {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }

          // Log validation event
          const validationStatus = validation.hasRequiredCodeViolations && body.override_required_validation
            ? 'override'
            : validation.hasRequiredCodeViolations
            ? 'warning'
            : !validation.isValid
            ? 'failed'
            : 'passed';

          const actionType = body.is_active === true && !currentTemplate.is_active ? 'activated' : 'updated';

          // Log to console for immediate visibility
          if (validation.hasRequiredCodeViolations && body.override_required_validation && isAdmin) {
            console.warn(`[TEMPLATE_VALIDATION] Admin override: User ${user.id} updated template with missing required codes`, {
              template_id: templateId,
              template_type: typeToValidate,
              template_name: body.template_name ?? currentTemplate.template_name,
              missing_codes: validation.missingRequiredCodes.map(c => c.code),
              user_id: user.id,
              company_id,
              timestamp: new Date().toISOString(),
            });
          }

          // Log to database for audit trail (fire and forget)
          supabase.rpc('log_template_validation', {
            p_company_id: company_id,
            p_template_id: templateId,
            p_template_type: typeToValidate,
            p_template_name: body.template_name ?? currentTemplate.template_name,
            p_action: actionType,
            p_validation_status: validationStatus,
            p_has_errors: !validation.isValid,
            p_has_missing_required_codes: validation.hasRequiredCodeViolations,
            p_missing_codes: JSON.stringify(validation.missingRequiredCodes),
            p_errors: JSON.stringify(validation.errors),
            p_warnings: JSON.stringify(validation.warnings),
            p_override_used: body.override_required_validation || false,
            p_user_id: user.id,
            p_user_role: role,
          }).then(({ error: logError }) => {
            if (logError) {
              console.error('[TEMPLATE_VALIDATION] Failed to log validation event:', logError);
            }
          });
        }

        // If activating this template, check for conflicts
        if (body.is_active === true) {
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
