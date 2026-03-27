# InkOps API Documentation - Version 1.0

This directory contains comprehensive API documentation for the InkOps platform's public-facing and partner-accessible endpoints.

## Documentation Files

### 1. Word Document (`InkOps_API_Documentation_v1.docx`)
Complete API reference guide in Microsoft Word format including:
- Overview and introduction
- Authentication flows with detailed diagrams
- All API endpoints organized by category
- Request/response examples
- Error handling reference
- HTTP status codes
- Best practices and rate limiting

**Use this for:** Sharing with partners, offline reference, printing

### 2. OpenAPI Specification (`openapi-spec.yaml`)
Industry-standard OpenAPI 3.0 specification file that can be used with:
- **Swagger UI**: Interactive API documentation and testing
- **Redoc**: Clean, responsive API documentation
- **Code Generators**: Generate client SDKs in multiple languages
- **API Testing Tools**: Automated testing and validation

**Use this for:** Integration with documentation platforms, automated testing, SDK generation

### 3. Postman Collection (`InkOps_API.postman_collection.json`)
Pre-configured Postman collection with:
- All API endpoints ready to test
- Example requests with proper headers
- Environment variables for easy configuration
- Request bodies with sample data

**Use this for:** Manual API testing, exploring endpoints, development workflows

## API Categories

The documentation covers the following public-facing API categories:

### 1. Quotes Management
- Create draft quotes
- List and filter quotes
- Get quote details with line items
- Update and delete quotes

### 2. Product Search
- Search products by style number
- Multi-supplier catalog integration (SanMar, SSActivewear)
- Cached and live product data

### 3. Customer Portal
- Retrieve customer quotes, invoices, proofs, and work orders
- Customer session authentication
- Create payment links

### 4. Payment Methods
- List customer payment methods
- Add and manage payment methods
- Stripe integration

### 5. Webhooks
- Stripe webhook event processing
- Payment notifications
- Automatic invoice updates

## Authentication Methods

### JWT Bearer Token
For authenticated internal users and staff:
```
Authorization: Bearer {your_jwt_token}
```

### Customer Portal Token
For customer-facing portal access:
```
X-Customer-Token: {customer_session_token}
```

## Quick Start with Tools

### Swagger UI
1. Visit [Swagger Editor](https://editor.swagger.io/)
2. Import `openapi-spec.yaml`
3. Try out endpoints interactively

### Postman
1. Import `InkOps_API.postman_collection.json` into Postman
2. Set environment variables:
   - `base_url`: Your Supabase project URL
   - `jwt_token`: Your JWT authentication token
   - `customer_token`: Customer portal token (for portal endpoints)
   - `company_id`: Your company ID
3. Start testing endpoints

### Redoc
Generate beautiful documentation:
```bash
npx @redocly/cli build-docs openapi-spec.yaml
```

## Regenerating Documentation

To regenerate the Word document after making changes:

```bash
npm run generate:api-docs
```

Or manually:
```bash
npx tsx generate-api-docs.ts
```

## Recommended Tools for API Documentation

### 1. Swagger UI (Free, Open Source)
- **Best for:** Interactive API exploration and testing
- **Setup:** Upload `openapi-spec.yaml` to [Swagger Editor](https://editor.swagger.io/)
- **Features:** Try-it-out functionality, automatic request/response validation

### 2. Redoc (Free, Open Source)
- **Best for:** Beautiful, responsive documentation websites
- **Setup:** `npx @redocly/cli build-docs openapi-spec.yaml`
- **Features:** Three-panel design, search, responsive layout

### 3. Stoplight Studio (Free tier available)
- **Best for:** Visual API design and documentation
- **Setup:** Import OpenAPI spec into Stoplight Studio
- **Features:** Visual editor, mocking, testing

### 4. Postman (Free tier available)
- **Best for:** API testing and team collaboration
- **Setup:** Import the Postman collection
- **Features:** Automated tests, team workspaces, monitoring

### 5. ReadMe.io (Paid, with free tier)
- **Best for:** Public-facing developer portals
- **Setup:** Import OpenAPI spec
- **Features:** Custom branding, analytics, support integration

## API Versioning

This documentation represents **Version 1.0** of the InkOps API. Future versions will be documented separately to maintain backward compatibility.

## Base URL

All endpoints are accessed via:
```
https://your-project.supabase.co
```

Replace with your actual Supabase project URL.

## Support

For API support or questions about integration, please contact the InkOps development team.

## Security Notes

- Always use HTTPS for all API communications
- Store JWT tokens securely and refresh before expiration
- Validate webhook signatures to ensure authenticity
- Never expose API credentials in client-side code
- Implement rate limiting in your applications

## Data Models

Complete data model relationships are documented in the Word document with visual diagrams showing:
- Quote workflow states
- Customer portal session lifecycle
- Payment processing flow
- Authentication token flow
- Data relationships between entities

---

**Document Version:** 1.0
**Last Updated:** 2024
**Generated:** Automatically from Edge Function source code
