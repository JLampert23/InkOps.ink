import { supabase } from '../lib/supabase-client';

export interface SanMarPricingRecord {
  vendor: string;
  style_id: string;
  part_id: string;
  color: string;
  size: string;
  warehouse: string;
  piece_price: number;
  currency: string;
  effective_date: null;
  expires: null;
}

const SANMAR_REST_API_BASE = 'https://api.sanmar.com/v1';

interface SanMarCredentials {
  username: string;
  password: string;
}

interface SanMarSKU {
  sku: string;
  colorName: string;
  sizeName: string;
  discountedPrice: number;
}

interface SanMarSKUsResponse {
  skus: SanMarSKU[];
}

async function getSanMarCredentials(): Promise<SanMarCredentials> {
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
    .select('sanmar_enabled, sanmar_username, sanmar_password_encrypted')
    .eq('id', profile.company_id)
    .maybeSingle();

  if (!settings?.sanmar_enabled || !settings?.sanmar_username || !settings?.sanmar_password_encrypted) {
    throw new Error('SanMar credentials not configured');
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
        token: settings.sanmar_password_encrypted,
      }),
    }
  );

  if (!decryptResponse.ok) {
    throw new Error('Failed to decrypt credentials');
  }

  const decryptResult = await decryptResponse.json();

  return {
    username: settings.sanmar_username,
    password: decryptResult.result,
  };
}

async function fetchSanMarSKUs(
  credentials: SanMarCredentials,
  styleId: string
): Promise<SanMarSKU[]> {
  const url = `${SANMAR_REST_API_BASE}/products/${encodeURIComponent(styleId)}/skus`;

  const authString = btoa(`${credentials.username}:${credentials.password}`);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${authString}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('SanMar API error:', errorText);
    throw new Error(`SanMar API request failed: ${response.status} ${response.statusText}`);
  }

  const data: SanMarSKUsResponse = await response.json();

  if (!data.skus || !Array.isArray(data.skus)) {
    console.warn('No SKUs found in response');
    return [];
  }

  return data.skus;
}

function normalizeSKUData(
  sku: SanMarSKU,
  styleId: string
): SanMarPricingRecord {
  return {
    vendor: 'SanMar',
    style_id: styleId,
    part_id: sku.sku,
    color: sku.colorName || '',
    size: sku.sizeName || '',
    warehouse: 'default',
    piece_price: sku.discountedPrice || 0,
    currency: 'USD',
    effective_date: null,
    expires: null,
  };
}

export async function getSanMarPricing(styleId: string): Promise<SanMarPricingRecord[]> {
  try {
    const credentials = await getSanMarCredentials();

    const skus = await fetchSanMarSKUs(credentials, styleId);

    const normalizedRecords = skus.map((sku) => normalizeSKUData(sku, styleId));

    return normalizedRecords;
  } catch (error) {
    console.error('Error fetching SanMar pricing:', error);
    throw error;
  }
}
