# Email Template Authentication Fix

## Problem
Users were unable to save new email templates, receiving `401 Unauthorized - Invalid JWT` errors when attempting to create or modify communication templates.

## Root Cause
The authentication token (JWT) was expiring during the user session, and the service wasn't properly detecting expiration or refreshing the token before making requests to the `communication-templates` Edge Function.

## Solution Implemented

### 1. Smart Token Expiration Detection
Enhanced the `getHeaders()` function in `communication-template-service.ts` to:
- Check token expiration time before each API request
- Automatically refresh tokens that are expired or expiring within 60 seconds
- Use fresh tokens from the refresh operation
- Provide clear, actionable error messages when sessions are truly expired

### 2. Retry Logic with Automatic Token Refresh
Added a new `fetchWithAuth()` wrapper function that:
- Automatically retries failed requests (up to 2 retries)
- Waits before retrying with exponential backoff (500ms, 1000ms)
- Gets fresh authentication headers on each retry attempt
- Handles 401 errors gracefully with user-friendly messages

### 3. User-Friendly Error Messages
Replaced cryptic "Invalid JWT" errors with clear, actionable messages:
- "Session expired. Please refresh the page and sign in again."
- "No active session. Please sign in again."
- "Authentication error. Please refresh the page and sign in again."

## Files Modified
- `/src/services/communication-template-service.ts` - Added token expiration detection, automatic refresh, and retry mechanism

## How It Works

**Token Lifecycle Management:**
1. Before each API call, check if the token is expired or expiring soon (within 60 seconds)
2. If expired/expiring: automatically refresh the session and use the new token
3. If fresh: use the existing token
4. If refresh fails: show clear error message asking user to sign in again

**Retry Mechanism:**
1. If an API call returns 401, automatically retry (up to 2 additional attempts)
2. Each retry gets fresh authentication headers (which may trigger token refresh)
3. Wait between retries with exponential backoff
4. After all retries fail, show user-friendly error message

## Testing
- Build succeeds without errors
- All API calls (list, create, update, delete templates) now use the enhanced authentication
- Token expiration is detected and handled automatically
- Retry logic prevents transient failures from blocking users

## User Impact
Users can now reliably:
- Create new email templates without authentication errors
- Update existing templates
- Perform all template operations even after extended login sessions
- Get clear guidance when they need to sign in again

## Technical Details
The fix implements a three-layer defense:
1. **Proactive Prevention**: Check expiration and refresh before it becomes a problem (60-second buffer)
2. **Reactive Recovery**: Retry with fresh token if 401 error occurs
3. **Clear Communication**: User-friendly error messages when all recovery attempts fail

This ensures maximum reliability while providing excellent user experience.
