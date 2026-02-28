# Redis Initial Schema - Migration 001

## Overview
This migration documents the Redis key patterns used for the Georgia Utility Monitor application with OAuth support.

## Key Patterns

### User Data
- `user:{userId}` → Hash containing:
  - `userId`: UUID
  - `email`: User email address
  - `name`: User display name
  - `image`: Profile picture URL (optional)
  - `emailVerified`: ISO 8601 timestamp or empty string
  - `createdAt`: ISO 8601 timestamp
  - `updatedAt`: ISO 8601 timestamp
  - `ntfyFeedUrl`: Encrypted notification feed URL
  - `ntfyServerUrl`: ntfy.sh server URL
  - `notificationEnabled`: '1' or '0'

### OAuth Accounts (NextAuth)
- `account:{provider}:{providerAccountId}` → Hash containing:
  - `id`: UUID
  - `userId`: User ID reference
  - `type`: Account type (e.g., 'oauth')
  - `provider`: OAuth provider name (e.g., 'google')
  - `providerAccountId`: Provider's user ID
  - `refresh_token`: OAuth refresh token (optional)
  - `access_token`: OAuth access token (optional)
  - `expires_at`: Token expiration timestamp (optional)
  - `token_type`: Token type (optional)
  - `scope`: OAuth scopes (optional)
  - `id_token`: OpenID Connect ID token (optional)
  - `session_state`: Session state (optional)

- `user:{userId}:linked_accounts` → Set of account keys

### OAuth Sessions (NextAuth)
- `session:{sessionToken}` → Hash containing:
  - `id`: UUID
  - `sessionToken`: Unique session token
  - `userId`: User ID reference
  - `expires`: ISO 8601 timestamp
  - TTL set to match expiration time

- `user:{userId}:sessions` → Set of session tokens

### OAuth Verification Tokens (NextAuth)
- `verification:{identifier}:{token}` → Hash containing:
  - `identifier`: Email or other identifier
  - `token`: Verification token
  - `expires`: ISO 8601 timestamp
  - TTL set to match expiration time

### Utility Accounts
- `account:{accountId}` → Hash containing account data
- `user:{userId}:accounts` → Set of utility account IDs

### Balance Data
- `balance:latest:{accountId}` → Hash with latest balance
- `balance:history:{accountId}` → Sorted Set (score = timestamp, value = JSON)

### Notifications
- `notifications:{userId}` → List of notification JSON objects (capped at 100)

### Overdue Tracking
- `overdue:{accountId}` → Hash with overdue tracking data

### Check Attempts (Metrics)
- `checks:{providerName}` → Sorted Set (score = timestamp, value = JSON, capped at 1000)

### Migrations
- `migrations` → Set of applied migration names

## Migration Application

This migration is automatically applied when the Redis adapter is initialized. The key patterns are documented here for reference and to track the schema version.

To mark this migration as applied:
```
SADD migrations "001_initial_keys"
```

## Notes

- Redis is schemaless, so this migration primarily serves as documentation
- All timestamps are stored as ISO 8601 strings
- Booleans are stored as '1' (true) or '0' (false)
- UUIDs are stored as strings
- Session and verification token keys have TTL set automatically
- Foreign key relationships are maintained through application logic
