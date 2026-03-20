# API Changelog

All notable changes to the InkOps API will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Nothing yet

### Changed
- Nothing yet

### Deprecated
- Nothing yet

### Removed
- Nothing yet

### Fixed
- Nothing yet

### Security
- Nothing yet

---

## [1.0.0] - 2024-03-17

### Added
- Initial API release
- Quotes API endpoints for quote management
- Portal Data API for customer portal access
- Product Search API for supplier catalog integration
- Email API for transactional emails
- Stripe Payments API for payment processing
- Webhook endpoints for Stripe and ShipStation
- JWT-based authentication
- Rate limiting on all endpoints
- Comprehensive error handling with standard error codes
- OpenAPI 3.0 specification
- API documentation

### Security
- Implemented JWT authentication for all authenticated endpoints
- Added magic token authentication for customer portal
- Encrypted storage of API credentials (Stripe, Resend, etc.)
- Row-Level Security (RLS) policies for all database access
- Input validation and sanitization on all endpoints
- Rate limiting to prevent abuse

---

## Version History

### Version Naming Convention

- **Major version (X.0.0)**: Breaking changes that require client updates
- **Minor version (0.X.0)**: New features, backward compatible
- **Patch version (0.0.X)**: Bug fixes, backward compatible

### Breaking Changes Policy

Breaking changes will be announced at least 30 days in advance and will include:
- Migration guide for updating client code
- Deprecated endpoints will remain functional during transition period
- Clear documentation of what changed and why

### Support Policy

- **Current version**: Full support, security updates, bug fixes
- **Previous major version**: Security updates only for 6 months
- **Older versions**: No support, please upgrade

---

## How to Stay Updated

1. **Subscribe to changelog**: Watch this file for updates
2. **API versioning**: All endpoints are versioned via URL path
3. **Deprecation headers**: Deprecated endpoints return `X-API-Deprecated: true` header
4. **Sunset headers**: Endpoints scheduled for removal include `Sunset` header with date

## Reporting Issues

If you encounter any API issues:
- **Security issues**: Report to security@inkops.com (do not create public issues)
- **Bugs**: Create an issue in the project repository
- **Feature requests**: Submit via feature request form

---

## Template for New Entries

When adding new changelog entries, use this template:

```markdown
## [Version] - YYYY-MM-DD

### Added
- New feature description with endpoint path and brief explanation

### Changed
- Changed feature description with migration notes if needed

### Deprecated
- Deprecated feature with sunset date and recommended alternative

### Removed
- Removed feature with replacement recommendation

### Fixed
- Bug fix description with affected endpoints

### Security
- Security update description
```

Example:

```markdown
## [1.1.0] - 2024-04-01

### Added
- `GET /quotes-api/analytics` - New endpoint for quote analytics and reporting
- Support for custom fields in quote line items
- Bulk operations for quotes via `POST /quotes-api/bulk`

### Changed
- `POST /quotes-api` now supports optional `discount` field on line items
- Increased default page size from 50 to 100 for list endpoints
- Improved error messages for validation failures

### Deprecated
- `GET /quotes-api/legacy-format` will be removed on 2024-07-01
  - Use `GET /quotes-api` with `format=legacy` query parameter instead

### Fixed
- Fixed pagination issue when filtering by date range
- Corrected currency formatting for non-USD currencies
- Resolved race condition in concurrent quote updates

### Security
- Enhanced rate limiting for quote creation endpoints
- Added additional validation for email addresses
- Implemented request signing for webhook endpoints
```
