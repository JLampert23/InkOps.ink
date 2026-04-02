import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ResetPasswordRequest {
  token: string;
  newPassword: string;
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

    const { token, newPassword } = await req.json() as ResetPasswordRequest;

    if (!token || !token.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: "Reset token is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!newPassword || newPassword.length < 8) {
      return new Response(
        JSON.stringify({ success: false, error: "Password must be at least 8 characters" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const verifyResult = await supabase.rpc("verify_password_reset_token", {
      p_token: token.trim()
    });

    if (verifyResult.error) {
      console.error("Token verification error:", verifyResult.error);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired reset token" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const verifyData = verifyResult.data as { success: boolean; error?: string };

    if (!verifyData.success) {
      return new Response(
        JSON.stringify({ success: false, error: verifyData.error || "Invalid or expired reset token" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const passwordHash = await bcrypt.hash(newPassword);

    const resetResult = await supabase.rpc("reset_customer_password", {
      p_token: token.trim(),
      p_password_hash: passwordHash
    });

    if (resetResult.error) {
      console.error("Password reset error:", resetResult.error);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to reset password" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const resetData = resetResult.data as { success: boolean; error?: string };

    if (!resetData.success) {
      return new Response(
        JSON.stringify({ success: false, error: resetData.error || "Failed to reset password" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Password has been reset successfully"
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error resetting password:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "An error occurred while resetting your password"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
