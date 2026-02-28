# OAuth Database Schema

This document describes the database schema changes for OAuth authentication support in the Georgia Utility Monitor application.

## Overview

The application uses NextAuth.js with Google OAuth 2.0 for authentication. The database schema has been updated to support:

1. **User OAuth fields**: Email, name, profile picture, and email verification status
2. **OAuth accounts**: Links between users and their OAuth provider accounts
3. **Sessions**: Database-backed session management
4. **Verification tokens**: Email verification and password reset tokens

## Schema Changes

### Users Table

The `users` table has been updated with OAuth-specific fields:

**New Fields:**
- `email` (VARCHAR/TEXT, NOT NULL, UNIQUE): User's email address from OAuth provider
- `name` (VARCHAR/TEXT, NOT NULL): User's display name from OAuth provider
- `image` (TEXT, NULLABLE): Profile picture URL from OAuth provider
- `email_verified` (TIMESTAMP/TEXT, NULLABLE): Timestamp when email was verified by OAuth provider

**Existing Fields:**
- `user_id`: Primary key (UUID/TEXT)
- `created_at`: Account creation timestamp
- `updated_at`: Last update timestamp
- `ntfy_feed_url`: Encrypted notification feed URL (defaults to empty string)
- `ntfy_server_url`: ntfy.sh server URL (defaults to 'https://ntfy.sh')
- `notification_enabled`: Whether notifications are enabled (defaults to true)

### OAuth Accounts Table (auth_accounts)

Stores OAuth provider account information linked to users.

**Fields:**
- `id`: Primary key (UUID/TEXT)
- `user_id`: Foreign key to users table (CASCADE DELETE)
- `type`: Account type (e.g., 'oauth')
- `provider`: OAuth provider name (e.g., 'google')
- `provider_account_id`: Provider's user ID
- `refresh_token`: OAuth refresh token (optional, encrypted)
- `access_token`: OAuth access token (optional, encrypted)
- `expires_at`: Token expiration timestamp (optional)
- `token_type`: Token type (e.g., 'Bearer')
- `scope`: OAuth scopes granted
- `id_token`: OpenID Connect ID token (optional)
- `session_state`: OAuth session state (optional)

**Constraints:**
- UNIQUE(provider, provider_account_id): One account per provider per user

**Indexes:**
- `idx_auth_accounts_user_id`: Fast lookup by user

### OAuth Sessions Table (auth_sessions)

Stores active user sessions for database-backed session management.

**Fields:**
- `id`: Primary key (UUID/TEXT)
- `session_token`: Unique session token (UNIQUE)
- `user_id`: Foreign key to users table (CASCADE DELETE)
- `expires`: Session expiration timestamp

**Indexes:**
- `idx_auth_sessions_user_id`: Fast lookup by user
- `idx_auth_sessions_expires`: Fast cleanup of expired sessions

**Notes:**
- Sessions expire after 30 days by default
- Expired sessions are automatically cleaned up
- Redis implementation uses TTL for automatic expiration

### OAuth Verification Tokens Table (auth_verification_tokens)

Stores one-time verification tokens for email verification and password reset.

**Fields:**
- `identifier`: Email or other identifier
- `token`: Verification token
- `expires`: Token expiration timestamp

**Constraints:**
- PRIMARY KEY(identifier, token): Composite key

**Indexes:**
- `idx_auth_verification_tokens_expires`: Fast cleanup of expired tokens

**Notes:**
- Tokens are single-use and deleted after consumption
- Tokens typically expire after 24 hours
- Redis implementation uses TTL for automatic expiration

## Backend-Specific Implementation

### PostgreSQL

**Data Types:**
- UUIDs: `UUID` with `gen_random_uuid()` default
- Timestamps: `TIMESTAMP` with `NOW()` default
- Booleans: `BOOLEAN`
- Text: `VARCHAR(n)` for limited strings, `TEXT` for unlimited

**Features:**
- Foreign key constraints with CASCADE DELETE
- Indexes for performance
- Transaction support for atomic operations

**Migration File:** `migrations/postgres/001_initial_schema.sql`

### SQLite

**Data Types:**
- UUIDs: `TEXT` (generated in application code)
- Timestamps: `TEXT` (ISO 8601 format)
- Booleans: `INTEGER` (0 = false, 1 = true)
- Text: `TEXT` for all string types

**Features:**
- Foreign key constraints (must be enabled with `PRAGMA foreign_keys = ON`)
- Indexes for performance
- Transaction support for atomic operations

**Migration File:** `migrations/sqlite/001_initial_schema.sql`

### Redis

**Data Structures:**

**Users:**
```
user:{userId} → Hash {
  userId, email, name, image, emailVerified,
  createdAt, updatedAt, ntfyFeedUrl, ntfyServerUrl, notificationEnabled
}
```

**OAuth Accounts:**
```
account:{provider}:{providerAccountId} → Hash {
  id, userId, type, provider, providerAccountId,
  refresh_token, access_token, expires_at, token_type, scope, id_token, session_state
}

user:{userId}:linked_accounts → Set {account keys}
```

**Sessions:**
```
session:{sessionToken} → Hash {
  id, sessionToken, userId, expires
}
TTL: Set to match expiration time

user:{userId}:sessions → Set {session tokens}
```

**Verification Tokens:**
```
verification:{identifier}:{token} → Hash {
  identifier, token, expires
}
TTL: Set to match expiration time
```

**Features:**
- No schema enforcement (schemaless)
- TTL for automatic expiration
- Set-based indexing for relationships
- No foreign key constraints (enforced in application code)

**Migration File:** `migrations/redis/001_initial_keys.md` (documentation only)

## Data Flow

### User Registration (First Sign-In)

1. User clicks "Sign in with Google"
2. NextAuth redirects to Google OAuth
3. User approves consent screen
4. Google returns OAuth tokens and user info
5. NextAuth calls `createUser()` with OAuth data
6. Storage adapter creates user record with:
   - Email, name, image from Google
   - emailVerified from Google
   - Default notification settings
7. NextAuth calls `linkAccount()` to store OAuth tokens
8. NextAuth calls `createSession()` to create session
9. User is redirected to dashboard

### Subsequent Sign-Ins

1. User clicks "Sign in with Google"
2. NextAuth redirects to Google OAuth
3. Google returns OAuth tokens
4. NextAuth calls `getUserByAccount()` to find existing user
5. NextAuth updates OAuth tokens via `linkAccount()`
6. NextAuth calls `createSession()` to create new session
7. User is redirected to dashboard

### Session Validation

1. User makes authenticated request
2. NextAuth reads session cookie
3. NextAuth calls `getSessionAndUser()` with session token
4. Storage adapter:
   - Checks if session exists
   - Checks if session is expired
   - Returns session and user data
5. NextAuth validates and returns user info

### Sign-Out

1. User clicks "Sign out"
2. NextAuth calls `deleteSession()` with session token
3. Storage adapter deletes session record
4. NextAuth clears session cookie
5. User is redirected to sign-in page

## Security Considerations

### Encryption

**Encrypted Fields:**
- `ntfy_feed_url`: User's notification feed URL
- OAuth tokens (access_token, refresh_token, id_token) should be encrypted at rest

**Encryption Method:**
- AES-256-GCM with unique IV per value
- Encryption key stored in environment variable `ENCRYPTION_KEY`

### Session Security

**Cookie Configuration:**
- HTTP-only: true (prevents JavaScript access)
- Secure: true (HTTPS only)
- SameSite: lax (CSRF protection)
- Path: / (application-wide)
- Max-Age: 30 days

**Session Expiration:**
- Sessions expire after 30 days of inactivity
- Expired sessions are automatically cleaned up
- Session renewal on activity (sliding expiration)

### Token Security

**OAuth Tokens:**
- Stored encrypted in database
- Never logged in plain text
- Automatically refreshed when expired
- Revoked on sign-out

**Verification Tokens:**
- Single-use (deleted after consumption)
- Short expiration (24 hours)
- Cryptographically random
- Rate-limited to prevent brute force

## Migration Guide

### Running Migrations

See [migrations/README.md](../migrations/README.md) for detailed instructions.

**Quick Start:**

```bash
# PostgreSQL
STORAGE_BACKEND=postgres DATABASE_URL=postgresql://... npm run migrate

# SQLite
STORAGE_BACKEND=sqlite SQLITE_DB_PATH=./data/app.db npm run migrate

# Redis
STORAGE_BACKEND=redis REDIS_URL=https://... REDIS_TOKEN=... npm run migrate
```

### Migrating Existing Users

If you have existing users without OAuth fields, you'll need to:

1. **Backup your database** before migration
2. Run the migration to add new columns
3. Update existing user records:
   - Set `email` to a placeholder or prompt users to link OAuth
   - Set `name` to existing username or default value
   - Set `email_verified` to NULL (users will verify on next sign-in)
4. Prompt users to sign in with Google to link their accounts

**Example SQL (PostgreSQL):**
```sql
-- Update existing users with placeholder values
UPDATE users 
SET 
  email = COALESCE(email, user_id || '@placeholder.local'),
  name = COALESCE(name, 'User'),
  email_verified = NULL
WHERE email IS NULL;
```

## Testing

### Unit Tests

The auth adapter has comprehensive unit tests in `lib/auth-adapter.test.ts`:
- User creation with OAuth fields
- Account linking/unlinking
- Session management
- Verification token handling

Run tests:
```bash
npm test -- lib/auth-adapter.test.ts
```

### Integration Tests

Test the full OAuth flow:
1. Start the application
2. Click "Sign in with Google"
3. Complete OAuth flow
4. Verify user record created with OAuth fields
5. Verify session created
6. Sign out and verify session deleted

### Database Verification

**PostgreSQL:**
```sql
-- Check users table structure
\d users

-- Check OAuth tables
\d auth_accounts
\d auth_sessions
\d auth_verification_tokens

-- Verify data
SELECT user_id, email, name, email_verified FROM users;
```

**SQLite:**
```sql
-- Check users table structure
.schema users

-- Check OAuth tables
.schema auth_accounts
.schema auth_sessions
.schema auth_verification_tokens

-- Verify data
SELECT user_id, email, name, email_verified FROM users;
```

**Redis:**
```bash
# Check user data
redis-cli HGETALL user:{userId}

# Check OAuth account
redis-cli HGETALL account:google:{providerAccountId}

# Check session
redis-cli HGETALL session:{sessionToken}

# Check migrations
redis-cli SMEMBERS migrations
```

## Troubleshooting

### "Column does not exist" errors

**Cause:** Migration not applied or partially applied

**Solution:**
1. Check migration status: `npm run migrate`
2. Verify database schema matches migration
3. Re-run migration if needed

### "Unique constraint violation" on email

**Cause:** Duplicate email addresses in users table

**Solution:**
1. Identify duplicate emails: `SELECT email, COUNT(*) FROM users GROUP BY email HAVING COUNT(*) > 1`
2. Merge or delete duplicate accounts
3. Ensure email uniqueness before re-running migration

### Sessions not persisting

**Cause:** Session table not created or Redis TTL too short

**Solution:**
1. Verify session table exists
2. Check session expiration time (should be 30 days)
3. Verify Redis TTL is set correctly
4. Check NextAuth configuration

### OAuth tokens not refreshing

**Cause:** Refresh token not stored or expired

**Solution:**
1. Verify `refresh_token` is stored in `auth_accounts`
2. Check token expiration time
3. Verify OAuth provider configuration
4. Re-authenticate user to get new tokens

## References

- [NextAuth.js Documentation](https://next-auth.js.org/)
- [NextAuth.js Adapter API](https://next-auth.js.org/tutorials/creating-a-database-adapter)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [OpenID Connect](https://openid.net/connect/)
- [Requirements Document](../requirements.md) - Requirements 14.1-14.13
- [Design Document](../design.md) - Authentication Architecture section
