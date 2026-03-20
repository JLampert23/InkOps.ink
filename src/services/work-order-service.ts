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

export interface WorkOrder {
  id: string;
  work_order_number: string;
  company_id: string;
  quote_id: string | null;
  customer_id: string | null;
  customer_name: string;
  status: string;
  priority: string;
  production_due_date: string | null;
  customer_due_date: string | null;
  assigned_to: string | null;
  total_quantity: number;
  notes: string | null;
  custom_invoice_status_id: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface WorkOrderLineItem {
  id: string;
  work_order_id: string;
  company_id: string;
  quote_line_item_id: string | null;
  line_number: number;
  item_type: string;
  description: string;
  style_number: string | null;
  style_name: string | null;
  color: string | null;
  sizes: Record<string, number>;
  quantity: number;
  supplier_type: string | null;
  supplier_name: string | null;
  garment_images: any;
  notes: string | null;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowColumn {
  id: string;
  company_id: string;
  column_name: string;
  column_order: number;
  color: string;
  is_default: boolean;
  wip_limit: number | null;
  is_visible: boolean;
  is_default_column: boolean;
  created_at: string;
}

export interface WorkOrderWithImprints extends WorkOrder {
  types_of_work: string[];
}

export interface WorkOrderWithDetails extends WorkOrder {
  line_items?: WorkOrderLineItem[];
  imprints?: any[];
  schedule_entries?: any[];
  custom_invoice_status?: CustomInvoiceStatus | null;
}

export class WorkOrderService {
  static async getWorkOrders(filters?: {
    status?: string;
    priority?: string;
    assigned_to?: string;
    search?: string;
  }): Promise<{ data: WorkOrderWithImprints[] | null; error: any }> {
    let query = supabase
      .from('work_orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.priority) {
      query = query.eq('priority', filters.priority);
    }

    if (filters?.assigned_to) {
      query = query.eq('assigned_to', filters.assigned_to);
    }

    if (filters?.search) {
      query = query.or(
        `work_order_number.ilike.%${filters.search}%,customer_name.ilike.%${filters.search}%`
      );
    }

    const { data: workOrders, error } = await query;

    if (error || !workOrders || workOrders.length === 0) {
      return { data: workOrders as WorkOrderWithImprints[] | null, error };
    }

    const quoteIds = workOrders
      .map((wo) => wo.quote_id)
      .filter((id): id is string => !!id);

    let imprintsByQuote: Record<string, string[]> = {};

    if (quoteIds.length > 0) {
      const { data: imprints } = await supabase
        .from('quote_imprints')
        .select('quote_id, type_of_work')
        .in('quote_id', quoteIds);

      if (imprints) {
        for (const imp of imprints) {
          if (imp.type_of_work) {
            if (!imprintsByQuote[imp.quote_id]) {
              imprintsByQuote[imp.quote_id] = [];
            }
            if (!imprintsByQuote[imp.quote_id].includes(imp.type_of_work)) {
              imprintsByQuote[imp.quote_id].push(imp.type_of_work);
            }
          }
        }
      }
    }

    const enriched: WorkOrderWithImprints[] = workOrders.map((wo) => ({
      ...wo,
      types_of_work: wo.quote_id ? imprintsByQuote[wo.quote_id] || [] : [],
    }));

    return { data: enriched, error: null };
  }

  static async getWorkOrderById(
    workOrderId: string
  ): Promise<{ data: WorkOrderWithDetails | null; error: any }> {
    const { data: workOrder, error: workOrderError } = await supabase
      .from('work_orders')
      .select('*')
      .eq('id', workOrderId)
      .maybeSingle();

    if (workOrderError || !workOrder) {
      return { data: null, error: workOrderError };
    }

    const { data: lineItems } = await supabase
      .from('work_order_line_items')
      .select('*')
      .eq('work_order_id', workOrderId)
      .order('line_number');

    const { data: imprints } = await supabase
      .from('quote_imprints')
      .select('*')
      .eq('quote_id', workOrder.quote_id || '');

    const { data: scheduleEntries } = await supabase
      .from('production_schedule_entries')
      .select('*')
      .eq('quote_id', workOrder.quote_id || '');

    let customInvoiceStatus = null;
    if (workOrder.custom_invoice_status_id) {
      const { data: statusData } = await supabase
        .from('custom_invoice_statuses')
        .select('*')
        .eq('id', workOrder.custom_invoice_status_id)
        .maybeSingle();
      customInvoiceStatus = statusData;
    }

    return {
      data: {
        ...workOrder,
        line_items: lineItems || [],
        imprints: imprints || [],
        schedule_entries: scheduleEntries || [],
        custom_invoice_status: customInvoiceStatus,
      },
      error: null,
    };
  }

  static async getWorkOrdersByStatus(): Promise<{
    data: Record<string, WorkOrderWithImprints[]> | null;
    error: any;
  }> {
    const { data: columns, error: columnsError } = await supabase
      .from('production_workflow_columns')
      .select('*')
      .order('column_order');

    if (columnsError || !columns) {
      return { data: null, error: columnsError };
    }

    const { data: workOrders, error: workOrdersError } = await supabase
      .from('work_orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (workOrdersError) {
      return { data: null, error: workOrdersError };
    }

    const quoteIds = (workOrders || [])
      .map((wo) => wo.quote_id)
      .filter((id): id is string => !!id);

    let imprintsByQuote: Record<string, string[]> = {};

    if (quoteIds.length > 0) {
      const { data: imprints } = await supabase
        .from('quote_imprints')
        .select('quote_id, type_of_work')
        .in('quote_id', quoteIds);

      if (imprints) {
        for (const imp of imprints) {
          if (imp.type_of_work) {
            if (!imprintsByQuote[imp.quote_id]) {
              imprintsByQuote[imp.quote_id] = [];
            }
            if (!imprintsByQuote[imp.quote_id].includes(imp.type_of_work)) {
              imprintsByQuote[imp.quote_id].push(imp.type_of_work);
            }
          }
        }
      }
    }

    const grouped: Record<string, WorkOrderWithImprints[]> = {};

    columns.forEach((col) => {
      grouped[col.column_name] = [];
    });

    workOrders?.forEach((wo) => {
      const enriched: WorkOrderWithImprints = {
        ...wo,
        types_of_work: wo.quote_id ? imprintsByQuote[wo.quote_id] || [] : [],
      };

      if (grouped[wo.status]) {
        grouped[wo.status].push(enriched);
      } else {
        if (!grouped['Pending Scheduling']) {
          grouped['Pending Scheduling'] = [];
        }
        grouped['Pending Scheduling'].push(enriched);
      }
    });

    return { data: grouped, error: null };
  }

  static async updateWorkOrderStatus(
    workOrderId: string,
    status: string
  ): Promise<{ data: WorkOrder | null; error: any }> {
    return await supabase
      .from('work_orders')
      .update({
        status,
        started_at: status === 'In Production' ? new Date().toISOString() : undefined
      })
      .eq('id', workOrderId)
      .select()
      .single();
  }

  static async updateWorkOrder(
    workOrderId: string,
    updates: Partial<WorkOrder>
  ): Promise<{ data: WorkOrder | null; error: any }> {
    return await supabase
      .from('work_orders')
      .update(updates)
      .eq('id', workOrderId)
      .select()
      .single();
  }

  static async assignWorkOrder(
    workOrderId: string,
    userId: string
  ): Promise<{ data: WorkOrder | null; error: any }> {
    return await supabase
      .from('work_orders')
      .update({ assigned_to: userId })
      .eq('id', workOrderId)
      .select()
      .single();
  }

  static async getWorkflowColumns(): Promise<{
    data: WorkflowColumn[] | null;
    error: any;
  }> {
    const result = await supabase
      .from('production_workflow_columns')
      .select('*')
      .order('column_order');

    if (result.data && result.data.length === 0) {
      const defaults = [
        { column_name: 'Pending Scheduling', column_order: 0, color: '#94a3b8', is_default: true },
        { column_name: 'In Production', column_order: 1, color: '#3b82f6', is_default: false },
        { column_name: 'Quality Check', column_order: 2, color: '#f59e0b', is_default: false },
        { column_name: 'Ready to Ship', column_order: 3, color: '#10b981', is_default: false },
        { column_name: 'Completed', column_order: 4, color: '#6b7280', is_default: false },
      ];

      const { data: inserted, error: insertError } = await supabase
        .from('production_workflow_columns')
        .insert(defaults)
        .select();

      if (inserted && !insertError) {
        return { data: inserted, error: null };
      }
    }

    return result;
  }

  static async createWorkflowColumn(
    columnName: string,
    color: string = '#3b82f6'
  ): Promise<{ data: WorkflowColumn | null; error: any }> {
    const { data: maxOrder } = await supabase
      .from('production_workflow_columns')
      .select('column_order')
      .order('column_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const newOrder = (maxOrder?.column_order || 0) + 1;

    return await supabase
      .from('production_workflow_columns')
      .insert([
        {
          column_name: columnName,
          column_order: newOrder,
          color,
          is_default: false,
        },
      ])
      .select()
      .single();
  }

  static async updateWorkflowColumn(
    columnId: string,
    updates: Partial<WorkflowColumn>
  ): Promise<{ data: WorkflowColumn | null; error: any }> {
    return await supabase
      .from('production_workflow_columns')
      .update(updates)
      .eq('id', columnId)
      .select()
      .single();
  }

  static async deleteWorkflowColumn(
    columnId: string
  ): Promise<{ error: any }> {
    return await supabase
      .from('production_workflow_columns')
      .delete()
      .eq('id', columnId);
  }

  static async completeLineItem(
    lineItemId: string
  ): Promise<{ data: WorkOrderLineItem | null; error: any }> {
    return await supabase
      .from('work_order_line_items')
      .update({
        is_completed: true,
        completed_at: new Date().toISOString(),
      })
      .eq('id', lineItemId)
      .select()
      .single();
  }

  static async uncompleteLineItem(
    lineItemId: string
  ): Promise<{ data: WorkOrderLineItem | null; error: any }> {
    return await supabase
      .from('work_order_line_items')
      .update({
        is_completed: false,
        completed_at: null,
      })
      .eq('id', lineItemId)
      .select()
      .single();
  }

  static async getLineItemsByWorkOrder(
    workOrderId: string
  ): Promise<{ data: WorkOrderLineItem[] | null; error: any }> {
    return await supabase
      .from('work_order_line_items')
      .select('*')
      .eq('work_order_id', workOrderId)
      .order('line_number');
  }

  static async deleteWorkOrder(
    workOrderId: string
  ): Promise<{ error: any }> {
    return await supabase
      .from('work_orders')
      .delete()
      .eq('id', workOrderId);
  }

  static async updateWorkOrderInvoiceStatus(
    workOrderId: string,
    customInvoiceStatusId: string | null
  ): Promise<{ data: WorkOrderWithDetails | null; error: any }> {
    const { error: updateError } = await supabase
      .from('work_orders')
      .update({ custom_invoice_status_id: customInvoiceStatusId })
      .eq('id', workOrderId);

    if (updateError) {
      return { data: null, error: updateError };
    }

    return await this.getWorkOrderById(workOrderId);
  }
}
