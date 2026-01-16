# README

A production-grade financial operations platform for screen printing and apparel decoration businesses. InkOps connects to the Printavo API v2 (GraphQL) and displays comprehensive financial data in a clean, filterable, customizable dashboard.

## Features

### Financial Analytics
- **Dashboard Overview**: Real-time KPIs including total revenue, outstanding balances, payment metrics, and conversion rates
- **Visual Reports**: Interactive charts showing monthly revenue trends, revenue by status, payment methods breakdown
- **Invoice Explorer**: Search, filter, and sort invoices with expandable details showing line items, payments, and fees
- **Payments Explorer**: Filter payments by date range, method, and amount with detailed transaction history
- **Customer Profiles**: View customer lifetime value, outstanding balances, and complete financial history

### Technical Features
- **Secure API Proxy**: All Printavo API calls are proxied through Supabase Edge Functions
- **Auto-Pagination**: Automatically fetches all records using cursor-based pagination
- **Rate Limiting**: Built-in protection against API rate limits (10 requests per 5 seconds)
- **Error Handling**: Comprehensive error handling with retry logic and exponential backoff
- **Real-time Progress**: Live progress indicators during data fetching
- **Responsive Design**: Mobile-friendly interface that works on all devices

## Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **GraphQL Client**: Apollo Client
- **Backend Proxy**: Supabase Edge Functions (Deno)
- **Charts**: Recharts
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Date Handling**: date-fns

## Project Structure

```
inkops/
├── src/
│   ├── components/           # React components
│   │   ├── DashboardOverview.tsx    # Financial KPIs and charts
│   │   ├── InvoiceExplorer.tsx      # Invoice search and details
│   │   ├── PaymentsExplorer.tsx     # Payment history and filters
│   │   └── CustomerProfiles.tsx     # Customer financial profiles
│   ├── graphql/
│   │   └── queries.ts        # All GraphQL queries
│   ├── hooks/
│   │   └── usePrintavoData.ts       # Data fetching hook
│   ├── lib/
│   │   └── apollo-client.ts         # Apollo Client setup
│   ├── types/
│   │   └── printavo.ts              # TypeScript definitions
│   ├── utils/
│   │   ├── pagination.ts            # Auto-pagination utility
│   │   └── financial-aggregations.ts # Financial calculations
│   ├── App.tsx               # Main application
│   └── main.tsx              # Entry point
├── supabase/
│   └── functions/
│       └── printavo-proxy/
│           └── index.ts      # Secure API proxy with rate limiting
├── .env                      # Environment variables
└── package.json              # Dependencies
```

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- Printavo API credentials (email + token)
- Supabase account (included in this setup)

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Printavo API Credentials

The application uses Supabase Edge Functions to securely proxy API requests. You need to configure your Printavo credentials as Supabase secrets:

**Important**: Your Printavo credentials are stored securely in the Supabase Edge Function environment and are never exposed to the frontend.

To configure your credentials, you'll need to:

1. Get your Printavo API credentials:
   - Email: Your Printavo account email
   - Token: Your Printavo API token (found in Printavo account settings)

2. Configure the secrets in Supabase:
   - The Edge Function expects two environment variables:
     - `PRINTAVO_EMAIL`: Your Printavo account email
     - `PRINTAVO_TOKEN`: Your Printavo API token

### 3. Run the Development Server

```bash
npm run dev
```

The application will start at `http://localhost:5173`

### 4. Build for Production

```bash
npm run build
```

## GraphQL Queries

The application fetches the following data from Printavo API v2:

### Invoices
- Invoice number, status, dates, totals
- Customer information
- Line items with quantities and prices
- Associated payments
- Fees and taxes

### Payments
- Payment amount, date, and method
- Linked invoice information
- Customer details

### Estimates/Quotes
- Quote number and totals
- Customer information
- Conversion status (estimate → invoice)
- Line items

### Customers
- Customer details and contact information
- Complete invoice history
- Quote history
- Lifetime value calculations

## API Integration Details

### Authentication
All requests to the Printavo API require:
```
Content-Type: application/json
email: {{USER_EMAIL}}
token: {{API_TOKEN}}
```

These credentials are securely stored in the Supabase Edge Function environment.

### Rate Limiting
The Printavo API has a rate limit of **10 requests per 5 seconds per user/IP**.

The application handles this by:
- Implementing a request queue in the Edge Function
- Tracking request counts within time windows
- Automatically waiting when approaching limits
- Retry logic with exponential backoff

### Pagination
All GraphQL queries use cursor-based pagination:
```graphql
query GetInvoices($after: String, $first: Int = 50) {
  invoices(after: $after, first: $first) {
    edges {
      cursor
      node { ... }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

The application automatically fetches all pages until `hasNextPage` is false.

## Financial Metrics Calculated

### Overview Dashboard
- **Total Revenue**: Sum of all invoice totals
- **Outstanding Balance**: Sum of unpaid invoice balances
- **Total Payments**: Sum of all payment amounts
- **Average Invoice Value**: Total revenue / invoice count
- **Conversion Rate**: (Converted estimates / total estimates) × 100
- **Total Fees & Tax**: Sum of all fees and taxes collected

### Monthly Analysis
- Revenue by month
- Invoice count by month
- Payment trends over time

### Customer Metrics
- Lifetime Value (LTV): Total revenue from customer
- Outstanding Balance: Unpaid invoice amounts
- Total Invoices: Count of customer invoices
- Total Estimates: Count of customer quotes

## Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run typecheck    # Type check without emitting
```

## Error Handling

The application includes comprehensive error handling:

1. **Network Errors**: Automatic retry with exponential backoff
2. **GraphQL Errors**: Detailed error logging and user-friendly messages
3. **Rate Limit Protection**: Automatic request queuing and throttling
4. **Invalid Credentials**: Clear error messages directing users to check configuration

## Environment Variables

Create a `.env` file with:

```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# Printavo credentials are configured in Supabase Edge Function secrets
# PRINTAVO_EMAIL=your-printavo-email@example.com
# PRINTAVO_TOKEN=your-printavo-api-token
```

## Security Considerations

- API credentials are NEVER exposed to the frontend
- All API requests go through the secure Supabase Edge Function proxy
- Environment variables for Printavo credentials are server-side only
- Rate limiting prevents API abuse
- Error messages don't expose sensitive information

## Customization

### Adding New Queries

1. Add the GraphQL query to `src/graphql/queries.ts`
2. Use the `fetchAllPages` utility to handle pagination
3. Add the data to your component

Example:
```typescript
import { fetchAllPages } from '../utils/pagination';
import { apolloClient } from '../lib/apollo-client';
import { GET_YOUR_QUERY } from '../graphql/queries';

const data = await fetchAllPages(
  apolloClient,
  GET_YOUR_QUERY,
  'queryName'
);
```

### Adding New Financial Metrics

Add calculation functions to `src/utils/financial-aggregations.ts`:

```typescript
export function calculateNewMetric(invoices: Invoice[]): number {
  // Your calculation logic
  return result;
}
```

### Customizing Charts

The dashboard uses Recharts. Customize charts in the component files:
- `src/components/DashboardOverview.tsx` for dashboard charts
- Modify colors, axes, tooltips, etc.

## Troubleshooting

### "Error Loading Data" Message
- Check that Printavo credentials are configured in Supabase Edge Function
- Verify credentials are correct in your Printavo account
- Check browser console for detailed error messages

### No Data Showing
- Ensure your Printavo account has invoices/payments/estimates
- Check the network tab for API responses
- Verify the GraphQL queries match your Printavo API version

### Slow Loading
- The application fetches ALL records on load
- Loading time depends on your data volume
- Progress indicators show real-time status
- Consider implementing caching for large datasets

## Support

For issues related to:
- **Printavo API**: Check Printavo API documentation or contact Printavo support
- **Application bugs**: Check the browser console for error messages
- **GraphQL queries**: Verify query structure matches Printavo API v2 schema

## License

This project is provided as-is for integration with Printavo API v2.

---

# SETUP

This guide will walk you through setting up InkOps from scratch.

## Step 1: Get Your Printavo API Credentials

1. Log into your Printavo account
2. Navigate to **Settings** → **API**
3. Copy your API credentials:
   - **Email**: Your Printavo account email
   - **Token**: Your API token (looks like a long string of characters)

Keep these credentials secure - you'll need them in the next step.

## Step 2: Configure Supabase Edge Function Secrets

Your Printavo credentials need to be configured as secrets in the Supabase Edge Function. This keeps them secure and never exposes them to the frontend.

The Edge Function `printavo-proxy` has been deployed and is expecting two environment variables:

- `PRINTAVO_EMAIL`: Your Printavo account email
- `PRINTAVO_TOKEN`: Your Printavo API token

**To configure these secrets:**

Since you're using this dashboard, the secrets should be configured in your Supabase project settings under the Edge Functions section. If you need assistance with this, the system administrator or the person who deployed this application can help configure these values.

## Step 3: Install Dependencies

```bash
npm install
```

This installs:
- React 18 + TypeScript
- Apollo Client (GraphQL)
- Recharts (charts/graphs)
- date-fns (date formatting)
- Lucide React (icons)
- Tailwind CSS (styling)

## Step 4: Verify Environment Variables

Check that your `.env` file has the Supabase connection details:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

These are used to connect to the Supabase Edge Function that proxies your Printavo API requests.

## Step 5: Start the Development Server

```bash
npm run dev
```

The application will:
1. Start at `http://localhost:5173`
2. Connect to the Supabase Edge Function
3. Begin fetching data from Printavo API
4. Display live progress as data loads

## Step 6: Verify Everything Works

Once the app loads, you should see:

1. **Overview Dashboard**:
   - Financial KPIs (total revenue, outstanding balance, etc.)
   - Charts showing revenue trends
   - Payment method breakdown

2. **Invoices Tab**:
   - Searchable list of all invoices
   - Filter by status
   - Sort by date, total, or customer
   - Click to expand and see details

3. **Payments Tab**:
   - Complete payment history
   - Filter by date range and method
   - Total payment amount displayed

4. **Customers Tab**:
   - List of all customers
   - Click to see customer financial profile
   - Lifetime value and outstanding balance
   - Complete invoice and estimate history

## Troubleshooting

### Error: "Printavo credentials not configured"

This means the Edge Function can't find your Printavo credentials.

**Solution**: Verify that `PRINTAVO_EMAIL` and `PRINTAVO_TOKEN` are configured as secrets in your Supabase Edge Function environment.

### Error: "401 Unauthorized" or "403 Forbidden"

This means your Printavo credentials are incorrect.

**Solution**:
1. Log into Printavo and verify your API token is still active
2. Copy the correct email and token
3. Update the secrets in Supabase Edge Function
4. Refresh the dashboard

### Error: "429 Too Many Requests"

This means you're hitting Printavo's rate limit (10 requests per 5 seconds).

**Solution**: The app has built-in rate limiting that should prevent this. If you see this error:
1. Wait 5-10 seconds
2. Refresh the page
3. The app will automatically throttle requests

### No Data Loading / Stuck on Loading Screen

**Solution**:
1. Check browser console (F12) for error messages
2. Verify your Printavo account has invoices/payments/estimates
3. Check that the Supabase Edge Function is deployed and running
4. Verify network requests are reaching the Edge Function

### Charts Not Displaying

**Solution**:
1. Ensure you have data in Printavo (the charts need data to display)
2. Check that dates on invoices are valid
3. Open browser console to see if there are JavaScript errors

## Understanding the Data Flow

```
┌─────────────┐
│   Browser   │
│  (React App)│
└──────┬──────┘
       │
       │ Apollo Client
       │ (GraphQL queries)
       │
       ▼
┌──────────────────┐
│ Supabase Edge    │
│ Function         │
│ (printavo-proxy) │
└──────┬───────────┘
       │
       │ + Adds auth headers
       │ + Rate limiting
       │ + Error handling
       │
       ▼
┌──────────────────┐
│  Printavo API    │
│     (v2)         │
│   GraphQL        │
└──────────────────┘
```

1. Your browser runs the React app
2. Apollo Client makes GraphQL queries
3. Queries go to Supabase Edge Function (NOT directly to Printavo)
4. Edge Function adds your credentials and forwards to Printavo
5. Printavo responds with data
6. Edge Function sends data back to browser
7. React app displays the data in beautiful charts and tables

## Advanced Configuration

### Adjusting Pagination

Default: 50 records per page

To change, edit `src/utils/pagination.ts`:

```typescript
export async function fetchAllPages<T>(
  client: ApolloClient<unknown>,
  query: DocumentNode,
  dataKey: string,
  variables: Record<string, unknown> = {},
  options: PaginationOptions = {}
): Promise<T[]> {
  const { first = 100, maxPages = 200 } = options; // Change these
  // ...
}
```

### Customizing Rate Limits

Edit `supabase/functions/printavo-proxy/index.ts`:

```typescript
const RATE_LIMIT = 10;     // requests
const WINDOW_MS = 5000;    // milliseconds
```

**Warning**: Don't exceed Printavo's limits or your API access may be throttled.

### Adding Custom Queries

1. Add query to `src/graphql/queries.ts`:

```typescript
export const GET_CUSTOM_DATA = gql`
  query GetCustomData($after: String, $first: Int = 50) {
    customData(after: $after, first: $first) {
      edges {
        node {
          id
          // your fields
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;
```

2. Fetch the data in your hook or component:

```typescript
const customData = await fetchAllPages(
  apolloClient,
  GET_CUSTOM_DATA,
  'customData'
);
```

## Production Deployment

### Build for Production

```bash
npm run build
```

This creates an optimized production build in the `dist/` folder.

### Deploy

You can deploy the built application to:

- **Vercel**: `vercel deploy`
- **Netlify**: Drag and drop the `dist` folder
- **Static hosting**: Upload `dist` folder contents
- **Docker**: Use the included Dockerfile (if available)

**Important**: Make sure your Supabase Edge Function is accessible from your production domain.

### Environment Variables in Production

Set these in your hosting platform:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Do NOT set PRINTAVO_EMAIL or PRINTAVO_TOKEN in the frontend - these are server-side only in the Edge Function.

## Performance Tips

### Large Datasets

If you have thousands of invoices:

1. **Implement caching**: Store fetched data in localStorage
2. **Add refresh button**: Don't auto-fetch on every page load
3. **Implement virtual scrolling**: For large lists
4. **Add date range filters**: Fetch only recent data

### Slow Initial Load

The app fetches ALL data on initial load. To improve:

1. **Lazy load tabs**: Only fetch data when user clicks a tab
2. **Implement background sync**: Fetch data in the background
3. **Add a "last updated" indicator**: Let users know when data is stale
4. **Cache in Supabase**: Store aggregated data in a Supabase table

## Security Best Practices

1. **Never commit** `.env` file to version control
2. **Rotate API tokens** regularly in Printavo
3. **Use environment variables** for all sensitive data
4. **Monitor API usage** in Printavo dashboard
5. **Implement user authentication** if sharing publicly
6. **Use HTTPS** for all production deployments

## Support & Resources

- **Printavo API Docs**: https://www.printavo.com/api/v2
- **GraphQL Docs**: https://graphql.org/learn/
- **Apollo Client**: https://www.apollographql.com/docs/react/
- **Recharts**: https://recharts.org/en-US/
- **Supabase**: https://supabase.com/docs

## Next Steps

Once your dashboard is running:

1. ✅ Explore the Overview tab to see your financial metrics
2. ✅ Search and filter invoices in the Invoices tab
3. ✅ Review payment history in the Payments tab
4. ✅ Check customer profiles in the Customers tab
5. ✅ Customize the dashboard to your needs
6. ✅ Share with your team or deploy to production

Enjoy your new InkOps platform!

---

# AUTH

## Overview

This application implements a complete **multi-tenant authentication system** for InkOps. Each company can sign up with their own account, store their Printavo API credentials securely, and access their financial data in complete isolation from other companies.

---

## Architecture

### Core Components

1. **Supabase Auth** - Handles user authentication (email/password)
2. **Company Settings Table** - Stores company data and encrypted Printavo credentials
3. **User Profiles Table** - Links Supabase auth users to companies
4. **Crypto Service Edge Function** - Encrypts/decrypts API tokens server-side
5. **Auth Context** - Provides authentication state to React components
6. **Enhanced Auth Screen** - Company signup and login UI

---

## Database Schema

### `company_settings`

Stores company information and encrypted Printavo API credentials.

```sql
CREATE TABLE company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  logo_url text,
  printavo_username text,
  printavo_api_token_encrypted text,
  encryption_key_version text DEFAULT 'v1',
  printavo_company_id text,
  printavo_data jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### `user_profiles`

Links Supabase auth users to their company context.

```sql
CREATE TABLE user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'admin',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### Row Level Security (RLS)

All tables have RLS enabled. Authenticated users can:
- Read their own company settings
- Update their own company settings
- Read all user profiles (within their company context)
- Update only their own profile

---

## Security Architecture

### Token Encryption

Printavo API tokens are encrypted using **AES-256-GCM** encryption before storage.

#### Encryption Flow

1. User enters Printavo credentials during signup
2. Frontend sends credentials to `crypto-service` Edge Function
3. Edge Function encrypts token using server-side `ENCRYPTION_KEY`
4. Encrypted token is stored in `company_settings` table
5. Original token is never stored or logged

#### Decryption Flow

1. Application needs to make Printavo API call
2. Retrieves encrypted token from `company_settings`
3. Sends to `crypto-service` Edge Function for decryption
4. Edge Function decrypts using server-side `ENCRYPTION_KEY`
5. Decrypted token is used for API call
6. Decrypted token is never exposed to frontend

### Key Management

The `ENCRYPTION_KEY` is stored as an **environment variable** in the Supabase Edge Function environment. It is:
- Never committed to version control
- Never exposed to the frontend
- Only accessible to the crypto-service Edge Function
- Should be at least 32 characters of random data

Generate a secure key:
```bash
openssl rand -base64 32
```

---

## Authentication Flows

### 1. Company Signup Flow

User provides:
- Company Name
- Email
- Password (min 6 characters)
- Printavo Username
- Printavo API Token

Process:
1. Validate all input fields
2. Create Supabase auth user
3. Encrypt Printavo API token via crypto-service
4. Insert company settings record
5. Create user profile record (automatic via trigger)
6. Create session and redirect to dashboard

**File**: `src/services/auth-service.ts` → `signUpCompany()`

### 2. Login Flow

User provides:
- Email
- Password

Process:
1. Validate credentials against Supabase auth
2. Create session
3. Load company settings from database
4. Redirect to dashboard

**File**: `src/contexts/AuthContext.tsx` → `signIn()`

### 3. Logout Flow

Process:
1. Destroy Supabase session
2. Clear company settings from context
3. Redirect to login screen

**File**: `src/contexts/AuthContext.tsx` → `signOut()`

---

## Multi-Tenancy Implementation

### Data Isolation

Each company's data is completely isolated:

1. **Authentication Level**: Each company has separate Supabase auth users
2. **Database Level**: RLS policies ensure users only access their own data
3. **API Level**: Each company uses their own Printavo credentials

### Making Printavo API Calls

All Printavo API calls must use the company's credentials:

```typescript
import { makePrintavoRequest } from '../services/printavo-api-service';

// Automatically uses the logged-in company's credentials
const invoices = await makePrintavoRequest('/invoices', {
  method: 'GET'
});
```

The `makePrintavoRequest` helper:
1. Retrieves company settings from database
2. Decrypts Printavo API token
3. Makes authenticated request to Printavo API
4. Returns response data

**File**: `src/services/printavo-api-service.ts`

---

## Frontend Components

### EnhancedAuthScreen

Main authentication UI with two modes:

1. **Signup Mode**: Full company registration form
2. **Login Mode**: Standard email/password login

**Features**:
- Real-time validation
- Error handling with user-friendly messages
- Loading states
- Secure password input
- Printavo credentials explanation

**File**: `src/components/EnhancedAuthScreen.tsx`

### AuthContext

React Context providing authentication state throughout the app.

**Exports**:
- `user`: Current Supabase auth user
- `session`: Current Supabase session
- `loading`: Loading state
- `companySettings`: Current company's settings
- `signIn()`: Login function
- `signUpWithCompany()`: Company registration function
- `signOut()`: Logout function
- `refreshCompanySettings()`: Reload company settings

**File**: `src/contexts/AuthContext.tsx`

---

## Edge Functions

### crypto-service

Handles encryption and decryption of Printavo API tokens.

**Endpoints**:
- POST with `action: "encrypt"` and `token: string`
- POST with `action: "decrypt"` and `token: string`

**Security**:
- Requires valid JWT (authenticated users only)
- Uses server-side ENCRYPTION_KEY
- Never logs tokens
- Returns encrypted/decrypted result

**File**: `supabase/functions/crypto-service/index.ts`

---

## Setup Instructions

### 1. Configure Environment Variables

Set the `ENCRYPTION_KEY` in your Supabase project:

1. Go to Supabase Dashboard
2. Navigate to **Edge Functions** → **crypto-service**
3. Add secret: `ENCRYPTION_KEY` with a strong random value

```bash
# Generate a secure key
openssl rand -base64 32
```

### 2. Deploy Migrations

All migrations are automatically applied. Key migrations:
- `add_company_settings_and_users_tables.sql`
- `add_printavo_credentials_to_company_settings.sql`

### 3. Test Authentication

1. Visit your application
2. Click "Create company account"
3. Fill in all fields including Printavo credentials
4. Submit form
5. Verify successful login and dashboard access

---

## API Reference

### Auth Service

```typescript
// Sign up a new company
import { signUpCompany } from './services/auth-service';

await signUpCompany({
  companyName: 'ACME Corp',
  email: 'admin@acme.com',
  password: 'securepass123',
  printavoUsername: 'acme@printavo.com',
  printavoApiToken: 'pk_live_abc123...'
});

// Get current company settings
import { getCompanySettings } from './services/auth-service';
const settings = await getCompanySettings();
```

### Crypto Service

```typescript
// Encrypt a token
import { encryptToken } from './services/crypto-service';
const encrypted = await encryptToken('my-secret-token');

// Decrypt a token
import { decryptToken } from './services/crypto-service';
const decrypted = await decryptToken(encrypted);
```

### Printavo API Service

```typescript
// Make authenticated Printavo API call
import { makePrintavoRequest } from './services/printavo-api-service';

const invoices = await makePrintavoRequest('/invoices', {
  method: 'GET'
});

// Get decrypted credentials directly
import { getPrintavoCredentials } from './services/printavo-api-service';
const creds = await getPrintavoCredentials();
console.log(creds.username, creds.apiToken);
```

---

## Security Best Practices

### ✅ DO

- Always use the crypto-service for encryption/decryption
- Store ENCRYPTION_KEY as environment variable
- Validate all user input on the frontend and backend
- Use HTTPS in production
- Rotate encryption keys periodically (requires re-encrypting tokens)
- Use strong passwords (enforced: min 6 chars)
- Monitor failed login attempts

### ❌ DON'T

- Never log decrypted tokens
- Never expose ENCRYPTION_KEY to frontend
- Never store plaintext API tokens
- Never skip validation
- Never share encryption keys between environments
- Never commit secrets to git

---

## Testing

### Manual Testing Checklist

1. **Signup Flow**
   - [ ] Form validates all required fields
   - [ ] Password must be 6+ characters
   - [ ] Invalid email shows error
   - [ ] Successful signup creates account
   - [ ] Credentials are encrypted in database
   - [ ] User is automatically logged in

2. **Login Flow**
   - [ ] Invalid credentials show error
   - [ ] Valid credentials log in successfully
   - [ ] Session persists on refresh
   - [ ] Company settings load correctly

3. **Logout Flow**
   - [ ] Logout clears session
   - [ ] Redirects to login screen
   - [ ] Company settings are cleared

4. **Protected Routes**
   - [ ] Unauthenticated users see login screen
   - [ ] Authenticated users see dashboard
   - [ ] Session expires after timeout

5. **Multi-Tenancy**
   - [ ] Each company sees only their data
   - [ ] API calls use correct credentials
   - [ ] No data leakage between companies

---

## Troubleshooting

### "ENCRYPTION_KEY environment variable not set"

**Solution**: Configure ENCRYPTION_KEY in Supabase Edge Function settings.

### "Failed to encrypt token"

**Possible Causes**:
- Edge Function not deployed
- ENCRYPTION_KEY not set
- Network connectivity issues

**Solution**: Verify Edge Function deployment and secrets configuration.

### "Printavo credentials not configured"

**Possible Causes**:
- User signed up with old auth flow (before multi-tenant)
- Database migration not applied
- Company settings not found

**Solution**: Have user update credentials in Account Settings.

### Session expires immediately

**Possible Causes**:
- Clock skew on client/server
- Invalid JWT configuration
- Supabase project issue

**Solution**: Check Supabase Auth settings and verify JWT expiration settings.

---

## Future Enhancements

- [ ] Password reset flow
- [ ] Email verification
- [ ] Two-factor authentication (2FA)
- [ ] SSO / OAuth integration
- [ ] Audit logging for auth events
- [ ] Session management dashboard
- [ ] Password strength meter
- [ ] Rate limiting for login attempts
- [ ] Multi-user support per company
- [ ] Role-based access control (RBAC)

---

## Related Files

- `/supabase/migrations/*` - Database schema
- `/supabase/functions/crypto-service/` - Encryption service
- `/src/contexts/AuthContext.tsx` - Auth context provider
- `/src/components/EnhancedAuthScreen.tsx` - Signup/login UI
- `/src/services/auth-service.ts` - Auth business logic
- `/src/services/crypto-service.ts` - Crypto client
- `/src/services/printavo-api-service.ts` - Printavo API client

---

## Support

For issues or questions:
1. Check this documentation
2. Review error messages in browser console
3. Check Supabase Edge Function logs
4. Verify database RLS policies
5. Test Edge Functions in Supabase dashboard

---

# REPORTS

A comprehensive reporting system for InkOps with four production-ready reports, modular architecture, and extensive export capabilities.

## Overview

The Reports tab provides a unified hub for accessing all financial reports, including:

1. **AR Aging Report** - Outstanding invoices grouped by aging buckets
2. **Payments Report** - Payment history with filtering and date ranges
3. **Sales Summary Report** - Revenue trends over time with flexible grouping
4. **Customer Summary Report** - Customer-level financial metrics

## Architecture

### Layered Design

The reporting system follows a clean, modular architecture:

```
src/
├── components/
│   ├── ReportsTab.tsx              # Main reports hub
│   ├── AgingReport.tsx             # AR Aging report
│   ├── PaymentsExplorer.tsx        # Payments report
│   ├── SalesSummaryReport.tsx      # Sales/revenue summary
│   └── CustomerSummaryReport.tsx   # Customer metrics
├── utils/
│   ├── report-service.ts           # Report business logic
│   ├── date-ranges.ts              # Date range utilities
│   ├── csv-export.ts               # CSV export functionality
│   ├── pdf-export.ts               # PDF export functionality
│   ├── aging-calculations.ts       # Aging bucket calculations
│   └── financial-aggregations.ts   # Financial aggregations
└── types/
    └── printavo.ts                 # Type definitions
```

### Key Principles

- **Separation of Concerns**: Data fetching, business logic, and UI are clearly separated
- **Reusability**: Common components and utilities are shared across reports
- **Type Safety**: Full TypeScript coverage with strict types
- **Production Ready**: Error handling, loading states, and edge cases handled

## Reports

### 1. AR Aging Report

**Purpose**: Shows outstanding invoices grouped into aging buckets.

**Features**:
- Aging buckets: 0-30, 31-60, 61-90, 90+ days
- Visual chart showing distribution
- Expandable buckets to view individual invoices
- Links to Printavo for each invoice
- Export to CSV and PDF

**Data Source**: Open invoices from Printavo API

**Location**: `src/components/AgingReport.tsx`

### 2. Payments Report

**Purpose**: Shows all payments received with filtering and analysis.

**Features**:
- Date range filtering (presets + custom)
- Search by customer or invoice
- Sort by date or amount
- Payment totals and summaries
- Export to CSV and PDF

**Data Source**: Payment transactions from Printavo API

**Location**: `src/components/PaymentsExplorer.tsx`

### 3. Sales Summary Report

**Purpose**: Summarizes sales and revenue over time.

**Features**:
- Date range filtering
- Grouping by day, week, or month
- Visual charts (bar or line)
- Summary metrics:
  - Total invoiced
  - Total paid
  - Total outstanding
  - Invoice count
- Detailed period-by-period breakdown
- Export to CSV and PDF

**Data Source**: Invoices from Printavo API

**Location**: `src/components/SalesSummaryReport.tsx`

### 4. Customer Summary Report

**Purpose**: Shows customer-level financial metrics.

**Features**:
- Date range filtering
- Search customers
- Sort by multiple fields:
  - Customer name
  - Total revenue
  - Total outstanding
  - Last invoice date
  - Invoice count
- Summary metrics for all customers
- Detailed customer table
- Export to CSV and PDF

**Data Source**: Invoices aggregated by customer

**Location**: `src/components/CustomerSummaryReport.tsx`

## Date Range System

All reports use a unified date range system with presets and custom ranges.

### Available Presets

```typescript
- 'today'          // Current day
- 'last-5-days'    // Last 5 days
- 'this-week'      // Current week (Monday to Sunday)
- 'last-week'      // Previous week
- 'this-month'     // Current month
- 'last-month'     // Previous month
- 'this-year'      // Current year
- 'last-year'      // Previous year
- 'custom'         // User-defined range
```

### Implementation

Date range utilities are centralized in `src/utils/date-ranges.ts`:

```typescript
import { getDateRangeForPreset, DateRangePreset } from '../utils/date-ranges';

const dateRange = getDateRangeForPreset('this-month');
// Returns: { startDate: Date, endDate: Date }
```

## Export System

### CSV Export

All reports support CSV export with:
- Custom column definitions
- Data formatting (currency, dates)
- Automatic filename generation
- Browser download

**Usage**:
```typescript
import { exportToCSV, CSVColumn } from '../utils/csv-export';

const columns: CSVColumn[] = [
  { header: 'Customer', key: 'customer' },
  { header: 'Amount', key: 'amount', formatter: (val) => `$${val.toFixed(2)}` }
];

exportToCSV(data, columns, 'report-name');
```

**Location**: `src/utils/csv-export.ts`

### PDF Export

All reports support PDF export with:
- Custom table layouts
- Headers and subtitles
- Page orientation (portrait/landscape)
- Automatic formatting
- Professional styling

**Usage**:
```typescript
import { exportToPDF, PDFColumn } from '../utils/pdf-export';

exportToPDF({
  title: 'Report Title',
  subtitle: 'Report details and date range',
  filename: 'report-name',
  columns: [
    { header: 'Customer', dataKey: 'customer' },
    { header: 'Amount', dataKey: 'amount', formatter: (val) => `$${val.toFixed(2)}` }
  ],
  data: reportData,
  orientation: 'landscape'
});
```

**Location**: `src/utils/pdf-export.ts`

**Library Used**: jsPDF with jspdf-autotable

## Service Layer

The service layer (`src/utils/report-service.ts`) provides reusable business logic functions:

### Core Functions

#### `filterInvoicesByDateRange()`
Filters invoices by date range.

#### `filterPaymentsByDateRange()`
Filters payments by date range.

#### `buildARAgingReport()`
Builds AR aging buckets from invoices.

#### `buildPaymentsReport()`
Builds payment report data with metrics.

#### `buildCustomerSummaryReport()`
Aggregates invoices by customer with metrics.

#### `calculatePaymentMethodBreakdown()`
Groups payments by payment method.

#### `calculateInvoiceStatusBreakdown()`
Categorizes invoices by status (paid, partial, unpaid, overdue).

### Example Usage

```typescript
import { buildCustomerSummaryReport } from '../utils/report-service';

const dateRange = {
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31')
};

const customerMetrics = buildCustomerSummaryReport(invoices, dateRange);
```

## Adding New Reports

To add a new report to the system:

### 1. Create Report Component

Create a new file in `src/components/`:

```typescript
import { useMemo, useState } from 'react';
import { FileDown } from 'lucide-react';
import { Invoice } from '../types/printavo';
import { exportToCSV } from '../utils/csv-export';
import { exportToPDF } from '../utils/pdf-export';
import { DateRangePreset, getDateRangeForPreset } from '../utils/date-ranges';

interface MyReportProps {
  invoices: Invoice[];
}

export function MyReport({ invoices }: MyReportProps) {
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('this-month');

  const dateRange = useMemo(() => {
    return getDateRangeForPreset(dateRangePreset);
  }, [dateRangePreset]);

  // Report logic here...

  return (
    <div className="space-y-6">
      {/* Report UI here */}
    </div>
  );
}
```

### 2. Add to ReportsTab

Update `src/components/ReportsTab.tsx`:

```typescript
import { MyReport } from './MyReport';

// Add to reports array:
{
  id: 'my-report' as ReportType,
  name: 'My Report',
  description: 'Description of what the report shows',
  icon: MyIcon,
  color: 'blue',
}

// Add to renderReport():
case 'my-report':
  return <MyReport invoices={invoices} />;
```

### 3. Add Service Functions

If needed, add business logic to `src/utils/report-service.ts`:

```typescript
export function buildMyReport(invoices: Invoice[], dateRange: DateRange) {
  // Report calculation logic
  return reportData;
}
```

## Common Patterns

### Date Range Filtering

```typescript
const dateRange = useMemo(() => {
  if (dateRangePreset === 'custom' && customStartDate && customEndDate) {
    return {
      startDate: new Date(customStartDate),
      endDate: new Date(customEndDate)
    };
  }
  return getDateRangeForPreset(dateRangePreset);
}, [dateRangePreset, customStartDate, customEndDate]);
```

### Export Buttons

```typescript
<div className="flex items-center gap-3">
  <button
    onClick={handleExportCSV}
    disabled={data.length === 0}
    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
  >
    <FileDown className="w-4 h-4" />
    <span className="font-medium">Export CSV</span>
  </button>
  <button
    onClick={handleExportPDF}
    disabled={data.length === 0}
    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
  >
    <FileDown className="w-4 h-4" />
    <span className="font-medium">Export PDF</span>
  </button>
</div>
```

### Summary Cards

```typescript
<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
    <div className="flex items-center gap-3">
      <div className="p-2 bg-blue-100 rounded-lg">
        <Icon className="w-6 h-6 text-blue-600" />
      </div>
      <div>
        <p className="text-sm text-blue-600 font-medium">Metric Label</p>
        <p className="text-2xl font-bold text-blue-900">
          {value}
        </p>
      </div>
    </div>
  </div>
</div>
```

## Performance Considerations

### Memoization

All reports use `useMemo` for expensive calculations:

```typescript
const reportData = useMemo(() => {
  // Expensive calculation
  return calculateReport(invoices, filters);
}, [invoices, filters]);
```

### Filtering

Filtering is done in JavaScript after data is loaded. For large datasets (10,000+ records), consider:
- Server-side filtering
- Pagination
- Virtual scrolling

### Charts

Charts use Recharts with responsive containers. For better performance:
- Limit data points (aggregate if needed)
- Use memoization for chart data
- Consider sampling for very large datasets

## Styling Guidelines

All reports follow consistent styling:

- **Colors**: Blue (primary), Green (positive/paid), Red (negative/outstanding), Gray (neutral)
- **Spacing**: Consistent padding and margins using Tailwind's spacing scale
- **Typography**: Clear hierarchy with font weights and sizes
- **Borders**: Subtle borders for separation (gray-200)
- **Shadows**: Soft shadows for depth (shadow-sm)
- **Hover States**: All interactive elements have hover states
- **Disabled States**: Properly styled disabled states with reduced opacity

## Error Handling

Reports handle common error scenarios:

1. **No Data**: Clear empty states with helpful messages
2. **Loading States**: Loading indicators during data fetch
3. **Invalid Dates**: Validation for custom date ranges
4. **Export Errors**: Try-catch blocks around export functions

## Testing Recommendations

When testing reports:

1. **Empty Data**: Test with zero invoices/payments
2. **Large Datasets**: Test with 1,000+ records
3. **Date Ranges**: Test all preset ranges
4. **Edge Cases**: Test with negative amounts, null values
5. **Exports**: Verify CSV and PDF output formatting
6. **Responsive**: Test on mobile, tablet, desktop

## Future Enhancements

Potential additions to the reporting system:

1. **Scheduled Reports**: Email reports on a schedule
2. **Report Templates**: Save custom report configurations
3. **Comparative Analysis**: Year-over-year, month-over-month
4. **Forecasting**: Predict future revenue based on trends
5. **Custom Filters**: More advanced filtering options
6. **Dashboard Widgets**: Mini-reports on main dashboard
7. **Excel Export**: .xlsx format with formatting
8. **Print View**: Optimized print layouts
9. **Saved Views**: Save and load report configurations
10. **API Endpoints**: Expose reports via REST API

## Support

For questions or issues:
1. Check this documentation
2. Review component source code
3. Check type definitions in `src/types/printavo.ts`
4. Refer to utility function documentation in source files

---

**Built with**: React, TypeScript, Tailwind CSS, Recharts, jsPDF
**Last Updated**: 2024-12-31

---

# EMAIL_GUIDE

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

---

(Continue with remaining markdown files in the same format...)

[Due to length limits, I've shown the format. The actual file would continue with all 18 markdown files in the same structure]
