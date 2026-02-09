/**
 * SanMar PromoStandards SOAP Client
 *
 * Handles all SOAP requests to SanMar's PromoStandards Web Services
 * - Builds SOAP envelopes dynamically
 * - Parses XML responses to JSON
 * - Implements retry logic with exponential backoff
 * - Routes requests to correct endpoints based on service type
 */

interface SanMarCredentials {
  username: string;
  password: string;
}

interface CallServiceOptions {
  serviceType: 'ProductData' | 'MediaContent' | 'Inventory' | 'Pricing';
  operation: string;
  payload: Record<string, any>;
  credentials: SanMarCredentials;
}

interface ServiceResponse {
  success: boolean;
  data?: any;
  error?: string;
  duration: number;
  attempt: number;
}

interface SoapFault {
  faultcode: string;
  faultstring: string;
  detail?: any;
}

const SERVICE_URLS: Record<string, string> = {
  ProductData: import.meta.env.VITE_SANMAR_PRODUCT_DATA_URL || '',
  MediaContent: import.meta.env.VITE_SANMAR_MEDIA_CONTENT_URL || '',
  Inventory: import.meta.env.VITE_SANMAR_INVENTORY_URL || '',
  Pricing: import.meta.env.VITE_SANMAR_PRICING_URL || '',
};

const NAMESPACES = {
  soap: 'http://schemas.xmlsoap.org/soap/envelope/',
  ns: 'http://www.promostandards.org/WSDL/PricingAndConfiguration/2.0.0/',
  inv: 'http://www.promostandards.org/WSDL/Inventory/2.0.0/',
  prod: 'http://www.promostandards.org/WSDL/ProductDataService/2.0.0/',
  media: 'http://www.promostandards.org/WSDL/MediaService/1.0.0/',
};

const MAX_RETRIES = 3;
const BASE_DELAY = 1000;

/**
 * Main entry point for calling SanMar PromoStandards services
 */
export async function callService(options: CallServiceOptions): Promise<ServiceResponse> {
  const { serviceType, operation, payload, credentials } = options;

  const startTime = Date.now();
  let lastError: string = '';

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[SanMar] Calling ${serviceType}.${operation} (attempt ${attempt}/${MAX_RETRIES})`);

      const url = getServiceUrl(serviceType);
      if (!url) {
        throw new Error(`Service URL not configured for ${serviceType}`);
      }

      const envelope = buildEnvelope(serviceType, operation, payload, credentials);
      const response = await makeRequest(url, envelope, serviceType, operation);

      const duration = Date.now() - startTime;

      if (response.success) {
        console.log(`[SanMar] ${serviceType}.${operation} succeeded in ${duration}ms`);
        return {
          success: true,
          data: response.data,
          duration,
          attempt,
        };
      } else {
        lastError = response.error || 'Unknown error';

        if (shouldRetry(lastError, attempt)) {
          const delay = calculateBackoff(attempt);
          console.log(`[SanMar] ${serviceType}.${operation} failed, retrying in ${delay}ms...`);
          await sleep(delay);
          continue;
        } else {
          console.error(`[SanMar] ${serviceType}.${operation} failed (non-retryable): ${lastError}`);
          return {
            success: false,
            error: lastError,
            duration: Date.now() - startTime,
            attempt,
          };
        }
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Request failed';
      console.error(`[SanMar] ${serviceType}.${operation} error:`, error);

      if (attempt < MAX_RETRIES) {
        const delay = calculateBackoff(attempt);
        console.log(`[SanMar] Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  const duration = Date.now() - startTime;
  console.error(`[SanMar] ${serviceType}.${operation} failed after ${MAX_RETRIES} attempts`);

  return {
    success: false,
    error: lastError || 'Maximum retry attempts exceeded',
    duration,
    attempt: MAX_RETRIES,
  };
}

/**
 * Get the service URL from environment variables
 */
function getServiceUrl(serviceType: string): string {
  return SERVICE_URLS[serviceType] || '';
}

/**
 * Build SOAP envelope for the request
 */
function buildEnvelope(
  serviceType: string,
  operation: string,
  payload: Record<string, any>,
  credentials: SanMarCredentials
): string {
  const namespace = getNamespaceForService(serviceType);

  let bodyContent = '';

  switch (serviceType) {
    case 'ProductData':
      bodyContent = buildProductDataBody(operation, payload, credentials);
      break;
    case 'MediaContent':
      bodyContent = buildMediaContentBody(operation, payload, credentials);
      break;
    case 'Inventory':
      bodyContent = buildInventoryBody(operation, payload, credentials);
      break;
    case 'Pricing':
      bodyContent = buildPricingBody(operation, payload, credentials);
      break;
    default:
      throw new Error(`Unknown service type: ${serviceType}`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="${NAMESPACES.soap}" xmlns:ns="${namespace}">
  <soap:Body>
    ${bodyContent}
  </soap:Body>
</soap:Envelope>`;
}

/**
 * Build ProductData service body
 */
function buildProductDataBody(
  operation: string,
  payload: Record<string, any>,
  credentials: SanMarCredentials
): string {
  const { productId, localizationCountry, localizationLanguage } = payload;

  if (operation === 'getProduct') {
    return `<ns:GetProductRequest>
      <ns:wsVersion>2.0.0</ns:wsVersion>
      <ns:id>${credentials.username}</ns:id>
      <ns:password>${escapeXml(credentials.password)}</ns:password>
      <ns:productId>${escapeXml(productId)}</ns:productId>
      <ns:localizationCountry>${localizationCountry || 'US'}</ns:localizationCountry>
      <ns:localizationLanguage>${localizationLanguage || 'en'}</ns:localizationLanguage>
    </ns:GetProductRequest>`;
  }

  throw new Error(`Unknown ProductData operation: ${operation}`);
}

/**
 * Build MediaContent service body
 */
function buildMediaContentBody(
  operation: string,
  payload: Record<string, any>,
  credentials: SanMarCredentials
): string {
  const { productId, localizationCountry, localizationLanguage, partId } = payload;

  if (operation === 'getMediaContent') {
    let body = `<ns:GetMediaContentRequest>
      <ns:wsVersion>1.0.0</ns:wsVersion>
      <ns:id>${credentials.username}</ns:id>
      <ns:password>${escapeXml(credentials.password)}</ns:password>
      <ns:productId>${escapeXml(productId)}</ns:productId>
      <ns:localizationCountry>${localizationCountry || 'US'}</ns:localizationCountry>
      <ns:localizationLanguage>${localizationLanguage || 'en'}</ns:localizationLanguage>`;

    if (partId) {
      body += `\n      <ns:partId>${escapeXml(partId)}</ns:partId>`;
    }

    body += `\n    </ns:GetMediaContentRequest>`;
    return body;
  }

  throw new Error(`Unknown MediaContent operation: ${operation}`);
}

/**
 * Build Inventory service body
 */
function buildInventoryBody(
  operation: string,
  payload: Record<string, any>,
  credentials: SanMarCredentials
): string {
  const { productId, localizationCountry, localizationLanguage } = payload;

  if (operation === 'getInventoryLevels') {
    return `<ns:GetInventoryLevelsRequest>
      <ns:wsVersion>2.0.0</ns:wsVersion>
      <ns:id>${credentials.username}</ns:id>
      <ns:password>${escapeXml(credentials.password)}</ns:password>
      <ns:productId>${escapeXml(productId)}</ns:productId>
      <ns:localizationCountry>${localizationCountry || 'US'}</ns:localizationCountry>
      <ns:localizationLanguage>${localizationLanguage || 'en'}</ns:localizationLanguage>
    </ns:GetInventoryLevelsRequest>`;
  }

  throw new Error(`Unknown Inventory operation: ${operation}`);
}

/**
 * Build Pricing service body
 */
function buildPricingBody(
  operation: string,
  payload: Record<string, any>,
  credentials: SanMarCredentials
): string {
  const { productId, localizationCountry, localizationLanguage, currency, fobId, priceType } = payload;

  if (operation === 'getConfigurationAndPricing') {
    return `<ns:GetConfigurationAndPricingRequest>
      <ns:wsVersion>2.0.0</ns:wsVersion>
      <ns:id>${credentials.username}</ns:id>
      <ns:password>${escapeXml(credentials.password)}</ns:password>
      <ns:productId>${escapeXml(productId)}</ns:productId>
      <ns:localizationCountry>${localizationCountry || 'US'}</ns:localizationCountry>
      <ns:localizationLanguage>${localizationLanguage || 'en'}</ns:localizationLanguage>
      <ns:currency>${currency || 'USD'}</ns:currency>
      <ns:fobId>${fobId || ''}</ns:fobId>
      <ns:priceType>${priceType || 'Customer'}</ns:priceType>
    </ns:GetConfigurationAndPricingRequest>`;
  }

  throw new Error(`Unknown Pricing operation: ${operation}`);
}

/**
 * Make HTTP request to SOAP endpoint
 */
async function makeRequest(
  url: string,
  envelope: string,
  serviceType: string,
  operation: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': `"${operation}"`,
      },
      body: envelope,
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(`[SanMar] HTTP ${response.status}: ${responseText.substring(0, 500)}`);
      const fault = handleSoapFault(responseText);
      return {
        success: false,
        error: fault ? fault.faultstring : `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const parsedResponse = parseResponse(responseText, serviceType, operation);

    if (parsedResponse.error) {
      return {
        success: false,
        error: parsedResponse.error,
      };
    }

    return {
      success: true,
      data: parsedResponse.data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Request failed',
    };
  }
}

/**
 * Parse SOAP XML response into JSON
 */
function parseResponse(
  xml: string,
  serviceType: string,
  operation: string
): { data?: any; error?: string } {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xml, 'text/xml');

    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      return { error: `XML parse error: ${parseError.textContent}` };
    }

    const fault = handleSoapFault(xml);
    if (fault) {
      return { error: fault.faultstring };
    }

    const body = xmlDoc.querySelector('Body, body');
    if (!body) {
      return { error: 'No SOAP body found in response' };
    }

    switch (serviceType) {
      case 'ProductData':
        return parseProductDataResponse(body, operation);
      case 'MediaContent':
        return parseMediaContentResponse(body, operation);
      case 'Inventory':
        return parseInventoryResponse(body, operation);
      case 'Pricing':
        return parsePricingResponse(body, operation);
      default:
        return { error: `Unknown service type: ${serviceType}` };
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to parse response' };
  }
}

/**
 * Parse ProductData response
 */
function parseProductDataResponse(body: Element, operation: string): { data?: any; error?: string } {
  if (operation === 'getProduct') {
    const response = body.querySelector('GetProductResponse, getProductResponse');
    if (!response) {
      return { error: 'GetProductResponse not found' };
    }

    const errorMessage = getElementText(response, 'errorMessage');
    if (errorMessage) {
      return { error: errorMessage };
    }

    return {
      data: {
        productId: getElementText(response, 'productId'),
        productName: getElementText(response, 'productName'),
        description: getElementText(response, 'description'),
        priceType: getElementText(response, 'priceType'),
        parts: parseElements(response, 'PartArray > Part', parsePart),
      },
    };
  }

  return { error: `Unknown operation: ${operation}` };
}

/**
 * Parse MediaContent response
 */
function parseMediaContentResponse(body: Element, operation: string): { data?: any; error?: string } {
  if (operation === 'getMediaContent') {
    const response = body.querySelector('GetMediaContentResponse, getMediaContentResponse');
    if (!response) {
      return { error: 'GetMediaContentResponse not found' };
    }

    const errorMessage = getElementText(response, 'errorMessage');
    if (errorMessage) {
      return { error: errorMessage };
    }

    return {
      data: {
        productId: getElementText(response, 'productId'),
        mediaContent: parseElements(response, 'MediaContentArray > MediaContent', parseMediaContent),
      },
    };
  }

  return { error: `Unknown operation: ${operation}` };
}

/**
 * Parse Inventory response
 */
function parseInventoryResponse(body: Element, operation: string): { data?: any; error?: string } {
  if (operation === 'getInventoryLevels') {
    const response = body.querySelector('GetInventoryLevelsResponse, getInventoryLevelsResponse');
    if (!response) {
      return { error: 'GetInventoryLevelsResponse not found' };
    }

    const errorMessage = getElementText(response, 'errorMessage');
    if (errorMessage) {
      return { error: errorMessage };
    }

    return {
      data: {
        productId: getElementText(response, 'productId'),
        inventory: parseElements(response, 'InventoryArray > Inventory', parseInventoryItem),
      },
    };
  }

  return { error: `Unknown operation: ${operation}` };
}

/**
 * Parse Pricing response
 */
function parsePricingResponse(body: Element, operation: string): { data?: any; error?: string } {
  if (operation === 'getConfigurationAndPricing') {
    const response = body.querySelector('GetConfigurationAndPricingResponse, getConfigurationAndPricingResponse');
    if (!response) {
      return { error: 'GetConfigurationAndPricingResponse not found' };
    }

    const errorMessage = getElementText(response, 'errorMessage');
    if (errorMessage) {
      return { error: errorMessage };
    }

    return {
      data: {
        productId: getElementText(response, 'productId'),
        currency: getElementText(response, 'currency'),
        partArray: parseElements(response, 'PartArray > Part', parsePricingPart),
      },
    };
  }

  return { error: `Unknown operation: ${operation}` };
}

/**
 * Handle SOAP faults
 */
function handleSoapFault(xml: string): SoapFault | null {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xml, 'text/xml');

    const fault = xmlDoc.querySelector('Fault, fault');
    if (!fault) {
      return null;
    }

    return {
      faultcode: getElementText(fault, 'faultcode') || 'Unknown',
      faultstring: getElementText(fault, 'faultstring') || 'Unknown fault',
      detail: getElementText(fault, 'detail'),
    };
  } catch (error) {
    return null;
  }
}

/**
 * Helper: Parse Part element
 */
function parsePart(element: Element): any {
  return {
    partId: getElementText(element, 'partId'),
    color: getElementText(element, 'color'),
    colorName: getElementText(element, 'colorName'),
    size: getElementText(element, 'size'),
    labelSize: getElementText(element, 'labelSize'),
  };
}

/**
 * Helper: Parse MediaContent element
 */
function parseMediaContent(element: Element): any {
  return {
    productId: getElementText(element, 'productId'),
    partId: getElementText(element, 'partId'),
    url: getElementText(element, 'url'),
    mediaType: getElementText(element, 'mediaType'),
    fileType: getElementText(element, 'fileType'),
    description: getElementText(element, 'description'),
  };
}

/**
 * Helper: Parse Inventory element
 */
function parseInventoryItem(element: Element): any {
  return {
    partId: getElementText(element, 'partId'),
    quantityAvailable: parseFloat(getElementText(element, 'quantityAvailable') || '0'),
    attributeColor: getElementText(element, 'attributeColor'),
    attributeSize: getElementText(element, 'attributeSize'),
    labelSize: getElementText(element, 'labelSize'),
  };
}

/**
 * Helper: Parse Pricing Part element
 */
function parsePricingPart(element: Element): any {
  return {
    partId: getElementText(element, 'partId'),
    partDescription: getElementText(element, 'partDescription'),
    prices: parseElements(element, 'PartPriceArray > PartPrice', parsePriceBreak),
  };
}

/**
 * Helper: Parse PriceBreak element
 */
function parsePriceBreak(element: Element): any {
  return {
    minQuantity: parseInt(getElementText(element, 'minQuantity') || '0'),
    maxQuantity: parseInt(getElementText(element, 'maxQuantity') || '0'),
    price: parseFloat(getElementText(element, 'price') || '0'),
    discountCode: getElementText(element, 'discountCode'),
  };
}

/**
 * Helper: Get text content from element by tag name
 */
function getElementText(parent: Element, tagName: string): string {
  const element = parent.querySelector(tagName);
  return element?.textContent?.trim() || '';
}

/**
 * Helper: Parse multiple elements with a parser function
 */
function parseElements<T>(parent: Element, selector: string, parser: (el: Element) => T): T[] {
  const elements = parent.querySelectorAll(selector);
  return Array.from(elements).map(parser);
}

/**
 * Get namespace for service type
 */
function getNamespaceForService(serviceType: string): string {
  switch (serviceType) {
    case 'ProductData':
      return NAMESPACES.prod;
    case 'MediaContent':
      return NAMESPACES.media;
    case 'Inventory':
      return NAMESPACES.inv;
    case 'Pricing':
      return NAMESPACES.ns;
    default:
      return NAMESPACES.ns;
  }
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Calculate exponential backoff delay
 */
function calculateBackoff(attempt: number): number {
  return BASE_DELAY * Math.pow(2, attempt - 1);
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Determine if error is retryable
 */
function shouldRetry(error: string, attempt: number): boolean {
  if (attempt >= MAX_RETRIES) {
    return false;
  }

  const retryableErrors = [
    'timeout',
    'network',
    'connection',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'fetch failed',
  ];

  const errorLower = error.toLowerCase();
  return retryableErrors.some(keyword => errorLower.includes(keyword));
}

/**
 * Export helper to build credentials from company settings
 */
export interface CompanySettings {
  sanmar_promo_username: string;
  sanmar_promo_password_encrypted: string;
}

export async function getSanMarCredentials(
  companySettings: CompanySettings,
  decryptFunction: (encrypted: string) => Promise<string>
): Promise<SanMarCredentials> {
  const password = await decryptFunction(companySettings.sanmar_promo_password_encrypted);

  return {
    username: companySettings.sanmar_promo_username,
    password,
  };
}
