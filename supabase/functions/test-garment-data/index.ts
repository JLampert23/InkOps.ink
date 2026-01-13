import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

async function decryptToken(encryptedToken: string, encryptionKey: string): Promise<string> {
  const combined = new Uint8Array(
    atob(encryptedToken).split('').map(c => c.charCodeAt(0))
  );

  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const encryptedData = combined.slice(28);

  const key = await deriveKey(encryptionKey, salt);

  const decryptedData = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    encryptedData
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedData);
}

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
    const encryptionKey = Deno.env.get('ENCRYPTION_KEY');

    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: settings, error: settingsError } = await supabase
      .from('company_settings')
      .select('printavo_username, printavo_api_token_encrypted')
      .maybeSingle();

    if (settingsError || !settings || !settings.printavo_username || !settings.printavo_api_token_encrypted) {
      return new Response(
        JSON.stringify({ error: "Printavo credentials not configured" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const printavoToken = await decryptToken(settings.printavo_api_token_encrypted, encryptionKey);

    const query = `
      query TestGarmentData {
        invoices(first: 1, query: "60003382") {
          edges {
            node {
              id
              visualId
              lineItemGroups {
                edges {
                  node {
                    id
                    lineItems {
                      edges {
                        node {
                          id
                          description
                          items
                          price
                          style {
                            name
                            number
                          }
                          color {
                            name
                          }
                          product {
                            styleName
                            styleNumber
                            colorName
                          }
                          sizeQuantities
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const response = await fetch("https://www.printavo.com/api/v2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        email: settings.printavo_username,
        token: printavoToken,
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`Printavo API error: ${response.status}`);
    }

    const result = await response.json();

    return new Response(
      JSON.stringify(result, null, 2),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
