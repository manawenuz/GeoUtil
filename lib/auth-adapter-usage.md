# NextAuth Storage Adapter Usage

This document explains how to use the NextAuth storage adapter with the Georgia Utility Monitor.

## Overview

The `createNextAuthAdapter` function in `lib/auth-adapter.ts` creates a NextAuth adapter that works with our `StorageAdapter` interface, enabling database-backed sessions across all storage backends (Redis, Postgres, SQLite).

## Prerequisites

**IMPORTANT**: Before using this adapter, you must complete Task 14.3 to update the database schema with OAuth-specific tables and columns.

### Required Schema Changes

#### Users Table Updates
The `users` table needs these additional columns:
- `email` (TEXT/VARCHAR, NOT NULL, UNIQUE)
- `name` (TEXT/VARCHAR, NOT NULL)
- `image` (TEXT/VARCHAR, NULLABLE)
- `email_verified` (TIMESTAMP, NULLABLE)

#### New Tables Required

1. **auth_accounts** - OAuth account linkage
   - `id` (UUID/TEXT, PRIMARY KEY)
   - `user_id` (UUID/TEXT, FOREIGN KEY to users)
   - `type` (TEXT/VARCHAR) - "oauth"
   - `provider` (TEXT/VARCHAR) - "google"
   - `provider_account_id` (TEXT/VARCHAR) - Google user ID
   - `refresh_token` (TEXT, NULLABLE)
   - `access_token` (TEXT, NULLABLE)
   - `expires_at` (INTEGER/BIGINT, NULLABLE)
   - `token_type` (TEXT/VARCHAR, NULLABLE)
   - `scope` (TEXT, NULLABLE)
   - `id_token` (TEXT, NULLABLE)
   - `session_state` (TEXT, NULLABLE)

2. **auth_sessions** - Session storage
   - `id` (UUID/TEXT, PRIMARY KEY)
   - `session_token` (TEXT/VARCHAR, UNIQUE, NOT NULL)
   - `user_id` (UUID/TEXT, FOREIGN KEY to users)
   - `expires` (TIMESTAMP, NOT NULL)

3. **auth_verification_tokens** - Email verification tokens
   - `identifier` (TEXT/VARCHAR, NOT NULL)
   - `token` (TEXT/VARCHAR, NOT NULL)
   - `expires` (TIMESTAMP, NOT NULL)
   - PRIMARY KEY (identifier, token)

## Usage Example

Once Task 14.3 is complete, update `lib/auth.ts` as follows:

```typescript
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { createNextAuthAdapter } from "./auth-adapter";
import { getStorageAdapter } from "./storage-factory"; // You'll need to create this

// Get the storage adapter based on environment configuration
const storage = getStorageAdapter();

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  adapter: createNextAuthAdapter(storage),
  session: {
    strategy: "database", // Changed from "jwt"
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async session({ session, user }) {
      // Add user ID to session
      session.user.id = user.id;
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
};
```

## Storage Backend Support

The adapter works with all three storage backends:

### Redis
- Uses hash keys for users, accounts, and sessions
- Session tokens have automatic expiration via Redis TTL
- Verification tokens have automatic expiration via Redis TTL

### Postgres
- Uses standard SQL tables with foreign key constraints
- Session expiration checked via SQL queries
- Verification tokens deleted after use

### SQLite
- Uses standard SQL tables (similar to Postgres)
- Session expiration checked via SQL queries
- Verification tokens deleted after use

## Type Safety

The adapter extends the base `StorageAdapter` interface with `AuthStorageAdapter`, which includes all NextAuth-specific methods. Each storage adapter implementation (Redis, Postgres, SQLite) now implements these additional methods.

## Security Considerations

1. **OAuth Tokens**: Access tokens, refresh tokens, and ID tokens are stored in the database. Ensure your database is properly secured.

2. **Session Tokens**: Session tokens are stored as HTTP-only cookies and in the database. The database lookup happens on every authenticated request.

3. **Verification Tokens**: These are one-time use tokens that are deleted after consumption.

4. **Email Verification**: The `emailVerified` field tracks when a user's email was verified via OAuth.

## Testing

After implementing Task 14.3, you should test:

1. User creation on first Google sign-in
2. Session creation and retrieval
3. Session expiration (after 30 days)
4. Account linking (Google OAuth account to user)
5. Sign-out (session deletion)

## Next Steps

1. Complete Task 14.3: Update database schema for OAuth
2. Create storage adapter factory to instantiate the correct adapter
3. Update `lib/auth.ts` to use the database adapter
4. Test the authentication flow end-to-end
