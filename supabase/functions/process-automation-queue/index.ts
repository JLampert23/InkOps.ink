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

async function processQueueItem(supabase: any, queueItem: any) {
  try {
    // Mark as processing
    await supabase
      .from('automation_queue')
      .update({ status: 'processing' })
      .eq('id', queueItem.id);

    // Handle special system automation types
    if (queueItem.trigger_type === 'quote_followup') {
      const result = await processQuoteFollowup(supabase, queueItem);

      // Mark as completed
      await supabase
        .from('automation_queue')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString(),
        })
        .eq('id', queueItem.id);

      return result;
    }

    // Get all automations that match this trigger type
    const { data: automations, error: autoError } = await supabase
      .from('automations')
      .select('*')
      .eq('trigger_type', queueItem.trigger_type)
      .eq('company_id', queueItem.company_id)
      .eq('is_enabled', true);

    if (autoError) {
      throw new Error(`Failed to fetch automations: ${autoError.message}`);
    }

    if (!automations || automations.length === 0) {
      // No automations found for this trigger, mark as completed
      await supabase
        .from('automation_queue')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString(),
        })
        .eq('id', queueItem.id);

      return { success: true, skipped: true, reason: 'No matching automations' };
    }

    // Process each automation
    for (const automation of automations) {
      if (!automation.is_enabled) {
        continue;
      }

      // Validate conditions
      const conditionsMet = await validateConditions(
        supabase,
        automation.conditions,
        queueItem.trigger_data,
        queueItem.company_id
      );

      if (!conditionsMet) {
        console.log(`Conditions not met for automation ${automation.id}`);
        continue;
      }

      // Execute actions sequentially
      for (let i = 0; i < automation.actions.length; i++) {
        const action = automation.actions[i];

        const actionResult = await executeAction(
          supabase,
          action,
          queueItem.trigger_data,
          queueItem.company_id
        );

        if (!actionResult.success) {
          throw new Error(`Action ${i} failed: ${actionResult.error}`);
        }
      }

      // Log successful execution
      const { error: logError } = await supabase
        .from('automation_logs')
        .insert({
          company_id: queueItem.company_id,
          automation_id: automation.id,
          trigger_event: queueItem.trigger_data,
          status: 'success',
          executed_actions: automation.actions,
          execution_time_ms: 0,
          execution_method: 'automatic',
          executed_at: new Date().toISOString()
        });

      if (logError) {
        console.error('Failed to insert automation log:', logError);
      }
    }

    // All automations processed successfully
    await supabase
      .from('automation_queue')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString(),
      })
      .eq('id', queueItem.id);

    return {
      success: true,
      automations_processed: automations.length
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
        trigger_event: queueItem.trigger_data,
        status: 'error',
        error_message: errorMessage,
        execution_method: 'automatic',
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
      case 'change_status':
        return await executeUpdateStatus(supabase, config, triggerData, companyId);

      case 'create_task':
        return await executeCreateTask(supabase, config, triggerData, companyId);

      case 'send_notification':
        return await executeSendNotification(supabase, config, triggerData, companyId);

      case 'webhook':
        return await executeWebhook(supabase, config, triggerData, companyId);

      case 'send_message':
        return await executeSendMessage(supabase, config, triggerData, companyId);

      case 'apply_preset_task_list':
        return await executeApplyPresetTaskList(supabase, config, triggerData, companyId);

      case 'request_payment':
        return await executeRequestPayment(supabase, config, triggerData, companyId);

      case 'request_approval':
        return await executeRequestApproval(supabase, config, triggerData, companyId);

      case 'add_imprints_to_scheduler':
        return await executeAddImprintsToScheduler(supabase, config, triggerData, companyId);

      case 'wait_duration':
        return await executeWaitDuration(supabase, config, triggerData, companyId);

      case 'wait_until':
        return await executeWaitUntil(supabase, config, triggerData, companyId);

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

async function executeSendMessage(supabase: any, config: any, triggerData: any, companyId: string) {
  const { message_type, to, subject, message } = config;

  // Resolve recipient
  let recipient = to;
  if (to.startsWith('trigger.')) {
    recipient = getNestedValue(triggerData, to.replace('trigger.', ''));
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (message_type === 'email') {
    // Send email
    const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        company_id: companyId,
        to: recipient,
        subject: subject || 'Notification',
        html: message,
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
  } else if (message_type === 'sms') {
    // Send SMS
    const response = await fetch(`${supabaseUrl}/functions/v1/twilio-sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        company_id: companyId,
        to: recipient,
        message: message,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to send SMS: ${error}`);
    }
  }

  return { success: true };
}

async function executeApplyPresetTaskList(supabase: any, config: any, triggerData: any, companyId: string) {
  const { preset_name, assign_to } = config;

  // Note: This would fetch a preset task list template and create tasks
  // Implementation would depend on your task management structure
  console.log('Apply preset task list:', { preset_name, assign_to, triggerData });

  // Example: Create tasks from a preset
  const presetTasks = [
    { title: `${preset_name} - Task 1`, description: 'Auto-generated task' },
    { title: `${preset_name} - Task 2`, description: 'Auto-generated task' },
  ];

  for (const task of presetTasks) {
    console.log('Creating task:', task);
    // In production, this would call Printavo API or insert into local task table
  }

  return { success: true };
}

async function executeRequestPayment(supabase: any, config: any, triggerData: any, companyId: string) {
  const { invoice_id, payment_method, send_reminder } = config;

  // Resolve invoice ID
  let resolvedInvoiceId = invoice_id;
  if (invoice_id.startsWith('trigger.')) {
    resolvedInvoiceId = getNestedValue(triggerData, invoice_id.replace('trigger.', ''));
  }

  // Get invoice details
  const { data: invoice } = await supabase
    .from('printavo_invoices')
    .select('*')
    .eq('id', resolvedInvoiceId)
    .maybeSingle();

  if (!invoice) {
    throw new Error(`Invoice not found: ${resolvedInvoiceId}`);
  }

  if (send_reminder && invoice.customer_email) {
    // Send payment reminder email
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        company_id: companyId,
        to: invoice.customer_email,
        subject: `Payment Request - Invoice #${invoice.invoice_number}`,
        template: 'invoice-reminder',
        data: {
          customerName: invoice.customer_name,
          invoiceNumber: invoice.invoice_number,
          amountDue: invoice.amount_outstanding,
          dueDate: invoice.due_date,
        },
      }),
    });
  }

  return { success: true };
}

async function executeRequestApproval(supabase: any, config: any, triggerData: any, companyId: string) {
  const { quote_id, recipient_email, message } = config;

  // Resolve quote ID
  let resolvedQuoteId = quote_id;
  if (quote_id.startsWith('trigger.')) {
    resolvedQuoteId = getNestedValue(triggerData, quote_id.replace('trigger.', ''));
  }

  // Get quote details
  const { data: quote } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', resolvedQuoteId)
    .maybeSingle();

  if (!quote) {
    throw new Error(`Quote not found: ${resolvedQuoteId}`);
  }

  // Create approval record
  const { data: approval, error: approvalError } = await supabase
    .from('quote_approvals')
    .insert({
      company_id: companyId,
      quote_id: resolvedQuoteId,
      status: 'pending',
      sent_to_email: recipient_email,
    })
    .select()
    .single();

  if (approvalError) {
    throw new Error(`Failed to create approval: ${approvalError.message}`);
  }

  // Get company settings for subdomain
  const { data: companySettings } = await supabase
    .from('company_settings')
    .select('inkops_subdomain')
    .eq('id', companyId)
    .maybeSingle();

  // Generate approval URL - always use inkops subdomain format
  // Ensure the URL is valid for the current platform configuration without relying on wildcard Netlify setup
  const approvalUrl = `https://inkops.ink/quote-approval/${approval.approval_token}`;

  // Send approval request email
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  await fetch(`${supabaseUrl}/functions/v1/send-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseServiceKey}`,
    },
    body: JSON.stringify({
      company_id: companyId,
      to: recipient_email,
      subject: `Approval Request - Quote #${quote.quote_number}`,
      html: `
        <p>${message || 'Please review and approve the following quote:'}</p>
        <p><strong>Quote #${quote.quote_number}</strong></p>
        <p>Total: $${quote.total}</p>
        <p><a href="${approvalUrl}">Click here to review and approve</a></p>
      `,
      template: 'custom',
    }),
  });

  return { success: true };
}

async function executeAddImprintsToScheduler(supabase: any, config: any, triggerData: any, companyId: string) {
  const { work_order_id, scheduled_date, station_id } = config;

  // Resolve work order ID
  let resolvedWorkOrderId = work_order_id;
  if (work_order_id.startsWith('trigger.')) {
    resolvedWorkOrderId = getNestedValue(triggerData, work_order_id.replace('trigger.', ''));
  }

  // Create production schedule entry
  const { error } = await supabase
    .from('production_schedule_entries')
    .insert({
      company_id: companyId,
      work_order_id: resolvedWorkOrderId,
      scheduled_date: scheduled_date,
      station_id: station_id || null,
      status: 'scheduled',
    });

  if (error) {
    throw new Error(`Failed to add to scheduler: ${error.message}`);
  }

  return { success: true };
}

async function executeWaitDuration(supabase: any, config: any, triggerData: any, companyId: string) {
  const { duration_unit, duration_value } = config;

  // Calculate delay in milliseconds
  let delayMs = 0;
  switch (duration_unit) {
    case 'minutes':
      delayMs = duration_value * 60 * 1000;
      break;
    case 'hours':
      delayMs = duration_value * 60 * 60 * 1000;
      break;
    case 'days':
      delayMs = duration_value * 24 * 60 * 60 * 1000;
      break;
    default:
      throw new Error(`Unknown duration unit: ${duration_unit}`);
  }

  // This is a special action that doesn't execute immediately
  // Instead, it reschedules the next action in the sequence
  // The queue processor should handle this by updating the scheduled_for time
  console.log(`Wait duration: ${duration_value} ${duration_unit} (${delayMs}ms)`);

  return {
    success: true,
    delay_ms: delayMs,
    reschedule: true
  };
}

async function executeWaitUntil(supabase: any, config: any, triggerData: any, companyId: string) {
  const { target_datetime } = config;

  // Parse target datetime
  const targetDate = new Date(target_datetime);
  const now = new Date();

  if (targetDate <= now) {
    // Target time has passed, continue immediately
    return { success: true };
  }

  // Calculate delay
  const delayMs = targetDate.getTime() - now.getTime();

  console.log(`Wait until: ${target_datetime} (${delayMs}ms from now)`);

  return {
    success: true,
    delay_ms: delayMs,
    reschedule: true
  };
}

async function processQuoteFollowup(supabase: any, queueItem: any) {
  try {
    const { quote_id, quote_number, customer_id, contact_id, followup_number } = queueItem.trigger_data;

    // Get quote details
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('*, customers(name, email, primary_contact_name)')
      .eq('id', quote_id)
      .maybeSingle();

    if (quoteError || !quote) {
      throw new Error(`Failed to fetch quote: ${quoteError?.message || 'Quote not found'}`);
    }

    // Check if quote is still in a state where follow-up should be sent
    if (!['sent', 'pending'].includes(quote.status)) {
      return {
        success: true,
        skipped: true,
        reason: `Quote status is ${quote.status}, no follow-up needed`
      };
    }

    // Get company settings
    const { data: settings, error: settingsError } = await supabase
      .from('company_settings')
      .select('*, communication_templates!quote_followup_template_id(*)')
      .eq('id', queueItem.company_id)
      .maybeSingle();

    if (settingsError || !settings) {
      throw new Error(`Failed to fetch company settings: ${settingsError?.message}`);
    }

    if (!settings.quote_followup_enabled) {
      return {
        success: true,
        skipped: true,
        reason: 'Quote follow-ups are disabled'
      };
    }

    // Get customer email
    const customerEmail = quote.customers?.email || quote.customer_email;
    if (!customerEmail) {
      throw new Error('No customer email found for quote follow-up');
    }

    // Get template or use fallback
    const customTemplate = settings.communication_templates;
    
    // Default fallback values if no custom template exists
    const subjectTemplate = customTemplate?.subject_template || `Following up on Quote #${quote.quote_number}`;
    const bodyTemplate = customTemplate?.body_template || `
      <p>Hi {{customer.name}},</p>
      <p>We are reaching out to follow up on your recent quote: <strong>Quote #${quote.quote_number}</strong>.</p>
      <p>Total amount: $${quote.total}</p>
      <p>Please click the link below to review and approve your quote.</p>
      <p>Thank you,<br>{{company.name}}</p>
    `;
    const autoAttachQuoteLink = customTemplate ? customTemplate.auto_attach_quote_link : true; // Default true if no custom template
    const autoAttachPdf = customTemplate ? customTemplate.auto_attach_pdf : false;
    const autoAttachMockups = customTemplate ? customTemplate.auto_attach_mockups : false;
    const templateNameUsed = customTemplate ? customTemplate.template_name : 'default_fallback';

    // Send follow-up email
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        company_id: queueItem.company_id,
        to: customerEmail,
        subject: subjectTemplate,
        html: bodyTemplate,
        template: 'quote_followup',
        auto_attach_quote_link: autoAttachQuoteLink,
        auto_attach_pdf: autoAttachPdf,
        auto_attach_mockups: autoAttachMockups,
        shortCodeData: {
          quote: {
            id: quote.id,
            number: quote.quote_number,
            total: quote.total,
            created_date: quote.created_at,
            expiration_date: quote.expiration_date,
          },
          customer: {
            name: quote.customers?.name || quote.customer_name || quote.customers?.primary_contact_name,
            email: customerEmail,
          },
          company: {
            name: settings.company_name,
          }
        }
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to send follow-up email: ${error}`);
    }

    // Update quote with follow-up information
    const newFollowupCount = quote.followup_count + 1;
    const { error: updateError } = await supabase
      .from('quotes')
      .update({
        followup_count: newFollowupCount,
        last_followup_sent_at: new Date().toISOString(),
      })
      .eq('id', quote_id);

    if (updateError) {
      console.error('Failed to update quote follow-up count:', updateError);
    }

    // Log activity
    await supabase
      .from('quote_activity_log')
      .insert({
        company_id: queueItem.company_id,
        quote_id: quote_id,
        action: 'followup_sent',
        meta: {
          followup_number: followup_number,
          recipient_email: customerEmail,
          template_used: templateNameUsed,
        },
        performed_at: new Date().toISOString(),
      });

    return {
      success: true,
      message: `Follow-up #${followup_number} sent to ${customerEmail}`,
      followup_number: followup_number,
    };

  } catch (error) {
    console.error('Error processing quote follow-up:', error);

    // Log failed follow-up
    const { quote_id } = queueItem.trigger_data;
    if (quote_id) {
      await supabase
        .from('quote_activity_log')
        .insert({
          company_id: queueItem.company_id,
          quote_id: quote_id,
          action: 'followup_failed',
          meta: {
            error: error instanceof Error ? error.message : 'Unknown error',
            trigger_data: queueItem.trigger_data,
          },
          performed_at: new Date().toISOString(),
        });
    }

    throw error;
  }
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}
