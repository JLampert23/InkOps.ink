# InkOps

InkOps is a production-grade SaaS platform built for screen printing and apparel decoration businesses. It covers the full job lifecycle — from quoting and customer approvals through production, purchasing, invoicing, and payment collection — in a single unified application.

---

## Features

### Quote Management
- Build detailed quotes with line items, size breakdowns, and imprint/decoration details
- Send quotes to customers via shareable approval links
- Customers can approve or reject quotes directly from a public-facing page
- Automated follow-up emails for unanswered quotes with configurable scheduling
- Quote-to-invoice conversion with full history tracking

### Billing & Invoicing
- Invoice management with status tracking (unpaid, partial, paid, overdue)
- Manual and automated payment recording
- PDF invoice generation and download
- Aging reports and outstanding balance tracking
- Invoice fees management with category and sort ordering
- Financial lock to prevent editing of finalized invoices

### Customer Portal
- White-label, subdomain-aware customer portal per company
- Customers log in to view quotes, invoices, proofs, and order history
- Inline quote approval and payment submission
- Stripe payment processing from within the portal
- Password setup, reset, and forgot-password flows
- Company branding (logo, contact info, colors)

### Purchase Orders & Receiving
- Create and manage purchase orders for garment suppliers
- Auto-generate POs based on garment requirements from approved quotes
- Goods receiving workflow with quantity verification
- Garment order report across all active jobs

### Production & Workflow
- Kanban board and production scheduler views
- Work order management linked to quotes and invoices
- Imprint and decoration tracking with proof upload
- Box label printing for finished goods
- Custom workflow builder with configurable stages and statuses

### Automations
- Event-driven automation engine (invoice status changes, quote approvals, payments)
- Quote follow-up automation with configurable timing and attempt limits
- Custom automation rules with triggers, conditions, and actions
- Automation queue with execution logs and history viewer

### Analytics & Reporting
- Revenue trends, invoice totals, and payment method breakdowns
- Outstanding balances, overdue invoices, and AR aging
- Revenue per decoration type, per garment, and per order
- Sales by style, top-selling products, and units sold
- Customer summary and payment reports
- CSV and PDF export for all major reports

### Email & Communication Templates
- Rich-text email template editor with shortcode support
- Smart blocks for dynamic content (customer name, invoice total, portal link, etc.)
- Template validation to catch missing or broken shortcodes
- SMS template support via Twilio
- Automated report delivery via scheduled email

### Customers & Contacts
- Customer profiles with primary contacts, billing details, and linked history
- Artwork library per customer
- Tax exemption tracking
- Payment methods storage
- Fundraising credits management

### Integrations
- **Stripe** — Payment processing for invoices and the customer portal
- **Square** — Alternative payment processor with full dashboard (transactions, deposits, refunds, inventory)
- **SanMar** — Garment catalog, pricing, and media via PromoStandards API
- **SSActivewear** — Garment catalog sync and pricing
- **Chipply** — Import store orders directly as quotes
- **ShipStation** — Shipping label creation and order tracking
- **Twilio** — SMS notifications
- **Resend** — Transactional email delivery

### Platform & Access Control
- Role-based access control (Admin, User, and custom roles)
- Multi-tenant architecture with company data isolation
- Subscription tiers with feature gating
- Dark mode support
- Notification system with email forwarding

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend Framework | React 18 + TypeScript |
| Build Tool | Vite 5 |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Icons | Lucide React |
| Rich Text | React Quill |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Backend Functions | Supabase Edge Functions (Deno) |
| PDF Generation | jsPDF + jspdf-autotable |
| Date Utilities | date-fns |

---

## Project Structure

```
src/
  components/
    accounting/       # AR reports, customer billing, payments
    analytics/        # Financial analytics and charting
    automations/      # Workflow automation engine and rule builder
    billing/          # Invoice management, billing queue, payment modals
    chipply/          # Chipply import manager and integration settings
    common/           # Shared UI components (modals, selectors, etc.)
    diagnostics/      # Integration diagnostics
    email/            # Communication templates and email editor
    portal/           # Customer-facing self-service portal
    production/       # Quotes, work orders, kanban, scheduler, imprints
    purchase-orders/  # PO management, receiving, garment report
    settings/         # App and company configuration
    shared/           # Attachments and other shared components
    square/           # Square payment processor integration dashboard
  contexts/           # React contexts (Auth, Theme, Notifications, etc.)
  hooks/              # Custom React hooks
  lib/                # Supabase and Apollo client setup
  services/           # Business logic and API service layer
  types/              # TypeScript type definitions
  utils/              # PDF/CSV export, calculations, date utilities

supabase/
  functions/          # Supabase Edge Functions (API proxies, email, webhooks)
  migrations/         # Database migration history
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- A Supabase project
- (Optional) Accounts for any third-party integrations you want to enable

### Installation

```bash
npm install
```

### Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required variables:
- `VITE_SUPABASE_URL` — Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Your Supabase anonymous key

All other integration credentials (Stripe, Square, SanMar, etc.) are configured per-company inside the application's Settings panel and stored encrypted in the database.

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Type Check

```bash
npm run typecheck
```

---

## Database

InkOps uses Supabase (PostgreSQL) with Row Level Security enabled on all tables. All migrations are in `supabase/migrations/` and are applied in chronological order.

Multi-tenant data isolation is enforced at the database level via `company_id` columns and RLS policies. Each company's data is fully isolated from all other companies.

---

## Customer Portal

The customer portal is subdomain-aware. Each company can configure a custom subdomain (e.g., `yourshop.inkops.ink`) through Settings. Customers access their portal at:

```
https://{company-subdomain}.inkops.ink/customer/{customer-id}
```

Customers authenticate via email/password or magic link. The portal displays their quotes, invoices, proofs, and payment history, and allows them to approve quotes and submit payments.

---

## License

Proprietary. All rights reserved.
