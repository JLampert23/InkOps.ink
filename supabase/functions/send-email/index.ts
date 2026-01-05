import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EmailAttachment {
  filename: string;
  content: string;
  type?: string;
}

interface EmailRequest {
  to: string | string[];
  subject: string;
  template: 'invoice-reminder' | 'payment-received' | 'overdue-notice' | 'welcome' | 'custom';
  data?: Record<string, any>;
  html?: string;
  attachments?: EmailAttachment[];
}

interface ResendResponse {
  id: string;
  from: string;
  to: string[];
  created_at: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    // Extract JWT from Bearer token
    const jwt = authHeader.replace('Bearer ', '');

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(jwt);

    console.log('User validation result:', { user: user?.id, error: userError?.message });

    if (userError || !user) {
      const errorMsg = userError?.message || 'No user found';
      console.error('Authentication failed:', errorMsg);
      return new Response(
        JSON.stringify({ code: 401, message: `Invalid JWT: ${errorMsg}` }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: settings, error: settingsError } = await supabase
      .from('company_settings')
      .select('resend_api_key, email_from_address')
      .maybeSingle();

    if (settingsError) {
      throw new Error(`Failed to load settings: ${settingsError.message}`);
    }

    if (!settings?.resend_api_key) {
      throw new Error('Resend API key not configured. Please add it in Settings → Integrations.');
    }

    if (!settings?.email_from_address) {
      throw new Error('From email address not configured. Please add it in Settings → Integrations.');
    }

    const cryptoResponse = await fetch(`${supabaseUrl}/functions/v1/crypto-service`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        action: 'decrypt',
        token: settings.resend_api_key,
      }),
    });

    if (!cryptoResponse.ok) {
      const errorData = await cryptoResponse.json();
      throw new Error(`Failed to decrypt API key: ${errorData.error || 'Unknown error'}`);
    }

    const { result: RESEND_API_KEY } = await cryptoResponse.json();

    const emailRequest: EmailRequest = await req.json();
    const { to, subject, template, data, html: customHtml, attachments } = emailRequest;

    if (!to || !subject) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: to, subject' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let html = customHtml;

    if (!customHtml && template !== 'custom') {
      html = generateEmailTemplate(template, data || {});
    }

    const toArray = Array.isArray(to) ? to : [to];

    const emailPayload: any = {
      from: data?.from || settings.email_from_address,
      to: toArray,
      subject: subject,
      html: html,
    };

    if (attachments && attachments.length > 0) {
      emailPayload.attachments = attachments.map(att => ({
        filename: att.filename,
        content: att.content,
      }));
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Resend API error: ${error}`);
    }

    const result: ResendResponse = await response.json();

    return new Response(
      JSON.stringify({ success: true, data: result }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function generateEmailTemplate(template: string, data: Record<string, any>): string {
  const baseStyles = `
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
      .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
      .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 14px; color: #6b7280; border-radius: 0 0 10px 10px; }
      .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
      .amount { font-size: 24px; font-weight: bold; color: #667eea; }
      .warning { background: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 20px 0; }
      .success { background: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; margin: 20px 0; }
      .info-box { background: #f9fafb; padding: 16px; border-radius: 8px; margin: 20px 0; }
    </style>
  `;

  switch (template) {
    case 'invoice-reminder':
      return `
        ${baseStyles}
        <div class="container">
          <div class="header">
            <h1>Invoice Reminder</h1>
          </div>
          <div class="content">
            <p>Hello ${data.customerName || 'Customer'},</p>
            <p>This is a friendly reminder about the following invoice:</p>
            <div class="info-box">
              <strong>Invoice #:</strong> ${data.invoiceNumber}<br>
              <strong>Amount Due:</strong> <span class="amount">$${data.amountDue}</span><br>
              <strong>Due Date:</strong> ${data.dueDate}
            </div>
            <p>Please make payment at your earliest convenience to avoid any late fees.</p>
            ${data.invoiceUrl ? `<a href="${data.invoiceUrl}" class="button">View Invoice</a>` : ''}
            <p>If you have any questions, please don't hesitate to contact us.</p>
            <p>Thank you for your business!</p>
          </div>
          <div class="footer">
            <p>${data.companyName || 'Your Company'}</p>
            <p>${data.companyEmail || ''} | ${data.companyPhone || ''}</p>
          </div>
        </div>
      `;

    case 'payment-received':
      return `
        ${baseStyles}
        <div class="container">
          <div class="header">
            <h1>Payment Received</h1>
          </div>
          <div class="content">
            <div class="success">
              <strong>Thank you for your payment!</strong>
            </div>
            <p>Hello ${data.customerName || 'Customer'},</p>
            <p>We have successfully received your payment.</p>
            <div class="info-box">
              <strong>Invoice #:</strong> ${data.invoiceNumber}<br>
              <strong>Payment Amount:</strong> <span class="amount">$${data.paymentAmount}</span><br>
              <strong>Payment Date:</strong> ${data.paymentDate}<br>
              ${data.remainingBalance ? `<strong>Remaining Balance:</strong> $${data.remainingBalance}` : '<strong>Status:</strong> Paid in Full'}
            </div>
            <p>A receipt for this payment has been generated for your records.</p>
            ${data.invoiceUrl ? `<a href="${data.invoiceUrl}" class="button">View Invoice</a>` : ''}
            <p>We appreciate your prompt payment and look forward to serving you again.</p>
          </div>
          <div class="footer">
            <p>${data.companyName || 'Your Company'}</p>
            <p>${data.companyEmail || ''} | ${data.companyPhone || ''}</p>
          </div>
        </div>
      `;

    case 'overdue-notice':
      return `
        ${baseStyles}
        <div class="container">
          <div class="header">
            <h1>Overdue Invoice Notice</h1>
          </div>
          <div class="content">
            <div class="warning">
              <strong>Important:</strong> This invoice is now overdue.
            </div>
            <p>Hello ${data.customerName || 'Customer'},</p>
            <p>Our records indicate that the following invoice is past due:</p>
            <div class="info-box">
              <strong>Invoice #:</strong> ${data.invoiceNumber}<br>
              <strong>Amount Due:</strong> <span class="amount">$${data.amountDue}</span><br>
              <strong>Original Due Date:</strong> ${data.dueDate}<br>
              <strong>Days Overdue:</strong> ${data.daysOverdue} days
            </div>
            <p>Please submit payment immediately to avoid any additional late fees or service interruptions.</p>
            ${data.invoiceUrl ? `<a href="${data.invoiceUrl}" class="button">Pay Now</a>` : ''}
            <p>If you have already made this payment, please disregard this notice. If you need to discuss payment arrangements, please contact us as soon as possible.</p>
          </div>
          <div class="footer">
            <p>${data.companyName || 'Your Company'}</p>
            <p>${data.companyEmail || ''} | ${data.companyPhone || ''}</p>
          </div>
        </div>
      `;

    case 'welcome':
      return `
        ${baseStyles}
        <div class="container">
          <div class="header">
            <h1>Welcome!</h1>
          </div>
          <div class="content">
            <p>Hello ${data.customerName || 'Customer'},</p>
            <p>Welcome to ${data.companyName || 'our platform'}! We're excited to have you on board.</p>
            <p>Your account has been successfully created and you can now:</p>
            <ul>
              <li>View and pay invoices online</li>
              <li>Track your order history</li>
              <li>Manage your account settings</li>
              <li>Access important documents</li>
            </ul>
            ${data.dashboardUrl ? `<a href="${data.dashboardUrl}" class="button">Go to Dashboard</a>` : ''}
            <p>If you have any questions or need assistance, please don't hesitate to reach out.</p>
            <p>Thank you for choosing us!</p>
          </div>
          <div class="footer">
            <p>${data.companyName || 'Your Company'}</p>
            <p>${data.companyEmail || ''} | ${data.companyPhone || ''}</p>
          </div>
        </div>
      `;

    default:
      return `
        ${baseStyles}
        <div class="container">
          <div class="header">
            <h1>${data.title || 'Notification'}</h1>
          </div>
          <div class="content">
            <p>${data.message || 'You have a new notification.'}</p>
          </div>
          <div class="footer">
            <p>${data.companyName || 'Your Company'}</p>
          </div>
        </div>
      `;
  }
}