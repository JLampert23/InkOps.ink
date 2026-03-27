# InkOps User Guide

**Complete User Documentation**
**Version 2.0** | Last Updated: March 2026

---

## Quick Navigation

- [Getting Started in 15 Minutes](#getting-started-in-15-minutes)
- [Account Settings Setup](#account-settings-setup)
- [Complete Workflows](#complete-workflows)
- [Features by Module](#features-by-module)
- [Integration Guides](#integration-guides)
- [Troubleshooting](#troubleshooting)

---

## Getting Started in 15 Minutes

### What You Need Before Starting

- [ ] Web browser (Chrome, Firefox, Safari, or Edge recommended)
- [ ] Email address for account creation
- [ ] Printavo account credentials (required for data sync)

### Your First 15 Minutes

**1. Create Your Account (2 minutes)**
- Navigate to your InkOps URL
- Click "Sign Up" and enter your email
- Create a secure password
- You're automatically logged in

**2. Configure Printavo Integration (3 minutes)**
- Click your email at the bottom of the sidebar
- Select "Account Settings"
- Go to "Integrations" tab
- Enter your Printavo email and API token
- Click "Test Connection" then "Save"

**3. Sync Your Data (5 minutes)**
- Click "Sync from Printavo" button in sidebar
- Wait for sync to complete (progress shown)
- Your invoices, customers, and orders are now loaded

**4. Set Up Your Company Profile (3 minutes)**
- In Account Settings, go to "Company Profile"
- Enter company name, address, phone
- Upload your logo (optional but recommended)
- Click "Save"

**5. Explore Your Dashboard (2 minutes)**
- View Billing Queue (outstanding invoices)
- Check Accounts Receivable aging report
- Review customer profiles
- See payment history

You're ready to start managing your business!

---

## Account Settings Setup

This is the **most important section** - proper configuration ensures everything works correctly.

### Company Profile

Your company information appears on invoices, quotes, and all customer communications.

**Required Information:**
- **Company Name** - Your business name
- **Company Address** - Street address, city, state, ZIP
- **Company Phone** - Main business phone
- **Company Email** - Main contact email

**Optional but Recommended:**
- **Company Logo** - 200x60 pixels recommended, PNG/JPG/SVG formats
- **Company Website** - Your website URL
- **Invoice Prefix** - Custom prefix for invoice numbers (e.g., "INV-")
- **Default Payment Terms** - Net 15, Net 30, Due on Receipt, etc.
- **Default Tax Rate** - Your standard tax percentage

**How to Configure:**
1. Click your email → Account Settings
2. Click "Company Profile" tab
3. Fill in all fields
4. Upload logo if available
5. Click "Save"

### Integration Configuration

InkOps integrates with multiple services. Configure only what you use.

#### Printavo Integration (REQUIRED)

Printavo is your core data source for invoices, orders, and customers.

**What You Need:**
- Printavo account email
- Printavo API token (get from Printavo Settings → API)

**Setup Steps:**
1. Account Settings → Integrations → Printavo
2. Enter your Printavo email
3. Paste your API token
4. Click "Test Connection" (should show success)
5. Click "Save"
6. Click "Sync from Printavo" in sidebar

**What Gets Synced:**
- All invoices (open, paid, overdue)
- All customers with contact information
- Line items and product details
- Payment history
- Custom fields from Printavo

**Sync Schedule:**
- Manual: Click "Sync from Printavo" anytime
- Automatic: Every 4 hours (configurable)

#### Stripe Integration (OPTIONAL)

Accept online credit card payments and send payment links to customers.

**What You Need:**
- Stripe account (sign up at stripe.com)
- Publishable Key (starts with pk_live_ or pk_test_)
- Secret Key (starts with sk_live_ or sk_test_)

**Setup Steps:**
1. Create Stripe account if you don't have one
2. In Stripe Dashboard → Developers → API Keys
3. Copy both keys
4. Account Settings → Integrations → Stripe
5. Paste Publishable Key and Secret Key
6. Click "Test Connection"
7. Click "Save"

**What You Can Do:**
- Send payment links in invoice emails
- Accept credit/debit card payments online
- Process partial payments
- Track payment status automatically
- Issue refunds
- View complete transaction history

**Webhook Setup (Recommended):**
1. In Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. URL: `[YOUR_INKOPS_URL]/functions/v1/stripe-webhook`
4. Select events: payment_intent.succeeded, payment_intent.failed, charge.refunded
5. Copy Signing Secret
6. Paste in Account Settings → Stripe → Webhook Secret
7. Save

#### Square Integration (OPTIONAL)

For point-of-sale and in-person payment tracking.

**What You Need:**
- Square account
- Access Token from Square Dashboard

**Setup Steps:**
1. Log in to Square Dashboard
2. Apps → Manage Apps → My Apps
3. Create new application or use existing
4. Copy Access Token
5. Account Settings → Integrations → Square
6. Paste Access Token
7. Select environment (Production or Sandbox)
8. Click "Test Connection"
9. Click "Save"

**What You Can Access:**
- Real-time transaction data
- Deposit information
- Customer database sync
- Inventory levels
- Location data
- Employee sales performance

#### Email Integration (OPTIONAL)

Send invoice emails, payment reminders, and customer communications.

**What You Need:**
- Resend account (sign up at resend.com)
- API Key from Resend
- Verified sending domain

**Setup Steps:**
1. Sign up at resend.com
2. Verify your domain (add DNS records)
3. Generate API Key
4. Account Settings → Integrations → Email
5. Paste API Key
6. Enter "From Address" (must use verified domain)
7. Enter "From Name" (your business name)
8. Click "Test" (sends test email)
9. Click "Save"

**What Gets Sent:**
- Invoice emails with payment links
- Payment reminders
- Overdue notices
- Payment confirmations
- Account statements
- Automated reports

#### SMS Integration (OPTIONAL)

Send text message notifications and payment reminders.

**What You Need:**
- Twilio account (sign up at twilio.com)
- Twilio phone number
- Account SID
- Auth Token

**Setup Steps:**
1. Sign up at twilio.com
2. Get a phone number
3. Copy Account SID and Auth Token
4. Account Settings → Integrations → SMS
5. Paste Account SID
6. Paste Auth Token
7. Enter phone number (format: +12345678900)
8. Click "Test" (sends test SMS)
9. Click "Save"

**What You Can Send:**
- Payment reminder texts
- Overdue notifications
- Invoice links
- Custom messages to customers

#### SanMar Integration (OPTIONAL)

Access SanMar product catalog, pricing, and inventory.

**What You Need:**
- SanMar account credentials
- Account number

**Setup Steps:**
1. Account Settings → Integrations → Garment Suppliers
2. Enable SanMar
3. Enter username, password, account number
4. Click "Test Connection"
5. Click "Save"

**What You Get:**
- Real-time product searches
- Live pricing with quantity breaks
- Inventory availability
- Product images
- Nightly catalog sync for fast searches

#### SSActivewear Integration (OPTIONAL)

Access SSActivewear product catalog, pricing, and inventory.

**What You Need:**
- SSActivewear account credentials

**Setup Steps:**
1. Account Settings → Integrations → Garment Suppliers
2. Enable SSActivewear
3. Enter username and password
4. Select price type (Wholesale, Premium, Blank)
5. Select FOB location if applicable
6. Click "Test Connection"
7. Click "Save"

**What You Get:**
- Real-time product searches
- Live pricing
- Inventory availability
- Product images
- Integrated with quote builder

#### ShipStation Integration (OPTIONAL)

Create shipping labels and track shipments.

**What You Need:**
- ShipStation account
- API Key
- API Secret

**Setup Steps:**
1. Account Settings → Integrations → ShipStation
2. Enter API Key and Secret
3. Click "Test Connection"
4. Click "Save"

**What You Can Do:**
- Export invoices to ShipStation
- Create shipping labels
- Track shipments
- Update customers with tracking info

### User Management

Add team members and control what they can access.

**User Roles:**

**Admin** - Full access to everything
- View and manage all financial data
- Configure integrations and settings
- Add/remove users
- Reverse payments
- Lock/unlock invoices
- Create automations
- Export all data

**Manager** - Most features except sensitive settings
- View all financial data
- Record and send invoices
- Manage customers
- Create reports
- Cannot change integration settings
- Cannot manage users
- Cannot reverse payments

**Accountant** - Financial-focused access
- View all invoices and payments
- Record payments
- Generate financial reports
- Export data
- Cannot send invoices
- Cannot change settings
- Cannot access production features

**Viewer** - Read-only access
- View dashboards and reports
- View invoices (limited PII)
- Cannot record payments
- Cannot send invoices
- Cannot export data
- Cannot change settings

**Adding a User:**
1. Account Settings → Users (admins only)
2. Click "Add User"
3. Enter email, full name
4. Select role
5. Click "Send Invitation"
6. User receives setup email
7. User creates password and logs in

**Editing User Permissions:**
1. Account Settings → Users
2. Find user in list
3. Click "Edit"
4. Change role or status
5. Click "Save"

**Deactivating a User:**
1. Account Settings → Users
2. Find user
3. Click "Deactivate"
4. User can no longer log in
5. History remains intact

### Email Template Configuration

Create reusable email templates with dynamic content.

**Available Templates:**
- Quote Approval Request
- Invoice Payment Request
- Payment Received Confirmation
- Overdue Invoice Reminder
- Account Statement
- Welcome Email

**Setting Up Templates:**
1. Account Settings → Email Templates
2. Click "Create Template" or edit existing
3. Enter template name
4. Write subject line with shortcodes
5. Compose email body with shortcodes
6. Preview with sample data
7. Click "Save"

**Using Shortcodes:**

Shortcodes are placeholders that get replaced with real data. Examples:
- `{{customer_first_name}}` → "John"
- `{{invoice_number}}` → "INV-001"
- `{{invoice_total}}` → "$1,250.00"
- `{{company_name}}` → "Your Company"

See complete shortcode reference at end of this guide.

### Automation Setup

Automate repetitive tasks to save time.

**Available Automations:**

**Automated Reports:**
- Sales Summary
- Accounts Receivable
- Payments Summary
- Customer Summary

**Setup Steps:**
1. Account Settings → Automations → Automated Reports
2. Click "Create New Report"
3. Select report type
4. Choose frequency (Daily, Weekly, Monthly)
5. Set time to send
6. Enter recipient email addresses
7. Apply filters if needed
8. Select format (PDF or CSV)
9. Click "Save"

**A/R Collection Automations:**
1. Account Settings → Automations → A/R Collections
2. Click "Create Automation"
3. Set trigger (days after due date)
4. Choose action (Send Email or SMS)
5. Select message template
6. Set frequency (once or repeat)
7. Click "Save"

**Invoice Status Automations:**
1. Account Settings → Automations → Invoice Workflows
2. Click "Create Workflow"
3. Choose trigger (status change, time-based, amount threshold)
4. Add conditions (optional)
5. Define actions (email, SMS, update field)
6. Click "Save"

### Purchase Order Settings

Control PO behavior, numbering, and approval workflows.

**PO Settings:**
1. Account Settings → Manage Goods → PO Settings

**Key Settings:**

**Numbering:**
- PO Number Format (e.g., PO-{YYYY}-{SEQ})
- Starting Sequence Number

**Approval Rules:**
- Require approval before sending
- Allow editing after sending
- Require justification for edits

**Email & Communication:**
- Default email template
- Auto-attach PDF
- CC accounting team
- CC sales representative
- Require vendor confirmation before receiving

**Receiving:**
- Vendor confirmation required
- Auto-update work order status

---

## Complete Workflows

This section shows you how to complete end-to-end business processes.

### Quote-to-Cash Workflow

This is the complete journey from creating a quote to collecting payment.

**Step 1: Create Quote**

1. Go to Production → Quotes
2. Click "New Quote"
3. Select customer or create new customer
4. Add line items:
   - Search products from SanMar/SSActivewear
   - Or enter custom items
   - Set quantities and sizes
5. Add decorations (print, embroidery, etc.)
6. Set pricing and discounts
7. Add terms and conditions
8. Preview quote
9. Save as draft or send to customer

**Step 2: Send Quote to Customer**

1. Open quote from list
2. Click "Send Quote"
3. Select email template
4. Review email content (uses shortcodes)
5. Add custom message if needed
6. Click "Send"
7. Customer receives approval link

**Step 3: Customer Approves Quote**

1. Customer clicks approval link
2. Reviews quote details
3. Enters name and email
4. Clicks "Approve Quote"
5. Quote status changes to "Approved"

**Automatic Processes Triggered:**

When quote is approved, the system automatically:
- Creates Work Order
- Creates Invoice
- Stages Garment Requirements for PO creation
- Pushes to Production Scheduler
- Logs all activity

**Step 4: Purchase Garments (if Auto-PO enabled)**

1. Go to Manage Goods → Auto-PO Dashboard
2. View pending garment requirements
3. Click "Create POs"
4. System creates draft POs grouped by vendor
5. Review draft POs
6. Send POs to vendors

**Step 5: Receive Garments**

1. Go to Manage Goods → Receiving
2. Select PO to receive
3. Enter quantities received
4. Note any damaged or short items
5. Click "Process Receiving"
6. System tracks cumulative quantities

**Automatic Work Order Update:**

When all garments are received:
- Work Order marked as "Garments Ready"
- Status changes to "In Progress"
- Production Scheduler notified

**Step 6: Production Process**

1. Production → Scheduler shows ready jobs
2. Move work order through stages:
   - Pre-Press (artwork, screens)
   - Production (printing, embroidery)
   - Finishing (folding, bagging)
   - Quality Control (inspection)
   - Completed
3. Each stage timestamped and tracked
4. QC can fail and send back to production

**Step 7: Invoice Customer**

Invoice was auto-created when quote approved. Now:
1. Go to Accounting → Billing Queue
2. Find invoice (status: Open)
3. Click "Send Invoice"
4. Select email template
5. Include Stripe payment link if configured
6. Click "Send"
7. Customer receives invoice with payment link

**Step 8: Collect Payment**

**Option A: Customer Pays Online (Stripe)**
- Customer clicks payment link
- Enters card information
- Payment processed automatically
- Invoice updated automatically
- Customer receives receipt

**Option B: Manual Payment**
- Customer pays cash, check, or bank transfer
- Click "Record Payment" on invoice
- Enter amount, method, date
- Add reference number (check #, transaction ID)
- Click "Save"
- Invoice balance updated

**Step 9: Fulfillment**

**Option A: Create Shipping Label (ShipStation)**
- Click "Export to ShipStation" on invoice
- Create shipping label
- Track shipment
- Update customer

**Option B: Customer Pickup**
- Mark invoice as fulfilled
- Notify customer ready for pickup

**Step 10: Complete & Close**

- Invoice fully paid → Status: "Paid"
- Work order completed → Status: "Completed"
- Quote converted → Status: "Converted"
- Job complete

**Timeline Example:**
- Day 1: Quote created and sent
- Day 2: Customer approves
- Day 2: PO created and sent to vendor
- Day 5: Garments received
- Day 5-7: Production (pre-press, printing, finishing, QC)
- Day 7: Invoice sent to customer
- Day 10: Customer pays
- Day 10: Ship to customer
- Day 11: Delivered, job complete

### Purchase Order Workflow

**Step 1: Create Purchase Order**

**Manual Creation:**
1. Go to Manage Goods → Purchase Orders
2. Click "Create PO"
3. Select vendor
4. Add line items (products, quantities, costs)
5. Enter delivery date
6. Add notes for vendor
7. Generate PO number
8. Save as draft

**Automatic Creation (from approved quotes):**
1. Enable Auto-PO in Account Settings
2. When quote approved, garments staged
3. Click "Create POs" in Auto-PO Dashboard
4. System groups by vendor
5. Draft POs created automatically

**Step 2: Send PO to Vendor**

1. Open draft PO
2. Review all details
3. Generate PDF if not attached
4. Click "Send PO"
5. Status changes to "Sent"
6. Vendor receives PO by email

**Step 3: Vendor Confirms Order** (if required)

1. Wait for vendor confirmation
2. When confirmed, update status to "Confirmed"
3. Now receiving is allowed

**Step 4: Track Delivery**

1. Expected delivery date calculated automatically
2. Status updates: In Transit
3. Notifications when approaching delivery date

**Step 5: Receive Goods**

1. Go to Manage Goods → Receiving
2. Select PO
3. Verify vendor confirmation (if required)
4. Enter received quantities per line item
5. Note damaged items
6. Note short shipments
7. Add variance explanations
8. Click "Process Receiving"

**Step 6: Verify Completion**

1. All quantities received → Status: "Fully Received"
2. Partial receipt → Status: "Partially Received"
3. Linked work orders updated if all garments ready

**Step 7: Close PO**

1. Verify all items received
2. Resolve any variances
3. Click "Close PO"
4. Status: "Closed"

### Receiving Workflow

**Preparation:**
1. Check expected deliveries (POs sent to vendors)
2. Prepare receiving area
3. Have PO details ready

**Receiving Process:**

**Step 1: Locate PO**
1. Go to Manage Goods → Receiving
2. Find PO in receivable list
3. Click to open

**Step 2: Verify Can Receive**
- Check PO status (must be Sent or Confirmed)
- If vendor confirmation required, verify PO is confirmed
- If blocked, resolve before continuing

**Step 3: Scan or Enter Quantities**

For each line item:
1. Scan barcode (if available) or manually select item
2. Enter quantity received
3. Note quantity damaged (if any)
4. Note quantity short (if any)
5. Add variance notes for damaged/short items
6. Move to next item

**Step 4: Add Receipt Notes**
- Delivery carrier and tracking
- Condition of shipment
- Any issues noticed
- Special handling notes

**Step 5: Submit Receiving**
1. Review all quantities
2. Verify totals
3. Click "Process Receiving"
4. System creates receiving log
5. Updates PO line items (cumulative)
6. Updates PO receiving status

**Step 6: Automatic Work Order Updates**

System checks:
- Are all garments needed for work order received?
- If yes:
  - Updates work order: Garments Ready
  - Sets Ready for Production
  - Notifies production scheduler
  - Logs activity

**Step 7: Handle Variances**

If damaged or short:
1. Document with photos
2. Note details in variance notes
3. File claim with vendor if needed
4. Create replacement PO if necessary

**Best Practices:**
- Receive on same day as delivery
- Inspect thoroughly before accepting
- Document all variances immediately
- Use barcode scanning for speed and accuracy
- Partial receives are OK, track carefully

### Production Workflow

**Overview:**

Work orders move through 5 stages:
1. Pre-Press
2. Production
3. Finishing
4. Quality Control
5. Completed

Each stage is tracked with timestamps, duration, and user accountability.

**Stage 1: Pre-Press**

**Activities:**
- Artwork preparation
- Color separation
- Screen burning or hoop setup
- Film output
- Test prints

**Process:**
1. Work order appears in Production → Scheduler
2. Pre-press team claims work order
3. Completes artwork and setup
4. Runs test prints
5. Clicks "Advance to Production"
6. Adds notes about what was completed
7. System records completion time and user

**Stage 2: Production**

**Activities:**
- Screen printing
- Embroidery
- DTG printing
- DTF application
- Heat press

**Process:**
1. Production team receives notification
2. Work order appears in Production queue
3. Team completes printing/decoration
4. Verifies quality as they work
5. Clicks "Advance to Finishing"
6. Adds production notes
7. System records type (printing, embroidery, etc.)

**Stage 3: Finishing**

**Activities:**
- Folding garments
- Bagging/packaging
- Tagging and labeling
- Order preparation

**Process:**
1. Finishing team receives notification
2. Work order in Finishing queue
3. Completes folding and packaging
4. Prepares for quality check
5. Clicks "Advance to QC"
6. Adds finishing notes

**Stage 4: Quality Control**

**Activities:**
- Final inspection
- Quality verification
- Pass/fail determination
- Rework routing if needed

**Process:**
1. QC inspector receives notification
2. Work order in QC queue
3. Inspects all items
4. Records inspection results:
   - Items inspected
   - Items passed
   - Items failed
5. **If Pass:**
   - Clicks "Pass QC"
   - Advances to Completed
6. **If Fail:**
   - Enters failure reason
   - Provides rework instructions
   - Clicks "Fail QC"
   - Work order sent back to Production
   - Production re-does work
   - Returns to QC for re-inspection

**Stage 5: Completed**

**Activities:**
- Work order marked complete
- Total duration calculated
- Ready for shipping/pickup

**Process:**
1. System updates work order status to "Completed"
2. Records completion timestamp
3. Calculates total production time
4. Invoice can now be fulfilled

**Tracking & Reporting:**

**Real-time Status:**
- View current stage for any work order
- See how long in current stage
- Check who completed each stage
- Review stage durations

**Performance Metrics:**
- Average duration per stage
- Bottleneck identification
- QC pass rates
- Total cycle time

**Variance Reporting:**

If issues occur during production:
1. Click "Report Variance"
2. Select stage where issue occurred
3. Choose type (equipment, quality, material, etc.)
4. Set severity (minor, moderate, major, critical)
5. Describe issue in detail
6. Note quantity affected
7. Submit variance report
8. Production manager resolves
9. Resolution documented

**Hold Status:**

To pause a work order:
1. Click "Put on Hold"
2. Enter hold reason
3. Work order status: "On Hold"
4. To resume: Click "Resume", enter notes

### Billing and Collections Workflow

**Step 1: Monitor Billing Queue**

1. Go to Accounting → Billing Queue
2. View all open invoices
3. See aging summary (Current, 1-30 days, 31-60 days, etc.)
4. Sort by due date, customer, amount

**Step 2: Send Invoices**

**Individual Invoice:**
1. Click on invoice in queue
2. Click "Send Invoice"
3. Select email template
4. Include Stripe payment link (if configured)
5. Add custom message
6. Click "Send"
7. Customer receives email

**Bulk Sending:**
1. Select multiple invoices
2. Click "Send Selected"
3. Choose template
4. All customers receive invoices

**Step 3: Track Payment Status**

**Invoice Statuses:**
- **Open** - Sent, awaiting payment
- **Partial** - Partially paid
- **Paid** - Fully paid
- **Overdue** - Past due date with balance

**Monitoring:**
1. Dashboard shows unpaid amount
2. Aging report shows overdue invoices
3. Notifications for new payments

**Step 4: Record Payments**

**Stripe Payments (Automatic):**
- Customer clicks payment link
- Pays online
- Payment recorded automatically
- Invoice updated
- Customer gets receipt

**Manual Payments:**
1. Click "Record Payment" on invoice
2. Enter amount received
3. Select payment method (Cash, Check, Bank Transfer)
4. Enter payment date
5. Add reference number (check #, transaction ID)
6. Add notes
7. Click "Save"
8. Invoice balance updated

**Step 5: Collections for Overdue**

**Manual Reminders:**
1. Open overdue invoice
2. Click "Send Reminder"
3. Select reminder template
4. Send email or SMS

**Automated Reminders:**
1. Set up collection automations
2. Example: 3 days after due → gentle reminder
3. Example: 15 days after due → firm notice
4. Example: 30 days after due → urgent notice
5. Automations run on schedule

**Step 6: Generate Reports**

**Accounts Receivable Report:**
1. Go to Accounting → A/R Report
2. Select date range
3. Generate aging report
4. Export to PDF or CSV
5. Email to stakeholders

**Collections Report:**
1. Filter invoices by status: Overdue
2. Sort by days overdue
3. Identify priority collections
4. Take action on oldest invoices

**Step 7: Close Paid Invoices**

1. When fully paid, invoice moves to "Paid Invoices"
2. Lock invoice to prevent changes
3. Archive for records

**Best Practices:**
- Send invoices immediately after work complete
- Include payment links for convenience
- Follow up on overdue invoices promptly
- Use automated reminders for consistency
- Document all payment communications
- Reconcile payments daily

### Reporting Workflow

**Step 1: Determine What You Need**

**Common Reporting Needs:**
- Monthly sales summary
- Accounts receivable aging
- Customer lifetime value
- Payment method breakdown
- Product sales analysis
- Overdue invoices list

**Step 2: Navigate to Report**

**Financial Reports:**
- Accounting → Reports
- Select report type
- Choose date range
- Apply filters

**Analytics Reports:**
- Dashboard → Analytics
- Select metric to analyze
- Set comparison period

**Step 3: Configure Report Parameters**

**Date Range Options:**
- Today
- This Week
- This Month
- Last Month
- This Quarter
- Last Quarter
- This Year
- Last Year
- Custom Range

**Filters:**
- Customer (specific or all)
- Status (open, paid, overdue)
- Amount range (min/max)
- Payment method
- Product category
- Sales representative

**Step 4: Generate Report**

1. Click "Generate Report"
2. Wait for processing
3. Review results on screen
4. Check totals and calculations
5. Verify data looks correct

**Step 5: Export Report**

**Export Formats:**

**PDF** - Professional formatted report
- Includes charts and graphs
- Company branding
- Printer-friendly
- Ideal for sharing with stakeholders

**CSV** - Spreadsheet data
- Raw data for analysis
- Import into Excel or Google Sheets
- Pivot tables and custom calculations
- Ideal for further processing

**Export Process:**
1. Click "Export" button
2. Choose format (PDF or CSV)
3. Report downloads to device
4. Open in appropriate application

**Step 6: Schedule Automated Reports**

1. Account Settings → Automations → Automated Reports
2. Click "Create New Report"
3. Configure:
   - Report type
   - Frequency (Daily, Weekly, Monthly)
   - Time to send
   - Recipients
   - Filters
   - Format
4. Click "Save"
5. Reports sent automatically

**Step 7: Analyze and Take Action**

**Sales Summary:**
- Are sales trending up or down?
- Which months are strongest?
- What's the average invoice value?
- Action: Adjust pricing, marketing

**Accounts Receivable:**
- How much is outstanding?
- Who owes the most?
- What's aging into 60+ days?
- Action: Prioritize collections

**Customer Analysis:**
- Who are top customers by revenue?
- Who has highest outstanding balances?
- Who pays fastest?
- Action: Strengthen relationships, adjust credit terms

**Product Performance:**
- Which products sell best?
- What decoration methods are most popular?
- Which styles generate most revenue?
- Action: Stock popular items, promote slow movers

---

## Features by Module

### Billing Queue

Your command center for managing outstanding invoices.

**Dashboard Metrics:**
- Total invoices count
- Unpaid amount (total outstanding)
- Overdue invoices (count and amount)
- Recent payments (last 30 days)

**Invoice Tabs:**

**Open Invoices:**
- All unpaid or partially paid invoices
- Expandable details per invoice
- Quick actions: Send, Record Payment, View Details
- Sort by date, amount, customer

**Paid Invoices:**
- All fully paid invoices
- Payment history visible
- Export options
- Archive access

**All Invoices:**
- Combined view regardless of status
- Advanced filtering
- Bulk actions
- Comprehensive export

**Working with Invoices:**

**View Details:**
- Click invoice row to expand
- See line items with quantities and prices
- View payment history
- Check fees, taxes, totals

**Send Invoice:**
- "Send Invoice" button
- Verify customer email
- Add custom message
- Include Stripe payment link
- Send confirmation

**Record Payment:**
- "Record Payment" button
- Enter amount, method, date
- Add reference number
- Add notes
- Save and update balance

**Lock Invoice:**
- Prevents accidental edits
- Set unlock PIN in profile
- Click lock icon to toggle
- Unlock with PIN when needed

### Accounts Receivable

Track outstanding balances and aging.

**Aging Report:**

**Buckets:**
- **Current** - Not yet due
- **1-30 Days** - Overdue 1-30 days
- **31-60 Days** - Overdue 31-60 days
- **61-90 Days** - Overdue 61-90 days
- **90+ Days** - Overdue 90+ days

**Using the Report:**
- View summary chart
- See totals per bucket
- Click bucket to see invoices
- Export aging report
- Email to stakeholders

**Outstanding Invoices View:**
- Customer name and contact
- Invoice number and date
- Original amount and balance
- Days outstanding
- Status indicators
- Quick actions available

**A/R Automation:**
1. Account Settings → Automations → A/R Reports
2. Enable automated reports
3. Choose frequency
4. Select recipients
5. Configure status filters
6. Save settings

### Customers

Complete financial profiles for each customer.

**Customer List:**
- Customer name and company
- Contact information
- Total revenue (lifetime value)
- Current outstanding balance
- Number of invoices
- Last invoice date

**Sorting and Filtering:**
- Sort by name, revenue, balance
- Search by name or email
- Filter: Customers with balances only
- Export customer list

**Customer Detail View:**

**Financial Summary:**
- Total revenue
- Outstanding balance
- Average invoice value
- Payment history
- Days to payment (average)

**Invoice History:**
- All invoices for customer
- Status of each
- Payment records
- Outstanding balances

**Contact Information:**
- Primary contact name
- Email address
- Phone number
- Billing address
- Shipping address

**Quick Actions:**
- Send account statement
- Create new invoice
- Record payment
- View communication history
- Edit customer details

### Payments

Track all payment transactions.

**Payment List:**
- Payment date and amount
- Payment method
- Associated invoice
- Customer name
- Payment status
- Reference number

**Payment Methods Supported:**
- Stripe (online credit/debit)
- Cash
- Check (with check number)
- Bank Transfer
- Square POS
- Fundraising Credits
- Other/Custom

**Recording Manual Payments:**
1. Navigate to invoice or Payments module
2. Click "Add Payment"
3. Enter details:
   - Amount
   - Method
   - Date
   - Reference number
   - Notes
4. Click "Save"
5. Invoice balance updated
6. Confirmation shown

**Payment Statuses:**
- **Completed** - Successfully processed
- **Pending** - Initiated, not confirmed
- **Failed** - Attempt failed
- **Reversed** - Refunded/reversed

**Reversing Payments:**
1. Find payment in list
2. Click "Reverse Payment" (admin only)
3. Enter reason
4. Confirm reversal
5. Negative entry created
6. Invoice balance adjusted

### Production Dashboard

Manage quotes, proofs, and production workflow.

**Dashboard Tabs:**
- Dashboard (overview)
- Quotes (estimate management)
- Proofs (artwork approvals)
- Invoicing (conversion)
- Customers (production customers)
- Automation (workflow rules)
- Workflows (stage customization)

**Quotes Manager:**

**Creating Quotes:**
1. Click "New Quote"
2. Enter customer info
3. Add line items:
   - Search products (SanMar/SSActivewear)
   - Custom items
   - Quantities and sizes
4. Add decorations/imprints
5. Calculate totals
6. Add terms
7. Preview
8. Save or send

**Quote Statuses:**
- Draft - In progress, not sent
- Sent - Sent to customer
- Viewed - Customer opened
- Approved - Customer accepted
- Declined - Customer rejected
- Expired - Past expiration date
- Converted - Became invoice

**Sending Quotes:**
1. Open quote
2. Click "Send Quote"
3. Select email template
4. Review content (shortcodes filled)
5. Send to customer
6. Customer gets approval link

**Quote Approval:**
- Customer clicks link
- Reviews quote details
- Enters name/email
- Approves or declines
- System processes approval:
  - Creates work order
  - Creates invoice
  - Stages garments
  - Pushes to scheduler

**Proofs Manager:**

**Proof Workflow:**
1. Upload artwork/design files
2. Link to quote or invoice
3. Send to customer
4. Customer reviews
5. Customer provides feedback
6. Make revisions if needed
7. Get final approval
8. Move to production

**Proof Statuses:**
- Pending Review - Awaiting customer
- Revisions Requested - Changes needed
- Approved - Design approved
- In Production - Production started

**Workflow Customization:**

**Default Stages:**
1. Quote/Estimate
2. Proof Creation
3. Proof Approval
4. Production
5. Quality Check
6. Shipping
7. Delivered
8. Invoiced
9. Paid

**Customizing:**
1. Go to Workflows tab
2. Add custom stages
3. Drag to reorder
4. Set role permissions
5. Add automated actions
6. Save configuration

### Square Dashboard

Point-of-sale integration for Square users.

**Connecting Square:**
1. Account Settings → Integrations → Square
2. Enter Access Token
3. Test connection
4. Save settings

**Square Modules:**

**Transactions:**
- All Square transactions
- Date and time
- Amount and payment method
- Customer info
- Location
- Receipt URL
- Filters: date, location, method, amount

**Deposits:**
- Square bank deposits
- Deposit date and amount
- Transaction count included
- Bank account details
- Fee deductions

**Customers:**
- Square customer database
- Contact information
- Total spent
- Transaction count
- Last visit date
- Customer notes

**Inventory:**
- Item name and SKU
- Quantity on hand
- Reorder point
- Item value
- Last sold date

**Locations:**
- Business location details
- Address and phone
- Business hours
- Active/Inactive status

**Employees:**
- Team member info
- Role/position
- Location assignments
- Active status

**Reports:**
- Sales by location
- Sales by payment method
- Employee performance
- Top selling items
- Revenue trends

**Fetching Data:**
1. Navigate to Square module
2. Click "Fetch Data"
3. Data retrieved from Square API
4. Results displayed
5. Use filters to narrow

### Purchase Orders

Create and manage vendor purchase orders.

**PO Creation:**
1. Manage Goods → Purchase Orders
2. Click "Create PO"
3. Select vendor
4. Add line items
5. Set delivery date
6. Add notes
7. Generate PO number
8. Save as draft

**PO Statuses:**
- Draft - Being created
- Sent - Sent to vendor
- Confirmed - Vendor confirmed
- In Transit - Shipping
- Partially Received - Some items received
- Fully Received - All received
- Closed - Completed

**PO Line Items:**
- Product SKU/style
- Description
- Color and size
- Quantity ordered
- Quantity received
- Unit cost
- Extended cost

**Sending POs:**
1. Review draft PO
2. Generate PDF
3. Click "Send PO"
4. Email to vendor
5. Status updates to Sent

**Vendor Management:**
- Vendor name and type
- Contact information
- Payment terms
- Lead time (days)
- Min order quantity/value
- Preferred vendor flag
- Active status

### Receiving

Process goods received from vendors.

**Receiving Dashboard:**
- Receivable POs list
- Blocked POs (if vendor confirmation required)
- Recently received
- Statistics

**Receiving Process:**
1. Select PO
2. Verify can receive
3. Enter quantities received per line
4. Note damaged items
5. Note short shipments
6. Add variance notes
7. Add receipt notes
8. Click "Process Receiving"
9. System updates PO
10. Updates linked work orders if ready

**Receiving Logs:**
- Complete history per PO
- Date and user
- Quantities received
- Variance notes
- Cumulative totals

**Work Order Readiness:**

System automatically checks:
- Do all requirements have POs?
- Are all quantities received?
- If yes:
  - Updates work order
  - Sets "Garments Ready"
  - Sets "Ready for Production"
  - Notifies scheduler

### Production Scheduler

Visual production schedule and work order tracking.

**Scheduler Views:**
- Kanban board (by stage)
- Calendar view (by date)
- List view (filterable)
- Timeline view

**Work Order Cards:**
- Work order number
- Customer name
- Due dates (production, customer)
- Priority level
- Current stage
- Total quantity
- Status indicators

**Kanban Columns:**
- Pre-Press
- Production
- Finishing
- Quality Control
- Completed

**Moving Work Orders:**
1. Drag card to next column
2. System prompts for notes
3. Enter completion notes
4. Card moves
5. Timestamps recorded
6. Next department notified

**Filtering:**
- By priority
- By due date
- By customer
- By status
- By assigned user

**Calendar View:**
- See scheduled jobs by date
- Drag to reschedule
- Color-coded by priority
- Click for details

### Manage Goods

Purchase orders, receiving, and inventory.

**Sub-Modules:**
- Purchase Orders
- Receiving
- Auto-PO Dashboard
- Garment Order Report
- Vendors

**Auto-PO Dashboard:**

**Statistics:**
- Pending requirements (count, value)
- POs created today
- Active vendors
- Draft POs awaiting review

**Pending Requirements:**
- Grouped by vendor
- Requirement count per vendor
- Total value per vendor
- Detailed requirement list

**Create POs:**
1. Click "Create POs"
2. System groups by vendor
3. Creates draft POs
4. Links to requirements
5. Shows confirmation
6. Draft POs ready to review

**Garment Order Report:**
- All garment requirements
- By work order or quote
- Quantities needed
- Quantities ordered
- Quantities received
- Outstanding needs
- Export to CSV

**Vendors:**
- Vendor list
- Contact details
- Type (SanMar, SSActivewear, Independent)
- Lead time settings
- Auto-PO enabled status
- Edit vendor details

---

## Integration Guides

### Printavo Sync

**Initial Setup:**
1. Get API token from Printavo (Settings → API)
2. Enter credentials in InkOps
3. Test connection
4. First sync loads all data

**What Gets Synced:**
- Invoices (all statuses)
- Customers with contact info
- Line items and products
- Payments
- Custom fields
- Order details

**Sync Frequency:**
- Manual: Click "Sync from Printavo" anytime
- Auto: Every 4 hours (default)

**Troubleshooting:**
- "Cannot connect": Verify email and token
- "Sync not updating": Wait for completion, refresh page
- "Data missing": Check Printavo account has data

### Stripe Payments

**Setup:**
1. Create Stripe account
2. Get Publishable Key and Secret Key
3. Enter in InkOps integrations
4. Test connection
5. Optionally set up webhooks

**Sending Payment Links:**
1. Send invoice with "Include Payment Link" checked
2. Customer receives email
3. Clicks payment link
4. Pays with credit/debit card
5. Payment recorded automatically

**Partial Payments:**
- Customer can pay any amount
- Multiple payments allowed
- Balance tracked automatically

**Refunds:**
1. Find payment in Payments list
2. Click "Refund" (admin only)
3. Enter refund amount
4. Confirm
5. Processed through Stripe

**Webhooks:**
- Automatic payment confirmations
- Failed payment notifications
- Refund processing
- Set up in Stripe Dashboard

### Square POS Integration

**Setup:**
1. Log in to Square Dashboard
2. Generate Access Token
3. Enter token in InkOps
4. Test connection
5. Start fetching data

**Fetching Data:**
- Click "Fetch Data" in any Square module
- Real-time API call to Square
- Results appear immediately
- Use filters to refine

**What You Can Access:**
- All transactions with details
- Deposits to bank account
- Customer database
- Inventory levels
- Location information
- Employee data
- Sales reports

**Use Cases:**
- Reconcile end-of-day deposits
- Track employee sales performance
- Monitor inventory
- View customer purchase history
- Generate location comparisons

### Email Integration (Resend)

**Setup:**
1. Sign up at resend.com
2. Verify your domain (DNS records)
3. Generate API Key
4. Enter in InkOps
5. Set From Address and Name
6. Test email delivery

**Domain Verification:**
Required for deliverability:
1. Add SPF record to DNS
2. Add DKIM record to DNS
3. Wait for verification (few minutes)
4. Test sending

**Sending Emails:**
- Invoice emails automatically use templates
- Shortcodes replaced with real data
- Attachments included
- Tracking available in Resend dashboard

**Email Templates:**
- Create in Account Settings
- Use shortcodes for dynamic content
- Preview before saving
- Test with sample data

**Troubleshooting:**
- Emails not sending: Check API key, domain verification
- Going to spam: Complete domain verification
- Rate limits: Check Resend plan limits

### SMS Integration (Twilio)

**Setup:**
1. Sign up at twilio.com
2. Get phone number
3. Copy Account SID and Auth Token
4. Enter in InkOps
5. Test SMS delivery

**Sending SMS:**
- Payment reminders
- Overdue notices
- Invoice links (shortened)
- Custom messages

**Best Practices:**
- Keep messages under 160 characters
- Include customer name
- Provide clear action items
- Don't overuse (avoid annoyance)

**Troubleshooting:**
- SMS not sending: Check credentials
- Wrong sender number: Verify phone number format
- Delivery failures: Check recipient number validity

### SanMar Integration

**What You Get:**
- 5,000+ product styles
- Real-time pricing
- Inventory availability
- Product images
- Size/color availability

**Setup:**
1. Account Settings → Garment Suppliers → SanMar
2. Enable integration
3. Enter username, password, account number
4. Test connection
5. Save credentials

**Using in Quote Builder:**
1. Create new quote
2. Click "Search Products"
3. Enter style number or search term
4. Select from results
5. Choose color and sizes
6. Add to quote
7. Pricing filled automatically

**Catalog Sync:**
- Runs nightly at 2 AM
- Full catalog download
- Updates products, pricing, inventory
- Makes searches faster

### SSActivewear Integration

**What You Get:**
- 150,000+ products
- Live pricing with quantity breaks
- Real-time inventory
- Product images
- Multiple price types

**Setup:**
1. Account Settings → Garment Suppliers → SSActivewear
2. Enable integration
3. Enter username and password
4. Select price type (Wholesale, Premium, Blank)
5. Select FOB location if applicable
6. Test connection
7. Save

**Price Types:**
- **Wholesale**: Standard wholesale pricing
- **Premium**: Higher tier pricing with benefits
- **Blank**: Blank goods pricing

**Using in Quote Builder:**
- Same search process as SanMar
- Products show with SSActivewear branding
- Pricing reflects selected price type
- Inventory shows real-time availability

### ShipStation Integration

**Setup:**
1. Account Settings → ShipStation
2. Enter API Key and Secret
3. Test connection
4. Save

**Exporting Orders:**
1. Open invoice
2. Click "Export to ShipStation"
3. Order sent to ShipStation
4. Create label in ShipStation
5. Track shipment
6. Update customer

**Features:**
- Automatic order sync
- Label creation
- Tracking numbers
- Customer notifications
- Multi-carrier support

---

## Troubleshooting

### Common Issues

**Cannot connect to Printavo**

Possible causes:
- Incorrect email or API token
- Printavo account inactive
- Network issue

Solutions:
1. Verify credentials in Printavo
2. Generate new API token
3. Test credentials in Printavo first
4. Check Printavo account is active
5. Try again in a few minutes

**Sync not updating data**

Possible causes:
- Sync still in progress
- Cached data displayed
- API rate limit hit

Solutions:
1. Wait for sync progress indicator to complete
2. Refresh browser page
3. Clear browser cache
4. Wait 5 minutes and try again
5. Check Printavo status page

**Cannot send invoice email**

Possible causes:
- Email integration not configured
- Customer email missing/invalid
- Email service API issue

Solutions:
1. Verify Resend integration in settings
2. Test email connection
3. Check customer has valid email
4. Verify "From" email is configured
5. Check Resend service status

**Stripe payment not showing**

Possible causes:
- Webhook not configured
- Payment still processing
- Test/production mode mismatch

Solutions:
1. Verify webhook setup in Stripe
2. Wait a few minutes for processing
3. Check test vs. production API keys
4. Manually trigger webhook in Stripe
5. Check payment in Stripe Dashboard

**Cannot unlock invoice**

Possible causes:
- Incorrect unlock PIN
- PIN not set
- Insufficient permissions

Solutions:
1. Verify 6-digit PIN in settings
2. Set new PIN if forgotten
3. Check user role (Admin or Manager required)
4. Ask administrator for help

**Square data not loading**

Possible causes:
- Square integration not configured
- Invalid access token
- Square API issue

Solutions:
1. Verify access token in settings
2. Test Square connection
3. Generate new token in Square
4. Check Square API status
5. Try again in a few minutes

**Report generation fails**

Possible causes:
- Too much data
- Invalid date range
- Browser timeout

Solutions:
1. Use smaller date range
2. Apply filters to reduce data
3. Refresh and try again
4. Use CSV for large datasets
5. Contact support for assistance

**User cannot log in**

Possible causes:
- Incorrect password
- Account deactivated
- Email not verified

Solutions:
1. Use "Forgot Password" to reset
2. Check if account deactivated (ask admin)
3. Verify email address correct
4. Check spam for verification email
5. Contact administrator

**Automation not running**

Possible causes:
- Automation disabled
- Incorrect schedule
- Integration not configured

Solutions:
1. Verify automation is enabled
2. Check schedule and time zone
3. Ensure email/SMS integration configured
4. Test manually
5. Check automation logs

**PO cannot be received**

Possible causes:
- Vendor confirmation required but not confirmed
- PO in draft status
- Incorrect settings

Solutions:
1. Check if vendor confirmation required in settings
2. Confirm PO or disable confirmation requirement
3. Update PO status from draft to sent
4. Verify receiving settings

**Work order not becoming ready**

Possible causes:
- Not all garments received
- PO not linked properly
- Requirements missing

Solutions:
1. Check all POs for work order are fully received
2. Verify garment requirements have PO IDs
3. Manually trigger readiness check
4. Review receiving logs

### Error Messages Explained

**"Authentication failed"**
Your login credentials are incorrect or session expired. Log in again.

**"Insufficient permissions"**
Your user role doesn't allow this action. Contact administrator.

**"Rate limit exceeded"**
Too many API requests in short time. Wait a moment and try again.

**"Invalid data format"**
Data provided doesn't match expected format. Check input and retry.

**"Network error"**
Cannot connect to server. Check internet connection.

**"Session expired"**
Login session timed out. Please log in again.

**"Duplicate entry"**
Record with this information already exists.

**"Required field missing"**
Fill in all required fields before saving.

**"Vendor confirmation required"**
This PO requires vendor confirmation before receiving goods. Mark as confirmed first.

**"PO requires approval before sending"**
Have a manager approve this PO before sending to vendor.

**"PDF required before sending"**
Generate and attach PDF before sending PO.

### Getting Help

**Self-Service Resources:**
1. This documentation
2. Tooltips (hover over ? icons in app)
3. Error messages (read carefully for solutions)
4. Integration documentation (Printavo, Stripe, Square, etc.)

**Support Channels:**
1. In-app help (click help icon)
2. Email support with:
   - What you were trying to do
   - What happened instead
   - Screenshots if applicable
   - Error messages
   - Your account email
3. Contact your account administrator
4. Check service status pages for integrations

**Browser Compatibility:**

Supported:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Not supported:
- Internet Explorer (any version)
- Very old browser versions

**Browser Troubleshooting:**
1. Update to latest browser version
2. Clear cache and cookies
3. Disable extensions temporarily
4. Try incognito/private mode
5. Try different supported browser

---

## Email Shortcode Reference

### Customer Information
- `{{customer_first_name}}` - First name
- `{{customer_last_name}}` - Last name
- `{{customer_full_name}}` - Full name
- `{{customer_company}}` - Company name
- `{{customer_email}}` - Email address
- `{{customer_phone}}` - Phone number
- `{{customer_address}}` - Street address
- `{{customer_city}}` - City
- `{{customer_state}}` - State
- `{{customer_zip}}` - ZIP code

### Quote Information
- `{{quote_number}}` - Quote number
- `{{quote_total}}` - Total amount (formatted)
- `{{quote_subtotal}}` - Subtotal (formatted)
- `{{quote_tax}}` - Tax amount (formatted)
- `{{quote_discount}}` - Discount (formatted)
- `{{quote_date}}` - Creation date
- `{{quote_expiry_date}}` - Expiration date
- `{{quote_link}}` - Approval link
- `{{quote_status}}` - Current status

### Invoice Information
- `{{invoice_number}}` - Invoice number
- `{{invoice_total}}` - Total amount (formatted)
- `{{invoice_subtotal}}` - Subtotal (formatted)
- `{{invoice_tax}}` - Tax amount (formatted)
- `{{invoice_balance}}` - Outstanding balance (formatted)
- `{{invoice_date}}` - Invoice date
- `{{invoice_due_date}}` - Due date
- `{{invoice_link}}` - Payment link
- `{{invoice_status}}` - Current status

### Company Information
- `{{company_name}}` - Your company name
- `{{company_address}}` - Street address
- `{{company_city}}` - City
- `{{company_state}}` - State
- `{{company_zip}}` - ZIP code
- `{{company_phone}}` - Phone number
- `{{company_email}}` - Email address
- `{{company_website}}` - Website URL

### User Information
- `{{user_name}}` - Sender's full name
- `{{user_first_name}}` - Sender's first name
- `{{user_last_name}}` - Sender's last name
- `{{user_email}}` - Sender's email
- `{{user_phone}}` - Sender's phone

### Payment Information
- `{{payment_amount}}` - Payment amount (formatted)
- `{{payment_method}}` - Payment method
- `{{payment_date}}` - Date of payment
- `{{payment_link}}` - Link to pay

### General
- `{{current_date}}` - Today's date
- `{{current_year}}` - Current year

---

## Glossary

**A/R (Accounts Receivable)** - Money owed to you by customers for unpaid invoices.

**Aging Report** - Report showing how long invoices have been outstanding.

**API** - Application Programming Interface, allows systems to communicate.

**Balance Due** - Amount remaining on invoice after payments.

**DSO (Days Sales Outstanding)** - Average days to collect payment.

**LTV (Lifetime Value)** - Total revenue from a customer over their lifetime.

**Net Terms** - Payment terms (Net 30 = payment due in 30 days).

**PO (Purchase Order)** - Order sent to vendor for goods/services.

**RLS (Row Level Security)** - Database security based on user access.

**Shortcode** - Placeholder in template replaced with real data (e.g., {{customer_name}}).

**Webhook** - Automatic message sent when event occurs.

**Work Order** - Internal production order tracking job completion.

---

## FAQs

**Q: Do I need a Printavo account?**
A: Yes, Printavo is the core data source. You need an active Printavo account with API access.

**Q: Can I use this on mobile?**
A: Yes, the application is fully responsive and works on phones and tablets.

**Q: How often does data sync from Printavo?**
A: Automatically every 4 hours, or manually anytime by clicking "Sync from Printavo".

**Q: Is my data secure?**
A: Yes, all data is encrypted in transit and at rest. Industry best practices followed.

**Q: I forgot my password. How do I reset it?**
A: Click "Forgot Password" on login screen, enter email, follow reset link.

**Q: Can I have multiple users?**
A: Yes, administrators can add unlimited users with different roles.

**Q: Can I edit invoices?**
A: Invoices from Printavo are read-only. Edit in Printavo, then sync. You can record payments and send invoices.

**Q: How do I accept credit card payments?**
A: Set up Stripe integration, then use "Send Invoice" with payment link option.

**Q: Can customers pay partial amounts?**
A: Yes, Stripe invoices support partial payments. Manual payments can also be partial.

**Q: Can I issue refunds?**
A: Yes, Stripe payments can be refunded from Payments module (admin role required).

**Q: Can I customize invoice templates?**
A: Upload your logo and set company info in Account Settings. Templates use this information.

**Q: Can I schedule reports?**
A: Yes, go to Account Settings → Automations → Automated Reports.

**Q: What's the difference between Manager and Accountant roles?**
A: Managers can send invoices and access production. Accountants focus on financial reporting and cannot send invoices.

**Q: Can I integrate with QuickBooks?**
A: Export data as CSV to import into QuickBooks, Xero, or other accounting software.

**Q: Will automations send duplicate emails?**
A: No, automations track which invoices have been processed to avoid duplicates.

**Q: The application is loading slowly. Why?**
A: Large datasets take time. Try filtering to reduce data volume. Clear browser cache.

**Q: Can I use the API directly?**
A: API access may be available for enterprise. Contact support.

**Q: Is there a mobile app?**
A: Not currently, but the web application works on mobile browsers.

---

## Status Definitions

### Invoice Statuses
- **Draft** - Created but not finalized
- **Open** - Sent and awaiting payment
- **Partial** - Partially paid
- **Paid** - Fully paid
- **Overdue** - Past due with balance
- **Void** - Cancelled
- **Locked** - Locked to prevent changes

### Payment Statuses
- **Completed** - Successfully processed
- **Pending** - Initiated, awaiting confirmation
- **Failed** - Attempt failed
- **Reversed** - Refunded or reversed

### Quote Statuses
- **Draft** - Being prepared
- **Sent** - Sent to customer
- **Viewed** - Customer opened
- **Approved** - Customer accepted
- **Declined** - Customer rejected
- **Expired** - Past expiration
- **Converted** - Became invoice

### PO Statuses
- **Draft** - Being created
- **Sent** - Sent to vendor
- **Confirmed** - Vendor confirmed
- **In Transit** - Shipping
- **Partially Received** - Some received
- **Fully Received** - All received
- **Closed** - Completed

### Work Order Statuses
- **Draft** - Initial creation
- **In Progress** - Production started
- **Completed** - Work finished
- **Cancelled** - Cancelled
- **On Hold** - Paused

### Production Stages
- **Pre-Press** - Artwork and setup
- **Production** - Printing/decoration
- **Finishing** - Folding/packaging
- **Quality Control** - Inspection
- **Completed** - Done

---

**End of User Guide**

*Thank you for using InkOps. We're here to help you manage your business more efficiently. If you have suggestions for improving this documentation, please contact support.*
