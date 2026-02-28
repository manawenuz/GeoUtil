# Edge Runtime Compatibility Fix

## Problem

The application was failing to start with the error:
```
The edge runtime does not support Node.js 'crypto' module.
```

This occurred because the middleware was trying to initialize the app, which uses Node.js-only modules like:
- `pg` (PostgreSQL client)
- `better-sqlite3` (SQLite client)
- `fs` (file system)
- `crypto` (encryption)

Next.js middleware runs in the Edge Runtime, which is a lightweight environment that doesn't support these Node.js modules.

## Solution

### 1. Simplified Middleware
Removed all initialization logic from `middleware.ts`. Middleware now only handles routing and stays Edge Runtime compatible.

### 2. Created `lib/ensure-init.ts`
A new helper module that ensures the app is initialized before handling requests. This is safe to use in:
- API routes (Node.js runtime)
- Server components
- Server actions

But NOT in:
- Middleware (Edge runtime)
- Client components

### 3. Added Initialization to Entry Points
Added `await ensureInitialized()` calls to:
- `app/page.tsx` - Main page (server component)
- `app/api/health/route.ts` - Health check endpoint
- Other API routes should also add this call

### 4. Webpack Configuration
Updated `next.config.js` to properly handle the optional `pg-native` dependency that was causing warnings.

## Usage

For any new API route, add initialization at the start:

```typescript
import { ensureInitialized } from "@/lib/ensure-init";

export async function GET(request: NextRequest) {
  await ensureInitialized();
  
  // Your route logic here
}
```

For server components:

```typescript
import { ensureInitialized } from "@/lib/ensure-init";

export default async function MyPage() {
  await ensureInitialized();
  
  return (
    // Your component JSX
  );
}
```

## Benefits

- Middleware stays lightweight and Edge Runtime compatible
- Initialization happens lazily on first request
- Idempotent - safe to call multiple times
- Works in both development and production
- Compatible with Vercel and other serverless platforms
