# InkOps API Quick Start Guide

Get up and running with the InkOps API in minutes.

## Prerequisites

- InkOps account with API access
- Basic understanding of REST APIs
- HTTP client (cURL, Postman, or programming language)

## 5-Minute Quick Start

### Step 1: Get Your Credentials

1. Log into InkOps
2. Navigate to Account Settings
3. Find your Supabase URL and Anon Key
4. Save these for later use

### Step 2: Authenticate

Get a JWT token by signing in:

```bash
curl -X POST 'https://your-project.supabase.co/auth/v1/token?grant_type=password' \
  -H 'apikey: YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "your-email@example.com",
    "password": "your-password"
  }'
```

Save the `access_token` from the response:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "..."
}
```

### Step 3: Make Your First API Call

List quotes:

```bash
export TOKEN="your-access-token"

curl -X GET 'https://your-project.supabase.co/functions/v1/quotes-api' \
  -H "Authorization: Bearer $TOKEN"
```

### Step 4: Create a Quote

```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/quotes-api' \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "Test Customer",
    "customer_email": "customer@example.com",
    "line_items": [
      {
        "description": "T-Shirts",
        "quantity": 100,
        "unit_price": 15.00
      }
    ]
  }'
```

Congratulations! You've made your first API calls.

---

## Language-Specific Examples

### JavaScript/TypeScript

```bash
npm install @supabase/supabase-js
```

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://your-project.supabase.co',
  'YOUR_ANON_KEY'
);

async function main() {
  // 1. Authenticate
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'your-email@example.com',
    password: 'your-password'
  });

  if (authError) throw authError;

  const token = authData.session.access_token;

  // 2. List quotes
  const response = await fetch(
    'https://your-project.supabase.co/functions/v1/quotes-api',
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const { quotes } = await response.json();
  console.log('Quotes:', quotes);

  // 3. Create a quote
  const createResponse = await fetch(
    'https://your-project.supabase.co/functions/v1/quotes-api',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customer_name: 'Test Customer',
        customer_email: 'customer@example.com',
        line_items: [
          {
            description: 'T-Shirts',
            quantity: 100,
            unit_price: 15.00
          }
        ]
      })
    }
  );

  const { quote } = await createResponse.json();
  console.log('Created quote:', quote);
}

main();
```

### Python

```bash
pip install requests
```

```python
import requests
import os

SUPABASE_URL = 'https://your-project.supabase.co'
ANON_KEY = 'YOUR_ANON_KEY'

def authenticate(email, password):
    """Authenticate and get JWT token"""
    response = requests.post(
        f'{SUPABASE_URL}/auth/v1/token?grant_type=password',
        headers={'apikey': ANON_KEY, 'Content-Type': 'application/json'},
        json={'email': email, 'password': password}
    )
    response.raise_for_status()
    return response.json()['access_token']

def list_quotes(token):
    """List all quotes"""
    response = requests.get(
        f'{SUPABASE_URL}/functions/v1/quotes-api',
        headers={
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
    )
    response.raise_for_status()
    return response.json()['quotes']

def create_quote(token, quote_data):
    """Create a new quote"""
    response = requests.post(
        f'{SUPABASE_URL}/functions/v1/quotes-api',
        headers={
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        },
        json=quote_data
    )
    response.raise_for_status()
    return response.json()['quote']

# Main execution
if __name__ == '__main__':
    # Authenticate
    token = authenticate('your-email@example.com', 'your-password')
    print(f'Authenticated successfully')

    # List quotes
    quotes = list_quotes(token)
    print(f'Found {len(quotes)} quotes')

    # Create quote
    new_quote = create_quote(token, {
        'customer_name': 'Test Customer',
        'customer_email': 'customer@example.com',
        'line_items': [
            {
                'description': 'T-Shirts',
                'quantity': 100,
                'unit_price': 15.00
            }
        ]
    })
    print(f'Created quote: {new_quote["quote_number"]}')
```

### Ruby

```bash
gem install httparty
```

```ruby
require 'httparty'
require 'json'

class InkOpsAPI
  include HTTParty
  base_uri 'https://your-project.supabase.co'

  def initialize(anon_key)
    @anon_key = anon_key
    @token = nil
  end

  def authenticate(email, password)
    response = self.class.post(
      '/auth/v1/token?grant_type=password',
      headers: {
        'apikey' => @anon_key,
        'Content-Type' => 'application/json'
      },
      body: { email: email, password: password }.to_json
    )

    @token = response['access_token']
  end

  def list_quotes
    response = self.class.get(
      '/functions/v1/quotes-api',
      headers: auth_headers
    )

    response['quotes']
  end

  def create_quote(quote_data)
    response = self.class.post(
      '/functions/v1/quotes-api',
      headers: auth_headers,
      body: quote_data.to_json
    )

    response['quote']
  end

  private

  def auth_headers
    {
      'Authorization' => "Bearer #{@token}",
      'Content-Type' => 'application/json'
    }
  end
end

# Usage
api = InkOpsAPI.new('YOUR_ANON_KEY')
api.authenticate('your-email@example.com', 'your-password')

quotes = api.list_quotes
puts "Found #{quotes.length} quotes"

new_quote = api.create_quote({
  customer_name: 'Test Customer',
  customer_email: 'customer@example.com',
  line_items: [
    {
      description: 'T-Shirts',
      quantity: 100,
      unit_price: 15.00
    }
  ]
})

puts "Created quote: #{new_quote['quote_number']}"
```

### PHP

```php
<?php

class InkOpsAPI {
    private $baseUrl;
    private $anonKey;
    private $token;

    public function __construct($baseUrl, $anonKey) {
        $this->baseUrl = $baseUrl;
        $this->anonKey = $anonKey;
    }

    public function authenticate($email, $password) {
        $response = $this->request('POST', '/auth/v1/token?grant_type=password', [
            'email' => $email,
            'password' => $password
        ], [
            'apikey' => $this->anonKey
        ]);

        $this->token = $response['access_token'];
        return $this->token;
    }

    public function listQuotes() {
        return $this->request('GET', '/functions/v1/quotes-api');
    }

    public function createQuote($quoteData) {
        return $this->request('POST', '/functions/v1/quotes-api', $quoteData);
    }

    private function request($method, $endpoint, $data = null, $extraHeaders = []) {
        $headers = array_merge([
            'Content-Type: application/json',
        ], $extraHeaders);

        if ($this->token) {
            $headers[] = "Authorization: Bearer {$this->token}";
        }

        $ch = curl_init($this->baseUrl . $endpoint);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        }

        $response = curl_exec($ch);
        curl_close($ch);

        return json_decode($response, true);
    }
}

// Usage
$api = new InkOpsAPI('https://your-project.supabase.co', 'YOUR_ANON_KEY');
$api->authenticate('your-email@example.com', 'your-password');

$quotes = $api->listQuotes();
echo "Found " . count($quotes['quotes']) . " quotes\n";

$newQuote = $api->createQuote([
    'customer_name' => 'Test Customer',
    'customer_email' => 'customer@example.com',
    'line_items' => [
        [
            'description' => 'T-Shirts',
            'quantity' => 100,
            'unit_price' => 15.00
        ]
    ]
]);

echo "Created quote: " . $newQuote['quote']['quote_number'] . "\n";
```

---

## Common Tasks

### Pagination

```javascript
async function getAllQuotes(token) {
  const allQuotes = [];
  let offset = 0;
  const limit = 50;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/quotes-api?limit=${limit}&offset=${offset}`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );

    const { quotes, count } = await response.json();
    allQuotes.push(...quotes);

    offset += limit;
    hasMore = offset < count;
  }

  return allQuotes;
}
```

### Error Handling

```javascript
async function safeAPICall(url, options) {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API request failed');
    }

    return await response.json();
  } catch (error) {
    console.error('API Error:', error.message);
    // Handle specific error codes
    if (error.message.includes('INVALID_JWT')) {
      // Re-authenticate
    } else if (error.message.includes('RATE_LIMIT_EXCEEDED')) {
      // Wait and retry
    }
    throw error;
  }
}
```

### Token Refresh

```javascript
class InkOpsClient {
  constructor(supabaseUrl, anonKey) {
    this.supabase = createClient(supabaseUrl, anonKey);
    this.token = null;
  }

  async ensureAuthenticated() {
    const { data: { session } } = await this.supabase.auth.getSession();

    if (!session) {
      throw new Error('Not authenticated');
    }

    // Check if token is about to expire (within 5 minutes)
    const expiresAt = session.expires_at * 1000;
    const now = Date.now();

    if (expiresAt - now < 5 * 60 * 1000) {
      // Refresh token
      const { data: { session: newSession } } = await this.supabase.auth.refreshSession();
      this.token = newSession.access_token;
    } else {
      this.token = session.access_token;
    }

    return this.token;
  }

  async request(endpoint, options = {}) {
    const token = await this.ensureAuthenticated();

    return fetch(`${this.supabase.supabaseUrl}/functions/v1${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
  }
}
```

---

## Testing with Postman

### Import Collection

1. Download [postman_collection.json](../postman_collection.json)
2. Open Postman
3. Click "Import" → Select file
4. Collection appears in sidebar

### Set Environment Variables

1. Click "Environments" → "Create Environment"
2. Add variables:
   - `base_url`: `https://your-project.supabase.co/functions/v1`
   - `anon_key`: Your Supabase anon key
   - `email`: Your login email
   - `password`: Your password
   - `jwt_token`: (leave empty, will be set automatically)

### Run Authentication Request

1. Select "Authenticate" request
2. Click "Send"
3. JWT token will be automatically saved to environment

### Test Other Endpoints

All other requests will automatically use the saved JWT token.

---

## Next Steps

1. **Explore the API**: Check out [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for all available endpoints
2. **Generate SDK**: Use [API_TOOLS_SETUP.md](./API_TOOLS_SETUP.md) to generate client libraries
3. **Read Best Practices**: Review error handling, rate limits, and pagination strategies
4. **Join Community**: Get help from other developers

## Support

- **Documentation**: [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
- **Issues**: Create an issue in the repository
- **Email**: api-support@inkops.com

## Resources

- [Full API Reference](./API_DOCUMENTATION.md)
- [OpenAPI Specification](../../openapi.yaml)
- [Changelog](./API_CHANGELOG.md)
- [Tools Setup Guide](./API_TOOLS_SETUP.md)
