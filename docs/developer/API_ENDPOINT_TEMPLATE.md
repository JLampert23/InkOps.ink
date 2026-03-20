# API Endpoint Documentation Template

Use this template when documenting new API endpoints.

---

## Endpoint Name

Brief description of what this endpoint does.

### Endpoint Details

**Method:** `GET | POST | PUT | DELETE | PATCH`

**Path:** `/endpoint-path`

**Authentication:** Required | Optional | Not Required

**Required Permissions:** `role_name` or `permission_name`

**Rate Limit:** X requests per minute

---

### Request

#### Headers

```http
Authorization: Bearer <token>
Content-Type: application/json
X-Custom-Header: value
```

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | uuid | Yes | Resource identifier |

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| page | integer | No | 1 | Page number for pagination |
| limit | integer | No | 50 | Number of results per page |
| filter | string | No | null | Filter criteria |

#### Request Body

```json
{
  "field1": "string",
  "field2": 123,
  "nested_object": {
    "property": "value"
  },
  "array_field": ["item1", "item2"]
}
```

**Schema:**

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| field1 | string | Yes | Max 255 chars | Description of field1 |
| field2 | integer | No | Min 0, Max 1000 | Description of field2 |
| nested_object | object | No | - | Description of nested object |
| array_field | string[] | No | Max 10 items | Description of array field |

---

### Response

#### Success Response

**Status Code:** `200 OK` | `201 Created` | `204 No Content`

**Response Body:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "field1": "string",
    "field2": 123,
    "created_at": "2024-03-17T14:30:00Z"
  },
  "metadata": {
    "page": 1,
    "total": 100,
    "has_more": true
  }
}
```

**Response Schema:**

| Field | Type | Always Present | Description |
|-------|------|----------------|-------------|
| success | boolean | Yes | Operation success status |
| data | object | Yes | Response payload |
| metadata | object | No | Pagination and metadata |

#### Error Responses

**400 Bad Request**

```json
{
  "success": false,
  "error": "Invalid input parameters",
  "code": "VALIDATION_ERROR",
  "details": {
    "field1": "Must be a valid email address"
  }
}
```

**401 Unauthorized**

```json
{
  "success": false,
  "error": "Invalid or expired token",
  "code": "INVALID_JWT"
}
```

**403 Forbidden**

```json
{
  "success": false,
  "error": "Insufficient permissions",
  "code": "INSUFFICIENT_PERMISSIONS"
}
```

**404 Not Found**

```json
{
  "success": false,
  "error": "Resource not found",
  "code": "RESOURCE_NOT_FOUND"
}
```

**500 Internal Server Error**

```json
{
  "success": false,
  "error": "Internal server error",
  "code": "INTERNAL_ERROR"
}
```

---

### Examples

#### Example 1: Basic Usage

**Request:**

```bash
curl -X POST "https://your-project.supabase.co/functions/v1/endpoint-path" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "field1": "example value",
    "field2": 123
  }'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "field1": "example value",
    "field2": 123,
    "created_at": "2024-03-17T14:30:00Z"
  }
}
```

#### Example 2: With Filters

**Request:**

```bash
curl -X GET "https://your-project.supabase.co/functions/v1/endpoint-path?page=2&limit=25&filter=active" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**

```json
{
  "success": true,
  "data": [...],
  "metadata": {
    "page": 2,
    "limit": 25,
    "total": 150,
    "has_more": true
  }
}
```

#### Example 3: Error Handling

**Request:**

```bash
curl -X POST "https://your-project.supabase.co/functions/v1/endpoint-path" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "field1": "invalid@value",
    "field2": -1
  }'
```

**Response:**

```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": {
    "field1": "Invalid format",
    "field2": "Must be greater than 0"
  }
}
```

---

### Code Examples

#### JavaScript/TypeScript

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Get auth token
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;

// Make API request
const response = await fetch(`${SUPABASE_URL}/functions/v1/endpoint-path`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    field1: 'example value',
    field2: 123
  })
});

const result = await response.json();

if (result.success) {
  console.log('Success:', result.data);
} else {
  console.error('Error:', result.error);
}
```

#### Python

```python
import requests
import os

SUPABASE_URL = os.getenv('SUPABASE_URL')
token = 'your-jwt-token'

response = requests.post(
    f'{SUPABASE_URL}/functions/v1/endpoint-path',
    headers={
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    },
    json={
        'field1': 'example value',
        'field2': 123
    }
)

data = response.json()

if data.get('success'):
    print('Success:', data.get('data'))
else:
    print('Error:', data.get('error'))
```

#### cURL

```bash
curl -X POST "https://your-project.supabase.co/functions/v1/endpoint-path" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "field1": "example value",
    "field2": 123
  }'
```

---

### Notes

- Additional notes about this endpoint
- Special considerations
- Performance tips
- Common pitfalls to avoid

### Related Endpoints

- `GET /related-endpoint` - Description
- `POST /another-endpoint` - Description

### Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.1.0 | 2024-03-17 | Added new field2 parameter |
| 1.0.0 | 2024-03-01 | Initial release |

---

## Testing

### Unit Tests

```typescript
describe('Endpoint Name', () => {
  it('should return success for valid input', async () => {
    const response = await testRequest({
      field1: 'valid value',
      field2: 123
    });

    expect(response.success).toBe(true);
    expect(response.data.field1).toBe('valid value');
  });

  it('should return validation error for invalid input', async () => {
    const response = await testRequest({
      field1: '',
      field2: -1
    });

    expect(response.success).toBe(false);
    expect(response.code).toBe('VALIDATION_ERROR');
  });
});
```

### Integration Tests

```typescript
describe('Endpoint Integration', () => {
  it('should integrate with dependent services', async () => {
    // Setup
    const user = await createTestUser();

    // Execute
    const response = await callEndpoint(user.token);

    // Verify
    expect(response.success).toBe(true);

    // Cleanup
    await deleteTestUser(user.id);
  });
});
```

---

## Performance

- **Average Response Time:** XXms
- **P95 Response Time:** XXms
- **Throughput:** X requests/second
- **Database Queries:** X queries per request

## Security

- **Authentication:** JWT token required
- **Authorization:** Role-based access control
- **Data Validation:** Input sanitization and validation
- **Rate Limiting:** 100 requests per minute
- **SQL Injection Protection:** Parameterized queries
- **XSS Protection:** Output encoding
