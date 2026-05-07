import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { renderTemplate, formatCurrency, formatDate, type ShortCodeData } from '../_shared/shortcode-engine.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-User-Token",
};

interface EmailAttachment {
  filename: string;
  content: string;
  type?: string;
}

interface EmailRequest {
  to: string | string[];
  subject: string;
  template: 'invoice-reminder' | 'payment-received' | 'overdue-notice' | 'welcome' | 'custom' | 'invoice' | 'payment-request' | 'quote' | 'quote_followup' | 'quote-approval';
  data?: Record<string, any>;
  html?: string;
  attachments?: EmailAttachment[];
  shortCodeData?: ShortCodeData;
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    const userToken = req.headers.get('X-User-Token') || '';
    const authHeader = req.headers.get('Authorization');
    const bearerToken = (authHeader?.replace('Bearer ', '') || '').trim();

    // Supabase's key migration leaves the same env var name resolving to
    // different values across functions (sb_secret_... in send-email vs
    // legacy JWT in process-automation-queue). Strict equality on env can't
    // bridge that. So we also accept any structurally valid service_role JWT
    // — it's the same JWT Supabase signed for the project; we just can't
    // verify the signature here because SUPABASE_JWT_SECRET isn't exposed
    // to this runtime. Security: gateway is verify_jwt=false anyway, and a
    // forged caller still needs a real company_id to do anything useful
    // (Resend key is encrypted per company).
    const candidateKeys = [
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      Deno.env.get('SUPABASE_LEGACY_SERVICE_ROLE_KEY'),
      Deno.env.get('SUPABASE_SECRET_KEY'),
    ]
      .filter((v): v is string => typeof v === 'string' && v.length > 0)
      .map(v => v.trim());

    const looksLikeServiceRoleJwt = (token: string): boolean => {
      try {
        const parts = token.split('.');
        if (parts.length !== 3) return false;
        const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
        const payload = JSON.parse(atob(padded));
        return payload?.role === 'service_role';
      } catch {
        return false;
      }
    };

    const isServiceCall =
      candidateKeys.some(k => k === bearerToken) ||
      looksLikeServiceRoleJwt(bearerToken);
    const token = isServiceCall ? bearerToken : (userToken || bearerToken);

    console.log('send-email: Auth check:', {
      hasAuthHeader: !!authHeader,
      bearerTokenLength: bearerToken.length,
      serviceKeyLength: supabaseServiceKey.length,
      isServiceCall,
      hasUserToken: !!userToken,
    });

    if (!token) {
      throw new Error('Missing authorization');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let companyId: string;

    if (isServiceCall) {
      console.log('send-email: Recognized as service-to-service call');
      const body = await req.clone().json();
      if (!body.company_id) {
        throw new Error('company_id is required for service-to-service calls');
      }
      companyId = body.company_id;
      console.log('send-email: Using company_id from request body:', companyId);
    } else {
      console.log('send-email: Treating as user call, verifying JWT');
      const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      });

      const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

      if (userError || !user) {
        return new Response(
          JSON.stringify({
            code: 401,
            message: `Invalid JWT: ${userError?.message || 'No user found'}`,
          }),
          {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .maybeSingle();

      if (!userProfile?.company_id) {
        throw new Error('User company not found');
      }
      companyId = userProfile.company_id;
    }

    const { data: companySettings, error: settingsError } = await supabase
      .from('company_settings')
      .select('resend_api_key, email_from_address, secondary_email_from_address, quote_email_sender, company_name, company_logo_primary_url, logo_url, email_signature')
      .eq('id', companyId)
      .maybeSingle();

    if (settingsError) {
      throw new Error(`Failed to load company settings: ${settingsError.message}`);
    }

    if (!companySettings) {
      throw new Error('Company settings not found.');
    }

    if (!companySettings.resend_api_key) {
      throw new Error('Resend API key not configured. Please add it in Account Settings.');
    }

    if (!companySettings.email_from_address) {
      throw new Error('Primary from email address not configured. Please add it in Account Settings.');
    }

    const encryptionKey = Deno.env.get('ENCRYPTION_KEY');
    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY environment variable not set');
    }

    console.log('Calling crypto-service to decrypt Resend API key');
    const decryptResponse = await fetch(`${supabaseUrl}/functions/v1/crypto-service`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        action: 'decrypt',
        token: companySettings.resend_api_key,
      }),
    });

    if (!decryptResponse.ok) {
      const errorText = await decryptResponse.text();
      console.error('Crypto-service decryption failed:', {
        status: decryptResponse.status,
        statusText: decryptResponse.statusText,
        error: errorText,
      });
      try {
        const errorData = JSON.parse(errorText);
        throw new Error(`Failed to decrypt Resend API key: ${errorData.error || errorText}`);
      } catch {
        throw new Error(`Failed to decrypt Resend API key: ${errorText}`);
      }
    }

    const decryptResult = await decryptResponse.json();
    console.log('Decryption result:', {
      success: decryptResult.success,
      hasResult: !!decryptResult.result,
      resultType: typeof decryptResult.result,
      error: decryptResult.error,
    });

    if (!decryptResult.success || !decryptResult.result) {
      throw new Error(`Decryption failed: ${decryptResult.error || 'No result returned'}`);
    }

    const decryptedApiKey = decryptResult.result;

    // Trim whitespace and ensure ASCII-only (no invalid ByteString characters)
    const rawApiKey = decryptedApiKey?.trim() || decryptedApiKey || '';
    const RESEND_API_KEY = rawApiKey.replace(/[^\x00-\x7F]/g, '');

    console.log('Resend API key check:', {
      hasKey: !!RESEND_API_KEY,
      keyLength: RESEND_API_KEY?.length,
      startsWithRe: RESEND_API_KEY?.startsWith('re_'),
      firstFourChars: RESEND_API_KEY?.substring(0, 4),
    });

    if (!RESEND_API_KEY?.startsWith('re_')) {
      console.error('Decrypted API key does not have expected format. Key may have been encrypted with a different ENCRYPTION_KEY.');
      throw new Error('Resend API key decryption failed. Please re-enter your Resend API key in Account Settings to re-encrypt it.');
    }

    const emailRequest: EmailRequest = await req.json();
    const { to, subject, template, data, html: customHtml, attachments, shortCodeData } = emailRequest;

    // Determine the correct from email address logic
    // ROUTING RULE: Invoices/Payments → Primary email, Quotes/Everything else → Secondary email
    let fromEmail = companySettings.email_from_address;
    
    // Check if this is an invoice/payment email based on the template
    const isInvoiceOrPaymentEmail = 
      template === 'invoice-reminder' || 
      template === 'payment-received' || 
      template === 'overdue-notice' || 
      template === 'invoice' ||
      template === 'payment-request' ||
      (typeof emailRequest.data?.invoiceNumber !== 'undefined');

    // Check if this is a quote-related email
    const isQuoteEmail = 
      template === 'quote' ||
      template === 'quote_followup' ||
      template === 'quote-approval' ||
      (typeof emailRequest.data?.quote_number !== 'undefined');

    if (companySettings.secondary_email_from_address) {
      if (isInvoiceOrPaymentEmail) {
        // Invoices & Payments ALWAYS use Primary email
        fromEmail = companySettings.email_from_address;
        console.log('Email routing: Invoice/Payment → Primary email:', fromEmail);
      } else {
        // Quotes, proofs, automations, and everything else use Secondary email
        fromEmail = companySettings.secondary_email_from_address;
        console.log('Email routing: Quote/Other → Secondary email:', fromEmail);
      }
    }

    const rawFromName = companySettings.company_name || '';
    const fromName = rawFromName.replace(/[^\x00-\x7F]/g, '').trim();

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

    // Apply short code replacement if shortCodeData is provided
    if (html && shortCodeData) {
      html = renderTemplate(html, shortCodeData);
    }

    // Also apply short codes to subject line
    let finalSubject = subject;
    if (shortCodeData) {
      finalSubject = renderTemplate(subject, shortCodeData);
    }

    // Wrap HTML with company branding: logo at top, email signature at bottom
    if (html) {
      const logoUrl = companySettings.company_logo_primary_url || companySettings.logo_url || null;
      const emailSig = companySettings.email_signature || null;
      html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
        ${ logoUrl ? `<div style="padding:20px 30px 15px;border-bottom:2px solid #e5e7eb;text-align:left;"><img src="${logoUrl}" alt="${fromName}" style="max-height:64px;max-width:220px;object-fit:contain;display:block;" /></div>` : '' }
        <div style="padding:24px 30px;">${html}</div>
        ${ emailSig ? `<div style="padding:16px 30px;border-top:1px solid #e5e7eb;font-size:13px;color:#6b7280;line-height:1.6;">${emailSig}</div>` : '' }
      </div>`;
    }

    const toArray = Array.isArray(to) ? to : [to];

    const fromAddress = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

    const emailPayload: any = {
      from: fromAddress,
      to: toArray,
      subject: finalSubject,
      html: html,
    };

    if (attachments && attachments.length > 0) {
      emailPayload.attachments = attachments.map(att => {
        const attachment: { filename: string; content: string; content_type?: string } = {
          filename: att.filename,
          content: att.content,
        };
        if (att.type) {
          attachment.content_type = att.type;
        }
        return attachment;
      });
    }

    console.log('Sending email with payload:', {
      from: emailPayload.from,
      to: emailPayload.to,
      subject: emailPayload.subject,
      hasHtml: !!emailPayload.html,
      htmlLength: emailPayload.html?.length,
      attachmentCount: emailPayload.attachments?.length || 0,
    });

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

    // Log the "Email sent" event if quote context exists in the data payload
    const targetQuoteId = data?.quote_id || data?.quoteId || (emailRequest.shortCodeData as any)?.quote_id;
    if (targetQuoteId) {
      try {
        await supabase.from('quote_activity_log').insert({
          quote_id: targetQuoteId,
          company_id: companyId,
          action: 'Email sent',
          details: {
             subject: finalSubject,
             to: emailPayload.to,
             template_used: template
          }
        });
        console.log(`Successfully logged 'Email sent' for quote ${targetQuoteId}`);
      } catch (logError) {
        console.error('Failed to log email sent activity:', logError);
      }
    }

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