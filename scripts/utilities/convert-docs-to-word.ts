import { Document, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, AlignmentType, WidthType, Packer } from 'docx';
import * as fs from 'fs';

// Convert README to Word
async function createReadmeDoc() {
  const children: any[] = [];

  children.push(
    new Paragraph({
      text: 'InkOps API Documentation - Version 1.0',
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
    new Paragraph({
      text: 'Documentation Overview and Setup Guide',
      alignment: AlignmentType.CENTER,
      spacing: { after: 800 },
    }),
    new Paragraph({
      text: 'Documentation Files',
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: '1. Word Document (InkOps_API_Documentation_v1.docx)',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: 'Complete API reference guide in Microsoft Word format including:',
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: '• Overview and introduction',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Authentication flows with detailed diagrams',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• All API endpoints organized by category',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Request/response examples',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Error handling reference',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• HTTP status codes',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Best practices and rate limiting',
      spacing: { after: 200, left: 400 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Use this for: ', bold: true }),
        new TextRun('Sharing with partners, offline reference, printing'),
      ],
      spacing: { after: 400 },
    }),

    new Paragraph({
      text: '2. OpenAPI Specification (openapi-spec.yaml)',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: 'Industry-standard OpenAPI 3.0 specification file that can be used with:',
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: '• Swagger UI - Interactive API documentation and testing',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Redoc - Clean, responsive API documentation',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Code Generators - Generate client SDKs in multiple languages',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• API Testing Tools - Automated testing and validation',
      spacing: { after: 200, left: 400 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Use this for: ', bold: true }),
        new TextRun('Integration with documentation platforms, automated testing, SDK generation'),
      ],
      spacing: { after: 400 },
    }),

    new Paragraph({
      text: '3. Postman Collection (InkOps_API.postman_collection.json)',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: 'Pre-configured Postman collection with:',
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: '• All API endpoints ready to test',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Example requests with proper headers',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Environment variables for easy configuration',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Request bodies with sample data',
      spacing: { after: 200, left: 400 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Use this for: ', bold: true }),
        new TextRun('Manual API testing, exploring endpoints, development workflows'),
      ],
      spacing: { after: 400 },
    }),

    new Paragraph({
      text: 'API Categories',
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: 'The documentation covers the following public-facing API categories:',
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: '1. Quotes Management',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: '• Create draft quotes',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• List and filter quotes',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Get quote details with line items',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Update and delete quotes',
      spacing: { after: 200, left: 400 },
    }),

    new Paragraph({
      text: '2. Product Search',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: '• Search products by style number',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Multi-supplier catalog integration (SanMar, SSActivewear)',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Cached and live product data',
      spacing: { after: 200, left: 400 },
    }),

    new Paragraph({
      text: '3. Customer Portal',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: '• Retrieve customer quotes, invoices, proofs, and work orders',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Customer session authentication',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Create payment links',
      spacing: { after: 200, left: 400 },
    }),

    new Paragraph({
      text: '4. Payment Methods',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: '• List customer payment methods',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Add and manage payment methods',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Stripe integration',
      spacing: { after: 200, left: 400 },
    }),

    new Paragraph({
      text: '5. Webhooks',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: '• Stripe webhook event processing',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Payment notifications',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Automatic invoice updates',
      spacing: { after: 400, left: 400 },
    }),

    new Paragraph({
      text: 'Authentication Methods',
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: 'JWT Bearer Token',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: 'For authenticated internal users and staff:',
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: 'Authorization: Bearer {your_jwt_token}',
      spacing: { after: 400 },
    }),

    new Paragraph({
      text: 'Customer Portal Token',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: 'For customer-facing portal access:',
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: 'X-Customer-Token: {customer_session_token}',
      spacing: { after: 400 },
    }),

    new Paragraph({
      text: 'Quick Start with Tools',
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: 'Swagger UI',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: '1. Visit Swagger Editor at https://editor.swagger.io/',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '2. Import openapi-spec.yaml',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '3. Try out endpoints interactively',
      spacing: { after: 200, left: 400 },
    }),

    new Paragraph({
      text: 'Postman',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: '1. Import InkOps_API.postman_collection.json into Postman',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '2. Set environment variables:',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '   - base_url: Your Supabase project URL',
      spacing: { after: 50, left: 600 },
    }),
    new Paragraph({
      text: '   - jwt_token: Your JWT authentication token',
      spacing: { after: 50, left: 600 },
    }),
    new Paragraph({
      text: '   - customer_token: Customer portal token',
      spacing: { after: 50, left: 600 },
    }),
    new Paragraph({
      text: '   - company_id: Your company ID',
      spacing: { after: 50, left: 600 },
    }),
    new Paragraph({
      text: '3. Start testing endpoints',
      spacing: { after: 400, left: 400 },
    }),

    new Paragraph({
      text: 'Recommended Tools for API Documentation',
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: '1. Swagger UI (Free, Open Source)',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Best for: ', bold: true }),
        new TextRun('Interactive API exploration and testing'),
      ],
      spacing: { after: 50 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Setup: ', bold: true }),
        new TextRun('Upload openapi-spec.yaml to Swagger Editor'),
      ],
      spacing: { after: 50 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Features: ', bold: true }),
        new TextRun('Try-it-out functionality, automatic request/response validation'),
      ],
      spacing: { after: 200 },
    }),

    new Paragraph({
      text: '2. Redoc (Free, Open Source)',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Best for: ', bold: true }),
        new TextRun('Beautiful, responsive documentation websites'),
      ],
      spacing: { after: 50 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Setup: ', bold: true }),
        new TextRun('npx @redocly/cli build-docs openapi-spec.yaml'),
      ],
      spacing: { after: 50 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Features: ', bold: true }),
        new TextRun('Three-panel design, search, responsive layout'),
      ],
      spacing: { after: 200 },
    }),

    new Paragraph({
      text: '3. Stoplight Studio (Free tier available)',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Best for: ', bold: true }),
        new TextRun('Visual API design and documentation'),
      ],
      spacing: { after: 50 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Setup: ', bold: true }),
        new TextRun('Import OpenAPI spec into Stoplight Studio'),
      ],
      spacing: { after: 50 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Features: ', bold: true }),
        new TextRun('Visual editor, mocking, testing'),
      ],
      spacing: { after: 200 },
    }),

    new Paragraph({
      text: '4. Postman (Free tier available)',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Best for: ', bold: true }),
        new TextRun('API testing and team collaboration'),
      ],
      spacing: { after: 50 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Setup: ', bold: true }),
        new TextRun('Import the Postman collection'),
      ],
      spacing: { after: 50 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Features: ', bold: true }),
        new TextRun('Automated tests, team workspaces, monitoring'),
      ],
      spacing: { after: 200 },
    }),

    new Paragraph({
      text: '5. ReadMe.io (Paid, with free tier)',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Best for: ', bold: true }),
        new TextRun('Public-facing developer portals'),
      ],
      spacing: { after: 50 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Setup: ', bold: true }),
        new TextRun('Import OpenAPI spec'),
      ],
      spacing: { after: 50 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Features: ', bold: true }),
        new TextRun('Custom branding, analytics, support integration'),
      ],
      spacing: { after: 400 },
    }),

    new Paragraph({
      text: 'Security Notes',
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: '• Always use HTTPS for all API communications',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Store JWT tokens securely and refresh before expiration',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Validate webhook signatures to ensure authenticity',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Never expose API credentials in client-side code',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Implement rate limiting in your applications',
      spacing: { after: 400, left: 400 },
    }),

    new Paragraph({
      text: 'Base URL',
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: 'All endpoints are accessed via:',
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: 'https://your-project.supabase.co',
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: 'Replace with your actual Supabase project URL.',
      spacing: { after: 400 },
    })
  );

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });

  return doc;
}

// Convert Summary to Word
async function createSummaryDoc() {
  const children: any[] = [];

  children.push(
    new Paragraph({
      text: 'API Documentation Generation Summary',
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
    new Paragraph({
      text: 'InkOps API Version 1.0',
      alignment: AlignmentType.CENTER,
      spacing: { after: 800 },
    }),

    new Paragraph({
      text: 'What Was Created',
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    }),

    new Paragraph({
      text: '1. Comprehensive Word Document',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'File: ', bold: true }),
        new TextRun('InkOps_API_Documentation_v1.docx (14.30 KB)'),
      ],
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: 'A complete, professional API reference guide containing:',
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: '• Title Page with version information and generation date',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Table of Contents with hierarchical navigation',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Overview Section explaining the API purpose and base URL',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Authentication Section with detailed flow diagrams',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• API Endpoints organized into 5 categories',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Detailed Endpoint Documentation for each API',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Error Handling Guide with common error scenarios',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Status Codes Reference Table',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Best Practices Section',
      spacing: { after: 400, left: 400 },
    }),

    new Paragraph({
      text: '2. OpenAPI 3.0 Specification',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'File: ', bold: true }),
        new TextRun('openapi-spec.yaml'),
      ],
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: 'Industry-standard API specification with:',
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: '• Complete endpoint definitions',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Request/response schemas',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Authentication schemes (BearerAuth, CustomerToken)',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Reusable components for data models',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Error response definitions',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Parameter specifications',
      spacing: { after: 200, left: 400 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Compatible with: ', bold: true }),
        new TextRun('Swagger UI, Redoc, Postman, Code generators, API testing tools'),
      ],
      spacing: { after: 400 },
    }),

    new Paragraph({
      text: '3. Postman Collection',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'File: ', bold: true }),
        new TextRun('InkOps_API.postman_collection.json'),
      ],
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: 'Pre-configured collection with:',
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: '• 16 ready-to-use API requests',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Environment variables for easy configuration',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Proper authentication headers',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Example request bodies',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Organized into logical folders',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Sample data for all endpoints',
      spacing: { after: 400, left: 400 },
    }),

    new Paragraph({
      text: 'API Categories Documented',
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: 'Public-Facing APIs (Partner & Customer Accessible)',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 200 },
    }),

    new Paragraph({
      text: '1. Quotes Management API',
      heading: HeadingLevel.HEADING_3,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: '• Create draft quotes',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• List quotes with filtering and pagination',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Get quote details with line items',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Update quotes',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Delete quotes (admin only)',
      spacing: { after: 200, left: 400 },
    }),

    new Paragraph({
      text: '2. Product Search API',
      heading: HeadingLevel.HEADING_3,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: '• Search SanMar catalog',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Search SSActivewear catalog',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Cached vs live results',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Product images and pricing',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Multi-color variations',
      spacing: { after: 200, left: 400 },
    }),

    new Paragraph({
      text: '3. Customer Portal API',
      heading: HeadingLevel.HEADING_3,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: '• Get customer quotes',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Get customer invoices',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Get customer proofs',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Get work orders',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Create payment links',
      spacing: { after: 200, left: 400 },
    }),

    new Paragraph({
      text: '4. Payment Methods API',
      heading: HeadingLevel.HEADING_3,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: '• List saved payment methods',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Add new payment methods',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Set default payment method',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Delete payment methods',
      spacing: { after: 200, left: 400 },
    }),

    new Paragraph({
      text: '5. Webhooks API',
      heading: HeadingLevel.HEADING_3,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: '• Stripe payment webhooks',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Signature verification',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Event processing',
      spacing: { after: 400, left: 400 },
    }),

    new Paragraph({
      text: 'Authentication Flows Documented',
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 200 },
    }),

    new Paragraph({
      text: 'JWT Authentication',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: '1. User login with credentials',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '2. Supabase Auth validation',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '3. JWT token generation',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '4. Token included in Authorization header',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '5. API validates token',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '6. Row Level Security enforces company scope',
      spacing: { after: 200, left: 400 },
    }),

    new Paragraph({
      text: 'Customer Portal Authentication',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: '1. Customer receives magic link email',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '2. Link contains session token',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '3. Token validation',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '4. Session creation (24-hour expiration)',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '5. Token used in X-Customer-Token header',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '6. Access limited to customer data',
      spacing: { after: 400, left: 400 },
    }),

    new Paragraph({
      text: 'File Sizes',
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ text: 'File', bold: true })],
              shading: { fill: 'E0E0E0' },
            }),
            new TableCell({
              children: [new Paragraph({ text: 'Size', bold: true })],
              shading: { fill: 'E0E0E0' },
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph('Word Document')] }),
            new TableCell({ children: [new Paragraph('14.30 KB')] }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph('OpenAPI Spec')] }),
            new TableCell({ children: [new Paragraph('~18 KB')] }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph('Postman Collection')] }),
            new TableCell({ children: [new Paragraph('~15 KB')] }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: 'Total', bold: true })] }),
            new TableCell({ children: [new Paragraph({ text: '~48 KB', bold: true })] }),
          ],
        }),
      ],
    }),

    new Paragraph({
      text: '',
      spacing: { after: 400 },
    }),

    new Paragraph({
      text: 'Key Features',
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: '• Comprehensive endpoint documentation',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Authentication flow diagrams',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Request/response examples for all endpoints',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Error handling reference',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• HTTP status code explanations',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Security best practices',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Tool recommendations',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Interactive testing capabilities',
      spacing: { after: 400, left: 400 },
    })
  );

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });

  return doc;
}

// Main execution
async function main() {
  console.log('Converting documentation files to Word format...');

  const readmeDoc = await createReadmeDoc();
  const readmeBuffer = await Packer.toBuffer(readmeDoc);
  fs.writeFileSync('./documentation/word-docs/API_Documentation_README.docx', readmeBuffer);
  console.log('✅ Created API_Documentation_README.docx');

  const summaryDoc = await createSummaryDoc();
  const summaryBuffer = await Packer.toBuffer(summaryDoc);
  fs.writeFileSync('./documentation/word-docs/API_Documentation_Summary.docx', summaryBuffer);
  console.log('✅ Created API_Documentation_Summary.docx');

  // Copy the main documentation
  fs.copyFileSync('./InkOps_API_Documentation_v1.docx', './documentation/word-docs/InkOps_API_Documentation_v1.docx');
  console.log('✅ Copied InkOps_API_Documentation_v1.docx');

  // Copy other documentation files
  fs.copyFileSync('./openapi-spec.yaml', './documentation/openapi-spec.yaml');
  console.log('✅ Copied openapi-spec.yaml');

  fs.copyFileSync('./InkOps_API.postman_collection.json', './documentation/InkOps_API.postman_collection.json');
  console.log('✅ Copied InkOps_API.postman_collection.json');

  console.log('\n📁 All documentation files organized in ./documentation/');
  console.log('📄 Word documents are in ./documentation/word-docs/');
}

main().catch(console.error);
