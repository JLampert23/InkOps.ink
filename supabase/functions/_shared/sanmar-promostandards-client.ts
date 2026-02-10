/**
 * SanMar PromoStandards SOAP Client (v24.2)
 *
 * Official SanMar PromoStandards Web Services implementation.
 * Uses ONLY PromoStandards authentication with id/password in SOAP body.
 *
 * CRITICAL: This module uses ONLY PromoStandards Web Services.
 * NO Standard Web Services. NO FTP. NO customer number authentication.
 *
 * Authentication:
 * - id = SanMar.com username
 * - password = SanMar.com password
 *
 * Endpoints (SanMar v24.2):
 * - Product Data V2.0.0
 * - Media Content V1.1.0
 * - Inventory V2.0.0
 * - Pricing & Configuration V1.0.0
 * - Order Status V2.0.0
 * - Shipment Notification V1.0.0
 */

const SANMAR_PROMOSTANDARDS_ENDPOINTS = {
  productData: "https://ws.sanmar.com:8080/promostandards/ProductDataServiceBindingV2?WSDL",
  media: "https://ws.sanmar.com:8080/promostandards/MediaContentServiceBindingV1?WSDL",
  inventory: "https://ws.sanmar.com:8080/promostandards/InventoryServiceBindingV2?WSDL",
  pricing: "https://ws.sanmar.com:8080/promostandards/PricingAndConfigurationServiceBindingV1?WSDL",
  orderStatus: "https://ws.sanmar.com:8080/promostandards/OrderStatusServiceBindingV2?WSDL",
  shipment: "https://ws.sanmar.com:8080/promostandards/ShipmentNotificationServiceBindingV1?WSDL",
};

export interface SanMarCredentials {
  id: string;       // SanMar.com username
  password: string; // SanMar.com password
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

export class PromoStandardsError extends Error {
  constructor(public code: number, message: string) {
    super(message);
    this.name = 'PromoStandardsError';
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function validateCredentials(credentials: SanMarCredentials): void {
  if (!credentials.id || !credentials.password) {
    throw new PromoStandardsError(110, 'Authentication required: id and password must be provided');
  }
}

/**
 * Builds PromoStandards SOAP envelope per SanMar v24.2 specification
 */
function buildSOAPEnvelope(
  service: string,
  version: string,
  operation: string,
  credentials: SanMarCredentials,
  payload: string
): string {
  validateCredentials(credentials);

  return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope
  xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:ns="http://www.promostandards.org/WSDL/${service}/${version}/"
  xmlns:shar="http://www.promostandards.org/WSDL/${service}/${version}/SharedObjects/">
  <soapenv:Header/>
  <soapenv:Body>
    <ns:${operation}Request>
      <shar:wsVersion>${version}</shar:wsVersion>
      <shar:id>${escapeXml(credentials.id)}</shar:id>
      <shar:password>${escapeXml(credentials.password)}</shar:password>
      <shar:localizationCountry>US</shar:localizationCountry>
      <shar:localizationLanguage>en</shar:localizationLanguage>
      ${payload}
    </ns:${operation}Request>
  </soapenv:Body>
</soapenv:Envelope>`;
}

/**
 * Parses PromoStandards error codes and throws appropriate errors
 */
function handlePromoStandardsError(xml: string): void {
  const errorCodeMatch = xml.match(/<errorCode>(\d+)<\/errorCode>/i);
  const errorMessageMatch = xml.match(/<errorMessage>([^<]+)<\/errorMessage>/i);

  if (errorCodeMatch) {
    const code = parseInt(errorCodeMatch[1]);
    const message = errorMessageMatch ? errorMessageMatch[1] : 'Unknown error';

    switch (code) {
      case 100:
        throw new PromoStandardsError(100, 'User not found');
      case 104:
        throw new PromoStandardsError(104, 'Account unauthorized for PromoStandards');
      case 105:
        throw new PromoStandardsError(105, 'Invalid username or password');
      case 110:
        throw new PromoStandardsError(110, 'Authentication required');
      default:
        throw new PromoStandardsError(code, message);
    }
  }
}

/**
 * Makes a SOAP request to SanMar PromoStandards API with retry logic
 */
async function callPromoStandardsService(
  wsdlUrl: string,
  soapAction: string,
  soapEnvelope: string,
  maxRetries = 1
): Promise<string> {
  const startTime = Date.now();
  const REQUEST_TIMEOUT_MS = 15000;

  console.log(`📡 PromoStandards Request: ${soapAction}`);
  console.log(`🔗 Endpoint: ${wsdlUrl}`);

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const response = await fetch(wsdlUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          "SOAPAction": soapAction,
        },
        body: soapEnvelope,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseText = await response.text();
      const duration = Date.now() - startTime;

      console.log(`⏱️  Duration: ${duration}ms | Status: ${response.status}`);

      // Check for SOAP faults or PromoStandards errors
      if (responseText.includes('<faultcode>') || responseText.includes('<errorCode>')) {
        console.log(`🚨 SOAP Fault detected in response`);
        handlePromoStandardsError(responseText);
      }

      if (!response.ok) {
        // Log the full response for debugging
        console.error(`❌ SanMar API returned error ${response.status}`);
        console.error(`Response body (first 500 chars):`, responseText.substring(0, 500));

        // Don't retry authentication errors (401, 403)
        if (response.status === 401 || response.status === 403) {
          throw new PromoStandardsError(105, 'Invalid username or password');
        }

        // Check if response contains a SOAP fault
        if (responseText.includes('<faultstring>')) {
          const faultMatch = responseText.match(/<faultstring>([^<]+)<\/faultstring>/);
          const faultString = faultMatch ? faultMatch[1] : 'Unknown SOAP fault';
          throw new Error(`SanMar SOAP Error: ${faultString}`);
        }

        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log(`✅ PromoStandards success: ${soapAction}`);
      return responseText;

    } catch (error: any) {
      lastError = error;

      // Don't retry authentication errors
      if (error instanceof PromoStandardsError && [100, 104, 105, 110].includes(error.code)) {
        throw error;
      }

      // Log retry attempt
      if (attempt < maxRetries) {
        console.warn(`⚠️  Attempt ${attempt} failed, retrying... ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
      }
    }
  }

  console.error(`❌ PromoStandards failed after ${maxRetries} attempts`);
  throw lastError || new Error('PromoStandards request failed');
}

/**
 * Extracts a single XML tag value
 */
function getXmlValue(xmlText: string, tagName: string): string | null {
  const regex = new RegExp(`<[^:]*:?${tagName}[^>]*>([^<]*)<\/[^:]*:?${tagName}>`, 'i');
  const match = xmlText.match(regex);
  return match ? match[1].trim() : null;
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
 * Fetches product data using PromoStandards Product Data Service V2.0.0
 */
export async function fetchSanMarProductData(
  credentials: SanMarCredentials,
  styleNumber: string
): Promise<SanMarStyleData> {
  // SanMar style numbers are case-sensitive and must be uppercase
  const normalizedStyle = styleNumber.toUpperCase().trim();
  console.log('🔍 Fetching SanMar product data:', normalizedStyle);

  const payload = `<shar:productId>${normalizedStyle}</shar:productId>`;

  const soapEnvelope = buildSOAPEnvelope(
    'ProductDataService',
    '2.0.0',
    'GetProduct',
    credentials,
    payload
  );

  const responseXml = await callPromoStandardsService(
    SANMAR_PROMOSTANDARDS_ENDPOINTS.productData,
    'getProduct',
    soapEnvelope
  );

  // Parse XML response
  const styleData: SanMarStyleData = {
    styleNumber: normalizedStyle,
    productName: getXmlValue(responseXml, "productName") || "",
    description: getXmlValue(responseXml, "description") || "",
    productBrand: getXmlValue(responseXml, "productBrand") || "",
    productCategory: getXmlValue(responseXml, "productCategory") || "",
    parts: [],
    colors: []
  };

  // Parse parts (handle namespaced tags like ns:Part or shar:Part)
  const partPattern = /<[^:]*:?Part[^>]*>([\s\S]*?)<\/[^:]*:?Part>/gi;
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
 * Fetches inventory using PromoStandards Inventory Service V2.0.0
 */
export async function fetchSanMarInventory(
  credentials: SanMarCredentials,
  partId: string
): Promise<SanMarInventoryData> {
  console.log('📦 Fetching SanMar inventory:', partId);

  const payload = `<shar:productId>${partId}</shar:productId>`;

  const soapEnvelope = buildSOAPEnvelope(
    'InventoryService',
    '2.0.0',
    'GetInventoryLevels',
    credentials,
    payload
  );

  const responseXml = await callPromoStandardsService(
    SANMAR_PROMOSTANDARDS_ENDPOINTS.inventory,
    'getInventoryLevels',
    soapEnvelope
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
 * Fetches pricing using PromoStandards Pricing & Configuration Service V1.0.0
 */
export async function fetchSanMarPricing(
  credentials: SanMarCredentials,
  partId: string
): Promise<SanMarPricingData> {
  console.log('💰 Fetching SanMar pricing:', partId);

  const payload = `<shar:productId>${partId}</shar:productId>
      <shar:currency>USD</shar:currency>
      <shar:priceType>Customer</shar:priceType>`;

  const soapEnvelope = buildSOAPEnvelope(
    'PricingAndConfiguration',
    '1.0.0',
    'GetConfigurationAndPricing',
    credentials,
    payload
  );

  const responseXml = await callPromoStandardsService(
    SANMAR_PROMOSTANDARDS_ENDPOINTS.pricing,
    'getConfigurationAndPricing',
    soapEnvelope
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
 * Fetches media content using PromoStandards Media Content Service V1.1.0
 */
export async function fetchSanMarMedia(
  credentials: SanMarCredentials,
  styleNumber: string,
  partId?: string
): Promise<SanMarMediaData> {
  // SanMar style numbers are case-sensitive and must be uppercase
  const normalizedStyle = styleNumber.toUpperCase().trim();
  console.log('🖼️ Fetching SanMar media:', normalizedStyle, partId || '(all)');

  const payload = `<shar:mediaType>Image</shar:mediaType>
      <shar:productId>${normalizedStyle}</shar:productId>${partId ? `
      <shar:partId>${partId}</shar:partId>` : ''}`;

  const soapEnvelope = buildSOAPEnvelope(
    'MediaService',
    '1.0.0',
    'GetMediaContent',
    credentials,
    payload
  );

  const responseXml = await callPromoStandardsService(
    SANMAR_PROMOSTANDARDS_ENDPOINTS.media,
    'getMediaContent',
    soapEnvelope
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
 */
export async function fetchUnifiedSanMarData(
  credentials: SanMarCredentials,
  request: SanMarRequest
): Promise<SanMarUnifiedResponse> {
  const { partId } = request;
  // SanMar style numbers are case-sensitive and must be uppercase
  const styleNumber = request.styleNumber.toUpperCase().trim();

  console.log('🔄 Fetching unified SanMar data:', { styleNumber, partId });

  // Make all requests in parallel where possible
  const [productResult, inventoryResult, pricingResult, mediaResult] = await Promise.allSettled([
    fetchSanMarProductData(credentials, styleNumber),
    partId ? fetchSanMarInventory(credentials, partId) : Promise.resolve({ items: [] }),
    partId ? fetchSanMarPricing(credentials, partId) : Promise.resolve({ parts: [] }),
    fetchSanMarMedia(credentials, styleNumber, partId),
  ]);

  console.log('📊 SanMar API Results:', {
    product: productResult.status,
    inventory: inventoryResult.status,
    pricing: pricingResult.status,
    media: mediaResult.status,
  });

  // Check if product data fetch failed (this is critical)
  if (productResult.status === 'rejected') {
    console.error('❌ SanMar Product fetch failed:', productResult.reason);
    throw new Error(`SanMar: ${productResult.reason?.message || 'Product not found'}`);
  }

  const style = productResult.value;

  // Check if product has no parts/colors
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

/**
 * Test function to verify authentication and connectivity
 * Makes a minimal SOAP request to check credentials
 */
export async function testSanMarConnection(credentials: SanMarCredentials): Promise<boolean> {
  try {
    console.log('🧪 Testing SanMar PromoStandards connection...');
    const startTime = Date.now();

    const payload = `<shar:productId>PC54</shar:productId>`;

    const soapEnvelope = buildSOAPEnvelope(
      'ProductDataService',
      '2.0.0',
      'GetProduct',
      credentials,
      payload
    );

    console.log(`📡 Sending SOAP request to: ${SANMAR_PROMOSTANDARDS_ENDPOINTS.productData}`);

    const responseText = await callPromoStandardsService(
      SANMAR_PROMOSTANDARDS_ENDPOINTS.productData,
      'getProduct',
      soapEnvelope,
      1
    );

    if (responseText.includes('GetProductResponse') || responseText.includes('productName')) {
      const totalTime = Date.now() - startTime;
      console.log(`✅ SanMar connection test successful! Total time: ${totalTime}ms`);
      return true;
    }

    console.warn('⚠️ Unexpected response from SanMar API');
    console.warn(`Response preview: ${responseText.substring(0, 500)}`);
    return false;

  } catch (error: any) {
    console.error('❌ SanMar connection test failed:', error.message);
    throw error;
  }
}
