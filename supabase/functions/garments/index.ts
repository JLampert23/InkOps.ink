/**
 * Garment Controller API
 *
 * RESTful API endpoints for accessing SanMar garment data
 *
 * Endpoints:
 * - GET /garments/{style} - Get all variants of a style
 * - GET /garments/{style}/{color} - Get all sizes for a color
 * - GET /garments/{style}/{color}/{size} - Get specific garment
 * - GET /garments/{style}/{color}/{size}/pricing - Get pricing only
 * - GET /garments/{style}/{color}/{size}/inventory - Get inventory only
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  getUnifiedGarment,
  getUnifiedStyle,
  getGarmentPricing,
  getGarmentInventory,
  getAvailableColors,
} from '../_shared/sanmar-unified-service.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RouteParams {
  style?: string;
  color?: string;
  size?: string;
  action?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);

    console.log('[GarmentController] Path:', url.pathname);
    console.log('[GarmentController] Parts:', pathParts);

    const garmentsIndex = pathParts.indexOf('garments');
    if (garmentsIndex === -1) {
      return jsonResponse({ error: 'Invalid endpoint' }, 404);
    }

    const relevantParts = ['garments', ...pathParts.slice(garmentsIndex + 1)];
    console.log('[GarmentController] Relevant parts:', relevantParts);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('[GarmentController] No auth header');
      return jsonResponse({ error: 'Authorization required' }, 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: {
          headers: { Authorization: authHeader },
        },
        auth: { autoRefreshToken: false, persistSession: false }
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[GarmentController] Auth error:', authError?.message);
      return jsonResponse({ error: 'Unauthorized', message: authError?.message }, 401);
    }

    console.log('[GarmentController] User authenticated:', user.id);

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile?.company_id) {
      return jsonResponse({ error: 'Company not found' }, 404);
    }

    const companyId = profile.company_id;
    const params = parseRoute(relevantParts);

    if (!params.style) {
      return jsonResponse({ error: 'Style parameter required' }, 400);
    }

    if (req.method === 'GET') {
      return await handleGetRequest(params, companyId);
    }

    return jsonResponse({ error: 'Method not allowed' }, 405);
  } catch (error) {
    console.error('[GarmentController] Error:', error);
    return jsonResponse(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

/**
 * Parse route parameters from path
 */
function parseRoute(parts: string[]): RouteParams {
  const params: RouteParams = {};

  if (parts.length >= 2) {
    params.style = parts[1];
  }

  if (parts.length >= 3) {
    params.color = parts[2];
  }

  if (parts.length >= 4) {
    params.size = parts[3];
  }

  if (parts.length >= 5) {
    params.action = parts[4];
  }

  return params;
}

/**
 * Handle GET requests based on route
 */
async function handleGetRequest(params: RouteParams, companyId: string): Promise<Response> {
  const { style, color, size, action } = params;

  if (!style) {
    return jsonResponse({ error: 'Style required' }, 400);
  }

  if (size && color && action === 'pricing') {
    console.log(`[GarmentController] GET /garments/${style}/${color}/${size}/pricing`);
    const pricing = await getGarmentPricing(style, color, size, companyId);

    if (!pricing) {
      return jsonResponse({ error: 'Pricing not found' }, 404);
    }

    return jsonResponse({
      style,
      color,
      size,
      pricing,
    });
  }

  if (size && color && action === 'inventory') {
    console.log(`[GarmentController] GET /garments/${style}/${color}/${size}/inventory`);
    const inventory = await getGarmentInventory(style, color, size, companyId);

    if (!inventory) {
      return jsonResponse({ error: 'Inventory not found' }, 404);
    }

    return jsonResponse({
      style,
      color,
      size,
      inventory,
    });
  }

  if (size && color) {
    console.log(`[GarmentController] GET /garments/${style}/${color}/${size}`);
    const garment = await getUnifiedGarment(style, color, size, companyId);

    if (!garment) {
      return jsonResponse({ error: 'Garment not found' }, 404);
    }

    return jsonResponse(garment);
  }

  if (color) {
    console.log(`[GarmentController] GET /garments/${style}/${color}`);
    const styleData = await getUnifiedStyle(style, companyId);

    if (!styleData) {
      return jsonResponse({ error: 'Style not found' }, 404);
    }

    const colorVariants = styleData.variants.filter(v => v.color === color);

    if (colorVariants.length === 0) {
      return jsonResponse({ error: 'Color not found' }, 404);
    }

    return jsonResponse({
      vendor: styleData.vendor,
      style: styleData.style,
      color,
      description: styleData.description,
      category: styleData.category,
      subcategory: styleData.subcategory,
      variants: colorVariants,
      media: styleData.media,
    });
  }

  console.log(`[GarmentController] GET /garments/${style}`);
  const styleData = await getUnifiedStyle(style, companyId);

  if (!styleData) {
    return jsonResponse({ error: 'Style not found' }, 404);
  }

  return jsonResponse(styleData);
}

/**
 * Create JSON response with CORS headers
 */
function jsonResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
