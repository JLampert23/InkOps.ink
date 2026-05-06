import { supabase } from '../lib/supabase-client';

export interface WorkflowStage {
  id: string;
  company_id: string;
  stage_key: string;
  stage_name: string;
  stage_order: number;
  description: string | null;
  requires_qc: boolean;
  auto_advance: boolean;
  department: string | null;
  expected_duration_hours: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkflowTracking {
  id: string;
  company_id: string;
  work_order_id: string;
  current_stage_key: string;
  current_stage_started_at: string;
  previous_stage_key: string | null;
  pre_press_started_at: string | null;
  pre_press_completed_at: string | null;
  pre_press_completed_by: string | null;
  pre_press_duration_minutes: number | null;
  production_started_at: string | null;
  production_completed_at: string | null;
  production_completed_by: string | null;
  production_duration_minutes: number | null;
  production_type: string | null;
  finishing_started_at: string | null;
  finishing_completed_at: string | null;
  finishing_completed_by: string | null;
  finishing_duration_minutes: number | null;
  qc_started_at: string | null;
  qc_completed_at: string | null;
  qc_completed_by: string | null;
  qc_duration_minutes: number | null;
  qc_passed: boolean | null;
  completed_at: string | null;
  completed_by: string | null;
  total_duration_minutes: number | null;
  is_on_hold: boolean;
  hold_reason: string | null;
  hold_started_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowTransition {
  id: string;
  company_id: string;
  work_order_id: string;
  work_order_number: string;
  from_stage: string | null;
  to_stage: string;
  transition_type: 'advance' | 'revert' | 'skip' | 'hold' | 'resume';
  performed_by: string;
  performed_by_name: string;
  notes: string | null;
  metadata: any;
  created_at: string;
}

export interface QCInspection {
  id: string;
  company_id: string;
  work_order_id: string;
  work_order_number: string;
  inspector_id: string;
  inspector_name: string;
  inspection_date: string;
  passed: boolean;
  items_inspected: number;
  items_passed: number;
  items_failed: number;
  failure_reason: string | null;
  variance_notes: string | null;
  corrective_action: string | null;
  requires_rework: boolean;
  rework_notes: string | null;
  inspection_photos: any;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export interface ProductionVariance {
  id: string;
  company_id: string;
  work_order_id: string;
  work_order_number: string;
  stage_key: string;
  variance_type: 'quality' | 'quantity' | 'timing' | 'equipment' | 'material' | 'other';
  severity: 'minor' | 'moderate' | 'major' | 'critical';
  description: string;
  quantity_affected: number;
  reported_by: string;
  reported_by_name: string;
  reported_at: string;
  resolution_status: 'open' | 'in_progress' | 'resolved' | 'closed';
  resolution_notes: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowResult {
  success: boolean;
  from_stage?: string;
  to_stage?: string;
  duration_minutes?: number;
  message?: string;
  error?: string;
}

export class ProductionWorkflowService {
  /**
   * Initialize workflow tracking for a work order
   */
  static async initializeWorkflow(workOrderId: string): Promise<{
    data: string | null;
    error: any;
  }> {
    try {
      const { data, error } = await supabase.rpc('initialize_work_order_workflow', {
        p_work_order_id: workOrderId,
      });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error initializing workflow:', error);
      return { data: null, error };
    }
  }

  /**
   * Get workflow stages for the company
   */
  static async getWorkflowStages(): Promise<{
    data: WorkflowStage[] | null;
    error: any;
  }> {
    try {
      const { data, error } = await supabase
        .from('production_workflow_stages')
        .select('*')
        .eq('is_active', true)
        .order('stage_order');

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error fetching workflow stages:', error);
      return { data: null, error };
    }
  }

  /**
   * Get workflow tracking for a work order
   */
  static async getWorkflowTracking(workOrderId: string): Promise<{
    data: WorkflowTracking | null;
    error: any;
  }> {
    try {
      const { data, error } = await supabase
        .from('work_order_workflow_tracking')
        .select('*')
        .eq('work_order_id', workOrderId)
        .maybeSingle();

      if (error) throw error;

      return { data: data ?? null, error: null };
    } catch (error) {
      console.error('Error fetching workflow tracking:', error);
      return { data: null, error };
    }
  }

  /**
   * Advance work order to next stage
   */
  static async advanceStage(
    workOrderId: string,
    userId: string,
    notes?: string,
    metadata?: any
  ): Promise<{ data: WorkflowResult | null; error: any }> {
    try {
      const { data, error } = await supabase.rpc('advance_workflow_stage', {
        p_work_order_id: workOrderId,
        p_user_id: userId,
        p_notes: notes,
        p_metadata: metadata,
      });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error advancing workflow stage:', error);
      return { data: null, error };
    }
  }

  /**
   * Put work order on hold
   */
  static async holdWorkOrder(
    workOrderId: string,
    userId: string,
    reason: string,
    metadata?: any
  ): Promise<{ data: WorkflowResult | null; error: any }> {
    try {
      const { data, error } = await supabase.rpc('hold_work_order', {
        p_work_order_id: workOrderId,
        p_user_id: userId,
        p_reason: reason,
        p_metadata: metadata,
      });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error holding work order:', error);
      return { data: null, error };
    }
  }

  /**
   * Resume work order from hold
   */
  static async resumeWorkOrder(
    workOrderId: string,
    userId: string,
    notes?: string,
    metadata?: any
  ): Promise<{ data: WorkflowResult | null; error: any }> {
    try {
      const { data, error } = await supabase.rpc('resume_work_order', {
        p_work_order_id: workOrderId,
        p_user_id: userId,
        p_notes: notes,
        p_metadata: metadata,
      });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error resuming work order:', error);
      return { data: null, error };
    }
  }

  /**
   * Create QC inspection
   */
  static async createQCInspection(params: {
    workOrderId: string;
    inspectorId: string;
    passed: boolean;
    itemsInspected: number;
    itemsPassed: number;
    itemsFailed: number;
    failureReason?: string;
    varianceNotes?: string;
    correctiveAction?: string;
    requiresRework?: boolean;
    reworkNotes?: string;
    metadata?: any;
  }): Promise<{ data: any | null; error: any }> {
    try {
      const { data, error } = await supabase.rpc('create_qc_inspection', {
        p_work_order_id: params.workOrderId,
        p_inspector_id: params.inspectorId,
        p_passed: params.passed,
        p_items_inspected: params.itemsInspected,
        p_items_passed: params.itemsPassed,
        p_items_failed: params.itemsFailed,
        p_failure_reason: params.failureReason,
        p_variance_notes: params.varianceNotes,
        p_corrective_action: params.correctiveAction,
        p_requires_rework: params.requiresRework,
        p_rework_notes: params.reworkNotes,
        p_metadata: params.metadata,
      });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error creating QC inspection:', error);
      return { data: null, error };
    }
  }

  /**
   * Fail QC and revert to production
   */
  static async failQCAndRevert(
    workOrderId: string,
    inspectorId: string,
    itemsInspected: number,
    itemsFailed: number,
    failureReason: string,
    reworkNotes: string
  ): Promise<{ data: any | null; error: any }> {
    try {
      const { data, error } = await supabase.rpc('fail_qc_and_revert', {
        p_work_order_id: workOrderId,
        p_inspector_id: inspectorId,
        p_items_inspected: itemsInspected,
        p_items_failed: itemsFailed,
        p_failure_reason: failureReason,
        p_rework_notes: reworkNotes,
      });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error failing QC:', error);
      return { data: null, error };
    }
  }

  /**
   * Report production variance
   */
  static async reportVariance(params: {
    workOrderId: string;
    stageKey: string;
    varianceType: string;
    severity: string;
    description: string;
    reportedBy: string;
    quantityAffected?: number;
    metadata?: any;
  }): Promise<{ data: any | null; error: any }> {
    try {
      const { data, error } = await supabase.rpc('report_production_variance', {
        p_work_order_id: params.workOrderId,
        p_stage_key: params.stageKey,
        p_variance_type: params.varianceType,
        p_severity: params.severity,
        p_description: params.description,
        p_reported_by: params.reportedBy,
        p_quantity_affected: params.quantityAffected,
        p_metadata: params.metadata,
      });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error reporting variance:', error);
      return { data: null, error };
    }
  }

  /**
   * Resolve production variance
   */
  static async resolveVariance(
    varianceId: string,
    resolvedBy: string,
    resolutionNotes: string,
    resolutionStatus: string = 'resolved'
  ): Promise<{ data: any | null; error: any }> {
    try {
      const { data, error } = await supabase.rpc('resolve_production_variance', {
        p_variance_id: varianceId,
        p_resolved_by: resolvedBy,
        p_resolution_notes: resolutionNotes,
        p_resolution_status: resolutionStatus,
      });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error resolving variance:', error);
      return { data: null, error };
    }
  }

  /**
   * Get complete workflow status for a work order
   */
  static async getWorkflowStatus(workOrderId: string): Promise<{
    data: any | null;
    error: any;
  }> {
    try {
      const { data, error } = await supabase.rpc('get_work_order_workflow_status', {
        p_work_order_id: workOrderId,
      });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error fetching workflow status:', error);
      return { data: null, error };
    }
  }

  /**
   * Get workflow transitions for a work order
   */
  static async getWorkflowTransitions(workOrderId: string): Promise<{
    data: WorkflowTransition[] | null;
    error: any;
  }> {
    try {
      const { data, error } = await supabase
        .from('workflow_transition_log')
        .select('*')
        .eq('work_order_id', workOrderId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error fetching workflow transitions:', error);
      return { data: null, error };
    }
  }

  /**
   * Get QC inspections for a work order
   */
  static async getQCInspections(workOrderId: string): Promise<{
    data: QCInspection[] | null;
    error: any;
  }> {
    try {
      const { data, error } = await supabase
        .from('qc_inspections')
        .select('*')
        .eq('work_order_id', workOrderId)
        .order('inspection_date', { ascending: false });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error fetching QC inspections:', error);
      return { data: null, error };
    }
  }

  /**
   * Get production variances for a work order
   */
  static async getProductionVariances(workOrderId: string): Promise<{
    data: ProductionVariance[] | null;
    error: any;
  }> {
    try {
      const { data, error } = await supabase
        .from('production_variances')
        .select('*')
        .eq('work_order_id', workOrderId)
        .order('reported_at', { ascending: false });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error fetching production variances:', error);
      return { data: null, error };
    }
  }

  /**
   * Get work orders by stage
   */
  static async getWorkOrdersByStage(stageKey: string): Promise<{
    data: any[] | null;
    error: any;
  }> {
    try {
      const { data, error } = await supabase
        .from('work_order_workflow_tracking')
        .select(
          `
          *,
          work_order:work_orders(*)
        `
        )
        .eq('current_stage_key', stageKey)
        .eq('is_on_hold', false)
        .order('current_stage_started_at');

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error fetching work orders by stage:', error);
      return { data: null, error };
    }
  }

  /**
   * Get work orders on hold
   */
  static async getWorkOrdersOnHold(): Promise<{
    data: any[] | null;
    error: any;
  }> {
    try {
      const { data, error } = await supabase
        .from('work_order_workflow_tracking')
        .select(
          `
          *,
          work_order:work_orders(*)
        `
        )
        .eq('is_on_hold', true)
        .order('hold_started_at', { ascending: false });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error fetching work orders on hold:', error);
      return { data: null, error };
    }
  }

  /**
   * Get open production variances
   */
  static async getOpenVariances(): Promise<{
    data: ProductionVariance[] | null;
    error: any;
  }> {
    try {
      const { data, error } = await supabase
        .from('production_variances')
        .select('*')
        .in('resolution_status', ['open', 'in_progress'])
        .order('severity', { ascending: false })
        .order('reported_at', { ascending: false });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error fetching open variances:', error);
      return { data: null, error };
    }
  }

  /**
   * Get stage performance statistics
   */
  static async getStagePerformanceStats(
    startDate?: string,
    endDate?: string
  ): Promise<{
    data: any | null;
    error: any;
  }> {
    try {
      const { data, error } = await supabase.rpc('get_stage_performance_stats', {
        p_company_id: null,
        p_start_date: startDate,
        p_end_date: endDate,
      });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error fetching stage performance stats:', error);
      return { data: null, error };
    }
  }

  /**
   * Get workflow dashboard stats
   */
  static async getDashboardStats(): Promise<{
    data: {
      by_stage: Record<string, number>;
      on_hold: number;
      completed_today: number;
      completed_week: number;
      open_variances: number;
      critical_variances: number;
      failed_qc_today: number;
    } | null;
    error: any;
  }> {
    try {
      // Get work orders by stage
      const { data: byStage } = await supabase
        .from('work_order_workflow_tracking')
        .select('current_stage_key')
        .eq('is_on_hold', false);

      const stageCounts = byStage?.reduce((acc, item) => {
        acc[item.current_stage_key] = (acc[item.current_stage_key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      // Get on hold count
      const { data: onHold } = await supabase
        .from('work_order_workflow_tracking')
        .select('id', { count: 'exact', head: true })
        .eq('is_on_hold', true);

      // Get completed today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data: completedToday } = await supabase
        .from('work_order_workflow_tracking')
        .select('id', { count: 'exact', head: true })
        .gte('completed_at', today.toISOString());

      // Get completed this week
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const { data: completedWeek } = await supabase
        .from('work_order_workflow_tracking')
        .select('id', { count: 'exact', head: true })
        .gte('completed_at', weekStart.toISOString());

      // Get open variances
      const { data: openVariances } = await supabase
        .from('production_variances')
        .select('id', { count: 'exact', head: true })
        .in('resolution_status', ['open', 'in_progress']);

      // Get critical variances
      const { data: criticalVariances } = await supabase
        .from('production_variances')
        .select('id', { count: 'exact', head: true })
        .eq('severity', 'critical')
        .in('resolution_status', ['open', 'in_progress']);

      // Get failed QC today
      const { data: failedQC } = await supabase
        .from('qc_inspections')
        .select('id', { count: 'exact', head: true })
        .eq('passed', false)
        .gte('inspection_date', today.toISOString());

      const stats = {
        by_stage: stageCounts,
        on_hold: onHold?.count || 0,
        completed_today: completedToday?.count || 0,
        completed_week: completedWeek?.count || 0,
        open_variances: openVariances?.count || 0,
        critical_variances: criticalVariances?.count || 0,
        failed_qc_today: failedQC?.count || 0,
      };

      return { data: stats, error: null };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      return { data: null, error };
    }
  }
}
