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

    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      encryptionKeySet: !!encryptionKey,
      encryptionKeyLength: encryptionKey?.length || 0,
    };

    if (!encryptionKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "ENCRYPTION_KEY not configured in Supabase Edge Function secrets",
          diagnostics,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: settings, error: settingsError } = await supabase
      .from('company_settings')
      .select('printavo_username, printavo_api_token_encrypted')
      .maybeSingle();

    diagnostics.settingsFound = !!settings;
    diagnostics.usernameSet = !!settings?.printavo_username;
    diagnostics.encryptedTokenSet = !!settings?.printavo_api_token_encrypted;
    diagnostics.encryptedTokenLength = settings?.printavo_api_token_encrypted?.length || 0;

    if (settingsError || !settings || !settings.printavo_username || !settings.printavo_api_token_encrypted) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Printavo credentials not found in company_settings",
          diagnostics,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let decryptedToken: string;
    try {
      decryptedToken = await decryptToken(settings.printavo_api_token_encrypted, encryptionKey);
      diagnostics.decryptionSuccess = true;
      diagnostics.decryptedTokenLength = decryptedToken.length;
      diagnostics.decryptedTokenPreview = decryptedToken.substring(0, 4) + "..." + decryptedToken.substring(decryptedToken.length - 4);
    } catch (error) {
      diagnostics.decryptionSuccess = false;
      diagnostics.decryptionError = error instanceof Error ? error.message : "Unknown error";
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to decrypt token - ENCRYPTION_KEY may have changed",
          diagnostics,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const url = new URL(req.url);
    const testType = url.searchParams.get('test') || 'customer';
    const customerId = url.searchParams.get('customer_id') || '8455168';

    let testQuery = '';
    let variables: any = {};

    if (testType === 'invoice') {
      testQuery = `
        query TestInvoice {
          invoices(first: 1) {
            edges {
              node {
                id
                visualId
                billingAddress {
                  address1
                  city
                  state
                  zip
                }
              }
            }
          }
        }
      `;
    } else {
      testQuery = `
        query TestCustomer($id: ID!) {
          customer(id: $id) {
            id
            companyName
            billingAddress {
              address1
              address2
              city
              state
              postalCode
              country
            }
            shippingAddress {
              address1
              address2
              city
              state
              postalCode
              country
            }
            contacts {
              edges {
                node {
                  id
                  fullName
                  firstName
                  lastName
                  email
                  phone
                }
              }
            }
          }
        }
      `;
      variables = { id: customerId };
    }

    const response = await fetch("https://www.printavo.com/api/v2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        email: settings.printavo_username,
        token: decryptedToken,
      },
      body: JSON.stringify({
        query: testQuery,
        variables
      }),
    });

    diagnostics.printavoResponseStatus = response.status;

    // Handle rate limiting (429)
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || 'unknown';
      diagnostics.retryAfter = retryAfter;

      return new Response(
        JSON.stringify({
          success: false,
          error: "Rate limit exceeded",
          printavoError: `Printavo API rate limit exceeded. Please wait before trying again.${retryAfter !== 'unknown' ? ` Retry after: ${retryAfter} seconds` : ''}`,
          diagnostics,
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const result = await response.json();
    diagnostics.printavoResponseHasErrors = !!result.errors;

    if (!response.ok || result.errors) {
      let errorMessage = "Unknown error";

      // Try to extract a meaningful error message
      if (result.errors && Array.isArray(result.errors) && result.errors.length > 0) {
        errorMessage = result.errors[0].message;
      } else if (result.error) {
        errorMessage = result.error;
      } else if (result.message) {
        errorMessage = result.message;
      }

      // Map HTTP status codes to friendly messages
      if (response.status === 401) {
        errorMessage = "Invalid Printavo credentials. Please check your username and API token.";
      } else if (response.status === 403) {
        errorMessage = "Access denied. Please check your Printavo API token permissions.";
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: "Printavo API authentication failed",
          printavoError: errorMessage,
          fullErrors: result.errors,
          diagnostics,
        }),
        {
          status: response.status === 401 || response.status === 403 ? response.status : 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const responseData: any = {
      success: true,
      testType,
      fullResponse: result,
      diagnostics,
    };

    if (testType === 'invoice') {
      const invoice = result.data?.invoices?.edges?.[0]?.node;
      responseData.message = 'Invoice address test';
      responseData.invoice = invoice;
      responseData.billingAddress = invoice?.billingAddress;
    } else {
      responseData.message = `Data for customer ID ${customerId}`;
      responseData.customer = result.data?.customer || null;
      responseData.billingAddress = result.data?.customer?.billingAddress || null;
      responseData.shippingAddress = result.data?.customer?.shippingAddress || null;
      responseData.contacts = result.data?.customer?.contacts?.edges?.map((e: any) => e.node) || [];
      responseData.hasBillingAddress = !!(result.data?.customer?.billingAddress?.address1 || result.data?.customer?.billingAddress?.city);
      responseData.hasShippingAddress = !!(result.data?.customer?.shippingAddress?.address1 || result.data?.customer?.shippingAddress?.city);
      responseData.hasPhone = result.data?.customer?.contacts?.edges?.some((e: any) => e.node?.phone) || false;
    }

    return new Response(
      JSON.stringify(responseData, null, 2),
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