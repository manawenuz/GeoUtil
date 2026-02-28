# Session Management

This document describes the session management implementation for the Georgia Utility Monitor application.

## Overview

The application uses NextAuth.js for session management with JWT-based sessions. Session security is implemented according to Requirement 14.5 with the following features:

- 30-day session expiration
- Automatic session renewal on activity
- HTTP-only cookies for XSS protection
- Secure cookies in production (HTTPS-only)
- SameSite protection for CSRF prevention
- Built-in CSRF token handling

## Configuration

Session management is configured in `lib/auth.ts`:

```typescript
session: {
  strategy: "jwt",
  maxAge: 30 * 24 * 60 * 60, // 30 days
  updateAge: 24 * 60 * 60,   // Refresh every 24 hours of activity
}
```

### Session Duration

- **maxAge**: 30 days (2,592,000 seconds)
  - Sessions expire after 30 days of inactivity
  - Meets Requirement 14.5 for 30-day session expiration

- **updateAge**: 24 hours (86,400 seconds)
  - Session is automatically renewed every 24 hours when the user is active
  - Prevents active users from being logged out
  - Reduces database/token refresh overhead

## Cookie Security

All cookies are configured with security best practices:

### Session Token Cookie

```typescript
sessionToken: {
  name: 'next-auth.session-token',
  options: {
    httpOnly: true,  // Prevents JavaScript access (XSS protection)
    sameSite: 'lax', // CSRF protection while allowing normal navigation
    path: '/',
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
  }
}
```

### CSRF Token Cookie

NextAuth automatically handles CSRF protection using a separate cookie:

```typescript
csrfToken: {
  name: 'next-auth.csrf-token',
  options: {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  }
}
```

### Callback URL Cookie

Used during OAuth flow to remember the return URL:

```typescript
callbackUrl: {
  name: 'next-auth.callback-url',
  options: {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  }
}
```

## Security Features

### HTTP-Only Cookies

All cookies have `httpOnly: true`, which:
- Prevents JavaScript access to cookies
- Protects against XSS (Cross-Site Scripting) attacks
- Ensures cookies can only be transmitted via HTTP(S)

### Secure Flag

The `secure` flag is environment-dependent:
- **Production**: `true` - cookies only sent over HTTPS
- **Development**: `false` - allows HTTP for local development

This meets Requirement 14.11 for HTTPS communication in production.

### SameSite Protection

All cookies use `sameSite: 'lax'`, which:
- Prevents CSRF (Cross-Site Request Forgery) attacks
- Allows cookies on normal navigation (GET requests)
- Blocks cookies on cross-site POST requests
- Meets Requirement 14.12 for CSRF protection

### CSRF Token

NextAuth provides built-in CSRF protection:
- Separate CSRF token cookie is automatically created
- Token is validated on all state-changing operations
- No additional configuration required

## Session Renewal

Sessions are automatically renewed when:
1. User makes a request after 24 hours of activity
2. Session has not expired (within 30-day window)
3. NextAuth refreshes the JWT token automatically

This ensures:
- Active users stay logged in
- Inactive sessions expire after 30 days
- Minimal overhead from constant token refreshes

## Testing

Session management is tested in `lib/auth.test.ts`:

```bash
npm test -- lib/auth.test.ts
```

Tests verify:
- 30-day session expiration
- 24-hour automatic renewal
- HTTP-only cookie configuration
- SameSite policy
- CSRF token cookie configuration
- Callback URL cookie configuration
- Environment-specific secure flag

## Usage in Protected Routes

Protected API routes use `getServerSession` to verify sessions:

```typescript
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }
  
  // Handle authenticated request
  const userId = session.user.id;
  // ...
}
```

## Environment Variables

No additional environment variables are required for session management. The configuration uses:

- `NODE_ENV` - Determines secure cookie flag
- `GOOGLE_CLIENT_ID` - OAuth provider configuration
- `GOOGLE_CLIENT_SECRET` - OAuth provider configuration

## Requirements Validation

This implementation satisfies:

- **Requirement 14.5**: 30-day session expiration with HTTP-only cookies
- **Requirement 14.11**: HTTPS communication (secure cookies in production)
- **Requirement 14.12**: CSRF protection (SameSite + CSRF tokens)

## Future Enhancements

When Task 14.2 (database adapter) is implemented:
- Session strategy will change from "jwt" to "database"
- Sessions will be stored in the configured backend (Redis/Postgres/SQLite)
- Cookie configuration will remain the same
- Session renewal behavior will be preserved
