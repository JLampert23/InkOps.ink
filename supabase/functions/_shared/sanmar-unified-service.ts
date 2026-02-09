/**
 * SanMar Unified Service for Edge Functions
 *
 * Aggregates data from all SanMar PromoStandards services
 * Adapted for Deno runtime in Supabase Edge Functions
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

interface SanMarCredentials {
  username: string;
  password: string;
}

interface UnifiedGarment {
  vendor: string;
  style: string;
  color: string;
  size: string;
  product: {
    partId?: string;
    description?: string;
    gtin?: string;
    status?: string;
    features?: string[];
    category?: string;
    subcategory?: string;
    labelSize?: string;
    colorName?: string;
  };
  pricing: {
    piecePrice?: number;
    casePrice?: number;
    msrp?: number;
    mapPrice?: number;
    priceBreaks?: Array<{ quantity: number; price: number }>;
    currency?: string;
  };
  inventory: {
    totalAvailable: number;
    inventoryLevels: Array<{
      partId: string;
      warehouse: string;
      quantityAvailable: number;
      availableDate?: string;
      leadTime?: number;
    }>;
  };
  media: {
    frontModel?: string;
    backModel?: string;
    frontFlat?: string;
    backFlat?: string;
    colorSwatch?: string;
    thumbnail?: string;
    specSheet?: string;
    measurementSheet?: string;
    additionalImages?: string[];
  };
  lastUpdated: string;
}

interface UnifiedStyle {
  vendor: string;
  style: string;
  description: string;
  category: string;
  subcategory: string;
  status: string;
  features: string[];
  companionStyles: string[];
  variants: UnifiedGarment[];
  media: {
    frontModel?: string;
    backModel?: string;
    frontFlat?: string;
    backFlat?: string;
    thumbnail?: string;
    specSheet?: string;
    measurementSheet?: string;
    additionalImages?: string[];
  };
  lastUpdated: string;
}

const SANMAR_ENDPOINTS = {
  productData: "https://psws.sanmar.com/ProductDataService.svc",
  inventory: "https://psws.sanmar.com/InventoryService.svc",
  pricing: "https://psws.sanmar.com/PricingAndConfigurationService.svc",
  media: "https://psws.sanmar.com/MediaContentService.svc",
};

/**
 * Get SanMar credentials from company settings
 */
async function getSanMarCredentials(companyId: string): Promise<SanMarCredentials> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data, error } = await supabase
    .from('company_settings')
    .select('sanmar_account_number, sanmar_password')
    .eq('id', companyId)
    .maybeSingle();

  if (error || !data?.sanmar_account_number || !data?.sanmar_password) {
    throw new Error('SanMar credentials not configured');
  }

  return {
    username: data.sanmar_account_number,
    password: data.sanmar_password,
  };
}

/**
 * Call SanMar PromoStandards SOAP service
 */
async function callPromoStandards(
  endpoint: string,
  operation: string,
  payload: Record<string, any>,
  credentials: SanMarCredentials
): Promise<any> {
  const soapEnvelope = buildSOAPEnvelope(operation, payload, credentials);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': operation,
    },
    body: soapEnvelope,
  });

  if (!response.ok) {
    throw new Error(`PromoStandards error: ${response.statusText}`);
  }

  const xmlText = await response.text();
  return parseSOAPResponse(xmlText);
}

/**
 * Build SOAP envelope for PromoStandards request
 */
function buildSOAPEnvelope(
  operation: string,
  payload: Record<string, any>,
  credentials: SanMarCredentials
): string {
  const payloadXML = Object.entries(payload)
    .map(([key, value]) => `<${key}>${value}</${key}>`)
    .join('');

  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Header>
    <wsUserId xmlns="http://www.promostandards.org/WSDL/Authentication/1.0.0/">
      <username>${credentials.username}</username>
      <password>${credentials.password}</password>
    </wsUserId>
  </soap:Header>
  <soap:Body>
    <${operation} xmlns="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/">
      ${payloadXML}
    </${operation}>
  </soap:Body>
</soap:Envelope>`;
}

/**
 * Parse SOAP XML response to JSON
 */
function parseSOAPResponse(xml: string): any {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');

  const result: any = {};
  const walk = (node: Element, obj: any) => {
    for (const child of Array.from(node.children)) {
      const tagName = child.tagName.replace(/.*:/, '');

      if (child.children.length === 0) {
        obj[tagName] = child.textContent;
      } else {
        if (!obj[tagName]) {
          obj[tagName] = child.children.length === 1 ? {} : [];
        }

        if (Array.isArray(obj[tagName])) {
          const item = {};
          walk(child, item);
          obj[tagName].push(item);
        } else {
          walk(child, obj[tagName]);
        }
      }
    }
  };

  walk(doc.documentElement, result);
  return result;
}

/**
 * Get complete unified data for a specific garment SKU
 */
export async function getUnifiedGarment(
  style: string,
  color: string,
  size: string,
  companyId: string
): Promise<UnifiedGarment | null> {
  try {
    const credentials = await getSanMarCredentials(companyId);
    const partId = `${style}-${color}-${size}`;

    const [productData, pricingData, inventoryData, mediaData] = await Promise.allSettled([
      callPromoStandards(
        SANMAR_ENDPOINTS.productData,
        'getProduct',
        { productId: style },
        credentials
      ),
      callPromoStandards(
        SANMAR_ENDPOINTS.pricing,
        'getConfigurationAndPricing',
        { productId: style, partId },
        credentials
      ),
      callPromoStandards(
        SANMAR_ENDPOINTS.inventory,
        'getInventoryLevels',
        { productId: style, partId },
        credentials
      ),
      callPromoStandards(
        SANMAR_ENDPOINTS.media,
        'getMediaContent',
        { productId: style, partId },
        credentials
      ),
    ]);

    const product = productData.status === 'fulfilled' ? productData.value : null;
    const pricing = pricingData.status === 'fulfilled' ? pricingData.value : null;
    const inventory = inventoryData.status === 'fulfilled' ? inventoryData.value : null;
    const media = mediaData.status === 'fulfilled' ? mediaData.value : null;

    return {
      vendor: 'SanMar',
      style,
      color,
      size,
      product: {
        partId,
        description: product?.productName || product?.description,
        gtin: product?.gtin,
        status: product?.productStatus || 'Active',
        features: product?.features ? [product.features] : [],
        category: product?.productCategory,
        subcategory: product?.productSubcategory,
        labelSize: size,
        colorName: color,
      },
      pricing: {
        piecePrice: pricing?.price ? parseFloat(pricing.price) : undefined,
        casePrice: pricing?.casePrice ? parseFloat(pricing.casePrice) : undefined,
        msrp: pricing?.msrp ? parseFloat(pricing.msrp) : undefined,
        mapPrice: pricing?.mapPrice ? parseFloat(pricing.mapPrice) : undefined,
        priceBreaks: pricing?.priceBreaks || [],
        currency: 'USD',
      },
      inventory: {
        totalAvailable: inventory?.quantityAvailable ? parseInt(inventory.quantityAvailable) : 0,
        inventoryLevels: inventory?.items || [],
      },
      media: {
        frontModel: media?.frontModel,
        backModel: media?.backModel,
        frontFlat: media?.frontFlat,
        backFlat: media?.backFlat,
        colorSwatch: media?.colorSwatch,
        thumbnail: media?.thumbnail,
        specSheet: media?.specSheet,
        measurementSheet: media?.measurementSheet,
        additionalImages: media?.additionalImages || [],
      },
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`Error fetching unified garment for ${style}/${color}/${size}:`, error);
    return null;
  }
}

/**
 * Get complete unified data for all variants of a style
 */
export async function getUnifiedStyle(
  style: string,
  companyId: string
): Promise<UnifiedStyle | null> {
  try {
    const credentials = await getSanMarCredentials(companyId);

    const productData = await callPromoStandards(
      SANMAR_ENDPOINTS.productData,
      'getProduct',
      { productId: style },
      credentials
    );

    const variants: UnifiedGarment[] = [];

    if (productData?.parts && Array.isArray(productData.parts)) {
      for (const part of productData.parts) {
        const [pricingData, inventoryData, mediaData] = await Promise.allSettled([
          callPromoStandards(
            SANMAR_ENDPOINTS.pricing,
            'getConfigurationAndPricing',
            { productId: style, partId: part.partId },
            credentials
          ),
          callPromoStandards(
            SANMAR_ENDPOINTS.inventory,
            'getInventoryLevels',
            { productId: style, partId: part.partId },
            credentials
          ),
          callPromoStandards(
            SANMAR_ENDPOINTS.media,
            'getMediaContent',
            { productId: style, partId: part.partId },
            credentials
          ),
        ]);

        const pricing = pricingData.status === 'fulfilled' ? pricingData.value : null;
        const inventory = inventoryData.status === 'fulfilled' ? inventoryData.value : null;
        const media = mediaData.status === 'fulfilled' ? mediaData.value : null;

        variants.push({
          vendor: 'SanMar',
          style,
          color: part.colorName,
          size: part.labelSize,
          product: {
            partId: part.partId,
            description: productData.productName || productData.description,
            gtin: part.gtin,
            status: 'Active',
            features: productData.features ? [productData.features] : [],
            category: productData.productCategory,
            subcategory: productData.productSubcategory,
            labelSize: part.labelSize,
            colorName: part.colorName,
          },
          pricing: {
            piecePrice: pricing?.price ? parseFloat(pricing.price) : undefined,
            casePrice: pricing?.casePrice ? parseFloat(pricing.casePrice) : undefined,
            msrp: pricing?.msrp ? parseFloat(pricing.msrp) : undefined,
            mapPrice: pricing?.mapPrice ? parseFloat(pricing.mapPrice) : undefined,
            priceBreaks: pricing?.priceBreaks || [],
            currency: 'USD',
          },
          inventory: {
            totalAvailable: inventory?.quantityAvailable ? parseInt(inventory.quantityAvailable) : 0,
            inventoryLevels: inventory?.items || [],
          },
          media: {
            frontModel: media?.frontModel,
            backModel: media?.backModel,
            frontFlat: media?.frontFlat,
            backFlat: media?.backFlat,
            colorSwatch: media?.colorSwatch,
            thumbnail: media?.thumbnail,
            specSheet: media?.specSheet,
            measurementSheet: media?.measurementSheet,
            additionalImages: media?.additionalImages || [],
          },
          lastUpdated: new Date().toISOString(),
        });
      }
    }

    return {
      vendor: 'SanMar',
      style,
      description: productData?.productName || productData?.description || '',
      category: productData?.productCategory || '',
      subcategory: productData?.productSubcategory || '',
      status: productData?.productStatus || 'Active',
      features: productData?.features ? [productData.features] : [],
      companionStyles: productData?.companionStyles || [],
      variants,
      media: {
        frontModel: variants[0]?.media.frontModel,
        backModel: variants[0]?.media.backModel,
        frontFlat: variants[0]?.media.frontFlat,
        backFlat: variants[0]?.media.backFlat,
        thumbnail: variants[0]?.media.thumbnail,
        specSheet: variants[0]?.media.specSheet,
        measurementSheet: variants[0]?.media.measurementSheet,
        additionalImages: variants[0]?.media.additionalImages,
      },
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`Error fetching unified style for ${style}:`, error);
    return null;
  }
}

/**
 * Get pricing only for a garment
 */
export async function getGarmentPricing(
  style: string,
  color: string,
  size: string,
  companyId: string
): Promise<UnifiedGarment['pricing'] | null> {
  try {
    const credentials = await getSanMarCredentials(companyId);
    const partId = `${style}-${color}-${size}`;

    const pricingData = await callPromoStandards(
      SANMAR_ENDPOINTS.pricing,
      'getConfigurationAndPricing',
      { productId: style, partId },
      credentials
    );

    return {
      piecePrice: pricingData?.price ? parseFloat(pricingData.price) : undefined,
      casePrice: pricingData?.casePrice ? parseFloat(pricingData.casePrice) : undefined,
      msrp: pricingData?.msrp ? parseFloat(pricingData.msrp) : undefined,
      mapPrice: pricingData?.mapPrice ? parseFloat(pricingData.mapPrice) : undefined,
      priceBreaks: pricingData?.priceBreaks || [],
      currency: 'USD',
    };
  } catch (error) {
    console.error(`Error fetching pricing for ${style}/${color}/${size}:`, error);
    return null;
  }
}

/**
 * Get inventory only for a garment
 */
export async function getGarmentInventory(
  style: string,
  color: string,
  size: string,
  companyId: string
): Promise<UnifiedGarment['inventory'] | null> {
  try {
    const credentials = await getSanMarCredentials(companyId);
    const partId = `${style}-${color}-${size}`;

    const inventoryData = await callPromoStandards(
      SANMAR_ENDPOINTS.inventory,
      'getInventoryLevels',
      { productId: style, partId },
      credentials
    );

    return {
      totalAvailable: inventoryData?.quantityAvailable ? parseInt(inventoryData.quantityAvailable) : 0,
      inventoryLevels: inventoryData?.items || [],
    };
  } catch (error) {
    console.error(`Error fetching inventory for ${style}/${color}/${size}:`, error);
    return null;
  }
}

/**
 * Get available colors for a style
 */
export async function getAvailableColors(
  style: string,
  companyId: string
): Promise<string[]> {
  try {
    const credentials = await getSanMarCredentials(companyId);

    const productData = await callPromoStandards(
      SANMAR_ENDPOINTS.productData,
      'getProduct',
      { productId: style },
      credentials
    );

    if (!productData?.colors || !Array.isArray(productData.colors)) {
      return [];
    }

    return productData.colors.map((c: any) => c.colorName);
  } catch (error) {
    console.error(`Error fetching colors for ${style}:`, error);
    return [];
  }
}
