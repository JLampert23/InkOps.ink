import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null || isNaN(amount)) return '$0.00';
  return '$' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatDate(dateString: string | null): string {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function renderErrorPage(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quote - Error</title>
  <style>${getBaseStyles()}</style>
</head>
<body style="background:#f8fafc;margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;">
    <div style="max-width:420px;width:100%;background:#fff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.08);padding:48px 32px;text-align:center;">
      <div style="width:64px;height:64px;margin:0 auto 16px;border-radius:50%;background:#fef2f2;display:flex;align-items:center;justify-content:center;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
      </div>
      <h1 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px;">Unable to Load Quote</h1>
      <p style="color:#6b7280;font-size:15px;line-height:1.5;margin:0;">${escapeHtml(message)}</p>
    </div>
  </div>
</body>
</html>`;
}

function getBaseStyles(): string {
  return `
    * { box-sizing: border-box; }
    body { margin:0; padding:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; color:#1f2937; line-height:1.5; background:#f8fafc; }
    .container { max-width:860px; margin:0 auto; padding:32px 16px; }
    .card { background:#fff; border-radius:12px; box-shadow:0 1px 3px rgba(0,0,0,0.06),0 1px 2px rgba(0,0,0,0.04); padding:28px; margin-bottom:20px; }
    .company-header { display:flex; align-items:center; gap:16px; flex-wrap:wrap; }
    .company-logo { height:56px; width:auto; object-fit:contain; }
    .company-name { font-size:22px; font-weight:700; color:#111827; margin:0; }
    .company-info { display:flex; gap:20px; flex-wrap:wrap; margin-top:8px; }
    .company-info a { color:#6b7280; text-decoration:none; font-size:13px; display:flex; align-items:center; gap:4px; }
    .company-info a:hover { color:#2563eb; }
    .quote-title { font-size:28px; font-weight:700; color:#111827; margin:0 0 4px; }
    .quote-subtitle { color:#6b7280; font-size:14px; margin:0; }
    .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-top:20px; }
    .label { font-size:12px; font-weight:600; color:#9ca3af; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px; }
    .value { font-size:14px; color:#374151; }
    .value strong { color:#111827; }
    table { width:100%; border-collapse:collapse; }
    thead th { padding:10px 16px; text-align:left; font-size:11px; font-weight:600; color:#9ca3af; text-transform:uppercase; letter-spacing:0.5px; background:#f9fafb; border-bottom:1px solid #e5e7eb; }
    thead th.right { text-align:right; }
    tbody td { padding:14px 16px; font-size:14px; color:#374151; border-bottom:1px solid #f3f4f6; }
    tbody td.right { text-align:right; }
    tbody td.bold { font-weight:600; color:#111827; }
    .totals { display:flex; justify-content:flex-end; margin-top:20px; }
    .totals-box { width:280px; }
    .totals-row { display:flex; justify-content:space-between; padding:6px 0; font-size:14px; color:#6b7280; }
    .totals-row.total { border-top:2px solid #e5e7eb; margin-top:8px; padding-top:12px; font-size:18px; font-weight:700; color:#111827; }
    .form-group { margin-bottom:16px; }
    .form-group label { display:block; font-size:13px; font-weight:600; color:#374151; margin-bottom:6px; }
    .form-group label .req { color:#ef4444; }
    .form-input { width:100%; padding:10px 14px; border:1px solid #d1d5db; border-radius:8px; font-size:14px; color:#111827; outline:none; transition:border-color 0.15s,box-shadow 0.15s; }
    .form-input:focus { border-color:#3b82f6; box-shadow:0 0 0 3px rgba(59,130,246,0.15); }
    textarea.form-input { resize:vertical; min-height:80px; }
    .btn-row { display:flex; gap:12px; margin-top:24px; }
    .btn { flex:1; display:flex; align-items:center; justify-content:center; gap:8px; padding:14px 24px; border:none; border-radius:10px; font-size:15px; font-weight:600; cursor:pointer; transition:all 0.15s; }
    .btn:disabled { opacity:0.6; cursor:not-allowed; }
    .btn-approve { background:#059669; color:#fff; }
    .btn-approve:hover:not(:disabled) { background:#047857; }
    .btn-reject { background:#dc2626; color:#fff; }
    .btn-reject:hover:not(:disabled) { background:#b91c1c; }
    .notes-box { background:#eff6ff; border-radius:8px; padding:16px; margin-top:16px; }
    .notes-label { font-size:13px; font-weight:600; color:#1e40af; margin-bottom:4px; }
    .notes-text { font-size:14px; color:#1e3a5f; white-space:pre-wrap; }
    .expired-banner { background:#fef2f2; border:1px solid #fecaca; border-radius:12px; padding:32px; text-align:center; }
    .expired-banner h3 { color:#991b1b; font-size:18px; margin:12px 0 8px; }
    .expired-banner p { color:#b91c1c; font-size:14px; }
    .success-page { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }
    .success-card { max-width:420px; width:100%; background:#fff; border-radius:12px; box-shadow:0 4px 24px rgba(0,0,0,0.08); padding:48px 32px; text-align:center; }
    .icon-circle { width:72px; height:72px; margin:0 auto 20px; border-radius:50%; display:flex; align-items:center; justify-content:center; }
    .icon-circle.green { background:#ecfdf5; }
    .icon-circle.red { background:#fef2f2; }
    #loading-overlay { position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(255,255,255,0.8); display:none; align-items:center; justify-content:center; z-index:100; }
    #loading-overlay.active { display:flex; }
    .spinner { width:40px; height:40px; border:3px solid #e5e7eb; border-top-color:#3b82f6; border-radius:50%; animation:spin 0.6s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    @media (max-width:640px) {
      .grid-2 { grid-template-columns:1fr; gap:16px; }
      .container { padding:16px 12px; }
      .card { padding:20px; }
      .btn-row { flex-direction:column; }
      .company-info { flex-direction:column; gap:6px; }
    }
  `;
}

function renderQuotePage(
  quote: any,
  lineItems: any[],
  companySettings: any,
  approval: any,
  token: string,
  supabaseUrl: string,
): string {
  const isExpired = approval.expires_at && new Date(approval.expires_at) < new Date();
  const logoUrl = companySettings?.company_logo_primary_url || companySettings?.logo_url || '';

  let lineItemsHtml = '';
  for (const item of lineItems) {
    const desc = escapeHtml(item.description);
    const deco = item.decoration_method
      ? escapeHtml(item.decoration_method) + (item.decoration_location ? ' - ' + escapeHtml(item.decoration_location) : '')
      : '';
    lineItemsHtml += `
      <tr>
        <td>${desc}${deco ? `<div style="color:#9ca3af;font-size:12px;margin-top:2px;">${deco}</div>` : ''}</td>
        <td class="right">${item.quantity || 0}</td>
        <td class="right">${formatCurrency(item.unit_price)}</td>
        <td class="right bold">${formatCurrency(item.total_price)}</td>
      </tr>`;
  }

  const companyHeaderHtml = companySettings ? `
    <div class="card">
      <div class="company-header">
        ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(companySettings.company_name)}" class="company-logo">` : ''}
        <div>
          <h1 class="company-name">${escapeHtml(companySettings.company_name)}</h1>
          <div class="company-info">
            ${companySettings.company_email ? `<a href="mailto:${escapeHtml(companySettings.company_email)}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg> ${escapeHtml(companySettings.company_email)}</a>` : ''}
            ${companySettings.company_phone ? `<a href="tel:${escapeHtml(companySettings.company_phone)}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg> ${escapeHtml(companySettings.company_phone)}</a>` : ''}
            ${companySettings.company_website ? `<a href="${escapeHtml(companySettings.company_website)}" target="_blank"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> Website</a>` : ''}
          </div>
        </div>
      </div>
    </div>` : '';

  const notesHtml = quote.customer_notes ? `
    <div class="notes-box">
      <div class="notes-label">Notes</div>
      <div class="notes-text">${escapeHtml(quote.customer_notes)}</div>
    </div>` : '';

  const approvalFormHtml = !isExpired ? `
    <div class="card" id="approval-form">
      <h3 style="font-size:18px;font-weight:700;color:#111827;margin:0 0 20px;">Your Response</h3>
      <div class="form-group">
        <label>Your Name <span class="req">*</span></label>
        <input type="text" id="approver-name" class="form-input" placeholder="Enter your name" value="${escapeHtml(quote.customer_name)}" required>
      </div>
      <div class="form-group">
        <label>Your Email <span class="req">*</span></label>
        <input type="email" id="approver-email" class="form-input" placeholder="Enter your email" value="${escapeHtml(quote.customer_email)}" required>
      </div>
      <div class="form-group">
        <label>Notes (Optional)</label>
        <textarea id="approver-notes" class="form-input" placeholder="Add any comments or questions..."></textarea>
      </div>
      <div class="btn-row">
        <button class="btn btn-approve" onclick="submitResponse(true)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg>
          Approve Quote
        </button>
        <button class="btn btn-reject" onclick="submitResponse(false)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          Reject Quote
        </button>
      </div>
    </div>` : `
    <div class="expired-banner">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.5" style="margin:0 auto;display:block;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      <h3>This Quote Has Expired</h3>
      <p>This approval link expired on ${formatDate(approval.expires_at)}. Please contact us for an updated quote.</p>
      ${companySettings?.company_email ? `<a href="mailto:${escapeHtml(companySettings.company_email)}" style="display:inline-block;margin-top:16px;padding:10px 24px;background:#dc2626;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Contact Us</a>` : ''}
    </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quote ${escapeHtml(quote.quote_number)} - Review &amp; Approve</title>
  <style>${getBaseStyles()}</style>
</head>
<body>
  <div id="loading-overlay"><div class="spinner"></div></div>

  <div class="container" id="quote-page">
    ${companyHeaderHtml}

    <div class="card">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
        <div>
          <h2 class="quote-title">Quote ${escapeHtml(quote.quote_number)}</h2>
          <p class="quote-subtitle">Please review the details below and submit your response</p>
        </div>
        ${isExpired ? `<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 12px;background:#fef2f2;color:#991b1b;border-radius:20px;font-size:13px;font-weight:600;">Expired</span>` : `<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 12px;background:#eff6ff;color:#1e40af;border-radius:20px;font-size:13px;font-weight:600;">Awaiting Response</span>`}
      </div>

      <div class="grid-2">
        <div>
          <div class="label">Customer</div>
          <div class="value"><strong>${escapeHtml(quote.customer_name)}</strong></div>
          ${quote.customer_company ? `<div class="value">${escapeHtml(quote.customer_company)}</div>` : ''}
          ${quote.customer_email ? `<div class="value">${escapeHtml(quote.customer_email)}</div>` : ''}
        </div>
        <div>
          <div class="label">Quote Details</div>
          ${quote.valid_until ? `<div class="value">Valid Until: <strong>${formatDate(quote.valid_until)}</strong></div>` : ''}
          ${quote.terms ? `<div class="value">Terms: <strong>${escapeHtml(quote.terms)}</strong></div>` : ''}
          ${quote.delivery_method ? `<div class="value">Delivery: <strong>${escapeHtml(quote.delivery_method)}</strong></div>` : ''}
        </div>
      </div>
      ${notesHtml}
    </div>

    <div class="card">
      <h3 style="font-size:18px;font-weight:700;color:#111827;margin:0 0 16px;">Items</h3>
      <div style="overflow-x:auto;">
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th class="right">Qty</th>
              <th class="right">Unit Price</th>
              <th class="right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${lineItemsHtml || '<tr><td colspan="4" style="text-align:center;color:#9ca3af;padding:24px;">No items</td></tr>'}
          </tbody>
        </table>
      </div>
      <div class="totals">
        <div class="totals-box">
          <div class="totals-row"><span>Subtotal</span><span>${formatCurrency(quote.subtotal)}</span></div>
          ${(quote.discount || 0) > 0 ? `<div class="totals-row"><span>Discount</span><span style="color:#059669;">-${formatCurrency(quote.discount)}</span></div>` : ''}
          ${(quote.tax_amount || 0) > 0 ? `<div class="totals-row"><span>Tax (${quote.tax_rate || 0}%)</span><span>${formatCurrency(quote.tax_amount)}</span></div>` : ''}
          ${(quote.ship || 0) > 0 ? `<div class="totals-row"><span>Shipping</span><span>${formatCurrency(quote.ship)}</span></div>` : ''}
          <div class="totals-row total"><span>Total</span><span>${formatCurrency(quote.total)}</span></div>
        </div>
      </div>
    </div>

    ${approvalFormHtml}
  </div>

  <div class="success-page" id="success-page" style="display:none;">
    <div class="success-card">
      <div class="icon-circle" id="success-icon"></div>
      <h1 id="success-title" style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px;"></h1>
      <p id="success-message" style="color:#6b7280;font-size:15px;line-height:1.5;margin:0;"></p>
      ${companySettings?.company_email ? `<p style="margin-top:24px;font-size:13px;color:#9ca3af;">Questions? <a href="mailto:${escapeHtml(companySettings.company_email)}" style="color:#2563eb;">${escapeHtml(companySettings.company_email)}</a></p>` : ''}
    </div>
  </div>

  <script>
    var SUBMIT_URL = '${supabaseUrl}/functions/v1/quote-approval/${token}/respond';

    function submitResponse(isApproved) {
      var name = document.getElementById('approver-name').value.trim();
      var email = document.getElementById('approver-email').value.trim();
      var notes = document.getElementById('approver-notes').value.trim();

      if (!name || !email) {
        alert('Please enter your name and email.');
        return;
      }

      var emailPattern = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
      if (!emailPattern.test(email)) {
        alert('Please enter a valid email address.');
        return;
      }

      var action = isApproved ? 'approve' : 'reject';
      if (!confirm('Are you sure you want to ' + action + ' this quote?')) return;

      var overlay = document.getElementById('loading-overlay');
      overlay.classList.add('active');

      var buttons = document.querySelectorAll('.btn');
      for (var i = 0; i < buttons.length; i++) buttons[i].disabled = true;

      fetch(SUBMIT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approved: isApproved,
          approver_name: name,
          approver_email: email,
          notes: notes || null
        })
      })
      .then(function(res) {
        if (!res.ok) return res.json().then(function(d) { throw new Error(d.error || 'Failed'); });
        return res.json();
      })
      .then(function() {
        overlay.classList.remove('active');
        document.getElementById('quote-page').style.display = 'none';
        var sp = document.getElementById('success-page');
        sp.style.display = 'flex';

        var iconEl = document.getElementById('success-icon');
        var titleEl = document.getElementById('success-title');
        var msgEl = document.getElementById('success-message');

        if (isApproved) {
          iconEl.className = 'icon-circle green';
          iconEl.innerHTML = '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg>';
          titleEl.textContent = 'Quote Approved!';
          msgEl.textContent = 'Thank you for approving this quote. We will begin processing your order shortly.';
        } else {
          iconEl.className = 'icon-circle red';
          iconEl.innerHTML = '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
          titleEl.textContent = 'Quote Declined';
          msgEl.textContent = 'Thank you for your response. We have recorded your feedback and will be in touch.';
        }
      })
      .catch(function(err) {
        overlay.classList.remove('active');
        for (var i = 0; i < buttons.length; i++) buttons[i].disabled = false;
        alert(err.message || 'Something went wrong. Please try again.');
      });
    }
  </script>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);

    if (req.method === "GET") {
      const token = pathParts[pathParts.length - 1];

      if (!token || token === "quote-approval") {
        return new Response(renderErrorPage("Approval token is required"), {
          status: 400,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      const { data: approval, error: approvalError } = await supabase
        .from("quote_approvals")
        .select("*, quote:quotes(*)")
        .eq("approval_token", token)
        .maybeSingle();

      if (approvalError || !approval) {
        return new Response(renderErrorPage("Invalid or expired approval link. Please contact the sender for a new link."), {
          status: 404,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      if (approval.expires_at && new Date(approval.expires_at) < new Date()) {
        // Still render the page but show expired state
      }

      if (approval.single_use && approval.is_used) {
        return new Response(renderErrorPage("This approval link has already been used. If you need to make changes, please contact the sender."), {
          status: 410,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      const { data: lineItems } = await supabase
        .from("quote_line_items")
        .select("*")
        .eq("quote_id", approval.quote_id)
        .order("line_number");

      const { data: companySettings } = await supabase
        .from("company_settings")
        .select("company_name, logo_url, company_logo_primary_url, company_email, company_phone, company_website")
        .eq("id", approval.company_id)
        .maybeSingle();

      // TEST: Return simple HTML first
      const testHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Test</title>
</head>
<body>
  <h1>TEST HTML RENDERING</h1>
  <p>If you can see this as a styled page, HTML rendering works!</p>
</body>
</html>`;

      return new Response(testHtml, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (req.method === "POST") {
      const lastPart = pathParts[pathParts.length - 1];
      const token = pathParts[pathParts.length - 2];

      if (lastPart !== "respond") {
        return new Response(
          JSON.stringify({ error: "Invalid endpoint" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const body = await req.json();

      if (body.approved === undefined) {
        return new Response(
          JSON.stringify({ error: "approved field is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!body.approver_name || !body.approver_email) {
        return new Response(
          JSON.stringify({ error: "Approver name and email are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: approval, error: approvalError } = await supabase
        .from("quote_approvals")
        .select("*")
        .eq("approval_token", token)
        .maybeSingle();

      if (approvalError || !approval) {
        return new Response(
          JSON.stringify({ error: "Invalid approval link" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (approval.expires_at && new Date(approval.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: "This approval link has expired" }),
          { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (approval.single_use && approval.is_used) {
        return new Response(
          JSON.stringify({ error: "This approval link has already been used" }),
          { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const ipAddress = req.headers.get("x-forwarded-for") ||
                        req.headers.get("x-real-ip") ||
                        "unknown";
      const userAgent = req.headers.get("user-agent") || "unknown";

      const { data: response, error: responseError } = await supabase
        .from("quote_approval_responses")
        .insert([{
          approval_id: approval.id,
          company_id: approval.company_id,
          approved: body.approved,
          approver_name: body.approver_name,
          approver_email: body.approver_email,
          notes: body.notes || null,
          ip_address: ipAddress,
          user_agent: userAgent,
        }])
        .select()
        .single();

      if (responseError) throw responseError;

      const newStatus = body.approved ? "approved" : "rejected";
      const statusField = body.approved ? "approved_at" : "rejected_at";

      await supabase
        .from("quotes")
        .update({
          status: newStatus,
          [statusField]: new Date().toISOString(),
        })
        .eq("id", approval.quote_id);

      if (approval.single_use) {
        await supabase
          .from("quote_approvals")
          .update({ is_used: true })
          .eq("id", approval.id);
      }

      await supabase
        .from("quote_activity_log")
        .insert([{
          quote_id: approval.quote_id,
          company_id: approval.company_id,
          action: body.approved ? "approved_by_customer" : "rejected_by_customer",
          performed_by: null,
          performed_by_name: body.approver_name,
          meta: {
            approver_email: body.approver_email,
            notes: body.notes,
            ip_address: ipAddress,
          },
        }]);

      return new Response(
        JSON.stringify({
          success: true,
          message: body.approved
            ? "Quote approved successfully!"
            : "Quote rejected. Thank you for your response.",
          response,
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error:", error);

    if (req.method === "GET") {
      return new Response(renderErrorPage(error.message || "Something went wrong"), {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
