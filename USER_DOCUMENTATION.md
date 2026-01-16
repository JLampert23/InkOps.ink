# Printavo Financial Dashboard - User Documentation

**Version 1.0** | Last Updated: January 2026

---

## Table of Contents

1. [Quick Start Guide](#quick-start-guide)
2. [Getting Started](#getting-started)
3. [Dashboard Overview](#dashboard-overview)
4. [Accounting Module](#accounting-module)
5. [Production Management](#production-management)
6. [Square Dashboard](#square-dashboard)
7. [Account Settings & Integrations](#account-settings--integrations)
8. [User Management & Permissions](#user-management--permissions)
9. [Automation & Workflows](#automation--workflows)
10. [Reports & Analytics](#reports--analytics)
11. [Troubleshooting](#troubleshooting)
12. [FAQs](#faqs)

---

## Quick Start Guide

### What You Need

- A web browser (Chrome, Firefox, Safari, or Edge)
- Printavo account credentials (for integration)
- Email address for account creation

### Getting Started in 5 Steps

1. **Sign Up / Sign In** - Create your account or log in at the application URL
2. **Configure Printavo** - Go to Settings and enter your Printavo API credentials
3. **Sync Your Data** - Click "Sync from Printavo" button in the sidebar
4. **Explore Your Dashboard** - View your billing queue, invoices, and financial data
5. **Start Managing** - Send invoices, record payments, and track your business

### Key Features at a Glance

- **Billing Queue**: Manage unpaid invoices and send payment requests
- **Accounts Receivable**: Track aging invoices and outstanding balances
- **Payments**: Record and track all payment transactions
- **Customers**: View customer profiles with complete financial history
- **Production**: Manage quotes, proofs, and production workflows
- **Square Integration**: Track Square POS transactions and deposits
- **Automated Reports**: Schedule reports to be sent automatically
- **Role-Based Access**: Control what users can see and do

---

## Getting Started

### Creating Your Account

1. Navigate to the application URL in your web browser
2. Click "Sign Up" on the login screen
3. Enter your email address and create a secure password
4. Click "Sign Up" to create your account
5. You'll be automatically logged in to your new dashboard

### First Login

After logging in for the first time:

1. You'll see the **Billing Queue** dashboard (may be empty initially)
2. The sidebar on the left provides navigation to all modules
3. The "Sync from Printavo" button at the bottom will sync your data
4. Go to **Account Settings** (click your email at bottom of sidebar) to configure integrations

### Understanding the Interface

#### Sidebar Navigation

The collapsible sidebar on the left contains:

- **Accounting Section** (collapsible):
  - Billing Queue
  - Accounts Receivable
  - Paid Invoices
  - Customers
  - Payments

- **Production Dashboard**: Manage quotes, proofs, and workflows

- **Square Dashboard**: View Square POS data

- **User Controls** (bottom of sidebar):
  - User email and account info
  - Account Settings link
  - Sync from Printavo button
  - Sign Out button
  - Collapse/Expand sidebar toggle

#### Top Bar

- Shows the current page title and description
- Displays status indicators for integrations
- Responsive design adjusts for mobile devices

#### Main Content Area

- Displays the selected module/page
- Contains all data tables, charts, and interactive elements
- Automatically updates when you sync data

---

## Dashboard Overview

### Billing Queue (Main Dashboard)

The Billing Queue is your command center for managing outstanding invoices and payments.

#### Overview Metrics

At the top of the page, you'll see key metrics:

- **Total Invoices**: Count of all invoices in the system
- **Unpaid Amount**: Total outstanding balance across all unpaid invoices
- **Overdue Invoices**: Count and amount of invoices past their due date
- **Recent Payments**: Total payments received in the last 30 days

#### Invoice Tabs

The dashboard has three main tabs:

**1. Open Invoices**
- Shows all unpaid or partially paid invoices
- Click on any invoice to view details
- Use the "Send Invoice" button to email customers
- Record payments directly from this view

**2. Paid Invoices**
- Displays all fully paid invoices
- Filter by date range or customer
- Export paid invoice reports
- View payment history for each invoice

**3. All Invoices**
- Combined view of all invoices regardless of status
- Advanced filtering options
- Bulk actions available
- Export to CSV or PDF

#### Working with Invoices

**Viewing Invoice Details:**
1. Click on any invoice row to expand it
2. See line items, quantities, and prices
3. View all payments applied to the invoice
4. Check fees, taxes, and total calculations

**Sending an Invoice:**
1. Click the "Send Invoice" button next to an invoice
2. Verify the customer email address
3. Add a custom message (optional)
4. Choose to request payment via Stripe (if configured)
5. Click "Send" to email the invoice to the customer

**Recording a Payment:**
1. Click "Record Payment" on an invoice
2. Enter the payment amount
3. Select payment method (Cash, Check, Credit Card, etc.)
4. Add payment date and reference number
5. Add notes (optional)
6. Click "Record Payment" to save

**Locking an Invoice:**
- Locked invoices cannot be edited
- Prevents accidental changes to completed transactions
- Set a 6-digit unlock PIN in your profile settings
- Click the lock icon to lock/unlock invoices

---

## Accounting Module

### Accounts Receivable

The Accounts Receivable (A/R) module helps you track outstanding invoices and aging reports.

#### Aging Report

The aging report categorizes unpaid invoices by how long they've been outstanding:

- **Current**: Invoices not yet due
- **1-30 Days**: Overdue by 1-30 days
- **31-60 Days**: Overdue by 31-60 days
- **61-90 Days**: Overdue by 61-90 days
- **90+ Days**: Overdue by more than 90 days

**Using the Aging Report:**
1. View the summary chart showing aging breakdown
2. See total amounts in each aging bucket
3. Click on any bucket to see detailed invoices
4. Export aging report to CSV or PDF
5. Email the report to stakeholders

#### Outstanding Invoices

View all unpaid invoices with:
- Customer name and contact info
- Invoice number and date
- Original amount and balance due
- Days outstanding
- Status indicators

**Actions you can take:**
- Send payment reminders via email or SMS
- Record partial or full payments
- View complete invoice details
- Filter by customer, date, or amount range

#### Setting Up A/R Automation

1. Go to **Account Settings** > **Automations**
2. Enable "Accounts Receivable Reports"
3. Choose frequency (daily, weekly, monthly)
4. Select recipients
5. Configure which statuses to include
6. Save automation settings

### Customers

The Customers module provides a complete financial profile for each customer.

#### Customer List

View all customers with:
- Customer name and contact information
- Total revenue (lifetime value)
- Outstanding balance
- Number of invoices
- Last invoice date

**Sorting and Filtering:**
- Sort by name, revenue, or balance
- Search by customer name or email
- Filter by customers with outstanding balances
- Export customer list to CSV

#### Customer Detail View

Click on any customer to see:

**Financial Summary:**
- Total revenue from this customer
- Current outstanding balance
- Average invoice value
- Payment history

**Invoice History:**
- All invoices for this customer
- Status of each invoice
- Payment records
- Outstanding balances

**Contact Information:**
- Primary contact name
- Email address
- Phone number
- Billing address
- Shipping address

**Quick Actions:**
- Send statement of account
- Create new invoice
- Record payment
- View communication history

### Payments

The Payments module tracks all payment transactions across your business.

#### Payment List

View all payments with:
- Payment date and amount
- Payment method (Stripe, Cash, Check, etc.)
- Associated invoice number
- Customer name
- Payment status
- Reference number

#### Payment Methods

The system supports multiple payment methods:

- **Stripe**: Online credit/debit card payments
- **Cash**: Cash payments recorded manually
- **Check**: Check payments with check number
- **Bank Transfer**: Direct bank transfers
- **Square**: Payments from Square POS
- **Other**: Any other payment method

#### Recording Manual Payments

1. Navigate to the invoice or click "Add Payment" in Payments module
2. Enter payment details:
   - Amount received
   - Payment method
   - Payment date
   - Reference number (check number, transaction ID, etc.)
   - Notes
3. Click "Record Payment"
4. Payment is applied to invoice balance
5. Confirmation notification appears

#### Payment Status

Payments can have different statuses:

- **Completed**: Payment successfully processed
- **Pending**: Payment initiated but not confirmed
- **Failed**: Payment attempt failed
- **Reversed**: Payment was reversed/refunded

#### Reversing a Payment

If you need to reverse a payment:

1. Find the payment in the Payments list
2. Click "Reverse Payment" (requires admin role)
3. Enter reason for reversal
4. Confirm the reversal
5. A negative payment entry is created
6. Invoice balance is adjusted automatically

---

## Production Management

The Production Dashboard helps you manage the entire lifecycle from quote to delivery.

### Overview

The Production Dashboard is organized into tabs:

- **Dashboard**: Overview of production status
- **Quotes**: Manage estimates and proposals
- **Proofs**: Handle artwork approvals
- **Invoicing**: Convert quotes to invoices
- **Customers**: Customer management
- **Automation**: Set up workflow automations
- **Workflows**: Customize production stages

### Quotes Manager

Create and manage quotes for customers.

#### Creating a Quote

1. Click "New Quote" button
2. Enter customer information:
   - Customer name
   - Email and phone
   - Company name
3. Add line items:
   - Product/service description
   - Quantity
   - Unit price
   - Decorations (printing, embroidery, etc.)
4. Calculate totals
5. Add terms and conditions
6. Preview the quote
7. Save or send to customer

#### Quote Statuses

- **Draft**: Quote in progress, not sent
- **Sent**: Quote sent to customer
- **Viewed**: Customer opened the quote
- **Accepted**: Customer accepted the quote
- **Declined**: Customer declined the quote
- **Expired**: Quote passed expiration date

#### Converting Quotes to Invoices

1. Open an accepted quote
2. Click "Convert to Invoice"
3. Review invoice details
4. Set payment terms
5. Save the invoice
6. Invoice is added to Billing Queue

### Proofs Manager

Manage artwork approvals and revisions.

#### Proof Workflow

1. Upload artwork or design files
2. Link proof to quote or invoice
3. Send proof to customer for approval
4. Customer reviews and provides feedback
5. Make revisions if needed
6. Get final approval
7. Move to production

#### Proof Statuses

- **Pending Review**: Waiting for customer to review
- **Revisions Requested**: Customer requested changes
- **Approved**: Customer approved the design
- **In Production**: Design approved and in production

### Workflow Customization

Create custom workflows that match your business process.

#### Default Workflow Stages

1. Quote/Estimate
2. Proof Creation
3. Proof Approval
4. Production
5. Quality Check
6. Shipping
7. Delivered
8. Invoiced
9. Paid

#### Customizing Workflows

1. Go to **Workflows** tab
2. Click "Add Stage" to create custom stages
3. Drag and drop to reorder stages
4. Set which roles can move items between stages
5. Add automated actions for each stage
6. Save workflow configuration

---

## Square Dashboard

If you use Square for point-of-sale, the Square Dashboard provides real-time integration.

### Connecting Square

1. Go to **Account Settings** > **Integrations**
2. Find the Square section
3. Enter your Square Access Token
4. Test the connection
5. Save settings

### Square Modules

The Square Dashboard includes multiple modules:

#### Transactions

View all Square transactions with:
- Transaction date and time
- Amount and payment method
- Customer information (if available)
- Location where transaction occurred
- Receipt URL

**Filtering Options:**
- Date range
- Location
- Payment method
- Amount range

#### Deposits

Track Square deposits to your bank account:
- Deposit date
- Deposit amount
- Number of transactions included
- Bank account details
- Fee deductions

#### Customers

View customers from your Square account:
- Customer name and contact info
- Total spent
- Number of transactions
- Last visit date
- Customer notes

#### Inventory

Monitor Square inventory (if configured):
- Item name and SKU
- Quantity on hand
- Reorder point
- Item value
- Last sold date

#### Locations

Manage Square business locations:
- Location name and address
- Phone number
- Business hours
- Active/Inactive status

#### Employees

View Square team members:
- Employee name
- Role/position
- Location assignments
- Active/Inactive status

#### Reports

Generate Square-specific reports:
- Sales by location
- Sales by payment method
- Employee performance
- Top selling items
- Revenue trends

### Fetching Square Data

Square data is fetched in real-time:

1. Navigate to any Square module
2. Click "Fetch Data" button
3. Data is retrieved from Square API
4. Results are displayed immediately
5. Use filters to narrow results

---

## Account Settings & Integrations

Access Account Settings by clicking your email address at the bottom of the sidebar, then clicking "Account Settings".

### General Settings

Configure basic account information:

#### Company Information

- **Company Name**: Your business name (appears on invoices)
- **Company Logo**: Upload your logo (displayed on invoices and in sidebar)
  - Supported formats: PNG, JPG, SVG
  - Recommended size: 200x60 pixels
  - Maximum file size: 2MB
- **Address**: Business address for invoices
- **Phone**: Business phone number
- **Email**: Business email (for "From" address)
- **Website**: Company website URL

#### Invoice Settings

- **Default Payment Terms**: Net 15, Net 30, Due on Receipt, etc.
- **Tax Rate**: Default tax percentage
- **Currency**: USD, CAD, EUR, etc.
- **Invoice Prefix**: Custom prefix for invoice numbers
- **Notes**: Default notes on invoices

### Integration Configuration

The application integrates with multiple services. Configure each integration separately.

#### Printavo Integration

Printavo is the core data source for invoices and orders.

**Setup Steps:**
1. Go to **Integrations** tab in Account Settings
2. Find **Printavo** section
3. Enter your Printavo credentials:
   - **Email**: Your Printavo account email
   - **API Token**: Found in Printavo under Settings > API
4. Click "Test Connection" to verify
5. Click "Save" to store credentials securely
6. Click "Sync from Printavo" in sidebar to fetch data

**What Gets Synced:**
- Invoices (all statuses)
- Customers
- Line items and products
- Payments
- Custom fields

**Sync Schedule:**
- Manual: Click "Sync from Printavo" anytime
- Automatic: Every 4 hours (configurable)

#### Stripe Integration

Stripe enables online payment collection and credit card processing.

**Setup Steps:**
1. Create a Stripe account at stripe.com (if you don't have one)
2. Get your API keys from Stripe Dashboard > Developers > API Keys
3. In Account Settings > Integrations > Stripe:
   - **Publishable Key**: Starts with `pk_live_` or `pk_test_`
   - **Secret Key**: Starts with `sk_live_` or `sk_test_`
   - **Webhook Secret**: For webhook verification (optional but recommended)
4. Click "Test Connection"
5. Click "Save"

**What You Can Do:**
- Send payment links to customers
- Accept credit card payments
- Process partial payments
- Track payment status
- Handle refunds
- View transaction history

**Setting Up Webhooks:**

Webhooks allow Stripe to notify your application when payments are processed.

1. In Stripe Dashboard, go to Developers > Webhooks
2. Click "Add endpoint"
3. Enter your webhook URL: `[YOUR_APP_URL]/functions/v1/stripe-webhook`
4. Select events to listen for:
   - `payment_intent.succeeded`
   - `payment_intent.failed`
   - `charge.refunded`
5. Copy the Signing Secret
6. Paste it in Account Settings > Integrations > Stripe > Webhook Secret
7. Save settings

#### Square Integration

Square integration is for POS and in-person payment tracking.

**Setup Steps:**
1. Log in to Square Dashboard
2. Go to Apps > Manage Apps > My Apps
3. Create a new application or use existing
4. Copy your Access Token
5. In Account Settings > Integrations > Square:
   - **Access Token**: Paste your Square access token
   - **Environment**: Production or Sandbox
6. Click "Test Connection"
7. Click "Save"

**What You Can Access:**
- Real-time transaction data
- Deposit information
- Customer database
- Inventory levels
- Location data
- Employee information

#### Email Integration (Resend)

Send transactional emails and invoice reminders.

**Setup Steps:**
1. Create account at resend.com
2. Verify your sending domain
3. Generate an API key
4. In Account Settings > Integrations > Email:
   - **API Key**: Your Resend API key
   - **From Address**: Verified email address (e.g., billing@yourdomain.com)
   - **From Name**: Your business name
5. Click "Test" to send test email
6. Click "Save"

**What Gets Sent:**
- Invoice emails
- Payment reminders
- Overdue notices
- Account statements
- Automated reports
- Password resets

#### SMS Integration (Twilio)

Send SMS notifications and payment reminders.

**Setup Steps:**
1. Create Twilio account at twilio.com
2. Get a phone number
3. Copy your Account SID and Auth Token
4. In Account Settings > Integrations > SMS:
   - **Account SID**: Your Twilio Account SID
   - **Auth Token**: Your Twilio Auth Token
   - **From Number**: Your Twilio phone number (format: +12345678900)
5. Click "Test" to send test SMS
6. Click "Save"

**What You Can Send:**
- Payment reminder texts
- Overdue notifications
- Invoice links
- Custom messages to customers

### User Profile Settings

Manage your personal account settings:

#### Profile Information

- **Display Name**: Your name as shown in the app
- **Email**: Your login email
- **Phone**: Your phone number

#### Security Settings

- **Change Password**: Update your login password
- **Unlock PIN**: Set a 6-digit PIN for unlocking invoices
  - Required to unlock financially locked invoices
  - Cannot be recovered if forgotten (new PIN must be set)
  - Used to prevent accidental changes

#### Notification Preferences

- **Email Notifications**: Receive email alerts
- **Desktop Notifications**: Browser notifications
- **Digest Frequency**: Daily or weekly summary

---

## User Management & Permissions

The application includes role-based access control (RBAC) to manage what users can see and do.

### User Roles

There are four distinct roles:

#### 1. Admin
**Full access to everything:**
- All accounting and financial features
- User management
- Integration settings
- Company settings
- Can reverse payments
- Can unlock invoices
- Can manage automations
- Can export all data

#### 2. Manager
**Most features except sensitive settings:**
- View all financial data
- Record payments
- Send invoices
- Manage customers
- Create reports
- Cannot change integration settings
- Cannot manage users
- Cannot reverse payments

#### 3. Accountant
**Financial-focused access:**
- View all invoices and payments
- Record payments
- Generate reports
- Export financial data
- View A/R aging reports
- Cannot send invoices
- Cannot change settings
- Cannot access production features

#### 4. Viewer
**Read-only access:**
- View dashboards
- View invoices (no PII)
- View reports
- Cannot record payments
- Cannot send invoices
- Cannot export data
- Cannot change any settings

### Managing Users

Admins can add and manage users.

#### Adding a User

1. Go to **Account Settings** > **Users** (admins only)
2. Click "Add User"
3. Enter user information:
   - Email address
   - Full name
   - Role (Admin, Manager, Accountant, Viewer)
4. Click "Send Invitation"
5. User receives email with setup link
6. User creates password and logs in

#### Editing User Permissions

1. Go to **Account Settings** > **Users**
2. Find the user in the list
3. Click "Edit"
4. Change role or status
5. Click "Save"

#### Deactivating a User

1. Go to **Account Settings** > **Users**
2. Find the user in the list
3. Click "Deactivate"
4. User can no longer log in
5. User's data and history remain intact

#### Reactivating a User

1. Go to **Account Settings** > **Users**
2. Filter for "Inactive" users
3. Find the user
4. Click "Reactivate"
5. User can log in again

### Permission Matrix

| Feature | Admin | Manager | Accountant | Viewer |
|---------|-------|---------|------------|--------|
| View Dashboard | Yes | Yes | Yes | Yes |
| View Invoices | Yes | Yes | Yes | Limited |
| Send Invoices | Yes | Yes | No | No |
| Record Payments | Yes | Yes | Yes | No |
| Reverse Payments | Yes | No | No | No |
| Lock/Unlock Invoices | Yes | Yes | No | No |
| View Customers | Yes | Yes | Yes | Limited |
| Edit Customers | Yes | Yes | No | No |
| Access Square Data | Yes | Yes | No | No |
| Access Production | Yes | Yes | No | No |
| Export Data | Yes | Yes | Yes | No |
| View Reports | Yes | Yes | Yes | Yes |
| Manage Users | Yes | No | No | No |
| Edit Settings | Yes | No | No | No |
| Manage Integrations | Yes | No | No | No |
| Create Automations | Yes | Yes | No | No |

---

## Automation & Workflows

Automate repetitive tasks and set up workflows to save time.

### Automated Reports

Schedule reports to be sent automatically via email.

#### Setting Up Automated Reports

1. Go to **Account Settings** > **Automations** > **Automated Reports**
2. Click "Create New Report"
3. Configure the report:
   - **Report Name**: e.g., "Weekly A/R Report"
   - **Report Type**:
     - Accounts Receivable
     - Sales Summary
     - Payments Summary
     - Customer Summary
   - **Frequency**:
     - Daily
     - Weekly (select day)
     - Monthly (select date)
   - **Time**: What time to send
   - **Recipients**: Email addresses (comma-separated)
   - **Filters**:
     - Status filters (open, overdue, etc.)
     - Date range
     - Minimum/maximum amounts
   - **Format**: PDF or CSV
4. Click "Save Automation"
5. Report will be sent automatically on schedule

#### Example Automations

**Daily Overdue Report:**
- Report Type: Accounts Receivable
- Frequency: Daily at 9:00 AM
- Filters: Status = Overdue
- Recipients: collections@company.com

**Weekly Sales Summary:**
- Report Type: Sales Summary
- Frequency: Weekly on Monday at 8:00 AM
- Date Range: Previous week
- Recipients: sales@company.com, ceo@company.com

**Monthly Financial Report:**
- Report Type: Payments Summary
- Frequency: Monthly on 1st at 9:00 AM
- Date Range: Previous month
- Recipients: accounting@company.com

### A/R Collection Automations

Automatically send payment reminders for overdue invoices.

#### Setting Up Collection Automation

1. Go to **Account Settings** > **Automations** > **A/R Collections**
2. Click "Create Automation"
3. Configure triggers:
   - **Trigger**: Days after due date
   - **Invoice Status**: Unpaid or Partially Paid
   - **Minimum Amount**: Only for invoices above this amount
4. Configure actions:
   - **Action Type**: Send Email or Send SMS
   - **Template**: Choose message template
   - **Recipient**: Customer contact
5. Set frequency:
   - **Run Once**: Send one time only
   - **Repeat**: Send every X days until paid
6. Click "Save Automation"

#### Example Collection Flows

**Gentle Reminder (3 days after due):**
- Trigger: 3 days past due date
- Action: Send Email
- Template: "Friendly payment reminder"
- Frequency: Once only

**Firm Notice (15 days after due):**
- Trigger: 15 days past due date
- Action: Send Email
- Template: "Overdue invoice notice"
- Frequency: Once only

**Urgent Notice (30 days after due):**
- Trigger: 30 days past due date
- Action: Send Email AND Send SMS
- Template: "Urgent: Payment required"
- Frequency: Every 7 days

### Billing Workflow Automation

Automate actions when invoices reach certain statuses.

#### Invoice Status Triggers

Set up actions when invoice status changes:

**When Invoice is Created:**
- Send confirmation email
- Notify accounting team
- Create task in project management tool

**When Invoice is Sent:**
- Log activity
- Set follow-up reminder
- Update CRM

**When Payment is Received:**
- Send receipt email
- Update financial records
- Notify sales team

**When Invoice Becomes Overdue:**
- Send reminder
- Flag in dashboard
- Create collection task

#### Setting Up Status Automation

1. Go to **Account Settings** > **Automations** > **Billing Workflow**
2. Click "Create Workflow"
3. Choose trigger:
   - Status change
   - Time-based (X days after creation)
   - Amount threshold
4. Add conditions (optional):
   - Customer type
   - Invoice amount range
   - Payment terms
5. Define actions:
   - Send email
   - Send SMS
   - Update field
   - Create task
   - Webhook call
6. Click "Save Workflow"

### Production Workflow Automation

Automate production stages and approvals.

#### Quote Approval Workflow

Automatically move quotes through approval stages:

1. Quote created → Notify sales manager
2. Quote approved → Generate proof
3. Proof uploaded → Send to customer
4. Proof approved → Create production job
5. Production complete → Generate invoice
6. Invoice sent → Notify accounting

#### Setting Up Production Automation

1. Go to **Production** > **Automation**
2. Click "Create Automation"
3. Select trigger:
   - Quote status change
   - Proof approved
   - Production stage complete
4. Define actions:
   - Move to next stage
   - Assign to team member
   - Send notification
   - Create invoice
5. Click "Save"

---

## Reports & Analytics

Generate detailed reports and gain insights into your business performance.

### Available Reports

The application includes numerous built-in reports:

#### Financial Reports

**1. Sales Summary Report**
- Total sales by period
- Sales by status
- Revenue trends
- Average invoice value
- Conversion rates

**2. Accounts Receivable Report**
- Aging summary
- Outstanding by customer
- Collection metrics
- DSO (Days Sales Outstanding)

**3. Payments Report**
- Payments by method
- Payment trends
- Deposits by date
- Failed payments

**4. Customer Summary Report**
- Customer lifetime value
- Top customers by revenue
- Payment history
- Outstanding balances

**5. Paid Invoices Report**
- All paid invoices by period
- Time to payment analysis
- Discount tracking
- Payment method breakdown

#### Analytics Reports

**6. Revenue by Product**
- Best-selling products
- Revenue per product line
- Product profitability

**7. Revenue by Decoration**
- Screen printing revenue
- Embroidery revenue
- DTG printing revenue
- Other decoration methods

**8. Top Selling Products**
- Units sold by product
- Revenue ranking
- Stock level recommendations

**9. Estimated Margin Report**
- Gross margin by invoice
- Margin by product type
- Margin trends over time

**10. Outstanding Balances Report**
- Total outstanding by customer
- Aged balance analysis
- Collection priority ranking

**11. Overdue Invoices Report**
- All overdue invoices
- Days overdue analysis
- Overdue by customer
- Collection difficulty score

**12. Decoration Breakdown**
- Decoration method usage
- Revenue per decoration type
- Most profitable decorations

**13. Invoices by Status Report**
- Count and amount by status
- Status change velocity
- Stuck invoice identification

#### Operational Reports

**14. Production Dashboard**
- Jobs in production
- Completion rates
- Bottleneck identification
- On-time delivery percentage

**15. Square Transaction Report**
- Daily sales from Square
- Payment method breakdown
- Location performance
- Employee sales performance

### Generating Reports

#### Steps to Generate a Report

1. Navigate to the relevant module (Accounting, Analytics, etc.)
2. Click "Reports" button or tab
3. Select the report type you want
4. Choose date range:
   - Today
   - This Week
   - This Month
   - Last Month
   - This Quarter
   - This Year
   - Custom Range
5. Apply filters (optional):
   - Customer
   - Status
   - Amount range
   - Product category
6. Click "Generate Report"
7. View results on screen

#### Exporting Reports

Once a report is generated, you can export it:

1. Click "Export" button
2. Choose format:
   - **PDF**: Professional formatted report
   - **CSV**: Spreadsheet data
   - **Excel**: Formatted spreadsheet
3. Report downloads to your device
4. Open in appropriate application

#### Scheduling Reports

See [Automated Reports](#automated-reports) section for scheduling recurring reports.

### Understanding Key Metrics

#### DSO (Days Sales Outstanding)

Measures how long it takes to collect payment after sale.

**Formula**: (Accounts Receivable / Total Sales) × Number of Days

**What it means:**
- Lower DSO = Faster collection
- DSO of 30 = Average 30 days to get paid
- Higher DSO may indicate collection problems

#### Aging Buckets

Categorizes unpaid invoices by age:

- **Current**: Not yet due (0-29 days from invoice date, or not past due date)
- **1-30 Days**: 1-30 days past due date
- **31-60 Days**: 31-60 days past due date
- **61-90 Days**: 61-90 days past due date
- **90+ Days**: More than 90 days past due date

**Action Guidelines:**
- Current: Monitor
- 1-30 Days: Send friendly reminder
- 31-60 Days: Send firm notice
- 61-90 Days: Phone call + formal notice
- 90+ Days: Collection agency or write-off consideration

#### Customer Lifetime Value (LTV)

Total revenue generated from a customer over their entire relationship.

**How it's calculated:**
Sum of all invoice totals for that customer

**Why it matters:**
- Identifies your most valuable customers
- Helps prioritize customer service
- Guides marketing investment decisions
- Informs credit limit decisions

#### Conversion Rate

Percentage of quotes that turn into invoices.

**Formula**: (Converted Quotes / Total Quotes) × 100

**Healthy Rates:**
- 20-30%: Typical for competitive industries
- 30-50%: Good conversion
- 50%+: Excellent conversion

**Improving Conversion:**
- Follow up quickly on quotes
- Simplify quote acceptance process
- Offer flexible payment terms
- Provide excellent customer service

---

## Troubleshooting

### Common Issues and Solutions

#### Issue: "Cannot connect to Printavo"

**Possible Causes:**
- Incorrect email or API token
- Printavo account inactive
- Network connectivity issue

**Solutions:**
1. Verify your Printavo credentials in Account Settings
2. Test your credentials directly in Printavo
3. Check that your Printavo account is active
4. Try logging out and back in
5. Contact support if issue persists

#### Issue: "Sync not updating data"

**Possible Causes:**
- Sync hasn't completed yet
- Cached data being displayed
- Printavo API rate limit hit

**Solutions:**
1. Wait for sync to complete (check progress indicator)
2. Refresh your browser page
3. Clear browser cache
4. Wait 5 minutes and try syncing again
5. Check Printavo status page

#### Issue: "Cannot send invoice email"

**Possible Causes:**
- Email integration not configured
- Customer email address missing or invalid
- Email service API issue

**Solutions:**
1. Verify Resend integration in Account Settings
2. Test email connection
3. Check customer has valid email address
4. Verify "From" email address is configured
5. Check email service status

#### Issue: "Stripe payment not showing"

**Possible Causes:**
- Webhook not configured
- Payment still processing
- Stripe test mode vs production mode mismatch

**Solutions:**
1. Verify Stripe webhook is set up correctly
2. Wait a few minutes for payment to process
3. Check you're not mixing test and production API keys
4. Manually trigger webhook in Stripe Dashboard
5. Check Stripe Dashboard for the payment

#### Issue: "Cannot unlock invoice"

**Possible Causes:**
- Incorrect unlock PIN
- PIN not set in profile
- User doesn't have permission

**Solutions:**
1. Verify your 6-digit PIN in Account Settings
2. Set a new PIN if you forgot it
3. Check that you have Admin or Manager role
4. Ask an administrator to unlock it
5. Contact support if locked out

#### Issue: "Square data not loading"

**Possible Causes:**
- Square integration not configured
- Invalid or expired access token
- Square API temporary issue

**Solutions:**
1. Verify Square access token in Account Settings
2. Test Square connection
3. Generate new access token in Square Dashboard
4. Check Square API status
5. Try again in a few minutes

#### Issue: "Report generation fails"

**Possible Causes:**
- Too much data to process
- Invalid date range selected
- Browser timeout

**Solutions:**
1. Try a smaller date range
2. Apply more filters to reduce data volume
3. Refresh page and try again
4. Use CSV export for large datasets
5. Contact support for large report needs

#### Issue: "User cannot log in"

**Possible Causes:**
- Incorrect password
- Account deactivated
- Email not verified

**Solutions:**
1. Use "Forgot Password" to reset password
2. Check if account was deactivated (ask admin)
3. Verify email address is correct
4. Check spam folder for verification email
5. Contact administrator

#### Issue: "Automation not running"

**Possible Causes:**
- Automation disabled
- Incorrect schedule configuration
- Integration not configured

**Solutions:**
1. Check automation is enabled in settings
2. Verify schedule and time zone
3. Ensure required integration (email/SMS) is configured
4. Test automation manually
5. Check automation logs for errors

### Error Messages Explained

#### "Authentication failed"
Your login credentials are incorrect or your session expired. Log in again.

#### "Insufficient permissions"
Your user role doesn't allow this action. Contact an administrator.

#### "Rate limit exceeded"
Too many API requests in a short time. Wait a moment and try again.

#### "Invalid data format"
The data provided doesn't match expected format. Check your input and try again.

#### "Network error"
Cannot connect to the server. Check your internet connection.

#### "Session expired"
Your login session timed out. Please log in again.

#### "Duplicate entry"
A record with this information already exists.

#### "Required field missing"
You must fill in all required fields before saving.

### Getting Help

#### Self-Service Resources

1. **This Documentation**: Comprehensive guide to all features
2. **Tooltips**: Hover over question mark icons in the app
3. **Error Messages**: Read carefully - they often contain solutions
4. **Integration Docs**: Check documentation for Printavo, Stripe, Square, etc.

#### Support Channels

1. **In-App Help**: Click the help icon in top right corner
2. **Email Support**: Send details about your issue including:
   - What you were trying to do
   - What happened instead
   - Screenshots (if applicable)
   - Error messages
   - Your account email
3. **Admin Assistance**: Contact your account administrator
4. **Service Status**: Check integration service status pages

### Browser Compatibility

**Supported Browsers:**
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**Not Supported:**
- Internet Explorer (any version)
- Opera Mini
- Very old browser versions

**Browser Issues:**

If you experience problems:
1. Update to latest browser version
2. Clear browser cache and cookies
3. Disable browser extensions temporarily
4. Try incognito/private mode
5. Try a different supported browser

---

## FAQs

### General Questions

**Q: Do I need a Printavo account to use this application?**
A: Yes, the application syncs data from Printavo. You need an active Printavo account with API access.

**Q: How much does this cost?**
A: Contact your administrator or sales team for pricing information.

**Q: Can I use this on my phone or tablet?**
A: Yes, the application is fully responsive and works on all devices.

**Q: How often does data sync from Printavo?**
A: Automatically every 4 hours, or manually anytime by clicking "Sync from Printavo".

**Q: Is my data secure?**
A: Yes, all data is encrypted in transit and at rest. We follow industry best practices for security.

### Account & Access Questions

**Q: I forgot my password. How do I reset it?**
A: Click "Forgot Password" on the login screen, enter your email, and follow the reset link sent to you.

**Q: Can I change my email address?**
A: Contact your administrator to change your account email address.

**Q: How do I change my role or permissions?**
A: Only administrators can change user roles. Contact your account admin.

**Q: Can I have multiple users on one account?**
A: Yes, administrators can add unlimited users with different roles.

**Q: What's the difference between Manager and Accountant roles?**
A: Managers can send invoices and access production features. Accountants focus on financial reporting and cannot send invoices.

### Data & Syncing Questions

**Q: Why don't I see all my Printavo invoices?**
A: Make sure you've completed at least one successful sync. Click "Sync from Printavo" and wait for completion.

**Q: Can I edit invoices in this application?**
A: No, invoices from Printavo are read-only. Edit them in Printavo, then sync again. You can record payments and send invoices.

**Q: What happens if I delete an invoice in Printavo?**
A: It will be removed from this application on the next sync.

**Q: Can I import data from other sources besides Printavo?**
A: Currently, Printavo is the primary data source. Contact support for custom integration needs.

**Q: How far back does historical data go?**
A: All data available in your Printavo account will be synced.

### Payment Questions

**Q: How do I accept credit card payments?**
A: Set up Stripe integration in Account Settings, then use "Send Invoice" with payment link option.

**Q: What payment methods are supported?**
A: Credit cards (via Stripe), cash, check, bank transfer, Square, and custom methods.

**Q: Can customers pay partial amounts?**
A: Yes, Stripe invoices support partial payments. Manual payments can also be partial.

**Q: How do I record a payment made outside the system?**
A: Click "Record Payment" on the invoice, enter the payment details, and save.

**Q: Can I issue refunds?**
A: Yes, Stripe payments can be refunded from the Payments module (requires admin role).

**Q: Are payment processing fees included?**
A: Stripe charges processing fees (typically 2.9% + $0.30). Square charges vary by plan.

### Invoice Questions

**Q: Can I customize invoice templates?**
A: Yes, upload your logo and set company information in Account Settings. Templates use this information.

**Q: How do I send an invoice to a customer?**
A: Click "Send Invoice" next to any invoice, verify email, and click Send.

**Q: Can I send invoices via SMS?**
A: You can send payment reminders via SMS if Twilio is configured, but full invoices go via email.

**Q: What does "locked invoice" mean?**
A: Locked invoices cannot be edited or have payments reversed, preventing accidental changes to completed transactions.

**Q: How do I unlock an invoice?**
A: Click the lock icon, enter your 6-digit unlock PIN. Only Admins and Managers can unlock.

**Q: Can I add line items to existing invoices?**
A: No, edit invoices in Printavo, then sync again.

### Reporting Questions

**Q: Can I schedule reports to be sent automatically?**
A: Yes, go to Account Settings > Automations > Automated Reports.

**Q: What's the difference between PDF and CSV exports?**
A: PDF is formatted for printing/reading. CSV is for spreadsheet analysis.

**Q: Can I customize reports?**
A: Reports have built-in filters and date ranges. Custom report development may be available.

**Q: How do I calculate my DSO (Days Sales Outstanding)?**
A: DSO is calculated automatically in the A/R report.

**Q: Can I see year-over-year comparisons?**
A: Use custom date ranges in reports to compare different periods.

### Integration Questions

**Q: Do I need all integrations configured?**
A: No, only configure the integrations you use. Printavo is required, others are optional.

**Q: Is it safe to enter my API keys?**
A: Yes, all credentials are encrypted and stored securely. Never share credentials.

**Q: Can I test integrations before going live?**
A: Yes, most integrations have test mode (sandbox) options.

**Q: What if my integration stops working?**
A: Check the connection in Account Settings. You may need to refresh tokens or verify credentials.

**Q: Can I integrate with my accounting software?**
A: Export data as CSV to import into QuickBooks, Xero, or other accounting software.

### Automation Questions

**Q: Will automations send duplicate emails?**
A: No, automations track which invoices have been processed to avoid duplicates.

**Q: Can I stop an automation once it starts?**
A: Disable the automation in settings. Already-sent emails cannot be recalled.

**Q: How do I test an automation before enabling it?**
A: Use test mode and send to your own email address first.

**Q: Can customers unsubscribe from automated emails?**
A: Invoice emails are transactional and don't have unsubscribe. Collection reminders should include opt-out.

**Q: What time zone are automations based on?**
A: Automations use your account's time zone set in Account Settings.

### Troubleshooting Questions

**Q: The application is loading slowly. Why?**
A: Large data sets take time to process. Try filtering to reduce data volume. Clear browser cache.

**Q: I see duplicate invoices. What's wrong?**
A: This shouldn't happen. Try re-syncing from Printavo. Contact support if issue persists.

**Q: Sync failed. What should I do?**
A: Wait a few minutes and try again. Check your Printavo credentials. Verify network connection.

**Q: My changes aren't saving. Help!**
A: Check for error messages. Verify you have permission to make changes. Ensure all required fields are filled.

**Q: Numbers don't match Printavo. Why?**
A: Sync again to get latest data. Check that you're comparing the same date ranges and statuses.

### Advanced Questions

**Q: Can I use the API directly?**
A: The application uses Supabase Edge Functions. Direct API access may be available for enterprise.

**Q: Can I white-label this application?**
A: Contact support about white-label options for enterprise accounts.

**Q: Is there a mobile app?**
A: Not currently, but the web application is fully responsive and works on mobile browsers.

**Q: Can I customize the workflow stages?**
A: Yes, go to Production > Workflows to customize stages and automations.

**Q: Is there a data export for everything?**
A: Yes, most views have CSV export. For complete database export, contact support.

---

## Appendix

### Keyboard Shortcuts

- **Ctrl/Cmd + K**: Global search
- **Escape**: Close modal/dialog
- **Tab**: Navigate form fields
- **Enter**: Submit form or save
- **Ctrl/Cmd + S**: Quick save (where applicable)

### Status Definitions

#### Invoice Statuses

- **Draft**: Invoice created but not finalized
- **Open**: Invoice sent and awaiting payment
- **Partial**: Partial payment received
- **Paid**: Full payment received
- **Overdue**: Past due date with balance remaining
- **Void**: Invoice cancelled
- **Locked**: Invoice locked to prevent changes

#### Payment Statuses

- **Completed**: Payment successfully processed
- **Pending**: Payment initiated, awaiting confirmation
- **Failed**: Payment attempt failed
- **Reversed**: Payment was refunded or reversed

#### Quote/Estimate Statuses

- **Draft**: Quote being prepared
- **Sent**: Quote sent to customer
- **Viewed**: Customer opened the quote
- **Accepted**: Customer accepted quote
- **Declined**: Customer declined quote
- **Expired**: Quote past expiration date
- **Converted**: Quote converted to invoice

#### Production Statuses

- **Quote**: Initial quote phase
- **Proof**: Artwork approval phase
- **Approved**: Design approved
- **In Production**: Being manufactured
- **Quality Check**: QC in progress
- **Shipping**: Being shipped
- **Delivered**: Delivered to customer
- **Complete**: Job complete

### Glossary

**A/R (Accounts Receivable)**: Money owed to you by customers for unpaid invoices.

**Aging Report**: Report showing how long invoices have been outstanding.

**API**: Application Programming Interface - allows systems to communicate.

**Balance Due**: Amount remaining on an invoice after payments applied.

**COD (Cash on Delivery)**: Payment collected when order is delivered.

**DSO (Days Sales Outstanding)**: Average number of days to collect payment.

**LTV (Lifetime Value)**: Total revenue from a customer over their lifetime.

**Net Terms**: Payment terms (e.g., Net 30 = payment due in 30 days).

**PII (Personally Identifiable Information)**: Data that identifies individuals.

**POS (Point of Sale)**: Where transactions occur (e.g., cash register, Square).

**RBAC (Role-Based Access Control)**: Security model based on user roles.

**Webhook**: Automated message sent when an event occurs.

**Write-Off**: Removing an uncollectible invoice from accounts receivable.

### Support Contact Information

For technical support, feature requests, or general inquiries, contact:

- **Email**: support@yourcompany.com
- **Website**: https://support.yourcompany.com
- **Hours**: Monday-Friday, 9 AM - 5 PM EST

For billing questions:
- **Email**: billing@yourcompany.com

For sales inquiries:
- **Email**: sales@yourcompany.com

---

## Document Version History

- **Version 1.0** (January 2026): Initial comprehensive documentation release

---

**End of Documentation**

Thank you for using Printavo Financial Dashboard. We hope this documentation helps you get the most out of the application. If you have suggestions for improving this documentation, please contact support.
