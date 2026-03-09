# Authentication System Documentation

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
