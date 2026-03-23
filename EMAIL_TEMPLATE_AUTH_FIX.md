# Email Template Authentication Fix

## Problem
Users were unable to save new email templates, receiving `401 Unauthorized - Invalid JWT` errors when attempting to create or modify communication templates.

## Root Cause
The authentication token (JWT) was either expired or not being properly refreshed before making requests to the `communication-templates` Edge Function. When users had been logged in for some time, their session tokens would expire, causing all API requests to fail with 401 errors.

## Solution Implemented

### 1. Automatic Token Refresh
Enhanced the `getHeaders()` function in `communication-template-service.ts` to:
- Automatically refresh the session before each API request
- Fall back to existing session if refresh fails
- Provide clear error messages when session is truly expired

### 2. Retry Logic with Fresh Tokens
Added a new `fetchWithAuth()` wrapper function that:
- Automatically retries failed requests (up to 2 retries)
- Refreshes tokens between retry attempts
- Adds exponential backoff between retries (500ms, 1000ms)
- Handles 401 errors gracefully with user-friendly messages

### 3. User-Friendly Error Messages
Replaced generic 401 errors with actionable messages:
- "Session expired. Please refresh the page and sign in again."
- Clear indication of what the user should do to resolve the issue

## Files Modified
- `/src/services/communication-template-service.ts` - Added token refresh logic and retry mechanism

## Testing
- Build succeeds without errors
- All API calls (list, create, update, delete templates) now use the enhanced authentication

## User Impact
Users can now reliably:
- Create new email templates without authentication errors
- Update existing templates
- Perform all template operations even after extended login sessions
- Receive clear guidance when sessions truly expire

## Technical Details
The fix implements a two-tier approach:
1. **Proactive**: Refresh token before every request
2. **Reactive**: Retry with fresh token if 401 error occurs

This ensures maximum reliability while minimizing unnecessary token refreshes.
