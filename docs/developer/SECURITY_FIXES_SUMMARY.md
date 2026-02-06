# Security Fixes Summary

## Fixed Issues

### 1. Missing Foreign Key Indexes
Added indexes to improve query performance:
- `ar_report_automations.created_by`
- `ar_report_presets.created_by`
- `automations.created_by`
- `communication_logs.sent_by`
- `customers.created_by`
- `payments.created_by`
- `payments.invoice_id`
- `quotes.created_by`

### 2. Auth RLS Performance Issues
Fixed all RLS policies to use `(select auth.uid())` instead of `auth.uid()` to prevent re-evaluation per row:
- `automated_reports` - all policies
- `user_profiles` - update and delete policies
- `ar_report_presets` - all policies
- `ar_report_automations` - all policies
- `ar_report_logs` - select policy
- `payments` - all admin policies

### 3. Function Search Path Security
Fixed all functions to have immutable search paths:
- `update_updated_at_column()`
- `is_super_admin()`
- `get_user_role()`
- `update_stripe_payment_links_updated_at()`
- `update_stripe_payments_updated_at()`
- `update_billing_queue_updated_at()`
- `update_stripe_invoice_updated_at()`
- `update_payment_updated_at()`
- `get_user_company_id()`

## Known Issues Requiring Schema Changes

The following tables have RLS policies with `USING (true)` or `WITH CHECK (true)` that allow unrestricted access. These cannot be fixed without adding `company_id` columns to the tables:

### Tables Without Multi-Tenancy Support
1. **automations** - No company_id column
2. **automation_logs** - No company_id column
3. **customers** - No company_id column
4. **customer_contacts** - No company_id column (relies on customers)
5. **printavo_invoices** - No company_id column
6. **printavo_payments** - No company_id column
7. **printavo_statuses** - No company_id column
8. **quotes** - No company_id column
9. **quote_items** - No company_id column (relies on quotes)
10. **quote_imprints** - No company_id column (relies on quotes)
11. **quote_fees** - No company_id column (relies on quotes)
12. **sms_logs** - No company_id column

### Recommendation
To properly secure these tables, you should:
1. Add `company_id` columns to the base tables
2. Migrate existing data to associate records with companies
3. Update RLS policies to check company_id
4. Add foreign key constraints and indexes

This is a significant schema change that should be planned carefully to avoid data loss or application downtime.

## Other Warnings

### Unused Indexes
Supabase reports many unused indexes. These should be monitored and potentially removed if they remain unused after the application is in production use.

### Auth DB Connection Strategy
The Auth server uses a fixed number (10) of connections instead of a percentage-based strategy. This should be changed in the Supabase dashboard under Settings > Database > Connection Pooling.

### Leaked Password Protection
Consider enabling HaveIBeenPwned password checking in Supabase Auth settings for enhanced security.
