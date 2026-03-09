import { supabase } from '../lib/supabase-client';

export interface SchedulerTask {
  id: string;
  company_id: string;
  quote_id: string | null;
  work_order_id: string | null;
  line_item_id: string | null;
  imprint_id: string | null;
  type_of_work: string;
  imprint_number: string | null;
  artwork_thumb_url: string | null;
  production_due_date: string;
  station: string | null;
  quantity: number;
  step_statuses: Record<string, any>;
  priority_order: number;
  customer_name: string | null;
  quote_number: string | null;
  scheduler_column: string;
  assigned_to: string | null;
  colors: string | null;
  press_type: string | null;
  estimated_runtime: number;
  actual_runtime: number;
  department: string | null;
  notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SchedulerColumn {
  id: string;
  company_id: string;
  column_name: string;
  column_order: number;
  color: string;
  is_default: boolean;
  is_completion_column: boolean;
  created_at: string;
  updated_at: string;
}

export interface SchedulerAssignment {
  id: string;
  company_id: string;
  department: string;
  type_of_work: string;
  assignment_mode: 'round_robin' | 'skill_based' | 'manual' | 'least_loaded';
  eligible_users: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export class SchedulerService {
  static async getTasks(filters?: {
    scheduler_column?: string;
    department?: string;
    type_of_work?: string;
    assigned_to?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<{ data: SchedulerTask[] | null; error: any }> {
    let query = supabase
      .from('production_schedule_entries')
      .select('*')
      .order('production_due_date', { ascending: true })
      .order('priority_order', { ascending: true });

    if (filters?.scheduler_column) {
      query = query.eq('scheduler_column', filters.scheduler_column);
    }

    if (filters?.department) {
      query = query.eq('department', filters.department);
    }

    if (filters?.type_of_work) {
      query = query.eq('type_of_work', filters.type_of_work);
    }

    if (filters?.assigned_to) {
      query = query.eq('assigned_to', filters.assigned_to);
    }

    if (filters?.start_date) {
      query = query.gte('production_due_date', filters.start_date);
    }

    if (filters?.end_date) {
      query = query.lte('production_due_date', filters.end_date);
    }

    return await query;
  }

  static async getTaskById(
    taskId: string
  ): Promise<{ data: SchedulerTask | null; error: any }> {
    return await supabase
      .from('production_schedule_entries')
      .select('*')
      .eq('id', taskId)
      .maybeSingle();
  }

  static async updateTask(
    taskId: string,
    updates: Partial<SchedulerTask>
  ): Promise<{ data: SchedulerTask | null; error: any }> {
    return await supabase
      .from('production_schedule_entries')
      .update(updates)
      .eq('id', taskId)
      .select()
      .single();
  }

  static async moveTaskToColumn(
    taskId: string,
    columnName: string
  ): Promise<{ data: SchedulerTask | null; error: any }> {
    return await this.updateTask(taskId, { scheduler_column: columnName });
  }

  static async assignTask(
    taskId: string,
    userId: string
  ): Promise<{ data: SchedulerTask | null; error: any }> {
    return await this.updateTask(taskId, { assigned_to: userId });
  }

  static async unassignTask(
    taskId: string
  ): Promise<{ data: SchedulerTask | null; error: any }> {
    return await this.updateTask(taskId, { assigned_to: null });
  }

  static async updatePriority(
    taskId: string,
    priority: number
  ): Promise<{ data: SchedulerTask | null; error: any }> {
    return await this.updateTask(taskId, { priority_order: priority });
  }

  static async startTask(
    taskId: string
  ): Promise<{ data: SchedulerTask | null; error: any }> {
    return await this.updateTask(taskId, {
      scheduler_column: 'In Progress',
      started_at: new Date().toISOString(),
    });
  }

  static async completeTask(
    taskId: string,
    actualRuntime?: number
  ): Promise<{ data: SchedulerTask | null; error: any }> {
    const updates: Partial<SchedulerTask> = {
      scheduler_column: 'Complete',
      completed_at: new Date().toISOString(),
    };

    if (actualRuntime !== undefined) {
      updates.actual_runtime = actualRuntime;
    }

    return await this.updateTask(taskId, updates);
  }

  static async getColumns(): Promise<{
    data: SchedulerColumn[] | null;
    error: any;
  }> {
    return await supabase
      .from('scheduler_columns')
      .select('*')
      .order('column_order');
  }

  static async createColumn(
    column: Omit<SchedulerColumn, 'id' | 'created_at' | 'updated_at'>
  ): Promise<{ data: SchedulerColumn | null; error: any }> {
    return await supabase
      .from('scheduler_columns')
      .insert(column)
      .select()
      .single();
  }

  static async updateColumn(
    columnId: string,
    updates: Partial<SchedulerColumn>
  ): Promise<{ data: SchedulerColumn | null; error: any }> {
    return await supabase
      .from('scheduler_columns')
      .update(updates)
      .eq('id', columnId)
      .select()
      .single();
  }

  static async deleteColumn(
    columnId: string
  ): Promise<{ data: null; error: any }> {
    return await supabase.from('scheduler_columns').delete().eq('id', columnId);
  }

  static async reorderColumns(
    columnUpdates: { id: string; column_order: number }[]
  ): Promise<{ success: boolean; error?: any }> {
    try {
      for (const update of columnUpdates) {
        const { error } = await supabase
          .from('scheduler_columns')
          .update({ column_order: update.column_order })
          .eq('id', update.id);

        if (error) throw error;
      }
      return { success: true };
    } catch (error) {
      return { success: false, error };
    }
  }

  static async getAssignmentRules(): Promise<{
    data: SchedulerAssignment[] | null;
    error: any;
  }> {
    return await supabase.from('scheduler_assignments').select('*');
  }

  static async createAssignmentRule(
    rule: Omit<SchedulerAssignment, 'id' | 'created_at' | 'updated_at'>
  ): Promise<{ data: SchedulerAssignment | null; error: any }> {
    return await supabase
      .from('scheduler_assignments')
      .insert(rule)
      .select()
      .single();
  }

  static async updateAssignmentRule(
    ruleId: string,
    updates: Partial<SchedulerAssignment>
  ): Promise<{ data: SchedulerAssignment | null; error: any }> {
    return await supabase
      .from('scheduler_assignments')
      .update(updates)
      .eq('id', ruleId)
      .select()
      .single();
  }

  static async deleteAssignmentRule(
    ruleId: string
  ): Promise<{ data: null; error: any }> {
    return await supabase
      .from('scheduler_assignments')
      .delete()
      .eq('id', ruleId);
  }

  static async getTasksByWorkOrder(
    workOrderId: string
  ): Promise<{ data: SchedulerTask[] | null; error: any }> {
    return await supabase
      .from('production_schedule_entries')
      .select('*')
      .eq('work_order_id', workOrderId)
      .order('imprint_number');
  }

  static async getTasksByQuote(
    quoteId: string
  ): Promise<{ data: SchedulerTask[] | null; error: any }> {
    return await supabase
      .from('production_schedule_entries')
      .select('*')
      .eq('quote_id', quoteId)
      .order('imprint_number');
  }

  static async getTasksGroupedByColumn(): Promise<{
    data: Record<string, SchedulerTask[]> | null;
    error: any;
  }> {
    const { data: tasks, error } = await this.getTasks();

    if (error || !tasks) {
      return { data: null, error };
    }

    const grouped: Record<string, SchedulerTask[]> = {};

    tasks.forEach((task) => {
      const column = task.scheduler_column || 'Unscheduled';
      if (!grouped[column]) {
        grouped[column] = [];
      }
      grouped[column].push(task);
    });

    return { data: grouped, error: null };
  }

  static async getMyTasks(
    userId: string
  ): Promise<{ data: SchedulerTask[] | null; error: any }> {
    return await supabase
      .from('production_schedule_entries')
      .select('*')
      .eq('assigned_to', userId)
      .not('scheduler_column', 'in', '(Complete)')
      .order('production_due_date', { ascending: true });
  }

  static async getOverdueTasks(): Promise<{
    data: SchedulerTask[] | null;
    error: any;
  }> {
    const today = new Date().toISOString().split('T')[0];

    return await supabase
      .from('production_schedule_entries')
      .select('*')
      .lt('production_due_date', today)
      .not('scheduler_column', 'in', '(Complete)')
      .order('production_due_date', { ascending: true });
  }

  static async getDashboardStats(): Promise<{
    data: {
      total: number;
      unscheduled: number;
      in_progress: number;
      completed: number;
      overdue: number;
      by_department: Record<string, number>;
    } | null;
    error: any;
  }> {
    const { data: tasks, error } = await this.getTasks();

    if (error || !tasks) {
      return { data: null, error };
    }

    const today = new Date().toISOString().split('T')[0];

    const stats = {
      total: tasks.length,
      unscheduled: tasks.filter((t) => t.scheduler_column === 'Unscheduled')
        .length,
      in_progress: tasks.filter((t) => t.scheduler_column === 'In Progress')
        .length,
      completed: tasks.filter((t) => t.scheduler_column === 'Complete').length,
      overdue: tasks.filter(
        (t) =>
          t.production_due_date < today && t.scheduler_column !== 'Complete'
      ).length,
      by_department: {} as Record<string, number>,
    };

    tasks.forEach((task) => {
      const dept = task.department || 'unknown';
      stats.by_department[dept] = (stats.by_department[dept] || 0) + 1;
    });

    return { data: stats, error: null };
  }
}
