import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { getLiveWholesalePricing, VendorConfig } from "./live-wholesale-pricing.ts";

const mockSanMarConfig: VendorConfig = {
  name: "sanmar",
  pricingEndpoint: "https://ws.sanmar.com:8080/promostandards/PricingAndConfigurationServiceBinding?WSDL",
  credentials: { id: "test_sanmar_id", password: "test_sanmar_pass" },
};

const mockSSAConfig: VendorConfig = {
  name: "ssactivewear",
  pricingEndpoint: "https://promostandards.ssactivewear.com/pricingandconfiguration/v1/pricingandconfigurationservice.svc",
  credentials: { id: "test_ssa_id", password: "test_ssa_pass" },
};

const sanmarSuccessResponse = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetConfigurationAndPricingResponse xmlns="http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/">
      <Configuration>
        <PartArray>
          <Part>
            <partId>PC61-JetBlack-S</partId>
            <PartPriceArray>
              <PartPrice>
                <minQuantity>1</minQuantity>
                <price>3.48</price>
                <discountCode>C</discountCode>
                <priceEffectiveDate>2024-01-01</priceEffectiveDate>
                <priceExpiryDate>2024-12-31</priceExpiryDate>
              </PartPrice>
              <PartPrice>
                <minQuantity>72</minQuantity>
                <price>3.25</price>
                <discountCode>C</discountCode>
                <priceEffectiveDate>2024-01-01</priceEffectiveDate>
                <priceExpiryDate>2024-12-31</priceExpiryDate>
              </PartPrice>
            </PartPriceArray>
          </Part>
          <Part>
            <partId>PC61-JetBlack-M</partId>
            <PartPriceArray>
              <PartPrice>
                <minQuantity>1</minQuantity>
                <price>3.48</price>
                <discountCode>C</discountCode>
              </PartPrice>
            </PartPriceArray>
          </Part>
        </PartArray>
      </Configuration>
    </GetConfigurationAndPricingResponse>
  </soap:Body>
</soap:Envelope>`;

const ssaSuccessResponse = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ns2:GetConfigurationAndPricingResponse xmlns:ns2="http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/">
      <ns2:Configuration>
        <ns2:PartArray>
          <ns2:Part>
            <ns2:partId>B00760033</ns2:partId>
            <ns2:partDescription>Antique Cherry Red (S)</ns2:partDescription>
            <ns2:PartPriceArray>
              <ns2:PartPrice>
                <ns2:minQuantity>1</ns2:minQuantity>
                <ns2:price>2.50</ns2:price>
                <ns2:discountCode>A</ns2:discountCode>
                <ns2:priceEffectiveDate>2024-02-01</ns2:priceEffectiveDate>
                <ns2:priceExpiryDate>2024-06-30</ns2:priceExpiryDate>
              </ns2:PartPrice>
            </ns2:PartPriceArray>
          </ns2:Part>
        </ns2:PartArray>
      </ns2:Configuration>
    </ns2:GetConfigurationAndPricingResponse>
  </soap:Body>
</soap:Envelope>`;

const missingPartPriceArrayResponse = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetConfigurationAndPricingResponse xmlns="http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/">
      <Configuration>
        <PartArray>
          <Part>
            <partId>PC61-JetBlack-S</partId>
          </Part>
        </PartArray>
      </Configuration>
    </GetConfigurationAndPricingResponse>
  </soap:Body>
</soap:Envelope>`;

const soapFaultResponse = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <soap:Fault>
      <faultcode>soap:Server</faultcode>
      <faultstring>Internal Server Error</faultstring>
    </soap:Fault>
  </soap:Body>
</soap:Envelope>`;

const invalidFobResponse = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetConfigurationAndPricingResponse xmlns="http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/">
      <errorCode>110</errorCode>
      <errorMessage>Invalid FOB ID</errorMessage>
    </GetConfigurationAndPricingResponse>
  </soap:Body>
</soap:Envelope>`;

let mockResponse: { ok: boolean; status: number; text: () => Promise<string> };

const originalFetch = globalThis.fetch;

function setupMockFetch(response: string, ok = true, status = 200) {
  mockResponse = {
    ok,
    status,
    text: async () => response,
  };
  globalThis.fetch = async () => mockResponse as Response;
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

Deno.test("SanMar success response - parses multiple parts and price tiers", async () => {
  setupMockFetch(sanmarSuccessResponse);

  const results = await getLiveWholesalePricing(mockSanMarConfig, "PC61", "1");

  assertEquals(results.length, 3);

  assertEquals(results[0].partId, "PC61-JetBlack-S");
  assertEquals(results[0].price, 3.48);
  assertEquals(results[0].minQty, 1);
  assertEquals(results[0].discountCode, "C");
  assertEquals(results[0].effectiveDate, "2024-01-01");
  assertEquals(results[0].expiryDate, "2024-12-31");

  assertEquals(results[1].partId, "PC61-JetBlack-S");
  assertEquals(results[1].price, 3.25);
  assertEquals(results[1].minQty, 72);

  assertEquals(results[2].partId, "PC61-JetBlack-M");
  assertEquals(results[2].price, 3.48);
  assertEquals(results[2].minQty, 1);

  restoreFetch();
});

Deno.test("S&S success response - parses namespaced XML correctly", async () => {
  setupMockFetch(ssaSuccessResponse);

  const results = await getLiveWholesalePricing(mockSSAConfig, "B00760", "IL");

  assertEquals(results.length, 1);
  assertEquals(results[0].partId, "B00760033");
  assertEquals(results[0].price, 2.50);
  assertEquals(results[0].minQty, 1);
  assertEquals(results[0].discountCode, "A");
  assertEquals(results[0].effectiveDate, "2024-02-01");
  assertEquals(results[0].expiryDate, "2024-06-30");

  restoreFetch();
});

Deno.test("Missing PartPriceArray - returns empty array for part", async () => {
  setupMockFetch(missingPartPriceArrayResponse);

  const results = await getLiveWholesalePricing(mockSanMarConfig, "PC61", "1");

  assertEquals(results.length, 0);

  restoreFetch();
});

Deno.test("SOAP fault - returns empty array", async () => {
  setupMockFetch(soapFaultResponse);

  const results = await getLiveWholesalePricing(mockSanMarConfig, "PC61", "1");

  assertEquals(results.length, 0);

  restoreFetch();
});

Deno.test("Invalid FOB - returns empty array on error code", async () => {
  setupMockFetch(invalidFobResponse);

  const results = await getLiveWholesalePricing(mockSanMarConfig, "PC61", "INVALID");

  assertEquals(results.length, 0);

  restoreFetch();
});

Deno.test("HTTP error - returns empty array", async () => {
  setupMockFetch("", false, 500);

  const results = await getLiveWholesalePricing(mockSanMarConfig, "PC61", "1");

  assertEquals(results.length, 0);

  restoreFetch();
});

Deno.test("Network error - returns empty array without throwing", async () => {
  globalThis.fetch = async () => {
    throw new Error("Network unreachable");
  };

  const results = await getLiveWholesalePricing(mockSanMarConfig, "PC61", "1");

  assertEquals(results.length, 0);

  restoreFetch();
});
