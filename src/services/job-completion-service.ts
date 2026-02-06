import { supabase } from '../lib/supabase-client';

export interface DeliveryTask {
  id: string;
  company_id: string;
  work_order_id: string;
  work_order_number: string;
  quote_id: string | null;
  invoice_id: string | null;
  customer_name: string;
  delivery_type: 'pickup' | 'local_delivery' | 'shipping' | 'courier';
  delivery_status: 'pending' | 'scheduled' | 'in_transit' | 'delivered' | 'failed' | 'cancelled';
  delivery_address_line1: string | null;
  delivery_address_line2: string | null;
  delivery_city: string | null;
  delivery_state: string | null;
  delivery_zip: string | null;
  delivery_country: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  scheduled_date: string | null;
  scheduled_time_start: string | null;
  scheduled_time_end: string | null;
  tracking_number: string | null;
  carrier: string | null;
  estimated_delivery_date: string | null;
  actual_delivery_date: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  delivery_notes: string | null;
  special_instructions: string | null;
  signature_required: boolean;
  signature_received: boolean;
  signature_name: string | null;
  signature_timestamp: string | null;
  num_packages: number;
  weight_lbs: number | null;
  dimensions_length_in: number | null;
  dimensions_width_in: number | null;
  dimensions_height_in: number | null;
  created_by: string | null;
  created_by_name: string | null;
  completed_by: string | null;
  completed_by_name: string | null;
  completed_at: string | null;
  delivery_photos: any;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export interface JobCompletionLog {
  id: string;
  company_id: string;
  work_order_id: string;
  work_order_number: string;
  completion_step: string;
  step_status: 'started' | 'completed' | 'failed' | 'skipped';
  step_message: string | null;
  error_details: string | null;
  performed_by: string | null;
  performed_by_name: string | null;
  metadata: any;
  created_at: string;
}

export interface CompletionResult {
  success: boolean;
  work_order_number?: string;
  has_errors?: boolean;
  steps?: any[];
  message?: string;
  error?: string;
}

export class JobCompletionService {
  /**
   * Create delivery task for completed work order
   */
  static async createDeliveryTask(params: {
    workOrderId: string;
    deliveryType: 'pickup' | 'local_delivery' | 'shipping' | 'courier';
    createdBy: string;
    deliveryAddress?: {
      address_line1?: string;
      address_line2?: string;
      city?: string;
      state?: string;
      zip?: string;
      country?: string;
      special_instructions?: string;
    };
    contactInfo?: {
      name?: string;
      phone?: string;
      email?: string;
    };
    deliveryNotes?: string;
    metadata?: any;
  }): Promise<{ data: any | null; error: any }> {
    try {
      const { data, error } = await supabase.rpc('create_delivery_task', {
        p_work_order_id: params.workOrderId,
        p_delivery_type: params.deliveryType,
        p_created_by: params.createdBy,
        p_delivery_address: params.deliveryAddress,
        p_contact_info: params.contactInfo,
        p_delivery_notes: params.deliveryNotes,
        p_metadata: params.metadata,
      });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error creating delivery task:', error);
      return { data: null, error };
    }
  }

  /**
   * Update delivery task status
   */
  static async updateDeliveryTask(
    deliveryTaskId: string,
    updates: Partial<DeliveryTask>
  ): Promise<{ data: DeliveryTask | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('delivery_tasks')
        .update(updates)
        .eq('id', deliveryTaskId)
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error updating delivery task:', error);
      return { data: null, error };
    }
  }

  /**
   * Get delivery tasks for a work order
   */
  static async getDeliveryTasks(workOrderId: string): Promise<{
    data: DeliveryTask[] | null;
    error: any;
  }> {
    try {
      const { data, error } = await supabase
        .from('delivery_tasks')
        .select('*')
        .eq('work_order_id', workOrderId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error fetching delivery tasks:', error);
      return { data: null, error };
    }
  }

  /**
   * Get all delivery tasks with filters
   */
  static async getAllDeliveryTasks(filters?: {
    status?: string;
    assignedTo?: string;
    scheduledDate?: string;
  }): Promise<{ data: DeliveryTask[] | null; error: any }> {
    try {
      let query = supabase
        .from('delivery_tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('delivery_status', filters.status);
      }

      if (filters?.assignedTo) {
        query = query.eq('assigned_to', filters.assignedTo);
      }

      if (filters?.scheduledDate) {
        query = query.eq('scheduled_date', filters.scheduledDate);
      }

      const { data, error } = await query;

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error fetching delivery tasks:', error);
      return { data: null, error };
    }
  }

  /**
   * Mark delivery as completed
   */
  static async completeDelivery(
    deliveryTaskId: string,
    completedBy: string,
    signatureInfo?: {
      signatureName?: string;
      signatureReceived?: boolean;
    }
  ): Promise<{ data: any | null; error: any }> {
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('full_name, email')
        .eq('id', completedBy)
        .single();

      const updates: Partial<DeliveryTask> = {
        delivery_status: 'delivered',
        completed_at: new Date().toISOString(),
        completed_by: completedBy,
        completed_by_name: profile?.full_name || profile?.email || 'Unknown',
        actual_delivery_date: new Date().toISOString(),
      };

      if (signatureInfo) {
        updates.signature_received = signatureInfo.signatureReceived || false;
        updates.signature_name = signatureInfo.signatureName;
        if (signatureInfo.signatureReceived) {
          updates.signature_timestamp = new Date().toISOString();
        }
      }

      const { data, error } = await supabase
        .from('delivery_tasks')
        .update(updates)
        .eq('id', deliveryTaskId)
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error completing delivery:', error);
      return { data: null, error };
    }
  }

  /**
   * Finalize invoice for work order
   */
  static async finalizeInvoice(
    workOrderId: string,
    userId: string,
    sendEmail: boolean = false
  ): Promise<{ data: any | null; error: any }> {
    try {
      const { data, error } = await supabase.rpc('finalize_invoice_for_work_order', {
        p_work_order_id: workOrderId,
        p_user_id: userId,
        p_send_email: sendEmail,
      });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error finalizing invoice:', error);
      return { data: null, error };
    }
  }

  /**
   * Archive job (work order, quote, invoice)
   */
  static async archiveJob(
    workOrderId: string,
    userId: string,
    archiveQuote: boolean = true,
    archiveInvoice: boolean = true
  ): Promise<{ data: any | null; error: any }> {
    try {
      const { data, error } = await supabase.rpc('archive_job', {
        p_work_order_id: workOrderId,
        p_user_id: userId,
        p_archive_quote: archiveQuote,
        p_archive_invoice: archiveInvoice,
      });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error archiving job:', error);
      return { data: null, error };
    }
  }

  /**
   * Unarchive job
   */
  static async unarchiveJob(
    workOrderId: string,
    userId: string
  ): Promise<{ data: any | null; error: any }> {
    try {
      const { data, error } = await supabase.rpc('unarchive_job', {
        p_work_order_id: workOrderId,
        p_user_id: userId,
      });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error unarchiving job:', error);
      return { data: null, error };
    }
  }

  /**
   * Get job completion log for work order
   */
  static async getCompletionLog(workOrderId: string): Promise<{
    data: JobCompletionLog[] | null;
    error: any;
  }> {
    try {
      const { data, error } = await supabase
        .from('job_completion_log')
        .select('*')
        .eq('work_order_id', workOrderId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error fetching completion log:', error);
      return { data: null, error };
    }
  }

  /**
   * Complete job automation (orchestrates all steps)
   */
  static async completeJobAutomation(params: {
    workOrderId: string;
    userId: string;
    finalizeInvoice?: boolean;
    sendInvoiceEmail?: boolean;
    createDelivery?: boolean;
    deliveryType?: 'pickup' | 'local_delivery' | 'shipping' | 'courier';
    deliveryAddress?: {
      address_line1?: string;
      address_line2?: string;
      city?: string;
      state?: string;
      zip?: string;
      country?: string;
      special_instructions?: string;
    };
    archiveJob?: boolean;
  }): Promise<{ data: CompletionResult | null; error: any }> {
    try {
      const { data, error } = await supabase.rpc('complete_job_automation', {
        p_work_order_id: params.workOrderId,
        p_user_id: params.userId,
        p_finalize_invoice: params.finalizeInvoice ?? true,
        p_send_invoice_email: params.sendInvoiceEmail ?? false,
        p_create_delivery: params.createDelivery ?? true,
        p_delivery_type: params.deliveryType ?? 'pickup',
        p_delivery_address: params.deliveryAddress,
        p_archive_job: params.archiveJob ?? false,
      });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error completing job automation:', error);
      return { data: null, error };
    }
  }

  /**
   * Get archived jobs
   */
  static async getArchivedJobs(): Promise<{
    data: any[] | null;
    error: any;
  }> {
    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select(
          `
          *,
          quote:quotes(*),
          workflow:work_order_workflow_tracking(*)
        `
        )
        .eq('archived', true)
        .order('archived_at', { ascending: false });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error fetching archived jobs:', error);
      return { data: null, error };
    }
  }

  /**
   * Get active (non-archived) jobs
   */
  static async getActiveJobs(): Promise<{
    data: any[] | null;
    error: any;
  }> {
    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select(
          `
          *,
          quote:quotes(*),
          workflow:work_order_workflow_tracking(*)
        `
        )
        .eq('archived', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error fetching active jobs:', error);
      return { data: null, error };
    }
  }

  /**
   * Get delivery dashboard stats
   */
  static async getDeliveryDashboardStats(): Promise<{
    data: {
      pending: number;
      scheduled: number;
      in_transit: number;
      delivered_today: number;
      failed: number;
    } | null;
    error: any;
  }> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get counts by status
      const { data: pending } = await supabase
        .from('delivery_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('delivery_status', 'pending');

      const { data: scheduled } = await supabase
        .from('delivery_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('delivery_status', 'scheduled');

      const { data: inTransit } = await supabase
        .from('delivery_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('delivery_status', 'in_transit');

      const { data: deliveredToday } = await supabase
        .from('delivery_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('delivery_status', 'delivered')
        .gte('actual_delivery_date', today.toISOString());

      const { data: failed } = await supabase
        .from('delivery_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('delivery_status', 'failed');

      const stats = {
        pending: pending?.count || 0,
        scheduled: scheduled?.count || 0,
        in_transit: inTransit?.count || 0,
        delivered_today: deliveredToday?.count || 0,
        failed: failed?.count || 0,
      };

      return { data: stats, error: null };
    } catch (error) {
      console.error('Error fetching delivery dashboard stats:', error);
      return { data: null, error };
    }
  }

  /**
   * Get deliveries scheduled for a specific date
   */
  static async getScheduledDeliveries(date: string): Promise<{
    data: DeliveryTask[] | null;
    error: any;
  }> {
    try {
      const { data, error } = await supabase
        .from('delivery_tasks')
        .select('*')
        .eq('scheduled_date', date)
        .in('delivery_status', ['scheduled', 'pending'])
        .order('scheduled_time_start');

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error fetching scheduled deliveries:', error);
      return { data: null, error };
    }
  }

  /**
   * Assign delivery to user
   */
  static async assignDelivery(
    deliveryTaskId: string,
    assignedTo: string
  ): Promise<{ data: any | null; error: any }> {
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('full_name, email')
        .eq('id', assignedTo)
        .single();

      const { data, error } = await supabase
        .from('delivery_tasks')
        .update({
          assigned_to: assignedTo,
          assigned_to_name: profile?.full_name || profile?.email || 'Unknown',
        })
        .eq('id', deliveryTaskId)
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error assigning delivery:', error);
      return { data: null, error };
    }
  }

  /**
   * Get my assigned deliveries
   */
  static async getMyDeliveries(userId: string): Promise<{
    data: DeliveryTask[] | null;
    error: any;
  }> {
    try {
      const { data, error } = await supabase
        .from('delivery_tasks')
        .select('*')
        .eq('assigned_to', userId)
        .in('delivery_status', ['pending', 'scheduled', 'in_transit'])
        .order('scheduled_date', { ascending: true, nullsFirst: false });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error fetching my deliveries:', error);
      return { data: null, error };
    }
  }
}
