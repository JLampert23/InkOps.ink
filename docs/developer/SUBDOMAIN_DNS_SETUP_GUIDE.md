# Subdomain DNS Setup Guide

This guide explains how to configure DNS for customer subdomains in InkOps, enabling branded quote approval pages and customer portals.

## Overview

InkOps supports customer-specific subdomains like:
- `toddssportinggoods.inkops.ink/quote-approval/[token]`
- `acmeprinting.inkops.ink/customer/[customer-id]`

This requires DNS configuration to point these subdomains to your deployment.

---

## Quick Start (Using Main Domain)

**For immediate testing without DNS setup**, the application will automatically use the main domain when `VITE_MAIN_DOMAIN` is configured:

### Step 1: Configure Environment Variable

Add to your `.env` file:
```bash
VITE_MAIN_DOMAIN=https://your-app.vercel.app
```

Replace `your-app.vercel.app` with your actual Vercel deployment URL.

### Step 2: Redeploy

The quote approval links will now use:
```
https://your-app.vercel.app/quote-approval/[token]
```

Instead of:
```
https://toddssportinggoods.inkops.ink/quote-approval/[token]
```

This works immediately with no DNS configuration required.

---

## Production Setup (Custom Subdomains)

For production, configure DNS to enable customer-specific branded subdomains.

### Option 1: Individual Subdomains

**Best for:** Small number of customers (< 10)

#### Step 1: Add DNS Record

In your DNS provider for `inkops.ink`:

1. Go to DNS management
2. Add a new CNAME record:
   - **Name:** `toddssportinggoods` (the customer's subdomain)
   - **Type:** CNAME
   - **Value:** `your-app.vercel.app` (your Vercel deployment)
   - **TTL:** 300 (5 minutes)

3. Save the record

#### Step 2: Configure in Vercel

1. Go to your Vercel project
2. Navigate to **Settings** → **Domains**
3. Click **Add Domain**
4. Enter: `toddssportinggoods.inkops.ink`
5. Vercel will verify DNS and provision SSL certificate

#### Step 3: Wait for Propagation

- DNS changes take 5-30 minutes to propagate
- Check status: `nslookup toddssportinggoods.inkops.ink`

#### Step 4: Test

Visit: `https://toddssportinggoods.inkops.ink/quote-approval/[token]`

#### Repeat for Each Customer

Add a new CNAME record and Vercel domain for each customer subdomain.

---

### Option 2: Wildcard Subdomain (Recommended)

**Best for:** Multiple customers (10+)

Wildcard DNS automatically works for all subdomains without individual configuration.

#### Step 1: Add Wildcard DNS Record

In your DNS provider for `inkops.ink`:

1. Go to DNS management
2. Add a new CNAME record:
   - **Name:** `*` (wildcard)
   - **Type:** CNAME
   - **Value:** `your-app.vercel.app`
   - **TTL:** 300

3. Save the record

#### Step 2: Configure in Vercel

**Note:** Wildcard domains require **Vercel Pro plan** or higher.

1. Go to your Vercel project
2. Navigate to **Settings** → **Domains**
3. Click **Add Domain**
4. Enter: `*.inkops.ink`
5. Vercel will verify DNS and provision wildcard SSL certificate

#### Step 3: Wait for Propagation

- DNS changes take 5-30 minutes to propagate
- Test with: `nslookup test.inkops.ink`

#### Step 4: Automatic for All Customers

Now ALL customer subdomains work automatically:
- `customer1.inkops.ink`
- `customer2.inkops.ink`
- `any-name.inkops.ink`

No additional DNS or Vercel configuration needed for new customers.

---

## How It Works

### URL Generation Logic

The `getPortalBaseUrl()` function in `src/utils/portal-url.ts` uses this priority:

1. **Main Domain (if configured):**
   - If `VITE_MAIN_DOMAIN` is set → use that
   - Example: `https://your-app.vercel.app/quote-approval/[token]`

2. **Subdomain (if DNS configured):**
   - If no main domain → use subdomain
   - Example: `https://toddssportinggoods.inkops.ink/quote-approval/[token]`

3. **Current Origin (fallback):**
   - If neither is set → use `window.location.origin`

### Database Configuration

Each company has a subdomain stored in `company_settings.inkops_subdomain`:

```sql
SELECT company_name, inkops_subdomain
FROM company_settings;
```

Example:
```
company_name                          | inkops_subdomain
--------------------------------------|-------------------
Todd's Screen Printing and Embroidery | toddssportinggoods
```

This subdomain is automatically generated from the company name on signup.

---

## Troubleshooting

### Error: DNS_PROBE_FINISHED_NXDOMAIN

**Problem:** Domain doesn't resolve to any IP address.

**Solutions:**
1. **Immediate:** Set `VITE_MAIN_DOMAIN` in `.env` and redeploy
2. **Long-term:** Configure DNS records (see above)

### Error: Site can't be reached / Connection refused

**Problem:** DNS resolves, but Vercel doesn't recognize the domain.

**Solutions:**
1. Add the domain in Vercel project settings
2. Wait for SSL certificate provisioning (can take 5-10 minutes)

### Quote Links Still Use Subdomain

**Problem:** Even with `VITE_MAIN_DOMAIN` set, links still use subdomain.

**Solutions:**
1. Ensure `.env` file is in project root
2. Restart dev server: `npm run dev`
3. For production: Redeploy to Vercel

### Mixed Content Warnings

**Problem:** Browser blocks non-HTTPS resources.

**Solutions:**
1. Ensure `VITE_MAIN_DOMAIN` uses `https://` not `http://`
2. Wait for Vercel SSL certificate to activate

---

## Environment Variables Summary

### Development (.env)

```bash
# Supabase
VITE_SUPABASE_URL=https://gccvdsxiqgbxhdyamzaa.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Main domain (use for testing without DNS)
VITE_MAIN_DOMAIN=http://localhost:5173
```

### Production (Vercel)

```bash
# Supabase
VITE_SUPABASE_URL=https://gccvdsxiqgbxhdyamzaa.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Main domain (use if DNS not configured)
VITE_MAIN_DOMAIN=https://your-app.vercel.app

# Or leave empty to use subdomains (if DNS is configured)
# VITE_MAIN_DOMAIN=
```

---

## Testing

### Test Quote Approval Page

1. Generate a quote in the app
2. Click "Send Quote"
3. Copy the approval URL from the email preview
4. Test in incognito browser window

### Test Customer Portal

1. Go to Customers tab
2. Click on a customer
3. Click "View Customer Portal"
4. Copy the portal URL
5. Test in incognito browser window

---

## Migration Path

### Phase 1: Testing (No DNS)
- Set `VITE_MAIN_DOMAIN=https://your-app.vercel.app`
- All links use main domain
- Test quote approval, customer portal, etc.

### Phase 2: Pilot (Few Customers)
- Remove or comment out `VITE_MAIN_DOMAIN`
- Configure DNS for 2-3 pilot customers
- Test subdomain functionality

### Phase 3: Production (All Customers)
- Set up wildcard DNS
- Add `*.inkops.ink` to Vercel (requires Pro plan)
- All customers get branded subdomains automatically

---

## Security Considerations

### Domain Validation

The app validates that customers can only access their own data, even if they guess another company's subdomain:

```typescript
// In App.tsx - DomainAwareCustomerPortal component
// Validates customer belongs to company associated with subdomain
```

### RLS Policies

Row Level Security policies ensure data isolation:
- Customers can only see their own quotes/invoices
- Companies can only see their own customers
- Subdomains don't bypass security

---

## Support

### Common Questions

**Q: Do I need to configure DNS for every customer?**
- With wildcard DNS: No, it's automatic
- Without wildcard: Yes, one record per customer

**Q: Can I use a different domain instead of inkops.ink?**
- Yes, update the hardcoded domain in `getPortalBaseUrl()`
- Example: Change `inkops.ink` to `yourcompany.com`

**Q: What if a customer already has their own domain?**
- You can use `customer_url` field to point to their domain
- Requires additional DNS configuration on their end

**Q: Can I test locally without deploying?**
- Yes, set `VITE_MAIN_DOMAIN=http://localhost:5173`
- Quote approval and portal pages will work locally

---

## Related Documentation

- [Customer Portal Implementation](./CUSTOMER_PORTAL_IMPLEMENTATION.md)
- [Quote Approval Automation](./QUOTE_APPROVAL_AUTOMATION_GUIDE.md)
- [Email Templates](./EMAIL_TEMPLATES_UI_GUIDE.md)
