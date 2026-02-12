import { supabase } from '../lib/supabase-client';

export interface CustomInvoiceStatus {
  id: string;
  company_id: string;
  name: string;
  color: string;
  category: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCustomStatusInput {
  name: string;
  color: string;
  category?: string | null;
}

export interface UpdateCustomStatusInput {
  name?: string;
  color?: string;
  category?: string | null;
}

export class CustomInvoiceStatusService {
  static async getCustomStatuses(companyId: string): Promise<CustomInvoiceStatus[]> {
    const { data, error } = await supabase
      .from('custom_invoice_statuses')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching custom statuses:', error);
      throw error;
    }

    return data || [];
  }

  static async createCustomStatus(
    companyId: string,
    input: CreateCustomStatusInput
  ): Promise<CustomInvoiceStatus> {
    // Get the next sort order
    const { data: maxOrderData } = await supabase
      .from('custom_invoice_statuses')
      .select('sort_order')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();

    const nextSortOrder = maxOrderData ? maxOrderData.sort_order + 1 : 0;

    const { data, error } = await supabase
      .from('custom_invoice_statuses')
      .insert({
        company_id: companyId,
        name: input.name,
        color: input.color,
        category: input.category || null,
        sort_order: nextSortOrder,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating custom status:', error);
      throw error;
    }

    return data;
  }

  static async updateCustomStatus(
    statusId: string,
    input: UpdateCustomStatusInput
  ): Promise<CustomInvoiceStatus> {
    const { data, error } = await supabase
      .from('custom_invoice_statuses')
      .update(input)
      .eq('id', statusId)
      .select()
      .single();

    if (error) {
      console.error('Error updating custom status:', error);
      throw error;
    }

    return data;
  }

  static async deleteCustomStatus(statusId: string): Promise<void> {
    // Soft delete
    const { error } = await supabase
      .from('custom_invoice_statuses')
      .update({ is_active: false })
      .eq('id', statusId);

    if (error) {
      console.error('Error deleting custom status:', error);
      throw error;
    }
  }

  static async reorderStatuses(
    companyId: string,
    statusIds: string[]
  ): Promise<void> {
    // Update sort_order for each status
    const updates = statusIds.map((id, index) => ({
      id,
      sort_order: index,
    }));

    for (const update of updates) {
      await supabase
        .from('custom_invoice_statuses')
        .update({ sort_order: update.sort_order })
        .eq('id', update.id)
        .eq('company_id', companyId);
    }
  }

  static async getAllCategories(companyId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('custom_invoice_statuses')
      .select('category')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .not('category', 'is', null);

    if (error) {
      console.error('Error fetching categories:', error);
      throw error;
    }

    const categories = data
      .map((row) => row.category)
      .filter((cat): cat is string => cat !== null);

    return Array.from(new Set(categories));
  }
}
