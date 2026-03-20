# InkOps API Documentation Suite

Welcome to the InkOps API documentation. This suite provides comprehensive information for integrating with the InkOps platform.

## Documentation Overview

### 📚 Core Documentation

1. **[API Documentation](./API_DOCUMENTATION.md)** - Complete API reference
   - All available endpoints
   - Request/response examples
   - Authentication guide
   - Error handling
   - Rate limiting
   - Webhooks

2. **[Quick Start Guide](./API_QUICK_START.md)** - Get started in 5 minutes
   - Step-by-step setup
   - Language-specific examples (JavaScript, Python, Ruby, PHP)
   - Common tasks and patterns
   - Postman collection usage

3. **[API Changelog](./API_CHANGELOG.md)** - Version history and updates
   - Latest changes
   - Breaking changes
   - Migration guides
   - Deprecation notices

### 🛠️ Developer Resources

4. **[API Tools Setup](./API_TOOLS_SETUP.md)** - Documentation automation tools
   - Swagger UI setup
   - Redoc configuration
   - Postman integration
   - Docusaurus setup
   - SDK generation
   - CI/CD integration

5. **[API Endpoint Template](./API_ENDPOINT_TEMPLATE.md)** - Template for documenting new endpoints
   - Standard format
   - Required sections
   - Example structure

6. **[OpenAPI Specification](../../openapi.yaml)** - Machine-readable API spec
   - OpenAPI 3.0 format
   - Use with Swagger UI, Redoc, etc.
   - Generate SDKs automatically

## Quick Links

### Getting Started

- 🚀 [5-Minute Quick Start](./API_QUICK_START.md#5-minute-quick-start)
- 🔐 [Authentication Guide](./API_DOCUMENTATION.md#authentication)
- 💡 [Common Examples](./API_QUICK_START.md#common-tasks)

### API Reference

- 📝 [Quotes API](./API_DOCUMENTATION.md#quotes-api)
- 🌐 [Portal Data API](./API_DOCUMENTATION.md#portal-data-api)
- 🔍 [Product Search API](./API_DOCUMENTATION.md#product-search-api)
- 📧 [Email API](./API_DOCUMENTATION.md#email-api)
- 💳 [Stripe Payments API](./API_DOCUMENTATION.md#stripe-payments-api)

### Tools & SDKs

- 📦 [Generate Client SDKs](./API_TOOLS_SETUP.md#openapi-generator)
- 🧪 [Testing with Postman](./API_QUICK_START.md#testing-with-postman)
- 📖 [Interactive API Docs](./API_TOOLS_SETUP.md#swagger-ui)

## Documentation Structure

```
docs/developer/
├── API_DOCUMENTATION.md          # Complete API reference
├── API_QUICK_START.md            # Quick start guide
├── API_CHANGELOG.md              # Version history
├── API_TOOLS_SETUP.md            # Documentation tools
├── API_ENDPOINT_TEMPLATE.md      # Template for new endpoints
└── API_DOCUMENTATION_INDEX.md    # This file

openapi.yaml                      # OpenAPI specification
```

## For Different Audiences

### 👨‍💻 Developers New to InkOps

Start here:
1. Read the [Quick Start Guide](./API_QUICK_START.md)
2. Try the examples in your language
3. Explore the [Full API Documentation](./API_DOCUMENTATION.md)

### 🏗️ Integration Engineers

Your path:
1. Review [API Documentation](./API_DOCUMENTATION.md) for all endpoints
2. Check [OpenAPI Specification](../../openapi.yaml) for exact schemas
3. Use [Postman Collection](./API_QUICK_START.md#testing-with-postman) for testing
4. Generate SDKs using [OpenAPI Generator](./API_TOOLS_SETUP.md#openapi-generator)

### 📚 Technical Writers

Resources for you:
1. Use the [Endpoint Template](./API_ENDPOINT_TEMPLATE.md) for consistency
2. Set up [Documentation Tools](./API_TOOLS_SETUP.md) for auto-generation
3. Maintain the [Changelog](./API_CHANGELOG.md) with each release

### 👷 DevOps Engineers

For your needs:
1. [CI/CD Integration](./API_TOOLS_SETUP.md#cicd-integration) guide
2. [Rate Limiting](./API_DOCUMENTATION.md#rate-limiting) specifications
3. [Webhook Setup](./API_DOCUMENTATION.md#webhooks) documentation

## Key Features

### 🔒 Security
- JWT-based authentication
- Encrypted credential storage
- Row-Level Security (RLS)
- Rate limiting
- Input validation

### 📊 Developer Experience
- RESTful design
- Comprehensive error messages
- Detailed examples
- Interactive documentation
- Multiple language SDKs

### 🚀 Performance
- Efficient pagination
- Cached responses where appropriate
- Optimized database queries
- CDN-delivered documentation

### 🔄 Reliability
- Webhook retry logic
- Token refresh handling
- Comprehensive error codes
- Detailed logging

## Common Use Cases

### Quote Management
```javascript
// Create, update, and manage quotes
const quote = await createQuote({
  customer_name: "Acme Corp",
  line_items: [...]
});
```
See: [Quotes API Documentation](./API_DOCUMENTATION.md#quotes-api)

### Customer Portal
```javascript
// Access customer-specific data
const quotes = await getPortalData('quotes', customerToken);
```
See: [Portal Data API Documentation](./API_DOCUMENTATION.md#portal-data-api)

### Product Search
```javascript
// Search supplier catalogs
const products = await searchProducts('PC54');
```
See: [Product Search API Documentation](./API_DOCUMENTATION.md#product-search-api)

### Payment Processing
```javascript
// Create payment links and invoices
const paymentLink = await createPaymentLink({
  amount: 162000,
  description: "Invoice #INV-001"
});
```
See: [Stripe Payments API Documentation](./API_DOCUMENTATION.md#stripe-payments-api)

### Email Notifications
```javascript
// Send transactional emails
await sendEmail({
  to: "customer@example.com",
  template: "invoice-reminder",
  data: { invoiceNumber: "INV-001" }
});
```
See: [Email API Documentation](./API_DOCUMENTATION.md#email-api)

## Support Channels

### Documentation
- **This documentation suite** - Comprehensive guides and references
- **OpenAPI Spec** - Machine-readable API specification
- **Interactive Docs** - Swagger UI and Redoc

### Community
- **GitHub Issues** - Bug reports and feature requests
- **Discussions** - General questions and community help

### Direct Support
- **Email**: api-support@inkops.com
- **Response Time**: Within 24 hours on business days

## Contributing to Documentation

We welcome documentation improvements! Here's how to contribute:

1. **Report Issues**: Found a typo or unclear explanation? Create an issue
2. **Suggest Improvements**: Have ideas for better examples? Submit a PR
3. **Add Examples**: More language examples always welcome
4. **Update Changelog**: Document API changes you're aware of

### Documentation Standards

- Use the [Endpoint Template](./API_ENDPOINT_TEMPLATE.md) for new endpoints
- Include realistic, working examples
- Test all code examples before submitting
- Update the [Changelog](./API_CHANGELOG.md) for any API changes
- Keep [OpenAPI Spec](../../openapi.yaml) in sync with documentation

## Frequently Asked Questions

### Authentication
**Q: How long do JWT tokens last?**
A: JWT tokens expire after 1 hour. Use refresh tokens to obtain new access tokens.

**Q: Can I use API keys instead of JWT?**
A: No, the API requires JWT authentication for security reasons.

### Rate Limits
**Q: What happens when I hit the rate limit?**
A: You'll receive a 429 status code with retry information in headers.

**Q: Can I request higher rate limits?**
A: Yes, contact api-support@inkops.com with your use case.

### Webhooks
**Q: How do I verify webhook signatures?**
A: See the [Webhooks documentation](./API_DOCUMENTATION.md#webhooks) for signature verification.

**Q: What's the retry policy for webhooks?**
A: Failed webhooks are retried with exponential backoff up to 24 hours.

### SDK Generation
**Q: Which languages have official SDKs?**
A: You can generate SDKs for any language using OpenAPI Generator. See the [Tools Setup](./API_TOOLS_SETUP.md#openapi-generator).

### Versioning
**Q: How are API versions managed?**
A: The API uses semantic versioning. Breaking changes increment the major version.

**Q: How long are old versions supported?**
A: Previous major versions receive security updates for 6 months after a new major release.

## Roadmap

### Coming Soon
- GraphQL endpoint (Q2 2024)
- WebSocket support for real-time updates (Q3 2024)
- Additional webhook events (Q2 2024)
- Bulk operations API (Q2 2024)

### Under Consideration
- Server-sent events (SSE) for notifications
- GraphQL subscriptions
- API usage analytics dashboard
- Custom webhook retry policies

## Version Information

- **Current API Version**: 1.0.0
- **OpenAPI Version**: 3.0.3
- **Last Updated**: 2024-03-17
- **Documentation Version**: 1.0.0

## License

This API documentation is proprietary to InkOps. The API is available to licensed InkOps customers.

---

## Quick Navigation

| Category | Link |
|----------|------|
| **Getting Started** | [Quick Start](./API_QUICK_START.md) |
| **API Reference** | [Full Documentation](./API_DOCUMENTATION.md) |
| **Updates** | [Changelog](./API_CHANGELOG.md) |
| **Tools** | [Setup Guide](./API_TOOLS_SETUP.md) |
| **Specification** | [OpenAPI Spec](../../openapi.yaml) |
| **Support** | api-support@inkops.com |

---

**Last Updated**: March 17, 2024
**Documentation Maintained By**: InkOps Development Team
