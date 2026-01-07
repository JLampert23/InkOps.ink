import { supabase } from '../lib/supabase-client';
import { Automation, AutomationLog, TriggerType } from '../types/automation';

export class AutomationEngineService {
  static async getAllAutomations(): Promise<Automation[]> {
    const { data, error } = await supabase
      .from('automations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async getAutomation(id: string): Promise<Automation | null> {
    const { data, error } = await supabase
      .from('automations')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async createAutomation(automation: Partial<Automation>): Promise<Automation> {
    const { data, error } = await supabase
      .from('automations')
      .insert([automation])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async updateAutomation(id: string, updates: Partial<Automation>): Promise<Automation> {
    const { data, error } = await supabase
      .from('automations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async deleteAutomation(id: string): Promise<void> {
    const { error } = await supabase
      .from('automations')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  static async toggleAutomation(id: string, enabled: boolean): Promise<void> {
    await this.updateAutomation(id, { is_enabled: enabled });
  }

  static async getAutomationLogs(automationId?: string, limit = 100): Promise<AutomationLog[]> {
    let query = supabase
      .from('automation_logs')
      .select('*')
      .order('executed_at', { ascending: false })
      .limit(limit);

    if (automationId) {
      query = query.eq('automation_id', automationId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  static async createLog(log: Partial<AutomationLog>): Promise<AutomationLog> {
    const { data, error } = await supabase
      .from('automation_logs')
      .insert([log])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async executeAutomation(automationId: string, triggerEvent: Record<string, any>): Promise<void> {
    const startTime = Date.now();

    try {
      const automation = await this.getAutomation(automationId);

      if (!automation || !automation.is_enabled) {
        throw new Error('Automation not found or disabled');
      }

      const conditionsMet = await this.evaluateConditions(automation.conditions, triggerEvent);

      if (!conditionsMet) {
        await this.createLog({
          automation_id: automationId,
          trigger_event: triggerEvent,
          executed_actions: [],
          status: 'success',
          execution_time_ms: Date.now() - startTime,
        });
        return;
      }

      const executedActions = [];

      for (const action of automation.actions) {
        try {
          await this.executeAction(action, triggerEvent);
          executedActions.push(action);
        } catch (actionError) {
          console.error(`Failed to execute action ${action.type}:`, actionError);
        }
      }

      await this.createLog({
        automation_id: automationId,
        trigger_event: triggerEvent,
        executed_actions: executedActions,
        status: 'success',
        execution_time_ms: Date.now() - startTime,
      });
    } catch (error) {
      await this.createLog({
        automation_id: automationId,
        trigger_event: triggerEvent,
        executed_actions: [],
        status: 'failure',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        execution_time_ms: Date.now() - startTime,
      });
      throw error;
    }
  }

  private static async evaluateConditions(conditions: any[], triggerEvent: Record<string, any>): Promise<boolean> {
    if (!conditions || conditions.length === 0) return true;

    let result = true;
    let currentOperator: 'AND' | 'OR' = 'AND';

    for (let i = 0; i < conditions.length; i++) {
      const condition = conditions[i];
      const conditionResult = this.evaluateCondition(condition, triggerEvent);

      if (i === 0) {
        result = conditionResult;
      } else {
        if (currentOperator === 'AND') {
          result = result && conditionResult;
        } else {
          result = result || conditionResult;
        }
      }

      if (condition.logicOperator) {
        currentOperator = condition.logicOperator;
      }
    }

    return result;
  }

  private static evaluateCondition(condition: any, triggerEvent: Record<string, any>): boolean {
    const fieldValue = triggerEvent[condition.field];
    const compareValue = condition.value;

    switch (condition.operator) {
      case 'equals':
        return fieldValue === compareValue;
      case 'not_equals':
        return fieldValue !== compareValue;
      case 'greater_than':
        return Number(fieldValue) > Number(compareValue);
      case 'less_than':
        return Number(fieldValue) < Number(compareValue);
      case 'contains':
        return String(fieldValue).toLowerCase().includes(String(compareValue).toLowerCase());
      case 'not_contains':
        return !String(fieldValue).toLowerCase().includes(String(compareValue).toLowerCase());
      case 'within_days':
        const date = new Date(fieldValue);
        const now = new Date();
        const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays <= Number(compareValue);
      default:
        return false;
    }
  }

  private static async executeAction(action: any, triggerEvent: Record<string, any>): Promise<void> {
    console.log(`Executing action: ${action.type}`, action.config);
  }

  static async triggerAutomationsByType(triggerType: TriggerType, eventData: Record<string, any>): Promise<void> {
    const { data: automations } = await supabase
      .from('automations')
      .select('*')
      .eq('trigger_type', triggerType)
      .eq('is_enabled', true);

    if (!automations || automations.length === 0) return;

    for (const automation of automations) {
      try {
        await this.executeAutomation(automation.id, eventData);
      } catch (error) {
        console.error(`Failed to execute automation ${automation.id}:`, error);
      }
    }
  }
}
