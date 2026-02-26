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
  const regex = new RegExp(`<[^:]*:?${tagName}[^>]*>([^<]*)</[^:]*:?${tagName}>`, "i");
  const match = xmlText.match(regex);
  return match ? match[1].trim() : null;
}

function getAllXmlBlocks(xmlText: string, tagName: string): string[] {
  const regex = new RegExp(`<[^:]*:?${tagName}[^>]*>([\\s\\S]*?)</[^:]*:?${tagName}>`, "gi");
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

function hasErrorCode(xmlText: string): boolean {
  const errorCodeMatch = xmlText.match(/<[^:]*:?errorCode[^>]*>([^<]*)<\/[^:]*:?errorCode>/i);
  if (errorCodeMatch && errorCodeMatch[1].trim() !== "") {
    return true;
  }
  const codeMatch = xmlText.match(/<[^:]*:?code[^>]*>(\d+)<\/[^:]*:?code>/i);
  if (codeMatch && parseInt(codeMatch[1]) > 0) {
    return true;
  }
  return false;
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
  <shar:currency>USD</shar:currency>
  <shar:fobId>${escapedFobId}</shar:fobId>
  <shar:priceType>Customer</shar:priceType>
  <shar:localizationCountry>US</shar:localizationCountry>
  <shar:localizationLanguage>en</shar:localizationLanguage>
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
        "SOAPAction": "getConfigurationAndPricing",
      },
      body: soapEnvelope,
    });

    if (!response.ok) {
      console.error(`Pricing request failed: ${response.status} ${response.statusText}`);
      return [];
    }

    const xmlText = await response.text();

    if (isSoapFault(xmlText)) {
      console.error("SOAP fault in pricing response");
      return [];
    }

    if (hasErrorCode(xmlText)) {
      console.error("Error code in pricing response");
      return [];
    }

    const results: WholesalePriceItem[] = [];
    const partBlocks = getAllXmlBlocks(xmlText, "Part");

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

    return results;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`getLiveWholesalePricing error: ${message}`);
    return [];
  }
}
