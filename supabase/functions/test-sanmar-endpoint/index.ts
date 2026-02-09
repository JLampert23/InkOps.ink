import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const results: any = {
    timestamp: new Date().toISOString(),
    tests: []
  };

  // Test 1: CORRECT endpoint - ws.sanmar.com
  try {
    const testUrl = "https://ws.sanmar.com:8080";
    const dnsStart = Date.now();
    const response = await fetch(testUrl, {
      method: "HEAD",
      signal: AbortSignal.timeout(5000)
    });
    results.tests.push({
      test: "✅ CORRECT: ws.sanmar.com:8080",
      status: "SUCCESS",
      statusCode: response.status,
      duration: Date.now() - dnsStart
    });
  } catch (error: any) {
    results.tests.push({
      test: "✅ CORRECT: ws.sanmar.com:8080",
      status: "FAILED",
      error: error.message
    });
  }

  // Test 2: PromoStandards Product Data endpoint (CORRECTED)
  try {
    const endpoint = "https://ws.sanmar.com:8080/promostandards/ProductDataService?wsdl";
    const soapStart = Date.now();
    const response = await fetch(endpoint, {
      method: "GET",
      signal: AbortSignal.timeout(5000)
    });
    const body = await response.text();
    results.tests.push({
      test: "✅ PromoStandards ProductDataService WSDL",
      status: "SUCCESS",
      statusCode: response.status,
      duration: Date.now() - soapStart,
      hasWSDL: body.includes("wsdl") || body.includes("WSDL"),
      preview: body.substring(0, 200)
    });
  } catch (error: any) {
    results.tests.push({
      test: "✅ PromoStandards ProductDataService WSDL",
      status: "FAILED",
      error: error.message
    });
  }

  // Test 3: Try OLD (incorrect) endpoints for comparison
  const incorrectEndpoints = [
    "https://api.sanmar.com",
    "https://webservices.sanmar.com",
  ];

  for (const url of incorrectEndpoints) {
    try {
      const altStart = Date.now();
      const response = await fetch(url, {
        method: "HEAD",
        signal: AbortSignal.timeout(5000)
      });
      results.tests.push({
        test: `Alternate endpoint: ${url}`,
        status: "SUCCESS",
        statusCode: response.status,
        duration: Date.now() - altStart
      });
    } catch (error: any) {
      results.tests.push({
        test: `Alternate endpoint: ${url}`,
        status: "FAILED",
        error: error.message
      });
    }
  }

  return new Response(
    JSON.stringify(results, null, 2),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    }
  );
});
