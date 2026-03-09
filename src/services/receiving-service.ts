import { supabase } from '../lib/supabase-client';

export interface ReceivablePO {
  po_id: string;
  po_number: string;
  vendor_name: string;
  status: string;
  can_receive: boolean;
  block_reason: string | null;
  expected_delivery_date: string | null;
  total_items: number;
  received_items: number;
  pending_items: number;
}

export interface POLineItem {
  id: string;
  po_id: string;
  line_number: number;
  style_number: string;
  product_name: string;
  color: string | null;
  size: string | null;
  quantity_ordered: number;
  quantity_received: number;
  quantity_damaged: number;
  quantity_short: number;
  unit_cost: number;
  extended_cost: number;
  upc_code: string | null;
}

export interface ReceivingLineItem {
  po_line_item_id: string;
  quantity_received: number;
  quantity_damaged?: number;
  quantity_short?: number;
  variance_notes?: string;
}

export interface ReceivingLog {
  id: string;
  company_id: string;
  po_id: string;
  received_by: string;
  received_at: string;
  status: string;
  notes: string | null;
  created_at: string;
}

export interface ReceivingResult {
  success: boolean;
  receiving_log_id?: string;
  total_received?: number;
  message?: string;
  error?: string;
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
  garments_ready: boolean;
  garments_received_at: string | null;
  ready_for_production: boolean;
  ready_for_production_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export class ReceivingService {
  /**
   * Get list of POs that can be received
   * Enforces vendor confirmation rules
   */
  static async getReceivablePOs(): Promise<{
    data: ReceivablePO[] | null;
    error: any;
  }> {
    try {
      const { data, error } = await supabase.rpc('get_receivable_pos');

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error fetching receivable POs:', error);
      return { data: null, error };
    }
  }

  /**
   * Check if a specific PO can be received
   */
  static async canReceivePO(poId: string): Promise<{
    data: boolean | null;
    error: any;
  }> {
    try {
      const { data, error } = await supabase.rpc('can_receive_po', {
        p_po_id: poId,
      });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error checking PO receivability:', error);
      return { data: null, error };
    }
  }

  /**
   * Get PO details with line items
   */
  static async getPOWithLineItems(poId: string): Promise<{
    data: {
      po: any;
      line_items: POLineItem[];
    } | null;
    error: any;
  }> {
    try {
      // Get PO details
      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .select(
          `
          *,
          vendor:vendors(*)
        `
        )
        .eq('id', poId)
        .single();

      if (poError) throw poError;

      // Get line items
      const { data: lineItems, error: lineItemsError } = await supabase
        .from('purchase_order_line_items')
        .select('*')
        .eq('po_id', poId)
        .order('line_number');

      if (lineItemsError) throw lineItemsError;

      return {
        data: {
          po,
          line_items: lineItems || [],
        },
        error: null,
      };
    } catch (error) {
      console.error('Error fetching PO with line items:', error);
      return { data: null, error };
    }
  }

  /**
   * Process receiving with vendor confirmation enforcement
   */
  static async processReceiving(
    poId: string,
    receivedBy: string,
    lineItems: ReceivingLineItem[],
    notes?: string
  ): Promise<{ data: ReceivingResult | null; error: any }> {
    try {
      const { data, error } = await supabase.rpc('process_receiving', {
        p_po_id: poId,
        p_received_by: receivedBy,
        p_line_items: lineItems,
        p_notes: notes,
      });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error processing receiving:', error);
      return { data: null, error };
    }
  }

  /**
   * Get receiving history for a PO
   */
  static async getReceivingHistory(poId: string): Promise<{
    data: ReceivingLog[] | null;
    error: any;
  }> {
    try {
      const { data, error } = await supabase
        .from('receiving_logs')
        .select(
          `
          *,
          received_by_user:user_profiles!receiving_logs_received_by_fkey(id, full_name, email),
          line_items:receiving_line_items(
            *,
            po_line_item:purchase_order_line_items(*)
          )
        `
        )
        .eq('po_id', poId)
        .order('received_at', { ascending: false });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error fetching receiving history:', error);
      return { data: null, error };
    }
  }

  /**
   * Get all receiving logs for the company
   */
  static async getAllReceivingLogs(filters?: {
    start_date?: string;
    end_date?: string;
    po_id?: string;
    received_by?: string;
  }): Promise<{ data: ReceivingLog[] | null; error: any }> {
    try {
      let query = supabase
        .from('receiving_logs')
        .select(
          `
          *,
          po:purchase_orders(id, po_number, vendor:vendors(vendor_name)),
          received_by_user:user_profiles!receiving_logs_received_by_fkey(id, full_name, email)
        `
        )
        .order('received_at', { ascending: false });

      if (filters?.start_date) {
        query = query.gte('received_at', filters.start_date);
      }

      if (filters?.end_date) {
        query = query.lte('received_at', filters.end_date);
      }

      if (filters?.po_id) {
        query = query.eq('po_id', filters.po_id);
      }

      if (filters?.received_by) {
        query = query.eq('received_by', filters.received_by);
      }

      const { data, error } = await query;

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error fetching receiving logs:', error);
      return { data: null, error };
    }
  }

  /**
   * Check work order readiness
   */
  static async checkWorkOrderReadiness(workOrderId: string): Promise<{
    data: boolean | null;
    error: any;
  }> {
    try {
      const { data, error } = await supabase.rpc(
        'check_work_order_readiness',
        {
          p_work_order_id: workOrderId,
        }
      );

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error checking work order readiness:', error);
      return { data: null, error };
    }
  }

  /**
   * Get ready work orders (garments received, ready for production)
   */
  static async getReadyWorkOrders(): Promise<{
    data: WorkOrder[] | null;
    error: any;
  }> {
    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select(
          `
          *,
          assigned_user:user_profiles!work_orders_assigned_to_fkey(id, full_name, email),
          quote:quotes(id, quote_number),
          customer:customers(id, name)
        `
        )
        .eq('ready_for_production', true)
        .eq('garments_ready', true)
        .in('status', ['draft', 'in_progress', 'on_hold'])
        .order('production_due_date', { ascending: true });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error fetching ready work orders:', error);
      return { data: null, error };
    }
  }

  /**
   * Get pending work orders (waiting for garments)
   */
  static async getPendingWorkOrders(): Promise<{
    data: WorkOrder[] | null;
    error: any;
  }> {
    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select(
          `
          *,
          assigned_user:user_profiles!work_orders_assigned_to_fkey(id, full_name, email),
          quote:quotes(id, quote_number),
          customer:customers(id, name)
        `
        )
        .eq('garments_ready', false)
        .in('status', ['draft', 'in_progress'])
        .order('production_due_date', { ascending: true });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error fetching pending work orders:', error);
      return { data: null, error };
    }
  }

  /**
   * Get garment requirements for a work order
   */
  static async getWorkOrderRequirements(workOrderId: string): Promise<{
    data: Array<{
      id: string;
      style_number: string;
      style_name: string;
      color: string;
      total_quantity: number;
      is_po_created: boolean;
      po_id: string | null;
      quantity_received: number;
      quantity_pending: number;
    }> | null;
    error: any;
  }> {
    try {
      const { data, error } = await supabase
        .from('garment_requirements_staging')
        .select(
          `
          id,
          style_number,
          style_name,
          color,
          total_quantity,
          is_po_created,
          po_id
        `
        )
        .eq('work_order_id', workOrderId);

      if (error) throw error;

      // For each requirement, get received quantities
      const enrichedData = await Promise.all(
        (data || []).map(async (req) => {
          if (req.po_id) {
            const { data: lineItems } = await supabase
              .from('purchase_order_line_items')
              .select('quantity_ordered, quantity_received')
              .eq('po_id', req.po_id)
              .eq('style_number', req.style_number)
              .eq('color', req.color);

            const received = lineItems?.reduce(
              (sum, item) => sum + item.quantity_received,
              0
            ) || 0;
            const ordered = lineItems?.reduce(
              (sum, item) => sum + item.quantity_ordered,
              0
            ) || 0;

            return {
              ...req,
              quantity_received: received,
              quantity_pending: Math.max(0, ordered - received),
            };
          }

          return {
            ...req,
            quantity_received: 0,
            quantity_pending: req.total_quantity,
          };
        })
      );

      return { data: enrichedData, error: null };
    } catch (error) {
      console.error('Error fetching work order requirements:', error);
      return { data: null, error };
    }
  }

  /**
   * Get receiving statistics
   */
  static async getReceivingStats(): Promise<{
    data: {
      pending_pos: number;
      blocked_pos: number;
      partially_received_pos: number;
      total_received_today: number;
      total_received_week: number;
      ready_work_orders: number;
      pending_work_orders: number;
    } | null;
    error: any;
  }> {
    try {
      // Get receivable POs
      const { data: receivablePOs } = await this.getReceivablePOs();

      // Get today's receiving logs
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data: todayLogs } = await supabase
        .from('receiving_logs')
        .select('id')
        .gte('received_at', today.toISOString());

      // Get this week's receiving logs
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const { data: weekLogs } = await supabase
        .from('receiving_logs')
        .select('id')
        .gte('received_at', weekStart.toISOString());

      // Get ready and pending work orders
      const { data: readyWOs } = await supabase
        .from('work_orders')
        .select('id')
        .eq('ready_for_production', true)
        .in('status', ['draft', 'in_progress', 'on_hold']);

      const { data: pendingWOs } = await supabase
        .from('work_orders')
        .select('id')
        .eq('garments_ready', false)
        .in('status', ['draft', 'in_progress']);

      const stats = {
        pending_pos: receivablePOs?.filter((po) => po.can_receive).length || 0,
        blocked_pos:
          receivablePOs?.filter((po) => !po.can_receive).length || 0,
        partially_received_pos:
          receivablePOs?.filter((po) => po.status === 'partially_received')
            .length || 0,
        total_received_today: todayLogs?.length || 0,
        total_received_week: weekLogs?.length || 0,
        ready_work_orders: readyWOs?.length || 0,
        pending_work_orders: pendingWOs?.length || 0,
      };

      return { data: stats, error: null };
    } catch (error) {
      console.error('Error fetching receiving stats:', error);
      return { data: null, error };
    }
  }
}
