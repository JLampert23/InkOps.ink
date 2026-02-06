# Database Schema Guide

## Overview

This guide explains how to download and upload your InkOps database schema.

## Files

- **COMPLETE_DATABASE_SCHEMA.sql** - Full production-ready schema with all tables, indexes, RLS policies, and functions

## What's Included

The complete schema includes:

1. **Core Tables**
   - Company settings and user profiles
   - Multi-tenant data isolation with company_id

2. **Customer Management**
   - Customers table with full contact info
   - Customer contacts (multiple per customer)

3. **Printavo Integration**
   - Invoices, line items, and payments cache
   - Automatic sync tracking

4. **Payment Processing**
   - Unified payments table (manual, Stripe, Printavo)
   - Stripe integration tables (customers, invoices, payment intents)
   - Payment status tracking

5. **Billing & Communication**
   - Billing queue for automated workflows
   - Communication logs (email, SMS)
   - Paid invoices archive

6. **Automation & Reporting**
   - Automated report scheduling
   - Custom automation rules engine
   - Execution logs

7. **Security Features**
   - Row Level Security (RLS) on all tables
   - Company data isolation
   - Role-based access control (RBAC)
   - Secure credential storage

## How to Apply the Schema

### Method 1: Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard at https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**
5. Open `COMPLETE_DATABASE_SCHEMA.sql` in a text editor
6. Copy the entire contents
7. Paste into the SQL Editor
8. Click **Run** (or press Ctrl/Cmd + Enter)

### Method 2: Using Supabase CLI (If Available)

```bash
supabase db push
```

### Method 3: Section by Section

If the file is too large to run at once, you can run each section separately:

1. Core Company & User Tables (Section 1)
2. Customer Management (Section 2)
3. Printavo Data Cache (Section 3)
4. Continue through each section in order...

## Important Notes

### Before Applying

- **Backup First**: Always backup your existing database before applying schema changes
- **Review Carefully**: Review the SQL to understand what will be created
- **Test Environment**: Consider testing in a development environment first

### Data Safety

- All tables use `CREATE TABLE IF NOT EXISTS` - safe to run multiple times
- Indexes use `IF NOT EXISTS` - won't conflict with existing indexes
- Policies are dropped and recreated - ensures clean state
- Triggers are dropped and recreated - ensures correct behavior

### After Applying

1. Verify all tables were created:
   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public'
   ORDER BY table_name;
   ```

2. Check RLS is enabled:
   ```sql
   SELECT tablename, rowsecurity
   FROM pg_tables
   WHERE schemaname = 'public';
   ```

3. Verify indexes:
   ```sql
   SELECT indexname, tablename
   FROM pg_indexes
   WHERE schemaname = 'public'
   ORDER BY tablename, indexname;
   ```

## Downloading the Schema

### Option 1: From Project Files

The schema file is located at:
```
/COMPLETE_DATABASE_SCHEMA.sql
```

### Option 2: Export from Supabase

To get the current state from Supabase:

```sql
-- Get all table definitions
SELECT
  'CREATE TABLE ' || table_name || ' (' ||
  string_agg(
    column_name || ' ' || data_type,
    ', '
  ) || ');'
FROM information_schema.columns
WHERE table_schema = 'public'
GROUP BY table_name;
```

## Customization

You can customize the schema by:

1. Editing company settings default values
2. Adjusting RLS policies for your security needs
3. Adding custom indexes for your query patterns
4. Modifying automation configurations

## Schema Features

### Multi-Tenancy

- Every data table has a `company_id` foreign key
- RLS policies filter data by company automatically
- Users can only see their company's data

### Security

- All tables have Row Level Security enabled
- Service role has full access for system operations
- Authenticated users filtered by company_id
- Helper function `get_user_company_id()` for policies

### Automation

- New users automatically get a company created
- `updated_at` timestamps automatically maintained
- Triggers handle common workflows

## Troubleshooting

### Error: Relation Already Exists

This is normal if tables exist. The `IF NOT EXISTS` clause handles this safely.

### Error: Policy Already Exists

The schema drops existing policies before creating new ones. If you see this error, you can:

1. Drop policies manually first
2. Or comment out the problematic `CREATE POLICY` lines

### Error: Permission Denied

Make sure you're running as a user with sufficient privileges (database owner or superuser).

## Support

For questions or issues:

1. Check the inline SQL comments for detailed explanations
2. Review the migration files in `/supabase/migrations/` for change history
3. Consult Supabase documentation at https://supabase.com/docs

## Version History

- **Current**: Complete production schema with all features
- Includes all migrations through January 2026
- Tested and deployed in production environment
