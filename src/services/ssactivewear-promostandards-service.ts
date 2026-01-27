import { supabase } from '../lib/supabase-client';
import {
  PromoStandardsProduct,
  PromoStandardsPricing,
  PromoStandardsInventory,
  PromoStandardsMedia,
} from '../types/promostandards';

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ssactivewear-api`;

async function getAuthToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }
  return session.access_token;
}

export async function lookupProductByStyle(styleNumber: string): Promise<PromoStandardsProduct | null> {
  try {
    const token = await getAuthToken();

    const response = await fetch(
      `${EDGE_FUNCTION_URL}?action=product&productId=${encodeURIComponent(styleNumber)}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to lookup product');
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error('Product lookup failed');
    }

    return result.data;
  } catch (error) {
    console.error('Error looking up product:', error);
    throw error;
  }
}

export async function getProductPricing(partId: string): Promise<PromoStandardsPricing | null> {
  try {
    const token = await getAuthToken();

    const response = await fetch(
      `${EDGE_FUNCTION_URL}?action=pricing&partId=${encodeURIComponent(partId)}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get pricing');
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error('Pricing lookup failed');
    }

    return result.data;
  } catch (error) {
    console.error('Error getting pricing:', error);
    throw error;
  }
}

export async function getProductInventory(partId: string): Promise<PromoStandardsInventory | null> {
  try {
    const token = await getAuthToken();

    const response = await fetch(
      `${EDGE_FUNCTION_URL}?action=inventory&partId=${encodeURIComponent(partId)}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get inventory');
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error('Inventory lookup failed');
    }

    return result.data;
  } catch (error) {
    console.error('Error getting inventory:', error);
    throw error;
  }
}

export async function getProductMedia(partId: string): Promise<PromoStandardsMedia | null> {
  try {
    const token = await getAuthToken();

    const response = await fetch(
      `${EDGE_FUNCTION_URL}?action=media&partId=${encodeURIComponent(partId)}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get media');
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error('Media lookup failed');
    }

    return result.data;
  } catch (error) {
    console.error('Error getting media:', error);
    throw error;
  }
}

export interface ColorOption {
  partId: string;
  colorName: string;
  hex?: string;
  approximatePmsColor?: string;
}

export async function getAllColorsForStyle(styleNumber: string): Promise<ColorOption[]> {
  const product = await lookupProductByStyle(styleNumber);

  if (!product || !product.colors) {
    return [];
  }

  const colorOptions: ColorOption[] = [];

  for (const colorData of product.colors) {
    if (colorData.colors && colorData.colors.length > 0) {
      for (const color of colorData.colors) {
        colorOptions.push({
          partId: colorData.partId,
          colorName: color.colorName,
          hex: color.hex || undefined,
          approximatePmsColor: color.approximatePmsColor || undefined,
        });
      }
    } else {
      colorOptions.push({
        partId: colorData.partId,
        colorName: colorData.colorName,
        hex: undefined,
        approximatePmsColor: undefined,
      });
    }
  }

  return colorOptions;
}

export async function getCompleteProductData(styleNumber: string, partId: string) {
  const [product, pricing, inventory, media] = await Promise.allSettled([
    lookupProductByStyle(styleNumber),
    getProductPricing(partId),
    getProductInventory(partId),
    getProductMedia(partId),
  ]);

  return {
    product: product.status === 'fulfilled' ? product.value : null,
    pricing: pricing.status === 'fulfilled' ? pricing.value : null,
    inventory: inventory.status === 'fulfilled' ? inventory.value : null,
    media: media.status === 'fulfilled' ? media.value : null,
  };
}
