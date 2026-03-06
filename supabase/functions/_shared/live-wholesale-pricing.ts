export interface VendorCredentials {
  id: string;
  password: string;
}

export interface VendorConfig {
  name: "sanmar" | "ssactivewear";
  pricingEndpoint: string;
  credentials: VendorCredentials;
}

export interface WholesalePriceItem {
  partId: string;
  price: number;
  minQty: number;
  discountCode: string | null;
  effectiveDate: string | null;
  expiryDate: string | null;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getXmlValue(xmlText: string, tagName: string): string | null {
  const regex = new RegExp(`<(?:[a-zA-Z0-9]+:)?${tagName}(?:\\s[^>]*)?>([^<]*)</(?:[a-zA-Z0-9]+:)?${tagName}>`, "i");
  const match = xmlText.match(regex);
  return match ? match[1].trim() : null;
}

function getAllXmlBlocks(xmlText: string, tagName: string): string[] {
  const regex = new RegExp(`<(?:[a-zA-Z0-9]+:)?${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[a-zA-Z0-9]+:)?${tagName}>`, "gi");
  const blocks: string[] = [];
  let match;
  while ((match = regex.exec(xmlText)) !== null) {
    blocks.push(match[1]);
  }
  return blocks;
}

function isSoapFault(xmlText: string): boolean {
  return xmlText.toLowerCase().includes("<soap:fault") ||
         xmlText.toLowerCase().includes("<faultcode") ||
         xmlText.toLowerCase().includes("<faultstring");
}

function getPromoStandardsError(xmlText: string): { code: string; description: string } | null {
  const errorCodeMatch = xmlText.match(/<[^:]*:?errorCode[^>]*>([^<]*)<\/[^:]*:?errorCode>/i);
  const errorMessageMatch = xmlText.match(/<[^:]*:?errorMessage[^>]*>([^<]*)<\/[^:]*:?errorMessage>/i);

  if (errorCodeMatch && errorMessageMatch && errorCodeMatch[1].trim() !== "") {
    return { code: errorCodeMatch[1].trim(), description: errorMessageMatch[1].trim() };
  }

  return null;
}

export async function getLiveWholesalePricing(
  vendor: VendorConfig,
  productId: string,
  fobId: string
): Promise<WholesalePriceItem[]> {
  const escapedId = escapeXml(vendor.credentials.id);
  const escapedPassword = escapeXml(vendor.credentials.password);
  const escapedProductId = escapeXml(productId);
  const escapedFobId = escapeXml(fobId);

  const soapBody = `<ns2:GetConfigurationAndPricingRequest xmlns:ns2="http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/SharedObjects/">
  <shar:wsVersion>1.0.0</shar:wsVersion>
  <shar:id>${escapedId}</shar:id>
  <shar:password>${escapedPassword}</shar:password>
  <shar:productId>${escapedProductId}</shar:productId>
  <shar:localizationCountry>US</shar:localizationCountry>
  <shar:localizationLanguage>en</shar:localizationLanguage>
  <shar:fobId>${escapedFobId}</shar:fobId>
  <shar:priceType>Net</shar:priceType>
  <shar:configurationType>Blank</shar:configurationType>
</ns2:GetConfigurationAndPricingRequest>`;

  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Header/>
  <soap:Body>
    ${soapBody}
  </soap:Body>
</soap:Envelope>`;

  try {
    const response = await fetch(vendor.pricingEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": `"getConfigurationAndPricing"`,
      },
      body: soapEnvelope,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      console.error(`[LivePricing] HTTP ${response.status} ${response.statusText} for ${productId}:`, errorBody.substring(0, 500));
      return [];
    }

    const xmlText = await response.text();
    console.log(`[LivePricing] Response received for ${productId}: ${xmlText.length} bytes`);

    if (isSoapFault(xmlText)) {
      console.error("[LivePricing] SOAP fault in pricing response:", xmlText.substring(0, 500));
      return [];
    }

    const promoError = getPromoStandardsError(xmlText);
    if (promoError) {
      console.error("[LivePricing] PromoStandards error:", promoError.code, promoError.description);
      return [];
    }

    const results: WholesalePriceItem[] = [];
    const partBlocks = getAllXmlBlocks(xmlText, "Part");

    console.log(`[LivePricing] Found ${partBlocks.length} Part blocks for product ${productId}`);

    for (const partXml of partBlocks) {
      const partId = getXmlValue(partXml, "partId");
      if (!partId) continue;

      const partPriceBlocks = getAllXmlBlocks(partXml, "PartPrice");

      for (const priceXml of partPriceBlocks) {
        const priceValue = getXmlValue(priceXml, "price");
        const minQtyValue = getXmlValue(priceXml, "minQuantity");

        if (!priceValue) continue;

        results.push({
          partId,
          price: parseFloat(priceValue) || 0,
          minQty: parseInt(minQtyValue || "1") || 1,
          discountCode: getXmlValue(priceXml, "discountCode") || null,
          effectiveDate: getXmlValue(priceXml, "priceEffectiveDate") || null,
          expiryDate: getXmlValue(priceXml, "priceExpiryDate") || null,
        });
      }
    }

    if (results.length === 0) {
      console.warn("[LivePricing] Zero price results parsed for", productId);
      console.warn("[LivePricing] FULL RESPONSE:", xmlText);

      const bodyMatch = xmlText.match(/<(?:[a-zA-Z0-9]+:)?Body[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9]+:)?Body>/i);
      if (bodyMatch) {
        console.warn("[LivePricing] SOAP Body content:", bodyMatch[1]);
      }

      const configMatch = xmlText.match(/<(?:[a-zA-Z0-9]+:)?Configuration[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9]+:)?Configuration>/i);
      if (configMatch) {
        console.log("[LivePricing] Found Configuration block, checking for pricing data inside...");
      }

      const priceMatch = xmlText.match(/<(?:[a-zA-Z0-9]+:)?PartPrice[^>]*>/i);
      if (priceMatch) {
        console.log("[LivePricing] Found PartPrice tags but Part blocks not parsed correctly");
      }
    } else {
      console.log(`[LivePricing] Parsed ${results.length} price entries. Sample:`, results[0]);
    }

    return results;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[LivePricing] Error for ${productId}: ${message}`);
    return [];
  }
}
