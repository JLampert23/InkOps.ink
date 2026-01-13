import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { parseGarmentFromPrintavoData } from "../shared/garment-parser.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
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
      query SyncInvoices($after: String) {
        invoices(first: 50, after: $after) {
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            node {
              id
              visualId
              total
              amountOutstanding
              amountPaid
              createdAt
              dueAt
              orderdate
              nickname
              productionNotes
              visualStatus
              customer {
                id
                companyName
                primaryEmail
                primaryPhone
                billingAddress {
                  address1
                  address2
                  city
                  state
                  postalCode
                  country
                }
              }
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
              fees {
                edges {
                  node {
                    id
                    description
                    amount
                    taxable
                  }
                }
              }
            }
          }
        }
      }
    `;

    let hasNextPage = true;
    let endCursor: string | null = null;
    let totalSynced = 0;

    while (hasNextPage) {
      const response = await fetch("https://www.printavo.com/api/v2", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          email: settings.printavo_username,
          token: printavoToken,
        },
        body: JSON.stringify({
          query,
          variables: { after: endCursor },
        }),
      });

      if (!response.ok) {
        throw new Error(`Printavo API error: ${response.status}`);
      }

      const result = await response.json();

      if (result.errors) {
        throw new Error(`GraphQL error: ${result.errors[0]?.message || 'Unknown error'}`);
      }

      const invoices = result.data?.invoices?.edges || [];

      for (const edge of invoices) {
        const invoice = edge.node;

        const invoiceData = {
          id: invoice.id,
          invoice_number: invoice.visualId,
          total: parseFloat(invoice.total) || 0,
          amount_outstanding: parseFloat(invoice.amountOutstanding) || 0,
          amount_paid: parseFloat(invoice.amountPaid) || 0,
          created_at: invoice.createdAt,
          due_date: invoice.dueAt,
          order_date: invoice.orderdate,
          nickname: invoice.nickname,
          production_notes: invoice.productionNotes,
          visual_status: invoice.visualStatus,
          customer_id: invoice.customer?.id,
          customer_name: invoice.customer?.companyName,
          customer_email: invoice.customer?.primaryEmail,
          customer_phone: invoice.customer?.primaryPhone,
          customer_billing_address: invoice.customer?.billingAddress,
          raw_data: invoice,
          last_synced_at: new Date().toISOString(),
        };

        const { error: invoiceError } = await supabase
          .from('printavo_invoices')
          .upsert(invoiceData, { onConflict: 'id' });

        if (invoiceError) {
          console.error('Error upserting invoice:', invoiceError);
          continue;
        }

        const lineItemGroups = invoice.lineItemGroups?.edges || [];
        for (const groupEdge of lineItemGroups) {
          const lineItems = groupEdge.node?.lineItems?.edges || [];

          for (const itemEdge of lineItems) {
            const lineItem = itemEdge.node;

            const parsedData = parseGarmentFromPrintavoData(lineItem, lineItem.description || '');

            const lineItemData = {
              id: lineItem.id,
              invoice_id: invoice.id,
              description: lineItem.description,
              quantity: lineItem.items || 0,
              unit_price: parseFloat(lineItem.price) || 0,
              total_price: (lineItem.items || 0) * (parseFloat(lineItem.price) || 0),
              extracted_style: parsedData.style,
              extracted_color: parsedData.color,
              extracted_sizes: parsedData.sizes,
              extraction_notes: parsedData.notes.join('; '),
              parsed_at: new Date().toISOString(),
              raw_data: lineItem,
            };

            const { error: lineItemError } = await supabase
              .from('printavo_line_items')
              .upsert(lineItemData, { onConflict: 'id' });

            if (lineItemError) {
              console.error('Error upserting line item:', lineItemError);
            }
          }
        }

        const fees = invoice.fees?.edges || [];
        for (const feeEdge of fees) {
          const fee = feeEdge.node;

          const feeData = {
            id: fee.id,
            invoice_id: invoice.id,
            description: fee.description,
            amount: parseFloat(fee.amount) || 0,
            taxable: fee.taxable || false,
            raw_data: fee,
          };

          const { error: feeError } = await supabase
            .from('printavo_fees')
            .upsert(feeData, { onConflict: 'id' });

          if (feeError) {
            console.error('Error upserting fee:', feeError);
          }
        }

        totalSynced++;
      }

      hasNextPage = result.data?.invoices?.pageInfo?.hasNextPage || false;
      endCursor = result.data?.invoices?.pageInfo?.endCursor || null;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced ${totalSynced} invoices`,
        totalSynced,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error('Sync error:', error);
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
