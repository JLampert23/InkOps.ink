/**
 * SanMar PromoStandards SOAP Client
 *
 * This module provides a unified interface to call SanMar PromoStandards services:
 * - Product Data Service 2.0.0
 * - Inventory Service 2.0.0
 * - Pricing & Configuration Service 1.0.0
 * - Media Content Service 1.0.0
 *
 * Authentication: Basic Auth (username:password)
 * Endpoints: https://api.sanmar.com/ps/
 */

const SANMAR_PROMOSTANDARDS_ENDPOINTS = {
  productData: "https://ws.sanmar.com:8080/promostandards/ProductDataService",
  inventory: "https://ws.sanmar.com:8080/promostandards/InventoryService",
  pricing: "https://ws.sanmar.com:8080/promostandards/PricingAndConfigurationService",
  media: "https://ws.sanmar.com:8080/promostandards/MediaContentService",
};

export interface SanMarCredentials {
  username: string;
  password: string;
}

export interface SanMarRequest {
  styleNumber: string;
  partId?: string;
}

export interface SanMarStyleData {
  styleNumber: string;
  productName: string;
  description: string;
  productBrand: string;
  productCategory: string;
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

export interface SanMarInventoryData {
  items: Array<{
    partId: string;
    quantityAvailable: number;
    attributeSelection?: string;
    warehouseName: string;
    postalCode: string;
  }>;
}

export interface SanMarPricingData {
  parts: Array<{
    partId: string;
    prices: Array<{
      minQuantity: number;
      price: number;
      discountCode: string;
    }>;
  }>;
}

export interface SanMarMediaData {
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

export interface SanMarUnifiedResponse {
  success: boolean;
  styleNumber: string;
  partId: string | null;
  style: SanMarStyleData;
  inventory: SanMarInventoryData;
  pricing: SanMarPricingData;
  media: SanMarMediaData;
}

/**
 * Makes a SOAP request to SanMar PromoStandards API
 */
async function makeSanMarSOAPRequest(
  endpoint: string,
  soapAction: string,
  soapBody: string,
  credentials: SanMarCredentials
): Promise<string> {
  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Header/>
  <soap:Body>
    ${soapBody}
  </soap:Body>
</soap:Envelope>`;

  console.log(`🔐 Making SOAP request to: ${endpoint}`);
  console.log(`🔐 SOAPAction: ${soapAction}`);
  console.log(`🔐 Username: ${credentials.username}`);
  console.log(`🔐 Password length: ${credentials.password?.length || 0}`);

  // SanMar PromoStandards uses credentials in SOAP body only (not Basic Auth header)
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "SOAPAction": soapAction,
    },
    body: soapEnvelope,
  });

  const responseText = await response.text();

  console.log(`📥 SOAP response status: ${response.status}`);
  if (!response.ok) {
    console.error("SanMar SOAP Error Response:", responseText.slice(0, 500));
  }

  if (!response.ok) {
    throw new Error(`SanMar PromoStandards request failed: ${response.status} ${response.statusText}`);
  }

  return responseText;
}

/**
 * Extracts a single XML tag value
 */
function getXmlValue(xmlText: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, 'i');
  const match = xmlText.match(regex);
  return match ? match[1] : null;
}

/**
 * Extracts all occurrences of an XML pattern
 */
function getAllXmlMatches(xmlText: string, pattern: RegExp): RegExpMatchArray[] {
  const matches = [];
  let match;
  while ((match = pattern.exec(xmlText)) !== null) {
    matches.push(match);
  }
  return matches;
}

/**
 * Fetches product information from SanMar using getProduct operation
 */
export async function fetchSanMarProductData(
  credentials: SanMarCredentials,
  styleNumber: string
): Promise<SanMarStyleData> {
  console.log('🔍 Fetching SanMar product data:', styleNumber);

  const soapBody = `<ns2:GetProductRequest xmlns:ns2="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/SharedObjects/">
  <shar:wsVersion>2.0.0</shar:wsVersion>
  <shar:id>${credentials.username}</shar:id>
  <shar:password>${credentials.password}</shar:password>
  <shar:productId>${styleNumber}</shar:productId>
</ns2:GetProductRequest>`;

  const responseXml = await makeSanMarSOAPRequest(
    SANMAR_PROMOSTANDARDS_ENDPOINTS.productData,
    "getProduct",
    soapBody,
    credentials
  );

  // Parse XML response
  const styleData: SanMarStyleData = {
    styleNumber,
    productName: getXmlValue(responseXml, "productName") || "",
    description: getXmlValue(responseXml, "description") || "",
    productBrand: getXmlValue(responseXml, "productBrand") || "",
    productCategory: getXmlValue(responseXml, "productCategory") || "",
    parts: [],
    colors: []
  };

  // Parse parts
  const partPattern = /<Part>([\s\S]*?)<\/Part>/gi;
  const partMatches = getAllXmlMatches(responseXml, partPattern);

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

  // Group parts by color
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

  console.log(`✅ Found ${styleData.parts.length} parts, ${styleData.colors.length} colors`);

  return styleData;
}

/**
 * Fetches inventory levels for a specific part
 */
export async function fetchSanMarInventory(
  credentials: SanMarCredentials,
  partId: string
): Promise<SanMarInventoryData> {
  console.log('📦 Fetching SanMar inventory:', partId);

  const soapBody = `<ns2:GetInventoryLevelsRequest xmlns:ns2="http://www.promostandards.org/WSDL/InventoryService/2.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/Inventory/2.0.0/SharedObjects/">
  <shar:wsVersion>2.0.0</shar:wsVersion>
  <shar:id>${credentials.username}</shar:id>
  <shar:password>${credentials.password}</shar:password>
  <shar:productId>${partId}</shar:productId>
</ns2:GetInventoryLevelsRequest>`;

  const responseXml = await makeSanMarSOAPRequest(
    SANMAR_PROMOSTANDARDS_ENDPOINTS.inventory,
    "getInventoryLevels",
    soapBody,
    credentials
  );

  // Parse inventory items
  const inventoryData: SanMarInventoryData = { items: [] };
  const inventoryPattern = /<Inventory>([\s\S]*?)<\/Inventory>/gi;
  const inventoryMatches = getAllXmlMatches(responseXml, inventoryPattern);

  inventoryData.items = inventoryMatches.map(match => {
    const invXml = match[1];
    return {
      partId: getXmlValue(invXml, "partId") || "",
      quantityAvailable: parseInt(getXmlValue(invXml, "quantityAvailable") || "0"),
      attributeSelection: getXmlValue(invXml, "attributeSelection") || undefined,
      warehouseName: getXmlValue(invXml, "warehouseName") || "",
      postalCode: getXmlValue(invXml, "postalCode") || "",
    };
  });

  console.log(`✅ Found ${inventoryData.items.length} inventory entries`);

  return inventoryData;
}

/**
 * Fetches pricing for a specific part
 */
export async function fetchSanMarPricing(
  credentials: SanMarCredentials,
  partId: string
): Promise<SanMarPricingData> {
  console.log('💰 Fetching SanMar pricing:', partId);

  const soapBody = `<ns2:GetConfigurationAndPricingRequest xmlns:ns2="http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/SharedObjects/">
  <shar:wsVersion>1.0.0</shar:wsVersion>
  <shar:id>${credentials.username}</shar:id>
  <shar:password>${credentials.password}</shar:password>
  <shar:productId>${partId}</shar:productId>
  <shar:currency>USD</shar:currency>
  <shar:priceType>Customer</shar:priceType>
</ns2:GetConfigurationAndPricingRequest>`;

  const responseXml = await makeSanMarSOAPRequest(
    SANMAR_PROMOSTANDARDS_ENDPOINTS.pricing,
    "getConfigurationAndPricing",
    soapBody,
    credentials
  );

  // Parse pricing data
  const pricingData: SanMarPricingData = { parts: [] };
  const partPattern = /<Part>([\s\S]*?)<\/Part>/gi;
  const partMatches = getAllXmlMatches(responseXml, partPattern);

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

  console.log(`✅ Found pricing for ${pricingData.parts.length} parts`);

  return pricingData;
}

/**
 * Fetches media content (images) for a style
 */
export async function fetchSanMarMedia(
  credentials: SanMarCredentials,
  styleNumber: string,
  partId?: string
): Promise<SanMarMediaData> {
  console.log('🖼️ Fetching SanMar media:', styleNumber, partId || '(all)');

  const soapBody = `<ns2:GetMediaContentRequest xmlns:ns2="http://www.promostandards.org/WSDL/MediaService/1.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/MediaService/1.0.0/SharedObjects/">
  <shar:wsVersion>1.0.0</shar:wsVersion>
  <shar:id>${credentials.username}</shar:id>
  <shar:password>${credentials.password}</shar:password>
  <shar:mediaType>Image</shar:mediaType>
  <shar:productId>${styleNumber}</shar:productId>${partId ? `
  <shar:partId>${partId}</shar:partId>` : ''}
</ns2:GetMediaContentRequest>`;

  const responseXml = await makeSanMarSOAPRequest(
    SANMAR_PROMOSTANDARDS_ENDPOINTS.media,
    "getMediaContent",
    soapBody,
    credentials
  );

  // Parse media content
  const mediaData: SanMarMediaData = {
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

  const mediaPattern = /<MediaContent>([\s\S]*?)<\/MediaContent>/gi;
  const mediaMatches = getAllXmlMatches(responseXml, mediaPattern);

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

  // Categorize images by view type
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

  console.log(`✅ Found ${mediaData.images.length} images`);

  return mediaData;
}

/**
 * Fetches all product data in parallel (unified call)
 *
 * @param credentials - SanMar username and password
 * @param request - Style number and optional part ID
 * @returns Unified response with style, inventory, pricing, and media data
 */
export async function fetchUnifiedSanMarData(
  credentials: SanMarCredentials,
  request: SanMarRequest
): Promise<SanMarUnifiedResponse> {
  const { styleNumber, partId } = request;

  console.log('🔄 Fetching unified SanMar data:', { styleNumber, partId });

  // Make all requests in parallel where possible
  const [productResult, inventoryResult, pricingResult, mediaResult] = await Promise.allSettled([
    // 1. Product Data (always fetch)
    fetchSanMarProductData(credentials, styleNumber),
    // 2. Inventory (only if partId provided)
    partId ? fetchSanMarInventory(credentials, partId) : Promise.resolve({ items: [] }),
    // 3. Pricing (only if partId provided)
    partId ? fetchSanMarPricing(credentials, partId) : Promise.resolve({ parts: [] }),
    // 4. Media Content (always fetch)
    fetchSanMarMedia(credentials, styleNumber, partId),
  ]);

  console.log('📊 SanMar API Results:', {
    product: productResult.status,
    inventory: inventoryResult.status,
    pricing: pricingResult.status,
    media: mediaResult.status,
  });

  // Check if product data fetch failed (this is critical - can't proceed without it)
  if (productResult.status === 'rejected') {
    console.error('❌ SanMar Product fetch failed:', productResult.reason);
    throw new Error(`SanMar: ${productResult.reason?.message || 'Product not found'}`);
  }

  const style = productResult.value;

  // Check if product has no parts/colors (means product doesn't exist)
  if (!style.parts || style.parts.length === 0) {
    console.warn(`⚠️ SanMar: Style ${styleNumber} returned no parts/colors`);
    throw new Error(`SanMar: Style ${styleNumber} not found or has no variants`);
  }

  const inventory = inventoryResult.status === 'fulfilled'
    ? inventoryResult.value
    : { items: [] };

  const pricing = pricingResult.status === 'fulfilled'
    ? pricingResult.value
    : { parts: [] };

  const media = mediaResult.status === 'fulfilled'
    ? mediaResult.value
    : {
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

  console.log(`✅ SanMar: Successfully fetched ${style.parts.length} parts for ${styleNumber}`);

  return {
    success: true,
    styleNumber,
    partId: partId || null,
    style,
    inventory,
    pricing,
    media,
  };
}
