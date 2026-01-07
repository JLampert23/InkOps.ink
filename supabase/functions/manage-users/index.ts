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

    const { action, email, full_name, role, userId, password } = await req.json();

    const isAdmin = profile?.role === "admin";
    const isUpdatingSelf = action === "update" && userId === user.id;

    if (!isAdmin && !isUpdatingSelf) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (action === "create") {
      if (!email) {
        return new Response(
          JSON.stringify({ error: "Email is required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data: newUser, error: createError } = await supabaseAuth.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          full_name: full_name || "",
        },
      });

      if (createError) {
        console.error("Error creating user:", createError);
        return new Response(
          JSON.stringify({ error: createError.message }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      const { error: profileError } = await supabaseAuth
        .from("user_profiles")
        .update({
          full_name: full_name || null,
          role: role || "user",
        })
        .eq("id", newUser.user.id);

      if (profileError) {
        console.error("Error updating profile:", profileError);
        return new Response(
          JSON.stringify({ error: profileError.message }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Generate password reset link for the new user
      const { data: resetData, error: resetError } = await supabaseAuth.auth.admin.generateLink({
        type: 'recovery',
        email: email,
      });

      if (resetError) {
        console.error("Error generating password reset link:", resetError);
      }

      // Send welcome email with password setup link
      if (resetData?.properties?.action_link) {
        try {
          const { data: settings } = await supabaseAuth
            .from('company_settings')
            .select('email_from_address')
            .maybeSingle();

          const emailHtml = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="margin: 0;">Welcome to Todd's Sporting Goods!</h1>
              </div>
              <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
                <p style="font-size: 16px; color: #1f2937;">Hello ${full_name || 'there'},</p>
                <p style="color: #4b5563;">Your account has been created successfully. To get started, please set up your password by clicking the button below:</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${resetData.properties.action_link}" style="display: inline-block; padding: 14px 28px; background: #667eea; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Set Up Your Password</a>
                </div>
                <p style="color: #6b7280; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
                <p style="color: #3b82f6; font-size: 13px; word-break: break-all; background: #f3f4f6; padding: 12px; border-radius: 6px;">${resetData.properties.action_link}</p>
                <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0;">
                  <p style="margin: 0; color: #92400e; font-size: 14px;"><strong>Important:</strong> This link will expire in 24 hours. If it expires, you can request a new password reset link from the login page.</p>
                </div>
                <p style="color: #4b5563; margin-top: 30px;">Once you've set your password, you'll have full access to the dashboard and all its features.</p>
              </div>
              <div style="background: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; border-radius: 0 0 10px 10px;">
                <p style="margin: 0;">If you didn't expect this email, please contact your administrator.</p>
              </div>
            </div>
          `;

          // Call send-email function
          const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authHeader,
            },
            body: JSON.stringify({
              to: email,
              subject: 'Welcome! Set Up Your Password',
              template: 'custom',
              html: emailHtml,
              data: {
                from: settings?.email_from_address,
              },
            }),
          });

          if (!emailResponse.ok) {
            console.error("Failed to send welcome email:", await emailResponse.text());
          } else {
            console.log("Welcome email sent successfully to:", email);
          }
        } catch (emailError) {
          console.error("Error sending welcome email:", emailError);
        }
      }

      return new Response(
        JSON.stringify({ success: true, user: newUser.user }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else if (action === "update") {
      if (!userId) {
        return new Response(
          JSON.stringify({ error: "User ID is required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const updates: any = {};
      if (email !== undefined) updates.email = email;
      if (full_name !== undefined) updates.full_name = full_name;

      if (role !== undefined) {
        if (!isAdmin) {
          return new Response(
            JSON.stringify({ error: "Only admins can change user roles" }),
            {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        updates.role = role;
      }

      const authUpdates: any = {};
      if (email !== undefined) authUpdates.email = email;
      if (password !== undefined) authUpdates.password = password;

      if (Object.keys(authUpdates).length > 0) {
        const { error: authUpdateError } = await supabaseAuth.auth.admin.updateUserById(
          userId,
          authUpdates
        );

        if (authUpdateError) {
          console.error("Error updating auth user:", authUpdateError);
          return new Response(
            JSON.stringify({ error: authUpdateError.message }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }

      const { error: profileUpdateError } = await supabaseAuth
        .from("user_profiles")
        .update(updates)
        .eq("id", userId);

      if (profileUpdateError) {
        console.error("Error updating profile:", profileUpdateError);
        return new Response(
          JSON.stringify({ error: profileUpdateError.message }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid action" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
