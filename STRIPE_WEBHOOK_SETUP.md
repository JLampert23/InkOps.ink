# Stripe Webhook Configuration Guide

## Issue Found

Invoice 60003424 received a payment in Stripe, but the invoice was not automatically marked as paid and locked. Investigation revealed two critical issues:

1. **No webhook events are being received** - The `stripe_webhook_events` table is empty, indicating Stripe is not sending webhook events to your application
2. **Database field mismatch** - The webhook handler was looking for `invoice_id` field but the correct field is `id` (this has been FIXED)

## Solution

### Step 1: Configure Stripe Webhook

You need to add a webhook endpoint in your Stripe Dashboard to receive payment notifications.

1. **Go to Stripe Dashboard**
   - Log in to https://dashboard.stripe.com/
   - Navigate to **Developers** → **Webhooks**

2. **Add Webhook Endpoint**
   - Click "Add endpoint"
   - Enter this URL:
     ```
     https://cuaukcvccxvfpuxaciac.supabase.co/functions/v1/stripe-webhook
     ```

3. **Select Events to Listen To**
   - Click "Select events"
   - Add these events:
     - `invoice.paid`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
     - `invoice.payment_action_required`
     - `checkout.session.completed`
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `charge.refunded`

4. **Save the Endpoint**
   - Click "Add endpoint"
   - The webhook is now active!

### Step 2: Test the Webhook

After configuring the webhook, you can test it:

1. In Stripe Dashboard, go to **Developers** → **Webhooks**
2. Click on your webhook endpoint
3. Click "Send test webhook"
4. Select `invoice.payment_succeeded` and click "Send test webhook"
5. Check your application logs to verify the event was received

### What's Fixed

The webhook handler has been updated to:
- Use the correct database field (`id` instead of `invoice_id`)
- Properly mark invoices as paid when payments are received
- Lock invoices when fully paid
- Move invoices from billing queue to paid invoices
- Record payment history in the database

### For Invoice 60003424

Since the payment was already processed in Stripe but wasn't recorded in your system, you have two options:

**Option 1: Manual Payment Recording**
- Go to the Invoice Detail page for invoice 60003424
- Use the "Record Manual Payment" button
- Enter the payment amount ($6.03)
- Select payment method "Credit Card"
- This will mark it as paid and lock it

**Option 2: Resend Webhook (if available in Stripe)**
- Go to Stripe Dashboard → Payments
- Find the payment for invoice 60003424
- Click on it and look for webhook events
- If the event exists, you can try resending it

## Future Payments

Once the webhook is configured in Stripe, all future payments will automatically:
1. Update the invoice status
2. Lock the invoice if fully paid
3. Move it to the paid invoices list
4. Record the payment in the database
5. Send any configured notifications
