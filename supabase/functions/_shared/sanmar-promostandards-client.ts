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
  productData: "https://ws.sanmar.com:8080/promostandards/ProductDataServiceBindingV2",
  media: "https://ws.sanmar.com:8080/promostandards/MediaContentServiceBinding",
  inventory: "https://ws.sanmar.com:8080/promostandards/InventoryServiceBindingV2",
  pricing: "https://ws.sanmar.com:8080/promostandards/PricingAndConfigurationServiceBinding",
  orderStatus: "https://ws.sanmar.com:8080/promostandards/OrderStatusServiceBindingV2",
  shipment: "https://ws.sanmar.com:8080/promostandards/ShipmentNotificationServiceBindingV1",
};

export interface SanMarCredentials {
  id: string;       // SanMar.com username
  password: string; // SanMar.com password
  fobId?: string;   // FOB warehouse ID
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

const SANMAR_CATALOG_CDN = "https://cdnm.sanmar.com/catalog/images";

function rewriteSanMarImageUrl(url: string): string {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith("/imglib/")) {
      const filename = parsed.pathname.split("/").pop() || "";
      if (filename) {
        return `${SANMAR_CATALOG_CDN}/${filename}`;
      }
    }
  } catch {
    // not a valid URL
  }
  return url;
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

    console.error(`🚨 PromoStandards error code=${code}, message="${message}"`);

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
        console.error(`🚨 Non-standard PromoStandards error code ${code}: "${message}"`);
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
  maxRetries = 1,
  skipErrorCheck = false
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

      if (!skipErrorCheck && (responseText.includes('<faultcode>') || responseText.includes('<errorCode>'))) {
        console.log(`🚨 SOAP Fault detected in response`);
        console.log(`🚨 Response body (first 1000 chars): ${responseText.substring(0, 1000)}`);
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

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function getXmlValue(xmlText: string, tagName: string): string | null {
  const regex = new RegExp(`<(?:[^:>]*:)?${tagName}(?:\\s[^>]*)?>([^<]*)<\\/(?:[^:>]*:)?${tagName}>`, 'i');
  const match = xmlText.match(regex);
  return match ? decodeXmlEntities(match[1].trim()) : null;
}

function nsElementPattern(tagName: string): RegExp {
  return new RegExp(`<(?:[^:>]*:)?${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[^:>]*:)?${tagName}>`, 'gi');
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
 * Fetches product data using PromoStandards Product Data Service V2.0.0
 */
export async function fetchSanMarProductData(
  credentials: SanMarCredentials,
  styleNumber: string
): Promise<SanMarStyleData> {
  // SanMar style numbers are case-sensitive and must be uppercase
  const normalizedStyle = styleNumber.toUpperCase().trim();
  console.log('🔍 Fetching SanMar product data:', normalizedStyle);

  const payload = `<shar:localizationCountry>US</shar:localizationCountry>
      <shar:localizationLanguage>en</shar:localizationLanguage>
      <shar:productId>${normalizedStyle}</shar:productId>`;

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

  console.log(`📄 Response XML length: ${responseXml.length}`);

  const partPattern = nsElementPattern("ProductPart");
  const partMatches = getAllXmlMatches(responseXml, partPattern);
  console.log(`📄 ProductPart matches found: ${partMatches.length}`);

  if (partMatches.length > 0) {
    console.log(`📄 First ProductPart sample (500 chars): ${partMatches[0][1].substring(0, 500)}`);
  }

  if (partMatches.length === 0) {
    const arrayPattern = nsElementPattern("ProductPartArray");
    const arrayMatches = getAllXmlMatches(responseXml, arrayPattern);
    console.log(`📄 ProductPartArray matches: ${arrayMatches.length}`);
    if (arrayMatches.length > 0) {
      console.log(`📄 ProductPartArray sample (500 chars): ${arrayMatches[0][1].substring(0, 500)}`);
    }
  }

  styleData.parts = partMatches.map(match => {
    const partXml = match[1];

    const standardColor = getXmlValue(partXml, "standardColorName") || "";

    let vendorColor = "";
    const colorArrayMatch = partXml.match(/<(?:[^:>]*:)?ColorArray(?:\s[^>]*)?>[\s\S]*?<\/(?:[^:>]*:)?ColorArray>/i);
    if (colorArrayMatch) {
      vendorColor = getXmlValue(colorArrayMatch[0], "colorName") || "";
    }

    return {
      partId: getXmlValue(partXml, "partId") || "",
      colorName: standardColor || vendorColor || getXmlValue(partXml, "colorName") || "",
      labelSize: getXmlValue(partXml, "labelSize") || "",
      hex: getXmlValue(partXml, "hex") || "",
      approximatePmsColor: getXmlValue(partXml, "approximatePms") || getXmlValue(partXml, "approximatePmsColor") || "",
    };
  });

  const colorMap = new Map<string, { colorName: string; hex: string; approximatePmsColor: string; partIds: { partId: string; size: string }[] }>();
  styleData.parts.forEach((part) => {
    if (!colorMap.has(part.colorName)) {
      colorMap.set(part.colorName, {
        colorName: part.colorName,
        hex: part.hex,
        approximatePmsColor: part.approximatePmsColor,
        partIds: []
      });
    }
    colorMap.get(part.colorName)!.partIds.push({
      partId: part.partId,
      size: part.labelSize
    });
  });

  styleData.colors = Array.from(colorMap.values());

  console.log(`✅ Found ${styleData.parts.length} parts, ${styleData.colors.length} colors`);
  if (styleData.parts.length > 0) {
    const sampleParts = styleData.parts.slice(0, 3);
    console.log(`📄 Sample parsed parts: ${JSON.stringify(sampleParts)}`);
  }

  const allColorNameRegex = /<(?:[^:>]*:)?colorName(?:\s[^>]*)?>([^<]*)<\/(?:[^:>]*:)?colorName>/gi;
  const allXmlColorNames: string[] = [];
  let colorNameMatch;
  while ((colorNameMatch = allColorNameRegex.exec(responseXml)) !== null) {
    allXmlColorNames.push(colorNameMatch[1].trim());
  }
  const uniqueXmlColors = [...new Set(allXmlColorNames)];

  const sampleIndices = [0, 12, 24, 36, partMatches.length - 1].filter(i => i >= 0 && i < partMatches.length);
  const matchSamples = sampleIndices.map(idx => {
    const m = partMatches[idx];
    if (!m) return null;
    return {
      index: idx,
      matchPosition: m.index,
      contentLength: m[1]?.length || 0,
      contentPreview: m[1]?.substring(0, 600) || '',
      extractedPartId: getXmlValue(m[1] || '', "partId"),
      extractedColorName: getXmlValue(m[1] || '', "colorName"),
      extractedLabelSize: getXmlValue(m[1] || '', "labelSize"),
    };
  }).filter(Boolean);

  (styleData as any)._debug = {
    xmlLength: responseXml.length,
    xmlPreview: responseXml.substring(0, 1500),
    productPartMatches: partMatches.length,
    matchSamples,
    allColorNamesCountInXml: allXmlColorNames.length,
    uniqueColorsInEntireXml: uniqueXmlColors.slice(0, 30),
    sampleParts: styleData.parts.slice(0, 3),
    uniqueParsedColors: [...new Set(styleData.parts.map(p => p.colorName))].slice(0, 10),
    uniqueSizes: [...new Set(styleData.parts.map(p => p.labelSize))],
  };

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

  const payload = `<shar:productId>${partId}</shar:productId>
      <shar:localizationCountry>US</shar:localizationCountry>
      <shar:localizationLanguage>en</shar:localizationLanguage>`;

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
  const inventoryPattern = nsElementPattern("Inventory");
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
 *
 * CRITICAL: SanMar's Pricing API expects STYLE NUMBERS (e.g., "PC147"), NOT partIds (e.g., "637711")
 * Using partIds will result in 404 errors.
 */
export async function fetchSanMarPricing(
  credentials: SanMarCredentials,
  styleNumber: string
): Promise<SanMarPricingData> {
  const normalizedStyle = styleNumber.toUpperCase().trim();
  console.log('💰 Fetching SanMar pricing for style:', normalizedStyle);

  const fobId = credentials.fobId || '1';
  const payload = `<shar:productId>${normalizedStyle}</shar:productId>
      <shar:currency>USD</shar:currency>
      <shar:fobId>${fobId}</shar:fobId>
      <shar:priceType>Net</shar:priceType>
      <shar:localizationCountry>US</shar:localizationCountry>
      <shar:localizationLanguage>en</shar:localizationLanguage>
      <shar:configurationType>Blank</shar:configurationType>`;

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
  const pricingPartPattern = nsElementPattern("Part");
  const partMatches = getAllXmlMatches(responseXml, pricingPartPattern);

  pricingData.parts = partMatches.map(match => {
    const partXml = match[1];
    const pricePattern = nsElementPattern("PartPrice");
    let priceMatches = getAllXmlMatches(partXml, pricePattern);
    if (priceMatches.length === 0) {
      const fallbackPattern = nsElementPattern("Price");
      priceMatches = getAllXmlMatches(partXml, fallbackPattern);
    }

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
  console.log(`💰 Pricing response XML length: ${responseXml.length}`);
  console.log(`💰 Pricing response preview (2000 chars): ${responseXml.substring(0, 2000)}`);
  if (pricingData.parts.length > 0) {
    console.log(`💰 Sample pricing part: ${JSON.stringify(pricingData.parts[0])}`);
  } else {
    console.log(`💰 No pricing parts parsed. Checking for alternative XML structures...`);
    const partArrayPattern = nsElementPattern("PartArray");
    const partArrayMatches = getAllXmlMatches(responseXml, partArrayPattern);
    console.log(`💰 PartArray matches: ${partArrayMatches.length}`);
    const configPattern = nsElementPattern("Configuration");
    const configMatches = getAllXmlMatches(responseXml, configPattern);
    console.log(`💰 Configuration matches: ${configMatches.length}`);
    if (configMatches.length > 0) {
      console.log(`💰 First Configuration preview (500 chars): ${configMatches[0][1].substring(0, 500)}`);
    }
  }

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

  validateCredentials(credentials);

  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope
  xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:ns="http://www.promostandards.org/WSDL/MediaService/1.0.0/"
  xmlns:shar="http://www.promostandards.org/WSDL/MediaService/1.0.0/SharedObjects/">
  <soapenv:Header/>
  <soapenv:Body>
    <ns:getMediaContentRequest>
      <shar:wsVersion>1.1.0</shar:wsVersion>
      <shar:id>${escapeXml(credentials.id)}</shar:id>
      <shar:password>${escapeXml(credentials.password)}</shar:password>
      <shar:cultureName>en-US</shar:cultureName>
      <shar:mediaType>Image</shar:mediaType>
      <shar:productId>${escapeXml(normalizedStyle)}</shar:productId>
    </ns:getMediaContentRequest>
  </soapenv:Body>
</soapenv:Envelope>`;

  const responseXml = await callPromoStandardsService(
    SANMAR_PROMOSTANDARDS_ENDPOINTS.media,
    'getMediaContent',
    soapEnvelope,
    1,
    true
  );

  console.log(`[SanMar Media] Response XML length: ${responseXml.length}`);
  console.log(`[SanMar Media] Response preview (2000 chars): ${responseXml.substring(0, 2000)}`);

  const mediaErrorCode = getXmlValue(responseXml, "errorCode");
  const mediaErrorMessage = getXmlValue(responseXml, "errorMessage");
  if (mediaErrorCode) {
    console.warn(`[SanMar Media] API returned error code ${mediaErrorCode}: ${mediaErrorMessage || 'unknown'}`);
  }

  const serviceExceptionMatch = responseXml.match(/<(?:[^:>]*:)?serviceException(?:\s[^>]*)?>[\s\S]*?<\/(?:[^:>]*:)?serviceException>/i);
  if (serviceExceptionMatch) {
    console.warn(`[SanMar Media] serviceException found: ${serviceExceptionMatch[0].substring(0, 500)}`);
  }

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

  const mediaPattern = nsElementPattern("MediaContent");
  const mediaMatches = getAllXmlMatches(responseXml, mediaPattern);

  mediaData.images = mediaMatches.map(match => {
    const mediaXml = match[1];
    const rawUrl = getXmlValue(mediaXml, "url") || "";
    return {
      url: rewriteSanMarImageUrl(rawUrl),
      productId: getXmlValue(mediaXml, "productId") || "",
      partId: getXmlValue(mediaXml, "partId") || "",
      classTypeName: getXmlValue(mediaXml, "classTypeName") || getXmlValue(mediaXml, "view") || "",
      color: getXmlValue(mediaXml, "color") || "",
      singlePart: getXmlValue(mediaXml, "singlePart") === "true",
    };
  });

  const frontImages: string[] = [];
  const rearImages: string[] = [];
  const sideImages: string[] = [];
  const lifestyleImages: string[] = [];
  const otherImages: string[] = [];

  function classifyView(classTypeName: string, url: string): string {
    const label = classTypeName.toLowerCase();
    const urlLower = url.toLowerCase();
    if (/front|fm/.test(label) || /_fm[._]/.test(urlLower)) return 'front';
    if (/rear|back|bk/.test(label) || /_bk[._]/.test(urlLower)) return 'back';
    if (/side|profile|sleeve/.test(label) || /_sd[._]/.test(urlLower)) return 'side';
    if (/lifestyle|casual/.test(label)) return 'lifestyle';
    if (/swatch/.test(label)) return 'swatch';
    return 'other';
  }

  mediaData.images.forEach((img) => {
    if (!img.url) return;
    const category = classifyView(img.classTypeName, img.url);
    if (category === 'front') frontImages.push(img.url);
    else if (category === 'back') rearImages.push(img.url);
    else if (category === 'side') sideImages.push(img.url);
    else if (category === 'lifestyle') lifestyleImages.push(img.url);
    else if (category !== 'swatch') otherImages.push(img.url);
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

  console.log(`[SanMar Media] MediaContent matches found: ${mediaMatches.length}`);
  if (mediaMatches.length === 0) {
    console.warn(`[SanMar Media] Zero MediaContent elements parsed from response for ${normalizedStyle}`);
    const mediaContentArrayMatch = responseXml.match(/<(?:[^:>]*:)?MediaContentArray(?:\s[^>]*)?>[\s\S]*?<\/(?:[^:>]*:)?MediaContentArray>/i);
    if (mediaContentArrayMatch) {
      console.log(`[SanMar Media] MediaContentArray found but no MediaContent children. Sample: ${mediaContentArrayMatch[0].substring(0, 500)}`);
    } else {
      console.log(`[SanMar Media] No MediaContentArray element found in response at all`);
    }
  } else {
    console.log(`[SanMar Media] First MediaContent sample: ${mediaMatches[0][1].substring(0, 300)}`);
  }

  console.log(`[SanMar Media] Found ${mediaData.images.length} images for ${normalizedStyle}`);

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
  const styleNumber = request.styleNumber.toUpperCase().trim();

  console.log('🔄 Fetching unified SanMar data:', { styleNumber, partId });

  const [productResult, mediaResult] = await Promise.allSettled([
    fetchSanMarProductData(credentials, styleNumber),
    fetchSanMarMedia(credentials, styleNumber, partId),
  ]);

  if (productResult.status === 'rejected') {
    console.error('❌ SanMar Product fetch failed:', productResult.reason);
    throw new Error(`SanMar: ${productResult.reason?.message || 'Product not found'}`);
  }

  const style = productResult.value;

  if (!style.parts || style.parts.length === 0) {
    console.warn(`⚠️ SanMar: Style ${styleNumber} returned no parts/colors`);
    throw new Error(`SanMar: Style ${styleNumber} not found or has no variants`);
  }

  let inventory: SanMarInventoryData = { items: [] };
  let pricing: SanMarPricingData = { parts: [] };

  // Fetch pricing for the style (pricing uses style number, not partIds)
  // Pricing failures should not block the rest of the data
  const pricingResult = await Promise.allSettled([
    fetchSanMarPricing(credentials, styleNumber)
  ]);

  if (pricingResult[0].status === 'fulfilled') {
    pricing = pricingResult[0].value;
    console.log(`✅ Pricing loaded successfully: ${pricing.parts.length} parts`);
  } else {
    console.warn(`⚠️ Pricing unavailable for ${styleNumber}:`, pricingResult[0].reason?.message);
    console.log('📦 Continuing without pricing data - images and product info still available');
  }

  // Fetch inventory only if a specific partId was requested
  if (partId) {
    const inventoryResult = await Promise.allSettled([
      fetchSanMarInventory(credentials, partId)
    ]);

    if (inventoryResult[0].status === 'fulfilled') {
      inventory = inventoryResult[0].value;
      console.log(`✅ Inventory loaded: ${inventory.items.length} items`);
    } else {
      console.warn(`⚠️ Inventory unavailable for ${partId}:`, inventoryResult[0].reason?.message);
    }
  }

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

    const payload = `<shar:localizationCountry>US</shar:localizationCountry>
      <shar:localizationLanguage>en</shar:localizationLanguage>
      <shar:productId>PC54</shar:productId>`;

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
