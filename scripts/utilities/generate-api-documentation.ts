import { Document, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, AlignmentType, BorderStyle, WidthType, convertInchesToTwip, ImageRun } from 'docx';
import * as fs from 'fs';
import * as path from 'path';

interface APIEndpoint {
  name: string;
  method: string;
  path: string;
  description: string;
  authentication: string;
  headers: { name: string; required: boolean; description: string }[];
  queryParams?: { name: string; type: string; required: boolean; description: string }[];
  requestBody?: { field: string; type: string; required: boolean; description: string }[];
  responseSuccess: { status: number; example: string };
  responseErrors: { status: number; description: string }[];
  example?: { request: string; response: string };
}

interface APICategory {
  category: string;
  description: string;
  endpoints: APIEndpoint[];
}

// Define all public-facing API endpoints
const apiCategories: APICategory[] = [
  {
    category: 'Quotes Management',
    description: 'APIs for creating, managing, and retrieving quotes for customers.',
    endpoints: [
      {
        name: 'Create Draft Quote',
        method: 'POST',
        path: '/functions/v1/quotes-api/draft',
        description: 'Creates a minimal draft quote with auto-generated quote number.',
        authentication: 'JWT Bearer Token (Required)',
        headers: [
          { name: 'Authorization', required: true, description: 'Bearer {JWT_TOKEN}' },
          { name: 'Content-Type', required: true, description: 'application/json' },
        ],
        requestBody: [],
        responseSuccess: {
          status: 201,
          example: JSON.stringify({
            quote: {
              id: '550e8400-e29b-41d4-a716-446655440000',
              quote_number: 'QTE-001',
              company_id: '123e4567-e89b-12d3-a456-426614174000',
              customer_name: 'Draft Quote',
              status: 'draft',
              subtotal: 0,
              tax_rate: 0,
              tax_amount: 0,
              total: 0,
              created_at: '2024-01-15T10:30:00Z'
            }
          }, null, 2)
        },
        responseErrors: [
          { status: 401, description: 'Missing or invalid JWT token' },
          { status: 403, description: 'User does not have permission to create quotes' },
          { status: 500, description: 'Internal server error' },
        ],
      },
      {
        name: 'List Quotes',
        method: 'GET',
        path: '/functions/v1/quotes-api',
        description: 'Retrieves a paginated list of quotes with optional filtering.',
        authentication: 'JWT Bearer Token (Required)',
        headers: [
          { name: 'Authorization', required: true, description: 'Bearer {JWT_TOKEN}' },
        ],
        queryParams: [
          { name: 'status', type: 'string', required: false, description: 'Filter by quote status (draft, sent, approved, declined)' },
          { name: 'customer_id', type: 'uuid', required: false, description: 'Filter by customer ID' },
          { name: 'search', type: 'string', required: false, description: 'Search by quote number, customer name, or email' },
          { name: 'date_from', type: 'string', required: false, description: 'Filter quotes created on or after this date (ISO 8601)' },
          { name: 'date_to', type: 'string', required: false, description: 'Filter quotes created on or before this date (ISO 8601)' },
          { name: 'limit', type: 'integer', required: false, description: 'Number of results to return (default: 50, max: 100)' },
          { name: 'offset', type: 'integer', required: false, description: 'Number of results to skip for pagination (default: 0)' },
        ],
        responseSuccess: {
          status: 200,
          example: JSON.stringify({
            quotes: [
              {
                id: '550e8400-e29b-41d4-a716-446655440000',
                quote_number: 'QTE-001',
                customer_name: 'Acme Corporation',
                customer_email: 'contact@acme.com',
                status: 'sent',
                subtotal: 500.00,
                tax_amount: 40.00,
                total: 540.00,
                created_at: '2024-01-15T10:30:00Z',
                customer: {
                  company_name: 'Acme Corporation',
                  contact_name: 'John Smith',
                  email: 'contact@acme.com'
                }
              }
            ],
            count: 1
          }, null, 2)
        },
        responseErrors: [
          { status: 401, description: 'Missing or invalid JWT token' },
          { status: 400, description: 'Invalid query parameters' },
          { status: 500, description: 'Internal server error' },
        ],
      },
      {
        name: 'Get Quote Details',
        method: 'GET',
        path: '/functions/v1/quotes-api/{quote_id}',
        description: 'Retrieves detailed information about a specific quote including line items, activity log, and approvals.',
        authentication: 'JWT Bearer Token (Required)',
        headers: [
          { name: 'Authorization', required: true, description: 'Bearer {JWT_TOKEN}' },
        ],
        responseSuccess: {
          status: 200,
          example: JSON.stringify({
            quote: {
              id: '550e8400-e29b-41d4-a716-446655440000',
              quote_number: 'QTE-001',
              customer_name: 'Acme Corporation',
              customer_email: 'contact@acme.com',
              status: 'sent',
              subtotal: 500.00,
              tax_amount: 40.00,
              total: 540.00,
              created_at: '2024-01-15T10:30:00Z'
            },
            lineItems: [
              {
                id: 'item-001',
                line_number: 1,
                description: 'Custom T-Shirt - Black - Size L',
                quantity: 50,
                unit_price: 10.00,
                total_price: 500.00,
                sku: 'PC54-BLK-L'
              }
            ],
            activityLog: [],
            approvals: []
          }, null, 2)
        },
        responseErrors: [
          { status: 401, description: 'Missing or invalid JWT token' },
          { status: 404, description: 'Quote not found or access denied' },
          { status: 500, description: 'Internal server error' },
        ],
      },
    ],
  },
  {
    category: 'Product Search',
    description: 'APIs for searching product catalogs from integrated suppliers.',
    endpoints: [
      {
        name: 'Search Products',
        method: 'GET',
        path: '/functions/v1/product-search',
        description: 'Searches for products by style number across enabled supplier catalogs (SanMar, SSActivewear). Returns cached results when available, otherwise fetches live data from supplier APIs.',
        authentication: 'JWT Bearer Token or Company ID (Required)',
        headers: [
          { name: 'Authorization', required: false, description: 'Bearer {JWT_TOKEN} (if authenticated user)' },
          { name: 'X-User-Token', required: false, description: 'Alternative JWT token in custom header' },
        ],
        queryParams: [
          { name: 'style', type: 'string', required: true, description: 'Product style number to search for (e.g., "PC54", "18000")' },
          { name: 'companyId', type: 'uuid', required: false, description: 'Company ID (required if not using JWT authentication)' },
        ],
        responseSuccess: {
          status: 200,
          example: JSON.stringify({
            success: true,
            style: 'PC54',
            results: [
              {
                supplier: 'sanmar',
                style: 'PC54',
                brand: 'Port & Company',
                description: 'Core Cotton Tee',
                category: 'T-Shirts',
                colors: [
                  {
                    name: 'Black',
                    code: 'PC54-BLK',
                    image_url: 'https://cdn.sanmar.com/images/PC54_Black_Front.jpg',
                    rear_image_url: 'https://cdn.sanmar.com/images/PC54_Black_Back.jpg',
                    sizes: ['S', 'M', 'L', 'XL', '2XL'],
                    pricing: {
                      wholesale: 4.98,
                      retail: 9.96
                    }
                  }
                ],
                cached: true,
                last_synced: '2024-01-15T08:00:00Z'
              }
            ],
            count: 1,
            diagnostics: {
              companyId: '123e4567-e89b-12d3-a456-426614174000',
              sanmarEnabled: true,
              ssaEnabled: true,
              searchPromisesCount: 2,
              errors: []
            }
          }, null, 2)
        },
        responseErrors: [
          { status: 400, description: 'Missing required style parameter' },
          { status: 401, description: 'Missing authorization credentials' },
          { status: 404, description: 'User company not found' },
          { status: 500, description: 'Internal server error or supplier API failure' },
        ],
      },
    ],
  },
  {
    category: 'Customer Portal',
    description: 'APIs for customer-facing portal access to quotes, invoices, proofs, and work orders.',
    endpoints: [
      {
        name: 'Get Portal Data',
        method: 'GET',
        path: '/functions/v1/portal-data',
        description: 'Retrieves customer-specific data including quotes, invoices, proofs, or work orders based on customer session token.',
        authentication: 'Customer Token (Required)',
        headers: [
          { name: 'X-Customer-Token', required: true, description: 'Customer magic link session token' },
        ],
        queryParams: [
          { name: 'type', type: 'string', required: false, description: 'Data type to retrieve: quotes, invoices, proofs, work_orders (default: quotes)' },
        ],
        responseSuccess: {
          status: 200,
          example: JSON.stringify({
            success: true,
            data: [
              {
                id: '550e8400-e29b-41d4-a716-446655440000',
                quote_number: 'QTE-001',
                created_at: '2024-01-15T10:30:00Z',
                expiry_date: '2024-01-30T23:59:59Z',
                subtotal: 500.00,
                tax_amount: 40.00,
                status: 'sent',
                customer_name: 'Acme Corporation',
                customer_email: 'contact@acme.com',
                notes: 'Custom t-shirt order for corporate event',
                quote_line_items: [
                  {
                    id: 'item-001',
                    description: 'Custom T-Shirt - Black - Size L',
                    quantity: 50,
                    unit_price: 10.00,
                    total_price: 500.00
                  }
                ]
              }
            ]
          }, null, 2)
        },
        responseErrors: [
          { status: 400, description: 'Invalid data type parameter' },
          { status: 401, description: 'Missing or invalid customer token' },
          { status: 404, description: 'Customer not found' },
          { status: 500, description: 'Internal server error' },
        ],
      },
      {
        name: 'Create Payment Link',
        method: 'POST',
        path: '/functions/v1/portal-payment',
        description: 'Creates a Stripe payment link for a customer to pay an invoice through the portal.',
        authentication: 'None (Public webhook endpoint)',
        headers: [
          { name: 'Content-Type', required: true, description: 'application/json' },
        ],
        requestBody: [
          { field: 'action', type: 'string', required: true, description: 'Must be "createPaymentLink"' },
          { field: 'companyId', type: 'uuid', required: true, description: 'Company ID' },
          { field: 'invoiceId', type: 'uuid', required: true, description: 'Invoice ID to create payment for' },
          { field: 'customerId', type: 'uuid', required: true, description: 'Customer ID' },
          { field: 'amount', type: 'integer', required: true, description: 'Payment amount in cents (e.g., 54000 for $540.00)' },
          { field: 'customerEmail', type: 'string', required: false, description: 'Customer email address' },
          { field: 'customerName', type: 'string', required: false, description: 'Customer name' },
          { field: 'description', type: 'string', required: false, description: 'Payment description' },
        ],
        responseSuccess: {
          status: 200,
          example: JSON.stringify({
            paymentLinkId: 'plink_1234567890',
            url: 'https://checkout.stripe.com/c/pay/cs_test_a1b2c3d4e5f6...'
          }, null, 2)
        },
        responseErrors: [
          { status: 400, description: 'Missing required parameters or Stripe not configured' },
          { status: 404, description: 'Invoice not found or access denied' },
          { status: 500, description: 'Internal server error or Stripe API failure' },
        ],
      },
    ],
  },
  {
    category: 'Payment Methods',
    description: 'APIs for managing customer payment methods in the portal.',
    endpoints: [
      {
        name: 'List Payment Methods',
        method: 'GET',
        path: '/functions/v1/customer-payment-methods',
        description: 'Retrieves all saved payment methods for a customer.',
        authentication: 'Service Role (Internal use)',
        headers: [
          { name: 'Authorization', required: true, description: 'Bearer {SERVICE_ROLE_KEY}' },
        ],
        queryParams: [
          { name: 'customer_id', type: 'uuid', required: true, description: 'Customer ID to retrieve payment methods for' },
        ],
        responseSuccess: {
          status: 200,
          example: JSON.stringify({
            success: true,
            payment_methods: [
              {
                id: 'pm-001',
                customer_id: '550e8400-e29b-41d4-a716-446655440000',
                stripe_payment_method_id: 'pm_1234567890',
                payment_method_type: 'card',
                last_four: '4242',
                brand: 'visa',
                exp_month: 12,
                exp_year: 2025,
                is_default: true,
                created_at: '2024-01-15T10:30:00Z'
              }
            ]
          }, null, 2)
        },
        responseErrors: [
          { status: 400, description: 'Missing customer_id parameter' },
          { status: 500, description: 'Internal server error' },
        ],
      },
      {
        name: 'Add Payment Method',
        method: 'POST',
        path: '/functions/v1/customer-payment-methods',
        description: 'Adds a new payment method for a customer.',
        authentication: 'Service Role (Internal use)',
        headers: [
          { name: 'Authorization', required: true, description: 'Bearer {SERVICE_ROLE_KEY}' },
          { name: 'Content-Type', required: true, description: 'application/json' },
        ],
        requestBody: [
          { field: 'customer_id', type: 'uuid', required: true, description: 'Customer ID' },
          { field: 'stripe_payment_method_id', type: 'string', required: true, description: 'Stripe payment method ID' },
          { field: 'is_default', type: 'boolean', required: false, description: 'Set as default payment method' },
        ],
        responseSuccess: {
          status: 201,
          example: JSON.stringify({
            success: true,
            payment_method: {
              id: 'pm-001',
              customer_id: '550e8400-e29b-41d4-a716-446655440000',
              stripe_payment_method_id: 'pm_1234567890',
              payment_method_type: 'card',
              last_four: '4242',
              brand: 'visa',
              is_default: false,
              created_at: '2024-01-15T10:30:00Z'
            }
          }, null, 2)
        },
        responseErrors: [
          { status: 400, description: 'Missing required parameters or Stripe not configured' },
          { status: 404, description: 'Customer not found' },
          { status: 500, description: 'Internal server error' },
        ],
      },
    ],
  },
  {
    category: 'Webhooks',
    description: 'Webhook endpoints for receiving events from external services.',
    endpoints: [
      {
        name: 'Stripe Webhook',
        method: 'POST',
        path: '/functions/v1/stripe-webhook',
        description: 'Receives and processes webhook events from Stripe for payment processing. Supports payment_intent.succeeded, payment_intent.payment_failed, charge.refunded, checkout.session.completed, invoice.paid, and other Stripe events.',
        authentication: 'Stripe Signature Verification (Required)',
        headers: [
          { name: 'stripe-signature', required: true, description: 'Stripe webhook signature for verification' },
          { name: 'Content-Type', required: true, description: 'application/json' },
        ],
        requestBody: [
          { field: 'id', type: 'string', required: true, description: 'Stripe event ID' },
          { field: 'type', type: 'string', required: true, description: 'Event type (e.g., payment_intent.succeeded)' },
          { field: 'data', type: 'object', required: true, description: 'Event data payload from Stripe' },
        ],
        responseSuccess: {
          status: 200,
          example: JSON.stringify({
            received: true
          }, null, 2)
        },
        responseErrors: [
          { status: 400, description: 'Missing Stripe signature header' },
          { status: 401, description: 'Invalid webhook signature' },
          { status: 500, description: 'Webhook processing failed' },
        ],
      },
    ],
  },
];

// Generate Word document
async function generateDocumentation() {
  const children: any[] = [];

  // Title Page
  children.push(
    new Paragraph({
      text: 'InkOps API Documentation',
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
    new Paragraph({
      text: 'Version 1.0',
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: `Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
    new Paragraph({
      text: 'Partner Integration Guide',
      alignment: AlignmentType.CENTER,
      spacing: { after: 800 },
    })
  );

  // Table of Contents
  children.push(
    new Paragraph({
      text: 'Table of Contents',
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: '1. Overview',
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: '2. Authentication',
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: '3. API Endpoints',
      spacing: { after: 100 },
    })
  );

  apiCategories.forEach((category, index) => {
    children.push(
      new Paragraph({
        text: `   ${index + 1}. ${category.category}`,
        spacing: { after: 100, left: 400 },
      })
    );
  });

  children.push(
    new Paragraph({
      text: '4. Error Handling',
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: '5. Status Codes Reference',
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: '6. Rate Limiting and Best Practices',
      spacing: { after: 400 },
    })
  );

  // Overview Section
  children.push(
    new Paragraph({
      text: '1. Overview',
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: 'The InkOps API provides programmatic access to quote management, product search, customer portal features, and payment processing. This documentation covers all public-facing and partner-accessible API endpoints.',
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: 'Base URL',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: 'https://your-project.supabase.co',
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: 'All API endpoints use HTTPS and return JSON responses. The API follows RESTful conventions with standard HTTP methods (GET, POST, PUT, DELETE).',
      spacing: { after: 400 },
    })
  );

  // Authentication Section
  children.push(
    new Paragraph({
      text: '2. Authentication',
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: 'The InkOps API supports multiple authentication methods depending on the use case:',
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: 'JWT Bearer Token Authentication',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: 'Used for authenticated internal users and staff members. Include the JWT token in the Authorization header:',
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: 'Authorization: Bearer {your_jwt_token}',
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: 'Customer Portal Token Authentication',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: 'Used for customer portal access. Customers receive a magic link via email that contains a session token. Include the token in a custom header:',
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: 'X-Customer-Token: {customer_session_token}',
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: 'Customer tokens expire after 24 hours and grant access only to data belonging to that specific customer.',
      spacing: { after: 400 },
    })
  );

  // Authentication Flow Diagram
  children.push(
    new Paragraph({
      text: 'Authentication Flow',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: 'JWT Authentication Flow:',
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: '1. User logs in with email and password',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '2. System validates credentials against Supabase Auth',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '3. Upon successful login, JWT token is returned',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '4. Client includes JWT token in Authorization header for subsequent requests',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '5. API validates token and extracts user ID and company ID',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '6. Row Level Security (RLS) policies enforce data access based on company scope',
      spacing: { after: 200, left: 400 },
    }),
    new Paragraph({
      text: 'Customer Portal Magic Link Flow:',
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: '1. Customer receives email with magic link',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '2. Customer clicks link containing session token',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '3. Token is validated and session is created',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '4. Customer can access portal data using X-Customer-Token header',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '5. Session expires after 24 hours',
      spacing: { after: 400, left: 400 },
    })
  );

  // API Endpoints Section
  children.push(
    new Paragraph({
      text: '3. API Endpoints',
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 200 },
    })
  );

  // Add each category
  apiCategories.forEach((category) => {
    children.push(
      new Paragraph({
        text: category.category,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 100 },
      }),
      new Paragraph({
        text: category.description,
        spacing: { after: 200 },
      })
    );

    // Add each endpoint
    category.endpoints.forEach((endpoint) => {
      children.push(
        new Paragraph({
          text: endpoint.name,
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 300, after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Method: ', bold: true }),
            new TextRun(endpoint.method),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Path: ', bold: true }),
            new TextRun(endpoint.path),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Authentication: ', bold: true }),
            new TextRun(endpoint.authentication),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          text: endpoint.description,
          spacing: { after: 200 },
        })
      );

      // Headers Table
      if (endpoint.headers.length > 0) {
        children.push(
          new Paragraph({
            text: 'Request Headers:',
            spacing: { after: 100 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ text: 'Header', bold: true })],
                    shading: { fill: 'E0E0E0' },
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: 'Required', bold: true })],
                    shading: { fill: 'E0E0E0' },
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: 'Description', bold: true })],
                    shading: { fill: 'E0E0E0' },
                  }),
                ],
              }),
              ...endpoint.headers.map(
                (header) =>
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph(header.name)] }),
                      new TableCell({ children: [new Paragraph(header.required ? 'Yes' : 'No')] }),
                      new TableCell({ children: [new Paragraph(header.description)] }),
                    ],
                  })
              ),
            ],
          })
        );
      }

      // Query Parameters Table
      if (endpoint.queryParams && endpoint.queryParams.length > 0) {
        children.push(
          new Paragraph({
            text: 'Query Parameters:',
            spacing: { before: 200, after: 100 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ text: 'Parameter', bold: true })],
                    shading: { fill: 'E0E0E0' },
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: 'Type', bold: true })],
                    shading: { fill: 'E0E0E0' },
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: 'Required', bold: true })],
                    shading: { fill: 'E0E0E0' },
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: 'Description', bold: true })],
                    shading: { fill: 'E0E0E0' },
                  }),
                ],
              }),
              ...endpoint.queryParams.map(
                (param) =>
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph(param.name)] }),
                      new TableCell({ children: [new Paragraph(param.type)] }),
                      new TableCell({ children: [new Paragraph(param.required ? 'Yes' : 'No')] }),
                      new TableCell({ children: [new Paragraph(param.description)] }),
                    ],
                  })
              ),
            ],
          })
        );
      }

      // Request Body Table
      if (endpoint.requestBody && endpoint.requestBody.length > 0) {
        children.push(
          new Paragraph({
            text: 'Request Body:',
            spacing: { before: 200, after: 100 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ text: 'Field', bold: true })],
                    shading: { fill: 'E0E0E0' },
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: 'Type', bold: true })],
                    shading: { fill: 'E0E0E0' },
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: 'Required', bold: true })],
                    shading: { fill: 'E0E0E0' },
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: 'Description', bold: true })],
                    shading: { fill: 'E0E0E0' },
                  }),
                ],
              }),
              ...endpoint.requestBody.map(
                (field) =>
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph(field.field)] }),
                      new TableCell({ children: [new Paragraph(field.type)] }),
                      new TableCell({ children: [new Paragraph(field.required ? 'Yes' : 'No')] }),
                      new TableCell({ children: [new Paragraph(field.description)] }),
                    ],
                  })
              ),
            ],
          })
        );
      }

      // Response Examples
      children.push(
        new Paragraph({
          text: 'Success Response:',
          spacing: { before: 200, after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `Status: `, bold: true }),
            new TextRun(`${endpoint.responseSuccess.status}`),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          text: endpoint.responseSuccess.example,
          spacing: { after: 200 },
        })
      );

      // Error Responses
      children.push(
        new Paragraph({
          text: 'Error Responses:',
          spacing: { before: 200, after: 100 },
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: 'Status Code', bold: true })],
                  shading: { fill: 'E0E0E0' },
                }),
                new TableCell({
                  children: [new Paragraph({ text: 'Description', bold: true })],
                  shading: { fill: 'E0E0E0' },
                }),
              ],
            }),
            ...endpoint.responseErrors.map(
              (error) =>
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph(error.status.toString())] }),
                    new TableCell({ children: [new Paragraph(error.description)] }),
                  ],
                })
            ),
          ],
        })
      );
    });
  });

  // Error Handling Section
  children.push(
    new Paragraph({
      text: '4. Error Handling',
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: 'All API errors follow a consistent format with an error object containing a message and optional details:',
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: JSON.stringify({
        error: 'Error message describing what went wrong',
        details: 'Additional context or technical details (optional)'
      }, null, 2),
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: 'Common error scenarios include:',
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: '• Authentication errors: Invalid or expired tokens, missing credentials',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Validation errors: Missing required fields, invalid data types, out-of-range values',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Authorization errors: Insufficient permissions, access to resources outside company scope',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Resource errors: Requested resource not found, resource already exists',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Server errors: Internal server errors, database connection issues, external API failures',
      spacing: { after: 400, left: 400 },
    })
  );

  // Status Codes Reference
  children.push(
    new Paragraph({
      text: '5. Status Codes Reference',
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ text: 'Status Code', bold: true })],
              shading: { fill: 'E0E0E0' },
            }),
            new TableCell({
              children: [new Paragraph({ text: 'Meaning', bold: true })],
              shading: { fill: 'E0E0E0' },
            }),
            new TableCell({
              children: [new Paragraph({ text: 'Description', bold: true })],
              shading: { fill: 'E0E0E0' },
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph('200')] }),
            new TableCell({ children: [new Paragraph('OK')] }),
            new TableCell({ children: [new Paragraph('Request successful, data returned')] }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph('201')] }),
            new TableCell({ children: [new Paragraph('Created')] }),
            new TableCell({ children: [new Paragraph('Resource successfully created')] }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph('400')] }),
            new TableCell({ children: [new Paragraph('Bad Request')] }),
            new TableCell({ children: [new Paragraph('Invalid request parameters or body')] }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph('401')] }),
            new TableCell({ children: [new Paragraph('Unauthorized')] }),
            new TableCell({ children: [new Paragraph('Missing or invalid authentication credentials')] }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph('403')] }),
            new TableCell({ children: [new Paragraph('Forbidden')] }),
            new TableCell({ children: [new Paragraph('Authenticated but insufficient permissions')] }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph('404')] }),
            new TableCell({ children: [new Paragraph('Not Found')] }),
            new TableCell({ children: [new Paragraph('Requested resource does not exist')] }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph('405')] }),
            new TableCell({ children: [new Paragraph('Method Not Allowed')] }),
            new TableCell({ children: [new Paragraph('HTTP method not supported for this endpoint')] }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph('500')] }),
            new TableCell({ children: [new Paragraph('Internal Server Error')] }),
            new TableCell({ children: [new Paragraph('Server-side error occurred')] }),
          ],
        }),
      ],
    })
  );

  // Best Practices Section
  children.push(
    new Paragraph({
      text: '6. Rate Limiting and Best Practices',
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: 'Rate Limiting',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: 'The API implements timeout protections to ensure service availability:',
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: '• Product search requests timeout after 20 seconds',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Standard API requests timeout after 2 minutes',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Webhook processing has dedicated timeout handling',
      spacing: { after: 200, left: 400 },
    }),
    new Paragraph({
      text: 'Best Practices',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: '• Use pagination for list endpoints to avoid large response payloads',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Cache product search results when possible to reduce API calls',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Implement exponential backoff for retries on temporary failures',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Store JWT tokens securely and refresh before expiration',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Use HTTPS for all API communications',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Validate webhook signatures to ensure authenticity',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Handle errors gracefully with user-friendly messages',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Monitor API usage and error rates for operational insights',
      spacing: { after: 400, left: 400 },
    })
  );

  // Create document
  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  return doc;
}

export { generateDocumentation };
