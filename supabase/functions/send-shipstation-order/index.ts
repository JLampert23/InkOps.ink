import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildShipStationOrderPayload } from "../_shared/shipstation-payload-builder.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface InvoiceData {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  customer_address2: string;
  customer_city: string;
  customer_state: string;
  customer_zip_code: string;
  customer_country: string;
  total: number;
  created_at: string;
  company_id: string;
}

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_type: string;
  sku: string;
  product_name: string;
}

interface CompanySettings {
  shipstation_api_key: string;
  shipstation_api_secret: string;
  shipstation_default_ship_from_name: string;
  shipstation_default_ship_from_company: string;
  shipstation_default_ship_from_address1: string;
  shipstation_default_ship_from_address2: string;
  shipstation_default_ship_from_city: string;
  shipstation_default_ship_from_state: string;
  shipstation_default_ship_from_postal_code: string;
  shipstation_default_ship_from_country: string;
}

async function decryptToken(supabase: any, encryptedToken: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('crypto-service', {
    body: {
      action: 'decrypt',
      token: encryptedToken,
    },
  });

  if (error || !data?.success || !data?.result) {
    throw new Error(data?.error || 'Decryption failed');
  }

  return data.result;
}

async function logShipStationAction(
  supabase: any,
  companyId: string,
  invoiceId: string,
  invoiceNumber: string,
  action: string,
  requestPayload: any,
  responsePayload: any,
  statusCode: number,
  errorMessage?: string,
  userId?: string
) {
  try {
    await supabase.from('shipstation_order_log').insert({
      company_id: companyId,
      invoice_id: invoiceId,
      invoice_number: invoiceNumber,
      action,
      request_payload: requestPayload,
      response_payload: responsePayload,
      status_code: statusCode,
      error_message: errorMessage || null,
      created_by: userId || null,
    });
  } catch (err) {
    console.error('Failed to log ShipStation action:', err);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    {
      global: {
        headers: { Authorization: req.headers.get("Authorization")! },
      },
    }
  );

  try {
    const { invoice_id } = await req.json();

    if (!invoice_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "invoice_id is required",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Unauthorized",
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const { data: invoice, error: invoiceError } = await supabaseClient
      .from('printavo_invoices')
      .select('*')
      .eq('id', invoice_id)
      .single();

    if (invoiceError || !invoice) {
      console.error('Invoice fetch error:', invoiceError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invoice not found",
        }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const invoiceData = invoice as InvoiceData;

    if (invoiceData.shipstation_order_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invoice already sent to ShipStation",
          shipstation_order_id: invoiceData.shipstation_order_id,
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const { data: lineItems, error: lineItemsError } = await supabaseClient
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', invoice_id)
      .order('created_at', { ascending: true });

    if (lineItemsError) {
      console.error('Line items fetch error:', lineItemsError);
    }

    const { data: companySettings, error: settingsError } = await supabaseClient
      .from('company_settings')
      .select('*')
      .eq('id', invoiceData.company_id)
      .single();

    if (settingsError || !companySettings) {
      console.error('Company settings fetch error:', settingsError);
      await logShipStationAction(
        supabaseClient,
        invoiceData.company_id,
        invoice_id,
        invoiceData.invoice_number,
        'error',
        null,
        null,
        0,
        'ShipStation credentials not configured',
        user.id
      );

      return new Response(
        JSON.stringify({
          success: false,
          error: "ShipStation credentials not configured",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const settings = companySettings as CompanySettings;

    if (!settings.shipstation_api_key || !settings.shipstation_api_secret) {
      await logShipStationAction(
        supabaseClient,
        invoiceData.company_id,
        invoice_id,
        invoiceData.invoice_number,
        'error',
        null,
        null,
        0,
        'ShipStation API credentials missing',
        user.id
      );

      return new Response(
        JSON.stringify({
          success: false,
          error: "ShipStation API credentials not configured",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    let apiKey: string;
    let apiSecret: string;

    try {
      apiKey = await decryptToken(supabaseClient, settings.shipstation_api_key);
      apiSecret = await decryptToken(supabaseClient, settings.shipstation_api_secret);
    } catch (decryptError) {
      console.error('Decryption error:', decryptError);
      await logShipStationAction(
        supabaseClient,
        invoiceData.company_id,
        invoice_id,
        invoiceData.invoice_number,
        'error',
        null,
        null,
        0,
        'Failed to decrypt API credentials',
        user.id
      );

      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to decrypt ShipStation credentials",
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const shipStationPayload = buildShipStationOrderPayload(
      invoiceData,
      lineItems || []
    );

    console.log('Sending order to ShipStation:', JSON.stringify(shipStationPayload, null, 2));

    const credentials = btoa(`${apiKey}:${apiSecret}`);

    const shipStationResponse = await fetch("https://ssapi.shipstation.com/orders/createorder", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(shipStationPayload),
    });

    const responseText = await shipStationResponse.text();
    let responseData: any;

    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    console.log('ShipStation response:', responseData);

    if (!shipStationResponse.ok) {
      const errorMessage = responseData?.message || responseData?.ExceptionMessage || responseText || 'ShipStation API error';

      await logShipStationAction(
        supabaseClient,
        invoiceData.company_id,
        invoice_id,
        invoiceData.invoice_number,
        'error',
        shipStationPayload,
        responseData,
        shipStationResponse.status,
        errorMessage,
        user.id
      );

      if (shipStationResponse.status === 401) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Invalid ShipStation API credentials. Please check your API Key and Secret in settings.",
          }),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: `ShipStation API error: ${errorMessage}`,
          status_code: shipStationResponse.status,
          details: responseData,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const shipStationOrderId = responseData.orderId?.toString();
    const shipStationOrderNumber = responseData.orderNumber;
    const orderKey = responseData.orderKey;

    await logShipStationAction(
      supabaseClient,
      invoiceData.company_id,
      invoice_id,
      invoiceData.invoice_number,
      'created',
      shipStationPayload,
      responseData,
      shipStationResponse.status,
      null,
      user.id
    );

    const { error: updateError } = await supabaseClient
      .from('printavo_invoices')
      .update({
        shipping_status: 'sent_to_shipstation',
        shipstation_order_id: shipStationOrderId,
        shipstation_order_key: orderKey,
        shipstation_sent_at: new Date().toISOString(),
      })
      .eq('id', invoice_id);

    if (updateError) {
      console.error('Failed to update invoice with ShipStation data:', updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Order successfully sent to ShipStation",
        shipstation_order_id: shipStationOrderId,
        shipstation_order_number: shipStationOrderNumber,
        order_key: orderKey,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error in send-shipstation-order function:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "An unexpected error occurred",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
