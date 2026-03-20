import { supabase } from '../lib/supabase-client';

export interface GarmentRequirement {
  id: string;
  company_id: string;
  quote_id: string;
  work_order_id: string | null;
  supplier_type: string;
  supplier_name: string | null;
  style_number: string;
  style_name: string | null;
  color: string | null;
  sizes: Record<string, number>;
  total_quantity: number;
  unit_cost: number;
  total_cost: number;
  is_po_created: boolean;
  po_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Vendor {
  id: string;
  company_id: string;
  vendor_name: string;
  vendor_type: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address_1: string | null;
  address_2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string;
  payment_terms: string | null;
  notes: string | null;
  is_active: boolean;
  default_lead_time_days: number;
  minimum_order_quantity: number;
  minimum_order_value: number;
  preferred_vendor: boolean;
  auto_po_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrder {
  id: string;
  company_id: string;
  po_number: string;
  vendor_id: string;
  status: string;
  subtotal: number;
  tax_amount: number;
  shipping_cost: number;
  total_cost: number;
  notes_to_vendor: string | null;
  internal_notes: string | null;
  expected_delivery_date: string | null;
  sent_at: string | null;
  confirmed_at: string | null;
  received_at: string | null;
  closed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutoPOResult {
  success: boolean;
  message: string;
  pos_created: number;
  po_ids?: string[];
  company_id?: string;
}

export class POAutoCreationService {
  static async getPendingRequirements(): Promise<{
    data: GarmentRequirement[] | null;
    error: any;
  }> {
    return await supabase
      .from('garment_requirements_staging')
      .select('*')
      .eq('is_po_created', false)
      .order('supplier_type')
      .order('supplier_name')
      .order('style_number');
  }

  static async getRequirementsByVendor(): Promise<{
    data: Array<{
      supplier_type: string;
      supplier_name: string;
      requirement_count: number;
      total_value: number;
      requirements: GarmentRequirement[];
    }> | null;
    error: any;
  }> {
    const { data: requirements, error } =
      await this.getPendingRequirements();

    if (error || !requirements) {
      return { data: null, error };
    }

    const grouped = requirements.reduce(
      (acc, req) => {
        const key = `${req.supplier_type}|${req.supplier_name || ''}`;
        if (!acc[key]) {
          acc[key] = {
            supplier_type: req.supplier_type,
            supplier_name: req.supplier_name || req.supplier_type,
            requirement_count: 0,
            total_value: 0,
            requirements: [],
          };
        }
        acc[key].requirement_count++;
        acc[key].total_value += req.total_cost;
        acc[key].requirements.push(req);
        return acc;
      },
      {} as Record<string, any>
    );

    return { data: Object.values(grouped), error: null };
  }

  static async autoCreatePOs(
    companyId?: string
  ): Promise<{ data: AutoPOResult | null; error: any }> {
    try {
      const { data, error } = await supabase.rpc(
        'auto_create_pos_from_requirements',
        companyId ? { p_company_id: companyId } : {}
      );

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error auto-creating POs:', error);
      return { data: null, error };
    }
  }

  static async getVendors(filters?: {
    vendor_type?: string;
    auto_po_enabled?: boolean;
    preferred_only?: boolean;
  }): Promise<{ data: Vendor[] | null; error: any }> {
    let query = supabase
      .from('vendors')
      .select('*')
      .eq('is_active', true)
      .order('preferred_vendor', { ascending: false })
      .order('vendor_name');

    if (filters?.vendor_type) {
      query = query.eq('vendor_type', filters.vendor_type);
    }

    if (filters?.auto_po_enabled !== undefined) {
      query = query.eq('auto_po_enabled', filters.auto_po_enabled);
    }

    if (filters?.preferred_only) {
      query = query.eq('preferred_vendor', true);
    }

    return await query;
  }

  static async updateVendor(
    vendorId: string,
    updates: Partial<Vendor>
  ): Promise<{ data: Vendor | null; error: any }> {
    return await supabase
      .from('vendors')
      .update(updates)
      .eq('id', vendorId)
      .select()
      .single();
  }

  static async createVendor(
    vendor: Omit<Vendor, 'id' | 'created_at' | 'updated_at'>
  ): Promise<{ data: Vendor | null; error: any }> {
    return await supabase.from('vendors').insert(vendor).select().single();
  }

  static async getDraftPOs(): Promise<{
    data: PurchaseOrder[] | null;
    error: any;
  }> {
    return await supabase
      .from('purchase_orders')
      .select(
        `
        *,
        vendor:vendors(id, vendor_name, vendor_type)
      `
      )
      .eq('status', 'draft')
      .order('created_at', { ascending: false });
  }

  static async getPOById(
    poId: string
  ): Promise<{ data: PurchaseOrder | null; error: any }> {
    return await supabase
      .from('purchase_orders')
      .select(
        `
        *,
        vendor:vendors(*),
        line_items:purchase_order_line_items(*),
        activity_log:purchase_order_activity_log(*)
      `
      )
      .eq('id', poId)
      .single();
  }

  static async getAutoCreateSettings(): Promise<{
    data: {
      po_auto_create_enabled: boolean;
      po_auto_create_threshold_days: number;
      po_auto_create_notify_users: string[];
      po_auto_create_notify_enabled: boolean;
      po_auto_group_by_vendor: boolean;
      po_auto_split_by_vendor: boolean;
    } | null;
    error: any;
  }> {
    const { data, error } = await supabase
      .from('company_settings')
      .select(
        `
        po_auto_create_enabled,
        po_auto_create_threshold_days,
        po_auto_create_notify_users,
        po_auto_create_notify_enabled,
        po_auto_group_by_vendor,
        po_auto_split_by_vendor
      `
      )
      .single();

    return { data, error };
  }

  static async updateAutoCreateSettings(settings: {
    po_auto_create_enabled?: boolean;
    po_auto_create_threshold_days?: number;
    po_auto_create_notify_users?: string[];
    po_auto_create_notify_enabled?: boolean;
    po_auto_group_by_vendor?: boolean;
    po_auto_split_by_vendor?: boolean;
  }): Promise<{ data: any; error: any }> {
    const { data, error } = await supabase
      .from('company_settings')
      .update(settings)
      .select()
      .single();

    return { data, error };
  }

  static async calculateExpectedDeliveryDate(
    vendorId: string,
    processingDays: number = 2
  ): Promise<{ data: string | null; error: any }> {
    try {
      const { data, error } = await supabase.rpc(
        'calculate_expected_delivery_date',
        {
          p_vendor_id: vendorId,
          p_processing_days: processingDays,
        }
      );

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error calculating delivery date:', error);
      return { data: null, error };
    }
  }

  static async getVendorStats(): Promise<{
    data: {
      total_vendors: number;
      auto_po_enabled: number;
      preferred_vendors: number;
      by_type: Record<string, number>;
    } | null;
    error: any;
  }> {
    const { data: vendors, error } = await supabase
      .from('vendors')
      .select('vendor_type, auto_po_enabled, preferred_vendor')
      .eq('is_active', true);

    if (error || !vendors) {
      return { data: null, error };
    }

    const stats = {
      total_vendors: vendors.length,
      auto_po_enabled: vendors.filter((v) => v.auto_po_enabled).length,
      preferred_vendors: vendors.filter((v) => v.preferred_vendor).length,
      by_type: vendors.reduce(
        (acc, v) => {
          acc[v.vendor_type] = (acc[v.vendor_type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
    };

    return { data: stats, error: null };
  }

  static async getPOStatsByStatus(): Promise<{
    data: Record<string, number> | null;
    error: any;
  }> {
    const { data: pos, error } = await supabase
      .from('purchase_orders')
      .select('status');

    if (error || !pos) {
      return { data: null, error };
    }

    const stats = pos.reduce(
      (acc, po) => {
        acc[po.status] = (acc[po.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return { data: stats, error: null };
  }

  static async getRequirementsSummary(): Promise<{
    data: {
      total_requirements: number;
      pending: number;
      po_created: number;
      total_value: number;
      pending_value: number;
    } | null;
    error: any;
  }> {
    const { data: requirements, error } = await supabase
      .from('garment_requirements_staging')
      .select('is_po_created, total_cost');

    if (error || !requirements) {
      return { data: null, error };
    }

    const summary = {
      total_requirements: requirements.length,
      pending: requirements.filter((r) => !r.is_po_created).length,
      po_created: requirements.filter((r) => r.is_po_created).length,
      total_value: requirements.reduce((sum, r) => sum + r.total_cost, 0),
      pending_value: requirements
        .filter((r) => !r.is_po_created)
        .reduce((sum, r) => sum + r.total_cost, 0),
    };

    return { data: summary, error: null };
  }

  static async deletePurchaseOrder(
    poId: string
  ): Promise<{ error: any }> {
    return await supabase
      .from('purchase_orders')
      .delete()
      .eq('id', poId);
  }
}
