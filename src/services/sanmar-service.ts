import { supabase } from '../lib/supabase-client';

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sanmar-api`;

async function getAuthToken(): Promise<string> {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error) {
    console.error('Error getting session:', error);
    throw new Error('Failed to get session: ' + error.message);
  }

  if (!session?.access_token) {
    throw new Error('Not authenticated - no access token in session');
  }

  // Check if token is expired or about to expire (within 5 minutes)
  const expiresAt = session.expires_at || 0;
  const now = Math.floor(Date.now() / 1000);
  const isExpiringSoon = expiresAt - now < 300;

  if (isExpiringSoon) {
    console.log('Token expiring soon, refreshing session...');
    const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !newSession) {
      console.error('Failed to refresh session:', refreshError);
      throw new Error('Session expired, please log in again');
    }
    return newSession.access_token;
  }

  return session.access_token;
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

export interface UnifiedSanMarData {
  success: boolean;
  supplier: string;
  style?: any;
  inventory?: any;
  pricing?: {
    parts?: Array<{
      partId: string;
      prices: Array<{ quantity: number; price: number }>;
    }>;
    basePrice?: number;
    pricesByPartId?: Record<string, number>;
  };
  media?: SanMarMediaData;
  debug?: any;
}

export async function getUnifiedSanMarData(
  styleNumber: string,
  partId?: string
): Promise<UnifiedSanMarData> {
  try {
    const token = await getAuthToken();

    let url = `${EDGE_FUNCTION_URL}?action=unified&style=${encodeURIComponent(styleNumber)}`;
    if (partId) {
      url += `&partId=${encodeURIComponent(partId)}`;
    }

    console.log('🟢 Fetching unified SanMar data:', {
      styleNumber,
      partId,
      url,
    });

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
    });

    console.log('🟢 SanMar Unified API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('🔴 SanMar Unified API error response:', errorText);
      let error;
      try {
        error = JSON.parse(errorText);
        console.error('🔴 Parsed error:', error);
      } catch {
        error = { error: errorText };
      }
      throw new Error(error.error || error.message || `Failed to fetch unified SanMar data: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('🟢 SanMar Unified API response data:', result);

    // Transform the response to match expected format
    const transformed: UnifiedSanMarData = {
      success: result.success || false,
      supplier: 'sanmar',
      style: result.style,
      inventory: result.inventory,
      pricing: result.pricing,
      media: result.media,
      debug: result.debug,
    };

    // Extract base price from pricing data if available
    if (result.pricing?.parts && result.pricing.parts.length > 0) {
      const firstPart = result.pricing.parts[0];
      if (firstPart?.prices && firstPart.prices.length > 0) {
        transformed.pricing = {
          ...result.pricing,
          basePrice: firstPart.prices[0].price,
        };
      }
    }

    return transformed;
  } catch (error) {
    console.error('Error fetching unified SanMar data:', error);
    throw error;
  }
}
