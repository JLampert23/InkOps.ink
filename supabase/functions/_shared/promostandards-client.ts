/**
 * Unified PromoStandards API Client
 *
 * This module provides a unified interface to call all S&S PromoStandards services:
 * - Product Data 2.0.0
 * - Inventory 2.0.0
 * - Pricing 1.0.0
 * - Media Content 1.0.0
 *
 * All calls are made in parallel for optimal performance.
 */

const PROMOSTANDARDS_ENDPOINTS = {
  productData: "https://promostandards.ssactivewear.com/productdata/v2/productdataservicev2.svc",
  inventory: "https://promostandards.ssactivewear.com/inventory/v2/inventoryservice.svc",
  pricing: "https://promostandards.ssactivewear.com/pricingandconfiguration/v1/pricingandconfigurationservice.svc",
  media: "https://promostandards.ssactivewear.com/mediacontent/v1/mediacontentservice.svc",
};

export interface PromoStandardsCredentials {
  accountNumber: string;
  apiKey: string;
}

export interface PromoStandardsRequest {
  styleNumber: string;
  partId?: string;
}

export interface StyleData {
  styleNumber: string;
  productName: string;
  description: string;
  productBrand: string;
  parts: Array<{
    partId: string;
    colorName: string;
    labelSize: string;
    hex: string;
    approximatePmsColor: string;
  }>;
  colors: Array<{
    colorName: string;
    hex: string;
    approximatePmsColor: string;
    partIds: Array<{
      partId: string;
      size: string;
    }>;
  }>;
}

export interface InventoryData {
  items: Array<{
    partId: string;
    quantityAvailable: number;
    warehouseName: string;
    postalCode: string;
  }>;
}

export interface PricingData {
  parts: Array<{
    partId: string;
    prices: Array<{
      minQuantity: number;
      price: number;
      discountCode: string;
    }>;
  }>;
}

export interface MediaData {
  images: Array<{
    url: string;
    productId: string;
    partId: string;
    classTypeName: string;
    color: string;
    singlePart: boolean;
  }>;
  views: {
    front: string | null;
    rear: string | null;
    side: string | null;
    lifestyle: string | null;
    frontImages: string[];
    rearImages: string[];
    sideImages: string[];
    lifestyleImages: string[];
    otherImages: string[];
  };
}

export interface UnifiedPromoStandardsResponse {
  success: boolean;
  styleNumber: string;
  partId: string | null;
  style: StyleData;
  inventory: InventoryData;
  pricing: PricingData;
  media: MediaData;
}

async function makePromoStandardsRequest(
  endpoint: string,
  soapAction: string,
  soapBody: string
): Promise<string> {
  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Header/>
  <soap:Body>
    ${soapBody}
  </soap:Body>
</soap:Envelope>`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "SOAPAction": soapAction,
    },
    body: soapEnvelope,
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`PromoStandards request failed: ${response.status} ${response.statusText}`);
  }

  return responseText;
}

function getXmlValue(xmlText: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, 'i');
  const match = xmlText.match(regex);
  return match ? match[1] : null;
}

function getAllXmlMatches(xmlText: string, pattern: RegExp): RegExpMatchArray[] {
  const matches = [];
  let match;
  while ((match = pattern.exec(xmlText)) !== null) {
    matches.push(match);
  }
  return matches;
}

/**
 * Fetches unified PromoStandards data for a given style
 *
 * @param credentials - S&S Activewear credentials
 * @param request - Style number and optional part ID
 * @returns Unified response with style, inventory, pricing, and media data
 */
export async function fetchUnifiedPromoStandardsData(
  credentials: PromoStandardsCredentials,
  request: PromoStandardsRequest
): Promise<UnifiedPromoStandardsResponse> {
  const { styleNumber, partId } = request;
  const { accountNumber, apiKey } = credentials;

  console.log('🔄 Fetching unified PromoStandards data:', { styleNumber, partId });

  // Make all 4 requests in parallel
  const [productResponse, inventoryResponse, pricingResponse, mediaResponse] = await Promise.allSettled([
    // 1. Product Data
    makePromoStandardsRequest(
      PROMOSTANDARDS_ENDPOINTS.productData,
      "http://www.promostandards.org/WSDL/ProductDataService/2.0.0/GetProduct",
      `<ns2:GetProductRequest xmlns:ns2="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/SharedObjects/">
  <shar:wsVersion>2.0.0</shar:wsVersion>
  <shar:id>${accountNumber}</shar:id>
  <shar:password>${apiKey}</shar:password>
  <shar:productId>${styleNumber}</shar:productId>
</ns2:GetProductRequest>`
    ),
    // 2. Inventory (if partId provided, otherwise skip)
    partId ? makePromoStandardsRequest(
      PROMOSTANDARDS_ENDPOINTS.inventory,
      "http://www.promostandards.org/WSDL/Inventory/2.0.0/GetInventoryLevels",
      `<ns2:GetInventoryLevelsRequest xmlns:ns2="http://www.promostandards.org/WSDL/InventoryService/2.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/Inventory/2.0.0/SharedObjects/">
  <shar:wsVersion>2.0.0</shar:wsVersion>
  <shar:id>${accountNumber}</shar:id>
  <shar:password>${apiKey}</shar:password>
  <shar:productId>${partId}</shar:productId>
</ns2:GetInventoryLevelsRequest>`
    ) : Promise.resolve(null),
    // 3. Pricing (if partId provided, otherwise skip)
    partId ? makePromoStandardsRequest(
      PROMOSTANDARDS_ENDPOINTS.pricing,
      "http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/GetConfigurationAndPricing",
      `<ns2:GetConfigurationAndPricingRequest xmlns:ns2="http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/SharedObjects/">
  <shar:wsVersion>1.0.0</shar:wsVersion>
  <shar:id>${accountNumber}</shar:id>
  <shar:password>${apiKey}</shar:password>
  <shar:productId>${partId}</shar:productId>
  <shar:currency>USD</shar:currency>
  <shar:priceType>Customer</shar:priceType>
</ns2:GetConfigurationAndPricingRequest>`
    ) : Promise.resolve(null),
    // 4. Media Content
    makePromoStandardsRequest(
      PROMOSTANDARDS_ENDPOINTS.media,
      "http://www.promostandards.org/WSDL/MediaService/1.0.0/GetMediaContent",
      `<ns2:GetMediaContentRequest xmlns:ns2="http://www.promostandards.org/WSDL/MediaService/1.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/MediaService/1.0.0/SharedObjects/">
  <shar:wsVersion>1.0.0</shar:wsVersion>
  <shar:id>${accountNumber}</shar:id>
  <shar:password>${apiKey}</shar:password>
  <shar:mediaType>Image</shar:mediaType>
  <shar:productId>${styleNumber}</shar:productId>${partId ? `
  <shar:partId>${partId}</shar:partId>` : ''}
</ns2:GetMediaContentRequest>`
    ),
  ]);

  console.log('📊 PromoStandards API Results:', {
    product: productResponse.status,
    inventory: inventoryResponse.status,
    pricing: pricingResponse.status,
    media: mediaResponse.status,
  });

  // Parse Product Data
  const styleData: StyleData = {
    styleNumber,
    productName: "",
    description: "",
    productBrand: "",
    parts: [],
    colors: []
  };

  if (productResponse.status === 'fulfilled' && productResponse.value) {
    const xmlDoc = productResponse.value;
    styleData.productName = getXmlValue(xmlDoc, "productName") || "";
    styleData.description = getXmlValue(xmlDoc, "description") || "";
    styleData.productBrand = getXmlValue(xmlDoc, "productBrand") || "";

    const partPattern = /<Part>([\s\S]*?)<\/Part>/gi;
    const partMatches = getAllXmlMatches(xmlDoc, partPattern);

    styleData.parts = partMatches.map(match => {
      const partXml = match[1];
      return {
        partId: getXmlValue(partXml, "partId") || "",
        colorName: getXmlValue(partXml, "colorName") || "",
        labelSize: getXmlValue(partXml, "labelSize") || "",
        hex: getXmlValue(partXml, "hex") || "",
        approximatePmsColor: getXmlValue(partXml, "approximatePmsColor") || "",
      };
    });

    const colorMap = new Map();
    styleData.parts.forEach((part) => {
      if (!colorMap.has(part.colorName)) {
        colorMap.set(part.colorName, {
          colorName: part.colorName,
          hex: part.hex,
          approximatePmsColor: part.approximatePmsColor,
          partIds: []
        });
      }
      colorMap.get(part.colorName).partIds.push({
        partId: part.partId,
        size: part.labelSize
      });
    });

    styleData.colors = Array.from(colorMap.values());
  }

  // Parse Inventory
  const inventoryData: InventoryData = { items: [] };
  if (inventoryResponse.status === 'fulfilled' && inventoryResponse.value) {
    const xmlDoc = inventoryResponse.value;
    const inventoryPattern = /<Inventory>([\s\S]*?)<\/Inventory>/gi;
    const inventoryMatches = getAllXmlMatches(xmlDoc, inventoryPattern);

    inventoryData.items = inventoryMatches.map(match => {
      const invXml = match[1];
      return {
        partId: getXmlValue(invXml, "partId") || "",
        quantityAvailable: parseInt(getXmlValue(invXml, "quantityAvailable") || "0"),
        warehouseName: getXmlValue(invXml, "warehouseName") || "",
        postalCode: getXmlValue(invXml, "postalCode") || "",
      };
    });
  }

  // Parse Pricing
  const pricingData: PricingData = { parts: [] };
  if (pricingResponse.status === 'fulfilled' && pricingResponse.value) {
    const xmlDoc = pricingResponse.value;
    const partPattern = /<Part>([\s\S]*?)<\/Part>/gi;
    const partMatches = getAllXmlMatches(xmlDoc, partPattern);

    pricingData.parts = partMatches.map(match => {
      const partXml = match[1];
      const pricePattern = /<Price>([\s\S]*?)<\/Price>/gi;
      const priceMatches = getAllXmlMatches(partXml, pricePattern);

      return {
        partId: getXmlValue(partXml, "partId") || "",
        prices: priceMatches.map(priceMatch => {
          const priceXml = priceMatch[1];
          return {
            minQuantity: parseInt(getXmlValue(priceXml, "minQuantity") || "0"),
            price: parseFloat(getXmlValue(priceXml, "price") || "0"),
            discountCode: getXmlValue(priceXml, "discountCode") || "",
          };
        })
      };
    });
  }

  // Parse Media Content
  const mediaData: MediaData = {
    images: [],
    views: {
      front: null,
      rear: null,
      side: null,
      lifestyle: null,
      frontImages: [],
      rearImages: [],
      sideImages: [],
      lifestyleImages: [],
      otherImages: [],
    }
  };

  if (mediaResponse.status === 'fulfilled' && mediaResponse.value) {
    const xmlDoc = mediaResponse.value;
    const mediaPattern = /<MediaContent>([\s\S]*?)<\/MediaContent>/gi;
    const mediaMatches = getAllXmlMatches(xmlDoc, mediaPattern);

    mediaData.images = mediaMatches.map(match => {
      const mediaXml = match[1];
      return {
        url: getXmlValue(mediaXml, "url") || "",
        productId: getXmlValue(mediaXml, "productId") || "",
        partId: getXmlValue(mediaXml, "partId") || "",
        classTypeName: getXmlValue(mediaXml, "classTypeName") || "",
        color: getXmlValue(mediaXml, "color") || "",
        singlePart: getXmlValue(mediaXml, "singlePart") === "true",
      };
    });

    const frontImages: string[] = [];
    const rearImages: string[] = [];
    const sideImages: string[] = [];
    const lifestyleImages: string[] = [];
    const otherImages: string[] = [];

    mediaData.images.forEach((img) => {
      const classTypeName = (img.classTypeName || '').toLowerCase();

      if (classTypeName.includes('front')) {
        frontImages.push(img.url);
      } else if (classTypeName.includes('rear') || classTypeName.includes('back')) {
        rearImages.push(img.url);
      } else if (classTypeName.includes('side') || classTypeName.includes('sleeve')) {
        sideImages.push(img.url);
      } else if (classTypeName.includes('lifestyle') || classTypeName.includes('casual')) {
        lifestyleImages.push(img.url);
      } else if (img.url && !classTypeName.includes('swatch')) {
        otherImages.push(img.url);
      }
    });

    mediaData.views = {
      front: frontImages.length > 0 ? frontImages[0] : null,
      rear: rearImages.length > 0 ? rearImages[0] : null,
      side: sideImages.length > 0 ? sideImages[0] : null,
      lifestyle: lifestyleImages.length > 0 ? lifestyleImages[0] : null,
      frontImages,
      rearImages,
      sideImages,
      lifestyleImages,
      otherImages,
    };
  }

  return {
    success: true,
    styleNumber,
    partId: partId || null,
    style: styleData,
    inventory: inventoryData,
    pricing: pricingData,
    media: mediaData,
  };
}
