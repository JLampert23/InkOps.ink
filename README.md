# InkOps

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
