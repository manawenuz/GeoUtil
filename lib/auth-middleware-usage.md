# Authentication Middleware Usage Guide

This document explains how to use the authentication middleware for protecting API routes in the Georgia Utility Monitor application.

## Overview

The authentication middleware provides several utilities for protecting API routes and validating user sessions:

- `withAuth()` - Higher-order function for wrapping API route handlers
- `getSession()` - Get the current session (returns null if not authenticated)
- `requireAuth()` - Get session or throw error if not authenticated
- `getUserId()` - Get authenticated user ID or throw error
- `validateSession()` - Validate session and return user ID with detailed error messages
- `AuthenticationError` - Custom error class for authentication failures

## Using `withAuth()` Middleware (Recommended)

The `withAuth()` function is the recommended way to protect API routes. It automatically handles session validation and error responses.

### Basic Usage

```typescript
// app/api/accounts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-helpers";

export const GET = withAuth(async (request: NextRequest, session) => {
  // Session is guaranteed to be valid here
  const userId = session.user.id;
  
  // Your protected route logic
  const accounts = await getAccountsForUser(userId);
  
  return NextResponse.json({ accounts });
});

export const POST = withAuth(async (request: NextRequest, session) => {
  const userId = session.user.id;
  const body = await request.json();
  
  // Create account for authenticated user
  const account = await createAccount(userId, body);
  
  return NextResponse.json({ account }, { status: 201 });
});
```

### Error Handling

The `withAuth()` middleware automatically handles errors:

- **401 Unauthorized**: When session is missing or invalid
- **500 Internal Server Error**: When handler throws unexpected errors

```typescript
export const GET = withAuth(async (request: NextRequest, session) => {
  // If you throw an AuthenticationError, it returns 401
  if (!hasPermission(session.user.id)) {
    throw new AuthenticationError("Insufficient permissions");
  }
  
  // Other errors return 500
  const data = await fetchData(); // If this throws, returns 500
  
  return NextResponse.json({ data });
});
```

## Using Helper Functions

### `getSession()`

Use when you need to check authentication but want to handle the response yourself:

```typescript
import { getSession } from "@/lib/auth-helpers";

export async function GET(request: NextRequest) {
  const session = await getSession();
  
  if (!session) {
    return NextResponse.json(
      { error: "Please sign in" },
      { status: 401 }
    );
  }
  
  // Continue with authenticated logic
  return NextResponse.json({ userId: session.user.id });
}
```

### `requireAuth()`

Use when you want to throw an error if not authenticated:

```typescript
import { requireAuth } from "@/lib/auth-helpers";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = session.user.id;
    
    // Your logic here
    return NextResponse.json({ userId });
  } catch (error) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }
}
```

### `getUserId()`

Shorthand for getting the authenticated user ID:

```typescript
import { getUserId } from "@/lib/auth-helpers";

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId();
    
    // Your logic here
    return NextResponse.json({ userId });
  } catch (error) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }
}
```

### `validateSession()`

Use when you need detailed validation with specific error messages:

```typescript
import { validateSession, AuthenticationError } from "@/lib/auth-helpers";

export async function GET(request: NextRequest) {
  try {
    const userId = await validateSession();
    
    // Session is valid, userId is guaranteed
    return NextResponse.json({ userId });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
```

## Response Formats

### Successful Response

When authentication succeeds, your handler returns the response:

```json
{
  "data": "your response data"
}
```

### Unauthorized Response (401)

When session is missing or invalid:

```json
{
  "error": "Unauthorized",
  "message": "Authentication required. Please sign in."
}
```

When session is missing required fields:

```json
{
  "error": "Invalid Session",
  "message": "Session is missing required user information."
}
```

### Internal Server Error (500)

When handler throws unexpected errors:

```json
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred."
}
```

## Best Practices

1. **Use `withAuth()` for most cases**: It provides the cleanest API and handles errors automatically.

2. **Access user info from session**: The session object contains:
   - `session.user.id` - User ID (guaranteed to exist)
   - `session.user.email` - User email (guaranteed to exist)
   - `session.user.name` - User name (optional)
   - `session.user.image` - Profile picture URL (optional)

3. **Throw `AuthenticationError` for auth-related errors**: This ensures consistent error responses.

4. **Don't catch errors inside `withAuth()` handlers**: Let the middleware handle them for consistent error responses.

5. **Use `validateSession()` when you need detailed error messages**: It provides more specific error messages than `requireAuth()`.

## Example: Complete Protected API Route

```typescript
// app/api/accounts/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withAuth, AuthenticationError } from "@/lib/auth-helpers";
import { getAccount, updateAccount, deleteAccount } from "@/lib/storage";

export const GET = withAuth(async (request: NextRequest, session) => {
  const accountId = request.nextUrl.pathname.split("/").pop();
  
  if (!accountId) {
    return NextResponse.json(
      { error: "Account ID required" },
      { status: 400 }
    );
  }
  
  const account = await getAccount(accountId);
  
  if (!account) {
    return NextResponse.json(
      { error: "Account not found" },
      { status: 404 }
    );
  }
  
  // Verify ownership
  if (account.userId !== session.user.id) {
    throw new AuthenticationError("Access denied");
  }
  
  return NextResponse.json({ account });
});

export const PUT = withAuth(async (request: NextRequest, session) => {
  const accountId = request.nextUrl.pathname.split("/").pop();
  const body = await request.json();
  
  if (!accountId) {
    return NextResponse.json(
      { error: "Account ID required" },
      { status: 400 }
    );
  }
  
  const account = await getAccount(accountId);
  
  if (!account) {
    return NextResponse.json(
      { error: "Account not found" },
      { status: 404 }
    );
  }
  
  // Verify ownership
  if (account.userId !== session.user.id) {
    throw new AuthenticationError("Access denied");
  }
  
  const updatedAccount = await updateAccount(accountId, body);
  
  return NextResponse.json({ account: updatedAccount });
});

export const DELETE = withAuth(async (request: NextRequest, session) => {
  const accountId = request.nextUrl.pathname.split("/").pop();
  
  if (!accountId) {
    return NextResponse.json(
      { error: "Account ID required" },
      { status: 400 }
    );
  }
  
  const account = await getAccount(accountId);
  
  if (!account) {
    return NextResponse.json(
      { error: "Account not found" },
      { status: 404 }
    );
  }
  
  // Verify ownership
  if (account.userId !== session.user.id) {
    throw new AuthenticationError("Access denied");
  }
  
  await deleteAccount(accountId);
  
  return NextResponse.json({ success: true });
});
```

## Testing Protected Routes

When testing protected routes, mock the session:

```typescript
import { getServerSession } from "next-auth";

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

describe("Protected API Route", () => {
  it("should return data for authenticated user", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: {
        id: "user-123",
        email: "test@example.com",
      },
      expires: "2024-12-31",
    });
    
    // Test your route
  });
  
  it("should return 401 for unauthenticated user", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    
    // Test your route
  });
});
```

## Security Considerations

1. **Session validation**: The middleware validates that sessions contain required fields (id, email).

2. **Error messages**: Error messages are generic to avoid leaking information about the system.

3. **HTTPS only**: In production, session cookies are marked as secure (HTTPS only).

4. **HTTP-only cookies**: Session cookies are HTTP-only to prevent XSS attacks.

5. **SameSite protection**: Cookies use SameSite=lax to prevent CSRF attacks.

## Migration from Old Pattern

If you have existing routes using the old pattern:

```typescript
// Old pattern
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // ...
}
```

Migrate to:

```typescript
// New pattern
export const GET = withAuth(async (request: NextRequest, session) => {
  // Session is guaranteed to be valid
  // ...
});
```

This provides:
- Cleaner code
- Consistent error handling
- Better type safety
- Automatic session validation
