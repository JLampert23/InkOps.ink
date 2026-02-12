import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AutomationQueue {
  id: string;
  company_id: string;
  automation_id: string;
  trigger_type: string;
  trigger_data: any;
  scheduled_for: string;
  attempts: number;
  max_attempts: number;
}

interface Automation {
  id: string;
  company_id: string;
  name: string;
  trigger_type: string;
  conditions: any[];
  actions: any[];
  is_enabled: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all pending automations that are ready to execute
    const { data: queueItems, error: queueError } = await supabase
      .from('automation_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(50);

    if (queueError) {
      throw new Error(`Failed to fetch queue: ${queueError.message}`);
    }

    if (!queueItems || queueItems.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No pending automations to process',
          processed: 0
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Processing ${queueItems.length} automation queue items`);

    const results = await Promise.all(
      queueItems.map((item) => processQueueItem(supabase, item))
    );

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${queueItems.length} automations`,
        successful,
        failed,
        results
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error processing automation queue:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process automation queue',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function processQueueItem(supabase: any, queueItem: AutomationQueue) {
  try {
    // Mark as processing
    await supabase
      .from('automation_queue')
      .update({ status: 'processing' })
      .eq('id', queueItem.id);

    // Get automation details
    const { data: automation, error: autoError } = await supabase
      .from('automations')
      .select('*')
      .eq('id', queueItem.automation_id)
      .maybeSingle();

    if (autoError || !automation) {
      throw new Error(`Automation not found: ${queueItem.automation_id}`);
    }

    if (!automation.is_enabled) {
      throw new Error('Automation is disabled');
    }

    // Validate conditions
    const conditionsMet = await validateConditions(
      supabase,
      automation.conditions,
      queueItem.trigger_data,
      queueItem.company_id
    );

    if (!conditionsMet) {
      // Mark as cancelled if conditions not met
      await supabase
        .from('automation_queue')
        .update({
          status: 'cancelled',
          processed_at: new Date().toISOString(),
          error_message: 'Conditions not met'
        })
        .eq('id', queueItem.id);

      return { success: true, skipped: true, reason: 'Conditions not met' };
    }

    // Execute actions
    const actionResults = await Promise.all(
      automation.actions.map((action: any) =>
        executeAction(supabase, action, queueItem.trigger_data, queueItem.company_id)
      )
    );

    const allActionsSuccessful = actionResults.every(r => r.success);

    if (!allActionsSuccessful) {
      throw new Error('One or more actions failed');
    }

    // Mark as completed
    await supabase
      .from('automation_queue')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString()
      })
      .eq('id', queueItem.id);

    // Log successful execution
    await supabase
      .from('automation_logs')
      .insert({
        company_id: queueItem.company_id,
        automation_id: automation.id,
        trigger_type: queueItem.trigger_type,
        trigger_data: queueItem.trigger_data,
        status: 'success',
        actions_executed: automation.actions.length,
        executed_at: new Date().toISOString()
      });

    return {
      success: true,
      automation_id: automation.id,
      actions_executed: automation.actions.length
    };

  } catch (error) {
    console.error(`Error processing queue item ${queueItem.id}:`, error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const newAttempts = queueItem.attempts + 1;
    const shouldRetry = newAttempts < queueItem.max_attempts;

    // Update queue item
    await supabase
      .from('automation_queue')
      .update({
        status: shouldRetry ? 'pending' : 'failed',
        attempts: newAttempts,
        error_message: errorMessage,
        processed_at: shouldRetry ? null : new Date().toISOString(),
        scheduled_for: shouldRetry
          ? new Date(Date.now() + 5 * 60 * 1000).toISOString() // Retry in 5 minutes
          : queueItem.scheduled_for
      })
      .eq('id', queueItem.id);

    // Log failed execution
    await supabase
      .from('automation_logs')
      .insert({
        company_id: queueItem.company_id,
        automation_id: queueItem.automation_id,
        trigger_type: queueItem.trigger_type,
        trigger_data: queueItem.trigger_data,
        status: 'error',
        error_message: errorMessage,
        executed_at: new Date().toISOString()
      });

    return {
      success: false,
      error: errorMessage,
      will_retry: shouldRetry
    };
  }
}

async function validateConditions(
  supabase: any,
  conditions: any[],
  triggerData: any,
  companyId: string
): Promise<boolean> {
  if (!conditions || conditions.length === 0) {
    return true; // No conditions means always execute
  }

  for (const condition of conditions) {
    const { field, operator, value } = condition;
    const fieldValue = getNestedValue(triggerData, field);

    let conditionMet = false;

    switch (operator) {
      case 'equals':
        conditionMet = fieldValue == value;
        break;
      case 'not_equals':
        conditionMet = fieldValue != value;
        break;
      case 'contains':
        conditionMet = String(fieldValue).includes(value);
        break;
      case 'greater_than':
        conditionMet = Number(fieldValue) > Number(value);
        break;
      case 'less_than':
        conditionMet = Number(fieldValue) < Number(value);
        break;
      case 'is_empty':
        conditionMet = !fieldValue || fieldValue === '';
        break;
      case 'is_not_empty':
        conditionMet = !!fieldValue && fieldValue !== '';
        break;
      default:
        console.warn(`Unknown operator: ${operator}`);
        conditionMet = false;
    }

    if (!conditionMet) {
      return false; // All conditions must be met
    }
  }

  return true;
}

async function executeAction(
  supabase: any,
  action: any,
  triggerData: any,
  companyId: string
) {
  try {
    const { type, config } = action;

    console.log(`Executing action: ${type}`, config);

    switch (type) {
      case 'send_email':
        return await executeSendEmail(supabase, config, triggerData, companyId);

      case 'send_sms':
        return await executeSendSMS(supabase, config, triggerData, companyId);

      case 'update_status':
        return await executeUpdateStatus(supabase, config, triggerData, companyId);

      case 'create_task':
        return await executeCreateTask(supabase, config, triggerData, companyId);

      case 'send_notification':
        return await executeSendNotification(supabase, config, triggerData, companyId);

      case 'webhook':
        return await executeWebhook(supabase, config, triggerData, companyId);

      default:
        throw new Error(`Unknown action type: ${type}`);
    }
  } catch (error) {
    console.error(`Error executing action ${action.type}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function executeSendEmail(supabase: any, config: any, triggerData: any, companyId: string) {
  const { to, subject, template_id, body } = config;

  // Resolve recipient email
  let recipientEmail = to;
  if (to.startsWith('trigger.')) {
    recipientEmail = getNestedValue(triggerData, to.replace('trigger.', ''));
  }

  // Get template if specified
  let emailBody = body;
  if (template_id) {
    const { data: template } = await supabase
      .from('communication_templates')
      .select('html_content, subject')
      .eq('id', template_id)
      .maybeSingle();

    if (template) {
      emailBody = template.html_content;
    }
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  // Call send-email function
  const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseServiceKey}`,
    },
    body: JSON.stringify({
      company_id: companyId,
      to: recipientEmail,
      subject: subject,
      html: emailBody,
      template: 'custom',
      shortCodeData: {
        invoice: triggerData,
        payment: triggerData,
        quote: triggerData,
        customer: triggerData,
      }
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send email: ${error}`);
  }

  return { success: true };
}

async function executeSendSMS(supabase: any, config: any, triggerData: any, companyId: string) {
  const { to, message } = config;

  let recipientPhone = to;
  if (to.startsWith('trigger.')) {
    recipientPhone = getNestedValue(triggerData, to.replace('trigger.', ''));
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  const response = await fetch(`${supabaseUrl}/functions/v1/twilio-sms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseServiceKey}`,
    },
    body: JSON.stringify({
      company_id: companyId,
      to: recipientPhone,
      message: message,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send SMS: ${error}`);
  }

  return { success: true };
}

async function executeUpdateStatus(supabase: any, config: any, triggerData: any, companyId: string) {
  const { entity_type, entity_id_field, new_status } = config;

  const entityId = getNestedValue(triggerData, entity_id_field);

  if (!entityId) {
    throw new Error(`Entity ID not found in trigger data: ${entity_id_field}`);
  }

  // Map entity types to tables
  const tableMap: Record<string, string> = {
    'invoice': 'printavo_invoices',
    'quote': 'quotes',
    'work_order': 'work_orders',
    'purchase_order': 'purchase_orders',
  };

  const tableName = tableMap[entity_type];
  if (!tableName) {
    throw new Error(`Unknown entity type: ${entity_type}`);
  }

  const { error } = await supabase
    .from(tableName)
    .update({ status: new_status })
    .eq('id', entityId);

  if (error) {
    throw new Error(`Failed to update status: ${error.message}`);
  }

  return { success: true };
}

async function executeCreateTask(supabase: any, config: any, triggerData: any, companyId: string) {
  const { title, description, due_date, assignee } = config;

  // Note: This would create a task in Printavo or your task system
  // For now, just log it
  console.log('Create task:', { title, description, due_date, assignee });

  return { success: true };
}

async function executeSendNotification(supabase: any, config: any, triggerData: any, companyId: string) {
  const { message, user_id } = config;

  // Note: This would send an in-app notification
  // For now, just log it
  console.log('Send notification:', { message, user_id });

  return { success: true };
}

async function executeWebhook(supabase: any, config: any, triggerData: any, companyId: string) {
  const { url, method = 'POST', headers = {}, body } = config;

  const response = await fetch(url, {
    method: method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body || triggerData),
  });

  if (!response.ok) {
    throw new Error(`Webhook failed with status ${response.status}`);
  }

  return { success: true };
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}
