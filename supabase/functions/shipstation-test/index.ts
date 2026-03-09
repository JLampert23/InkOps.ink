import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CarrierService {
  carrierCode: string;
  code: string;
  name: string;
  domestic: boolean;
  international: boolean;
}

interface Carrier {
  name: string;
  code: string;
  accountNumber: string;
  requiresFundedAccount: boolean;
  balance: number;
  nickname: string;
  shippingProviderId: number;
  primary: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { apiKey, apiSecret, action } = await req.json();

    if (!apiKey || !apiSecret) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "API Key and API Secret are required"
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

    const credentials = btoa(`${apiKey}:${apiSecret}`);

    if (action === 'list_carriers') {
      const carriersResponse = await fetch("https://ssapi.shipstation.com/carriers", {
        method: "GET",
        headers: {
          "Authorization": `Basic ${credentials}`,
          "Content-Type": "application/json",
        },
      });

      if (!carriersResponse.ok) {
        const errorText = await carriersResponse.text();
        console.error("ShipStation carriers API error:", carriersResponse.status, errorText);

        if (carriersResponse.status === 401) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Invalid API credentials. Please check your API Key and Secret."
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
            error: `Failed to fetch carriers: ${carriersResponse.status}`
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

      const carriers: Carrier[] = await carriersResponse.json();

      const carriersWithServices = await Promise.all(
        carriers.map(async (carrier) => {
          try {
            const servicesResponse = await fetch(
              `https://ssapi.shipstation.com/carriers/listservices?carrierCode=${carrier.code}`,
              {
                method: "GET",
                headers: {
                  "Authorization": `Basic ${credentials}`,
                  "Content-Type": "application/json",
                },
              }
            );

            if (servicesResponse.ok) {
              const services: CarrierService[] = await servicesResponse.json();
              return {
                ...carrier,
                services: services.map(s => ({
                  code: s.code,
                  name: s.name,
                  domestic: s.domestic,
                  international: s.international,
                })),
              };
            }
            return { ...carrier, services: [] };
          } catch {
            return { ...carrier, services: [] };
          }
        })
      );

      return new Response(
        JSON.stringify({
          success: true,
          carriers: carriersWithServices,
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

    const response = await fetch("https://ssapi.shipstation.com/carriers", {
      method: "GET",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ShipStation API error:", response.status, errorText);

      if (response.status === 401) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Invalid API credentials. Please check your API Key and Secret."
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
          error: `ShipStation API error: ${response.status} - ${errorText}`
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

    const carriers: Carrier[] = await response.json();

    return new Response(
      JSON.stringify({
        success: true,
        message: "Successfully connected to ShipStation!",
        carriersCount: carriers.length,
        carriers: carriers.map(c => ({ name: c.name, code: c.code })),
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
    console.error("Error in shipstation-test function:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "An unexpected error occurred"
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
