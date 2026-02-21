import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildShipStationOrderPayload, validateShipStationPayload } from "../_shared/shipstation-payload-builder.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface InvoiceData {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_company?: string;
  customer_email: string;
  customer_phone?: string;
  billing_address?: string;
  billing_address_line1?: string;
  billing_address_line2?: string;
  billing_city?: string;
  billing_state?: string;
  billing_zip?: string;
  shipping_address?: string;
  shipping_line1?: string;
  shipping_line2?: string;
  shipping_address_line1?: string;
  shipping_address_line2?: string;
  shipping_city?: string;
  shipping_state?: string;
  shipping_zip?: string;
  shipping_country?: string;
  total: number;
  tax?: number;
  shipping?: number;
  created_at: string;
  company_id: string;
  shipstation_order_id?: string;
  shipstation_order_key?: string;
  total_weight_oz?: number;
  package_length?: number;
  package_width?: number;
  package_height?: number;
}

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  item_type: string;
  style_number?: string;
  style_name?: string;
  weight_oz?: number;
}

interface CompanySettings {
  shipstation_api_key: string;
  shipstation_api_secret: string;
  shipstation_default_carrier_code: string;
  shipstation_default_service_code: string;
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

  try {
    const authHeader = req.headers.get("Authorization");
    console.log('Authorization header present:', !!authHeader);

    if (!authHeader) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing Authorization header",
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

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { invoice_id, packages, selected_rate, fetch_rates } = await req.json();

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

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Authentication failed",
          details: authError?.message,
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

    if (!user) {
      console.error('No user found in session');
      return new Response(
        JSON.stringify({
          success: false,
          error: "Unauthorized - invalid or expired session",
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

    // Fetch invoice
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

    const invoiceData: InvoiceData = invoice as InvoiceData;

    // Fetch line items
    const { data: lineItems, error: lineItemsError } = await supabaseClient
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', invoice_id)
      .order('created_at', { ascending: true });

    if (lineItemsError) {
      console.error('Line items fetch error:', lineItemsError);
    }

    // Fetch company settings
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

    const credentials = btoa(`${apiKey}:${apiSecret}`);
    let shipStationOrderId = invoiceData.shipstation_order_id;

    // If fetch_rates is true, fetch rates and return them for user selection
    if (fetch_rates) {
      const shipToAddress = {
        street1: invoiceData.shipping_line1 || invoiceData.shipping_address_line1 || invoiceData.billing_address_line1 || '',
        street2: invoiceData.shipping_line2 || invoiceData.shipping_address_line2 || invoiceData.billing_address_line2 || '',
        city: invoiceData.shipping_city || invoiceData.billing_city || '',
        state: invoiceData.shipping_state || invoiceData.billing_state || '',
        postalCode: invoiceData.shipping_zip || invoiceData.billing_zip || '',
        country: invoiceData.shipping_country || 'US',
      };

      const fromAddress = {
        postalCode: companySettings.company_zip || '60612',
        country: 'US',
      };

      let ratePackages: Array<{ weight: { value: number; units: string }; dimensions: { units: string; length: number; width: number; height: number } }> = [];

      if (packages && Array.isArray(packages) && packages.length > 0) {
        ratePackages = packages.map((pkg: { weight_oz: number; length: number; width: number; height: number }) => ({
          weight: { value: pkg.weight_oz, units: "ounces" },
          dimensions: { units: "inches", length: pkg.length, width: pkg.width, height: pkg.height },
        }));
      } else {
        ratePackages = [{
          weight: { value: invoiceData.total_weight_oz || 16, units: "ounces" },
          dimensions: {
            units: "inches",
            length: invoiceData.package_length || 12,
            width: invoiceData.package_width || 9,
            height: invoiceData.package_height || 3,
          },
        }];
      }

      const ratePayload = {
        carrierCode: null,
        fromPostalCode: fromAddress.postalCode,
        toState: shipToAddress.state,
        toCountry: shipToAddress.country,
        toPostalCode: shipToAddress.postalCode,
        toCity: shipToAddress.city,
        weight: ratePackages[0].weight,
        dimensions: ratePackages[0].dimensions,
        confirmation: "none",
        residential: true,
      };

      console.log('Fetching ShipStation rates:', JSON.stringify(ratePayload, null, 2));

      const ratesResponse = await fetch("https://ssapi.shipstation.com/shipments/getrates", {
        method: "POST",
        headers: {
          "Authorization": `Basic ${credentials}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(ratePayload),
      });

      const ratesResponseText = await ratesResponse.text();
      let ratesResponseData: any;

      try {
        ratesResponseData = JSON.parse(ratesResponseText);
      } catch {
        ratesResponseData = { raw: ratesResponseText };
      }

      console.log('ShipStation rates response:', ratesResponseData);

      if (!ratesResponse.ok) {
        const errorMessage = ratesResponseData?.message || ratesResponseData?.ExceptionMessage || ratesResponseText || 'Rate lookup failed';

        return new Response(
          JSON.stringify({
            success: false,
            error: `Rate lookup failed: ${errorMessage}`,
            status_code: ratesResponse.status,
            details: ratesResponseData,
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
          success: true,
          mode: "rates",
          rates: ratesResponseData,
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

    // Step 1: Create or verify ShipStation order exists
    if (!shipStationOrderId) {
      console.log('Invoice data for ShipStation:', JSON.stringify({
        id: invoiceData.id,
        customer_name: invoiceData.customer_name,
        customer_email: invoiceData.customer_email,
        billing_address_line1: invoiceData.billing_address_line1,
        billing_city: invoiceData.billing_city,
        billing_state: invoiceData.billing_state,
        billing_zip: invoiceData.billing_zip,
        shipping_address: invoiceData.shipping_address,
        shipping_line1: invoiceData.shipping_line1,
        shipping_address_line1: invoiceData.shipping_address_line1,
        shipping_city: invoiceData.shipping_city,
        shipping_state: invoiceData.shipping_state,
        shipping_zip: invoiceData.shipping_zip,
      }, null, 2));

      console.log('Line items count:', lineItems?.length || 0);

      const shipStationPayload = buildShipStationOrderPayload(
        invoiceData,
        lineItems || []
      );

      console.log('Built ShipStation payload:', JSON.stringify(shipStationPayload, null, 2));

      const validation = validateShipStationPayload(shipStationPayload);
      if (!validation.valid) {
        await logShipStationAction(
          supabaseClient,
          invoiceData.company_id,
          invoice_id,
          invoiceData.invoice_number,
          'validation_error',
          shipStationPayload,
          null,
          0,
          `Validation failed: ${validation.errors.join(', ')}`,
          user.id
        );

        return new Response(
          JSON.stringify({
            success: false,
            error: `Cannot create label: ${validation.errors.join(', ')}`,
            validation_errors: validation.errors,
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

      console.log('Creating ShipStation order:', JSON.stringify(shipStationPayload, null, 2));

      const orderResponse = await fetch("https://ssapi.shipstation.com/orders/createorder", {
        method: "POST",
        headers: {
          "Authorization": `Basic ${credentials}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(shipStationPayload),
      });

      const orderResponseText = await orderResponse.text();
      let orderResponseData: any;

      try {
        orderResponseData = JSON.parse(orderResponseText);
      } catch {
        orderResponseData = { raw: orderResponseText };
      }

      console.log('ShipStation order response:', orderResponseData);

      if (!orderResponse.ok) {
        const errorMessage = orderResponseData?.message || orderResponseData?.ExceptionMessage || orderResponseText || 'ShipStation API error';

        await logShipStationAction(
          supabaseClient,
          invoiceData.company_id,
          invoice_id,
          invoiceData.invoice_number,
          'error',
          shipStationPayload,
          orderResponseData,
          orderResponse.status,
          errorMessage,
          user.id
        );

        if (orderResponse.status === 401) {
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
            status_code: orderResponse.status,
            details: orderResponseData,
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

      shipStationOrderId = orderResponseData.orderId?.toString();
      const shipStationOrderNumber = orderResponseData.orderNumber;
      const orderKey = orderResponseData.orderKey;

      await logShipStationAction(
        supabaseClient,
        invoiceData.company_id,
        invoice_id,
        invoiceData.invoice_number,
        'created',
        shipStationPayload,
        orderResponseData,
        orderResponse.status,
        null,
        user.id
      );

      // Update invoice with ShipStation order ID
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
    }

    // Step 2: Create shipping label
    const today = new Date().toISOString().split('T')[0];

    // Check if multi-package shipment
    const isMultiPackage = packages && Array.isArray(packages) && packages.length > 1;

    if (isMultiPackage) {
      // Create a separate label for each package
      const shippingLabels: Array<{
        label_data: string;
        tracking_number: string;
        package_index: number;
        weight_oz: number;
        length: number;
        width: number;
        height: number;
      }> = [];
      const trackingNumbers: string[] = [];
      let totalCost = 0;
      let lastCarrierCode = '';
      let lastServiceCode = '';

      console.log(`Creating ${packages.length} separate labels for multi-package shipment`);

      for (let i = 0; i < packages.length; i++) {
        const pkg = packages[i] as { weight_oz: number; length: number; width: number; height: number };

        const labelPayload = {
          orderId: parseInt(shipStationOrderId!),
          carrierCode: selected_rate?.carrierCode || settings.shipstation_default_carrier_code,
          serviceCode: selected_rate?.serviceCode || settings.shipstation_default_service_code,
          packageCode: selected_rate?.packageCode || "package",
          confirmation: "none",
          shipDate: today,
          weight: {
            value: pkg.weight_oz,
            units: "ounces"
          },
          dimensions: {
            units: "inches",
            length: pkg.length,
            width: pkg.width,
            height: pkg.height
          }
        };

        console.log(`Creating label ${i + 1}/${packages.length}:`, JSON.stringify(labelPayload, null, 2));

        const labelResponse = await fetch("https://ssapi.shipstation.com/orders/createlabelfororder", {
          method: "POST",
          headers: {
            "Authorization": `Basic ${credentials}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(labelPayload),
        });

        const labelResponseText = await labelResponse.text();
        let labelResponseData: any;

        try {
          labelResponseData = JSON.parse(labelResponseText);
        } catch {
          labelResponseData = { raw: labelResponseText };
        }

        console.log(`Label ${i + 1} response:`, labelResponseData);

        if (!labelResponse.ok) {
          const errorMessage = labelResponseData?.message || labelResponseData?.ExceptionMessage || labelResponseText || 'Label creation failed';

          await logShipStationAction(
            supabaseClient,
            invoiceData.company_id,
            invoice_id,
            invoiceData.invoice_number,
            'label_error',
            labelPayload,
            labelResponseData,
            labelResponse.status,
            `Package ${i + 1}: ${errorMessage}`,
            user.id
          );

          if (labelResponse.status === 401) {
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

          if (errorMessage.toLowerCase().includes('requested provider not configured') ||
              errorMessage.toLowerCase().includes('carrier') ||
              errorMessage.toLowerCase().includes('provider not configured')) {
            return new Response(
              JSON.stringify({
                success: false,
                error: `The carrier "${settings.shipstation_default_carrier_code}" is not connected to your ShipStation account. Please go to ShipStation Settings > Shipping > Carriers and connect this carrier, or select a different carrier in InkOps Settings.`,
                error_type: 'carrier_not_configured',
                carrier_code: settings.shipstation_default_carrier_code,
                service_code: settings.shipstation_default_service_code,
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
              error: `Label creation failed for package ${i + 1}: ${errorMessage}`,
              status_code: labelResponse.status,
              details: labelResponseData,
              labels_created: shippingLabels.length,
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

        const labelBase64 = labelResponseData.labelData;
        const trackingNum = labelResponseData.trackingNumber;
        const shipmentId = labelResponseData.shipmentId?.toString();
        lastCarrierCode = labelResponseData.carrierCode || settings.shipstation_default_carrier_code;
        lastServiceCode = labelResponseData.serviceCode || settings.shipstation_default_service_code;
        const shipmentCost = labelResponseData.shipmentCost || 0;
        totalCost += shipmentCost;

        shippingLabels.push({
          label_data: labelBase64 ? `data:application/pdf;base64,${labelBase64}` : '',
          tracking_number: trackingNum,
          package_index: i,
          weight_oz: pkg.weight_oz,
          length: pkg.length,
          width: pkg.width,
          height: pkg.height,
        });
        trackingNumbers.push(trackingNum);

        // Save each label to shipping_labels table
        const { error: labelInsertError } = await supabaseClient
          .from('shipping_labels')
          .insert({
            company_id: invoiceData.company_id,
            invoice_id: invoice_id,
            shipstation_shipment_id: shipmentId,
            label_url: labelBase64 ? `data:application/pdf;base64,${labelBase64}` : null,
            tracking_number: trackingNum,
            carrier: lastCarrierCode,
            service: lastServiceCode,
            cost: shipmentCost,
            weight_oz: pkg.weight_oz,
            package_length: pkg.length,
            package_width: pkg.width,
            package_height: pkg.height,
            ship_date: today,
            created_by: user.id,
          });

        if (labelInsertError) {
          console.error(`Failed to save shipping label ${i + 1}:`, labelInsertError);
        }

        await logShipStationAction(
          supabaseClient,
          invoiceData.company_id,
          invoice_id,
          invoiceData.invoice_number,
          'label_created',
          labelPayload,
          labelResponseData,
          labelResponse.status,
          null,
          user.id
        );
      }

      // Update invoice with all labels and tracking numbers
      const allTrackingNumbers = trackingNumbers.join(', ');
      const { error: invoiceUpdateError } = await supabaseClient
        .from('printavo_invoices')
        .update({
          shipping_status: 'label_created',
          tracking_number: allTrackingNumbers,
          shipping_labels: shippingLabels,
        })
        .eq('id', invoice_id);

      if (invoiceUpdateError) {
        console.error('Failed to update invoice with label data:', invoiceUpdateError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          labels: shippingLabels,
          tracking_numbers: trackingNumbers,
          carrier: lastCarrierCode,
          service: lastServiceCode,
          cost: totalCost,
          package_count: shippingLabels.length,
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

    // Single package label creation (existing logic)
    const labelPayload = {
      orderId: parseInt(shipStationOrderId!),
      carrierCode: selected_rate?.carrierCode || settings.shipstation_default_carrier_code,
      serviceCode: selected_rate?.serviceCode || settings.shipstation_default_service_code,
      packageCode: selected_rate?.packageCode || "package",
      confirmation: "none",
      shipDate: today,
      weight: {
        value: invoiceData.total_weight_oz || 16,
        units: "ounces"
      },
      dimensions: {
        units: "inches",
        length: invoiceData.package_length || 12,
        width: invoiceData.package_width || 9,
        height: invoiceData.package_height || 3
      }
    };

    console.log('Creating ShipStation label:', JSON.stringify(labelPayload, null, 2));

    const labelResponse = await fetch("https://ssapi.shipstation.com/orders/createlabelfororder", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(labelPayload),
    });

    const labelResponseText = await labelResponse.text();
    let labelResponseData: any;

    try {
      labelResponseData = JSON.parse(labelResponseText);
    } catch {
      labelResponseData = { raw: labelResponseText };
    }

    console.log('ShipStation label response:', labelResponseData);

    if (!labelResponse.ok) {
      const errorMessage = labelResponseData?.message || labelResponseData?.ExceptionMessage || labelResponseText || 'Label creation failed';

      await logShipStationAction(
        supabaseClient,
        invoiceData.company_id,
        invoice_id,
        invoiceData.invoice_number,
        'label_error',
        labelPayload,
        labelResponseData,
        labelResponse.status,
        errorMessage,
        user.id
      );

      if (labelResponse.status === 401) {
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

      if (errorMessage.toLowerCase().includes('requested provider not configured') ||
          errorMessage.toLowerCase().includes('carrier') ||
          errorMessage.toLowerCase().includes('provider not configured')) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `The carrier "${settings.shipstation_default_carrier_code}" is not connected to your ShipStation account. Please go to ShipStation Settings > Shipping > Carriers and connect this carrier, or select a different carrier in InkOps Settings.`,
            error_type: 'carrier_not_configured',
            carrier_code: settings.shipstation_default_carrier_code,
            service_code: settings.shipstation_default_service_code,
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
          error: `Label creation failed: ${errorMessage}`,
          status_code: labelResponse.status,
          details: labelResponseData,
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

    // Parse label response
    // labelData is base64-encoded PDF, we need to convert it to a data URL for viewing
    const labelDataBase64 = labelResponseData.labelData;
    const labelUrl = labelDataBase64 ? `data:application/pdf;base64,${labelDataBase64}` : null;
    const trackingNumber = labelResponseData.trackingNumber;
    const shipmentId = labelResponseData.shipmentId?.toString();
    const carrierCode = labelResponseData.carrierCode;
    const serviceCode = labelResponseData.serviceCode;
    const shipmentCost = labelResponseData.shipmentCost;

    // Save shipping label to database
    const { error: labelInsertError } = await supabaseClient
      .from('shipping_labels')
      .insert({
        company_id: invoiceData.company_id,
        invoice_id: invoice_id,
        shipstation_shipment_id: shipmentId,
        label_url: labelUrl,
        tracking_number: trackingNumber,
        carrier: carrierCode,
        service: serviceCode,
        cost: shipmentCost,
        weight_oz: invoiceData.total_weight_oz || 16,
        package_length: invoiceData.package_length || 12,
        package_width: invoiceData.package_width || 9,
        package_height: invoiceData.package_height || 3,
        ship_date: today,
        created_by: user.id,
      });

    if (labelInsertError) {
      console.error('Failed to save shipping label:', labelInsertError);
    }

    // Update invoice with label data
    const { error: invoiceUpdateError } = await supabaseClient
      .from('printavo_invoices')
      .update({
        shipping_status: 'label_created',
        tracking_number: trackingNumber,
      })
      .eq('id', invoice_id);

    if (invoiceUpdateError) {
      console.error('Failed to update invoice with label data:', invoiceUpdateError);
    }

    await logShipStationAction(
      supabaseClient,
      invoiceData.company_id,
      invoice_id,
      invoiceData.invoice_number,
      'label_created',
      labelPayload,
      labelResponseData,
      labelResponse.status,
      null,
      user.id
    );

    return new Response(
      JSON.stringify({
        success: true,
        label_url: labelUrl,
        tracking_number: trackingNumber,
        carrier: carrierCode,
        service: serviceCode,
        cost: shipmentCost,
        shipment_id: shipmentId,
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
    console.error("Error in ship-invoice function:", error);

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
