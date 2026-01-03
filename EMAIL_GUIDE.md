# Email Integration Guide

This project now includes email functionality powered by Resend. You can send transactional emails directly from your application using pre-built templates.

## Setup Instructions

### 1. Get Your Resend API Key

1. Sign up or log in at [Resend](https://resend.com)
2. Go to [API Keys](https://resend.com/api-keys)
3. Create a new API key
4. Copy the API key (you'll need it in the next step)

### 2. Configure Domain (Important!)

Before you can send emails, you need to verify your sending domain:

1. Go to [Resend Domains](https://resend.com/domains)
2. Add your domain
3. Add the required DNS records to your domain provider
4. Wait for verification (usually takes a few minutes)

**Note:** For testing, you can use Resend's sandbox domain, but emails will only be sent to verified addresses.

### 3. Add API Key in Your Application

1. Log in to your application
2. Navigate to **Settings → Integrations**
3. Scroll to the **Resend Email Integration** section
4. Paste your Resend API key from step 1
5. Click **Save Resend Credentials**

Your API key is encrypted and stored securely in the database. You only need to enter it once.

### 4. Update the Default "From" Address (Optional)

If you want to customize the default sender email address:

1. Go to your project files
2. Open `supabase/functions/send-email/index.ts`
3. Find line ~115 and update:
   ```typescript
   from: data?.from || 'noreply@yourdomain.com',
   ```
4. Replace `yourdomain.com` with your actual verified domain

You can also specify the `from` address when calling the email service (see examples below).

## Available Email Templates

### 1. Invoice Reminder
Reminds customers about upcoming or due invoices.

```typescript
import { EmailService } from '../services/email-service';

await EmailService.sendInvoiceReminder('customer@example.com', {
  customerName: 'John Doe',
  invoiceNumber: 'INV-001',
  amountDue: '1,250.00',
  dueDate: 'January 15, 2024',
  invoiceUrl: 'https://yourdomain.com/invoices/001',
  companyName: 'Your Company',
  companyEmail: 'support@yourdomain.com',
  companyPhone: '(555) 123-4567'
});
```

### 2. Payment Received
Confirms payment receipt to customers.

```typescript
await EmailService.sendPaymentReceived('customer@example.com', {
  customerName: 'John Doe',
  invoiceNumber: 'INV-001',
  paymentAmount: '500.00',
  paymentDate: 'January 10, 2024',
  remainingBalance: '750.00', // Optional - omit if paid in full
  invoiceUrl: 'https://yourdomain.com/invoices/001',
  companyName: 'Your Company',
  companyEmail: 'support@yourdomain.com',
  companyPhone: '(555) 123-4567'
});
```

### 3. Overdue Notice
Notifies customers about overdue invoices.

```typescript
await EmailService.sendOverdueNotice('customer@example.com', {
  customerName: 'John Doe',
  invoiceNumber: 'INV-001',
  amountDue: '1,250.00',
  dueDate: 'January 15, 2024',
  daysOverdue: 5,
  invoiceUrl: 'https://yourdomain.com/invoices/001',
  companyName: 'Your Company',
  companyEmail: 'support@yourdomain.com',
  companyPhone: '(555) 123-4567'
});
```

### 4. Welcome Email
Welcomes new customers to your platform.

```typescript
await EmailService.sendWelcomeEmail('customer@example.com', {
  customerName: 'John Doe',
  dashboardUrl: 'https://yourdomain.com/dashboard',
  companyName: 'Your Company',
  companyEmail: 'support@yourdomain.com',
  companyPhone: '(555) 123-4567'
});
```

### 5. Custom Email
Send custom HTML emails.

```typescript
const customHtml = `
  <h1>Hello!</h1>
  <p>This is a custom email.</p>
`;

await EmailService.sendCustomEmail(
  'customer@example.com',
  'Custom Subject Line',
  customHtml
);
```

## Sending to Multiple Recipients

All methods support sending to multiple email addresses:

```typescript
await EmailService.sendInvoiceReminder(
  ['customer1@example.com', 'customer2@example.com'],
  { /* data */ }
);
```

## Using the Low-Level API

For more control, you can use the base `sendEmail` method:

```typescript
import { EmailService } from '../services/email-service';

const result = await EmailService.sendEmail({
  to: 'customer@example.com',
  subject: 'Your Invoice is Ready',
  template: 'invoice-reminder',
  data: {
    customerName: 'John Doe',
    invoiceNumber: 'INV-001',
    // ... other data
  }
});

if (result.success) {
  console.log('Email sent!', result.data);
} else {
  console.error('Failed to send email:', result.error);
}
```

## Error Handling

All email methods return a response with success status:

```typescript
const result = await EmailService.sendInvoiceReminder(/* ... */);

if (result.success) {
  // Email sent successfully
  console.log('Email ID:', result.data?.id);
} else {
  // Handle error
  console.error('Error:', result.error);
  alert(`Failed to send email: ${result.error}`);
}
```

## Integration Examples

### Example: Send Reminder from Invoice List

```typescript
import { EmailService } from '../services/email-service';
import { format } from 'date-fns';

const handleSendReminder = async (invoice: Invoice) => {
  const result = await EmailService.sendInvoiceReminder(
    invoice.customer.email,
    {
      customerName: invoice.customer.name,
      invoiceNumber: invoice.invoice_number,
      amountDue: invoice.amount_outstanding.toFixed(2),
      dueDate: format(new Date(invoice.due_date), 'MMMM d, yyyy'),
      invoiceUrl: getPrintavoInvoiceUrl(invoice.id),
      companyName: 'Your Company Name',
      companyEmail: 'billing@yourcompany.com',
      companyPhone: '(555) 123-4567'
    }
  );

  if (result.success) {
    alert('Reminder sent successfully!');
  } else {
    alert(`Failed to send reminder: ${result.error}`);
  }
};
```

### Example: Automatic Payment Confirmation

```typescript
// When a payment is recorded
const onPaymentReceived = async (payment: Payment, invoice: Invoice) => {
  // Send confirmation email
  await EmailService.sendPaymentReceived(
    invoice.customer.email,
    {
      customerName: invoice.customer.name,
      invoiceNumber: invoice.invoice_number,
      paymentAmount: payment.amount.toFixed(2),
      paymentDate: format(new Date(payment.payment_date), 'MMMM d, yyyy'),
      remainingBalance: invoice.amount_outstanding > 0
        ? invoice.amount_outstanding.toFixed(2)
        : undefined,
      invoiceUrl: getPrintavoInvoiceUrl(invoice.id),
      companyName: 'Your Company Name',
      companyEmail: 'billing@yourcompany.com',
      companyPhone: '(555) 123-4567'
    }
  );
};
```

## Customizing Email Templates

Email templates are defined in the edge function at:
`supabase/functions/send-email/index.ts`

To customize templates:

1. Open the edge function file
2. Find the `generateEmailTemplate` function
3. Modify the HTML for your desired template
4. Redeploy the edge function (this is done automatically when you save)

## Template Styling

All templates use inline styles and are responsive. The base styling includes:

- Professional gradient header (blue/purple)
- Clean, readable typography
- Responsive design for mobile devices
- Consistent spacing and alignment
- Color-coded sections (warnings, success messages)

## Best Practices

1. **Always provide company information** - Include your company name, email, and phone in all emails
2. **Test with your email first** - Send test emails to yourself before sending to customers
3. **Handle errors gracefully** - Always check the result and handle failures
4. **Use descriptive subjects** - Make it clear what the email is about
5. **Include relevant links** - Link back to invoices, dashboards, or payment pages
6. **Respect privacy** - Only send emails to customers who expect them
7. **Rate limiting** - Be mindful of Resend's rate limits (varies by plan)

## Resend Plans and Limits

- **Free Plan**: 3,000 emails/month, 100 emails/day
- **Pro Plan**: 50,000 emails/month, unlimited daily sends
- Check [Resend Pricing](https://resend.com/pricing) for current limits

## Troubleshooting

### Email not sending?

1. Check that you've added your Resend API key in **Settings → Integrations**
2. Verify your domain in Resend dashboard
3. Check browser console for error messages
4. Verify the "from" address uses your verified domain
5. Make sure you're logged in (the email service requires authentication)

### Emails going to spam?

1. Complete domain verification (SPF, DKIM records)
2. Use a recognizable "from" name
3. Avoid spam trigger words in subject lines
4. Keep a good sender reputation

### Rate limit errors?

1. Check your Resend plan limits
2. Implement retry logic with delays
3. Consider upgrading your Resend plan

## Support

- **Resend Documentation**: https://resend.com/docs
- **Supabase Edge Functions**: https://supabase.com/docs/guides/functions
- **Your Edge Function URL**: `https://your-project.supabase.co/functions/v1/send-email`
