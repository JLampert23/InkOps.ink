import { supabase } from '../lib/supabase-client';

export interface SSPricingRecord {
  vendor: string;
  style_id: string;
  part_id: string;
  color: string | null;
  size: string | null;
  warehouse: string;
  piece_price: number;
  currency: string;
  effective_date: string | null;
  expires: string | null;
}

const FOB_WAREHOUSES = ['IL', 'NJ', 'KS', 'TX', 'GA', 'NV', 'DS'];

const PROMOSTANDARDS_PRICING_ENDPOINT =
  'https://promostandards.ssactivewear.com/pricingandconfiguration/v1/pricingandconfigurationservice.svc';

interface SSCredentials {
  accountNumber: string;
  apiKey: string;
}

async function getSSCredentials(): Promise<SSCredentials> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !session) {
    throw new Error('Authentication required');
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('company_id')
    .eq('id', session.user.id)
    .maybeSingle();

  if (!profile?.company_id) {
    throw new Error('Company not found');
  }

  const { data: settings } = await supabase
    .from('company_settings')
    .select('ssactivewear_enabled, ssactivewear_username, ssactivewear_api_key_encrypted')
    .eq('id', profile.company_id)
    .maybeSingle();

  if (!settings?.ssactivewear_enabled || !settings?.ssactivewear_username || !settings?.ssactivewear_api_key_encrypted) {
    throw new Error('SSActivewear credentials not configured');
  }

  const decryptResponse = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crypto-service`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        action: 'decrypt',
        token: settings.ssactivewear_api_key_encrypted,
      }),
    }
  );

  if (!decryptResponse.ok) {
    throw new Error('Failed to decrypt credentials');
  }

  const decryptResult = await decryptResponse.json();

  return {
    accountNumber: settings.ssactivewear_username,
    apiKey: decryptResult.result,
  };
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildPricingSOAPRequest(
  credentials: SSCredentials,
  styleId: string,
  fobId: string
): string {
  const escapedAccountNumber = escapeXml(credentials.accountNumber);
  const escapedApiKey = escapeXml(credentials.apiKey);
  const escapedStyleId = escapeXml(styleId);
  const escapedFobId = escapeXml(fobId);

  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Header/>
  <soap:Body>
    <ns2:GetConfigurationAndPricingRequest xmlns:ns2="http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/SharedObjects/">
      <shar:wsVersion>1.0.0</shar:wsVersion>
      <shar:id>${escapedAccountNumber}</shar:id>
      <shar:password>${escapedApiKey}</shar:password>
      <shar:productId>${escapedStyleId}</shar:productId>
      <shar:currency>USD</shar:currency>
      <shar:fobId>${escapedFobId}</shar:fobId>
      <shar:priceType>Customer</shar:priceType>
      <shar:localizationCountry>US</shar:localizationCountry>
      <shar:localizationLanguage>en</shar:localizationLanguage>
      <shar:configurationType>Blank</shar:configurationType>
    </ns2:GetConfigurationAndPricingRequest>
  </soap:Body>
</soap:Envelope>`;
}

async function makePricingRequest(
  credentials: SSCredentials,
  styleId: string,
  fobId: string
): Promise<string> {
  const soapBody = buildPricingSOAPRequest(credentials, styleId, fobId);

  const response = await fetch(PROMOSTANDARDS_PRICING_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': '"getConfigurationAndPricing"',
    },
    body: soapBody,
  });

  if (!response.ok) {
    throw new Error(`PromoStandards request failed: ${response.status} ${response.statusText}`);
  }

  return await response.text();
}

function getXmlValue(xmlText: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, 'i');
  const match = xmlText.match(regex);
  return match ? match[1] : null;
}

function getAllXmlMatches(xmlText: string, pattern: RegExp): RegExpMatchArray[] {
  const matches = [];
  let match;
  pattern.lastIndex = 0;
  while ((match = pattern.exec(xmlText)) !== null) {
    matches.push(match);
  }
  return matches;
}

function extractColorAndSize(partDescription: string): { color: string | null; size: string | null } {
  if (!partDescription) {
    return { color: null, size: null };
  }

  const standardSizes = /\b(XXS|XS|S|M|L|XL|2XL|3XL|4XL|5XL|6XL|YXS|YS|YM|YL|YXL|OS|ONE SIZE)\b/i;
  const numericSizes = /\b(\d+(?:\.\d+)?)\b/;

  let size: string | null = null;
  let color: string | null = null;

  const sizeMatch = partDescription.match(standardSizes);
  if (sizeMatch) {
    size = sizeMatch[1].toUpperCase();
    color = partDescription.replace(sizeMatch[0], '').trim();
  } else {
    const numMatch = partDescription.match(numericSizes);
    if (numMatch) {
      size = numMatch[1];
      color = partDescription.replace(numMatch[0], '').trim();
    } else {
      color = partDescription.trim();
    }
  }

  color = color?.replace(/\s+/g, ' ').replace(/^[\/\-\s]+|[\/\-\s]+$/g, '') || null;

  return { color, size };
}

function parsePricingResponse(xmlText: string, styleId: string, warehouse: string): SSPricingRecord[] {
  const records: SSPricingRecord[] = [];

  const errorCodeMatch = xmlText.match(/<code>(\d+)<\/code>/);
  if (errorCodeMatch) {
    console.warn(`Pricing API returned error code ${errorCodeMatch[1]} for warehouse ${warehouse}`);
    return records;
  }

  const configPattern = /<Configuration>([\s\S]*?)<\/Configuration>/gi;
  const configMatches = getAllXmlMatches(xmlText, configPattern);

  for (const configMatch of configMatches) {
    const configXml = configMatch[1];

    const partArrayPattern = /<PartArray>([\s\S]*?)<\/PartArray>/gi;
    const partArrayMatches = getAllXmlMatches(configXml, partArrayPattern);

    for (const partArrayMatch of partArrayMatches) {
      const partArrayXml = partArrayMatch[1];

      const partPattern = /<Part>([\s\S]*?)<\/Part>/gi;
      const partMatches = getAllXmlMatches(partArrayXml, partPattern);

      for (const partMatch of partMatches) {
        const partXml = partMatch[1];

        const partId = getXmlValue(partXml, 'partId');
        const partDescription = getXmlValue(partXml, 'partDescription') || '';

        if (!partId) continue;

        const { color, size } = extractColorAndSize(partDescription);

        const partPriceArrayPattern = /<PartPriceArray>([\s\S]*?)<\/PartPriceArray>/gi;
        const partPriceArrayMatches = getAllXmlMatches(partXml, partPriceArrayPattern);

        for (const partPriceArrayMatch of partPriceArrayMatches) {
          const partPriceArrayXml = partPriceArrayMatch[1];

          const partPricePattern = /<PartPrice>([\s\S]*?)<\/PartPrice>/gi;
          const partPriceMatches = getAllXmlMatches(partPriceArrayXml, partPricePattern);

          for (const partPriceMatch of partPriceMatches) {
            const partPriceXml = partPriceMatch[1];

            const minQuantity = getXmlValue(partPriceXml, 'minQuantity');
            const price = getXmlValue(partPriceXml, 'price');
            const priceEffectiveDate = getXmlValue(partPriceXml, 'priceEffectiveDate');
            const priceExpiryDate = getXmlValue(partPriceXml, 'priceExpiryDate');

            if (price && minQuantity === '1') {
              records.push({
                vendor: 'SSActivewear',
                style_id: styleId,
                part_id: partId,
                color,
                size,
                warehouse,
                piece_price: parseFloat(price),
                currency: 'USD',
                effective_date: priceEffectiveDate || null,
                expires: priceExpiryDate || null,
              });
            }
          }
        }
      }
    }
  }

  return records;
}

export async function getSSPricing(styleId: string): Promise<SSPricingRecord[]> {
  try {
    const credentials = await getSSCredentials();

    const pricingPromises = FOB_WAREHOUSES.map(async (warehouse) => {
      try {
        const xmlResponse = await makePricingRequest(credentials, styleId, warehouse);
        return parsePricingResponse(xmlResponse, styleId, warehouse);
      } catch (error) {
        console.error(`Failed to fetch pricing for warehouse ${warehouse}:`, error);
        return [];
      }
    });

    const allResults = await Promise.allSettled(pricingPromises);

    const allRecords: SSPricingRecord[] = [];
    for (const result of allResults) {
      if (result.status === 'fulfilled') {
        allRecords.push(...result.value);
      }
    }

    return allRecords;
  } catch (error) {
    console.error('Error fetching SS pricing:', error);
    throw error;
  }
}
