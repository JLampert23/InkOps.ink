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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!profile?.company_id) throw new Error('User company not found');

    const automationData = {
      ...automation,
      company_id: profile.company_id,
      created_by: user.id,
    };

    const { data, error } = await supabase
      .from('automations')
      .insert([automationData])
      .select()
      .single();

    if (error) {
      console.error('Failed to save automation:', error);
      console.error('Supabase request failed', error);
      throw error;
    }
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!profile?.company_id) throw new Error('User company not found');

    const logData = {
      ...log,
      company_id: profile.company_id,
    };

    const { data, error } = await supabase
      .from('automation_logs')
      .insert([logData])
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

    switch (action.type) {
      case 'send_message':
        await this.executeSendMessage(action.config, triggerEvent);
        break;
      case 'change_status':
        await this.executeChangeStatus(action.config, triggerEvent);
        break;
      case 'request_payment':
        await this.executeRequestPayment(action.config, triggerEvent);
        break;
      case 'request_approval':
        await this.executeRequestApproval(action.config, triggerEvent);
        break;
      default:
        console.log(`Action type ${action.type} not implemented yet`);
    }
  }

  private static async executeSendMessage(config: any, triggerEvent: Record<string, any>): Promise<void> {
    const { EmailService } = await import('./email-service');
    const { TwilioService } = await import('./twilio-service');

    const messageType = config.message_type || 'email';
    let recipient = config.to || '';
    let subject = config.subject || 'Notification';
    let message = config.message || '';

    recipient = this.replaceVariables(recipient, triggerEvent);
    subject = this.replaceVariables(subject, triggerEvent);
    message = this.replaceVariables(message, triggerEvent);

    if (messageType === 'email' || messageType === 'both') {
      const emailRecipient = recipient || triggerEvent.customer_email;
      if (emailRecipient) {
        await EmailService.sendEmail({
          to: [emailRecipient],
          subject,
          template: 'custom',
          html: `<div style="font-family: sans-serif; padding: 20px;">${message.replace(/\n/g, '<br>')}</div>`,
        });
        console.log(`Email sent to ${emailRecipient}`);
      }
    }

    if (messageType === 'sms' || messageType === 'both') {
      const phoneNumber = triggerEvent.customer_phone;
      if (phoneNumber) {
        await TwilioService.sendSMS(phoneNumber, message);
        console.log(`SMS sent to ${phoneNumber}`);
      }
    }
  }

  private static async executeChangeStatus(config: any, triggerEvent: Record<string, any>): Promise<void> {
    const entityType = config.entity_type;
    const entityIdField = config.entity_id_field;
    const newStatus = this.replaceVariables(config.new_status, triggerEvent);
    const entityId = triggerEvent[entityIdField];

    if (!entityId) {
      console.error(`Entity ID not found in trigger event for field: ${entityIdField}`);
      return;
    }

    let tableName = '';
    let statusField = 'status';

    switch (entityType) {
      case 'invoice':
        tableName = 'billing_queue';
        statusField = 'payment_status';
        break;
      case 'work_order':
        tableName = 'work_orders';
        statusField = 'status';
        break;
      case 'quote':
        tableName = 'quotes';
        statusField = 'status';
        break;
      case 'purchase_order':
        tableName = 'purchase_orders';
        statusField = 'status';
        break;
      default:
        console.error(`Unknown entity type: ${entityType}`);
        return;
    }

    const { error } = await supabase
      .from(tableName)
      .update({ [statusField]: newStatus })
      .eq('id', entityId);

    if (error) {
      console.error(`Failed to update ${entityType} status:`, error);
      throw error;
    }

    console.log(`Updated ${entityType} ${entityId} status to ${newStatus}`);
  }

  private static async executeRequestPayment(config: any, triggerEvent: Record<string, any>): Promise<void> {
    const { billingService } = await import('./billing-service');

    const invoiceId = this.replaceVariables(config.invoice_id, triggerEvent);
    const percentage = parseFloat(config.percentage || '100');

    console.log(`Requesting ${percentage}% payment for invoice ${invoiceId}`);
  }

  private static async executeRequestApproval(config: any, triggerEvent: Record<string, any>): Promise<void> {
    const { EmailService } = await import('./email-service');

    const approvalType = this.replaceVariables(config.approval_type, triggerEvent);
    const recipientEmail = this.replaceVariables(config.recipient_email, triggerEvent);
    const customMessage = this.replaceVariables(config.message || '', triggerEvent);

    console.log(`Requesting ${approvalType} approval from ${recipientEmail}`);
  }

  private static replaceVariables(template: string, data: Record<string, any>): string {
    if (!template) return '';

    let result = template;

    const variablePattern = /\{\{([^}]+)\}\}/g;
    result = result.replace(variablePattern, (match, key) => {
      const trimmedKey = key.trim();
      return data[trimmedKey] !== undefined ? String(data[trimmedKey]) : match;
    });

    return result;
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
