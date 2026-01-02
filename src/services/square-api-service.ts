import { supabase } from '../lib/supabase-client';

interface SquareApiRequest {
  endpoint: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  params?: Record<string, string>;
}

export class SquareApiService {
  private static async callSquareProxy(request: SquareApiRequest) {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('No active session. Please log in.');
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const apiUrl = `${supabaseUrl}/functions/v1/square-proxy`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Square API error: ${response.status}`);
    }

    return response.json();
  }

  static async listLocations() {
    return this.callSquareProxy({
      endpoint: '/v2/locations',
      method: 'GET',
    });
  }

  static async listPayments(params?: { begin_time?: string; end_time?: string; location_id?: string }) {
    return this.callSquareProxy({
      endpoint: '/v2/payments',
      method: 'GET',
      params: params as Record<string, string>,
    });
  }

  static async listCustomers(params?: { limit?: number; cursor?: string }) {
    return this.callSquareProxy({
      endpoint: '/v2/customers',
      method: 'GET',
      params: params as Record<string, string>,
    });
  }

  static async listCatalogItems() {
    return this.callSquareProxy({
      endpoint: '/v2/catalog/list',
      method: 'GET',
      params: { types: 'ITEM' },
    });
  }

  static async listInventory() {
    return this.callSquareProxy({
      endpoint: '/v2/inventory/counts/batch-retrieve',
      method: 'POST',
      body: {},
    });
  }

  static async listRefunds(params?: { begin_time?: string; end_time?: string; location_id?: string }) {
    return this.callSquareProxy({
      endpoint: '/v2/refunds',
      method: 'GET',
      params: params as Record<string, string>,
    });
  }

  static async listTeamMembers() {
    return this.callSquareProxy({
      endpoint: '/v2/team-members',
      method: 'GET',
    });
  }

  static async listPayouts(params?: { location_id?: string; begin_time?: string; end_time?: string }) {
    return this.callSquareProxy({
      endpoint: '/v2/payouts',
      method: 'GET',
      params: params as Record<string, string>,
    });
  }

  static async searchOrders(body: any) {
    return this.callSquareProxy({
      endpoint: '/v2/orders/search',
      method: 'POST',
      body,
    });
  }
}
