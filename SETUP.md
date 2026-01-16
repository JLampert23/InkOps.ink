# InkOps - Setup Guide

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
