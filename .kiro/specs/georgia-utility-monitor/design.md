# Design Document: Georgia Utility Monitor

## Overview

The Georgia Utility Monitor is a Progressive Web App (PWA) built with Next.js that provides automated monitoring of utility bills across multiple providers in Georgia. The system architecture emphasizes portability, local-first development, and deployment flexibility.

### Core Architecture Principles

1. **Storage Abstraction**: A unified interface supporting Redis, Postgres, and SQLite backends
2. **Provider Adapters**: Pluggable adapters for different utility companies
3. **Deployment Flexibility**: Runs on Vercel, self-hosted VPS, or Docker environments
4. **Notification Portability**: Configurable ntfy.sh server (cloud or self-hosted)
5. **Environment-Based Configuration**: Same codebase for local and production

### Technology Stack

- **Frontend**: Next.js 14+ with App Router, React, TypeScript
- **Backend**: Next.js API Routes
- **Storage**: Redis, Postgres, or SQLite (via adapter pattern)
- **Scheduling**: Vercel Cron (production) or node-cron (local)
- **Notifications**: ntfy.sh (configurable server)
- **PWA**: Service Worker, Web App Manifest
- **Local Development**: Docker Compose with Redis and Postgres
- **Parsing**: Cheerio for HTML parsing
- **HTTP Client**: Axios with retry logic

## Architecture

### High-Level System Diagram

```mermaid
graph TB
    subgraph "Frontend (Next.js PWA)"
        UI[React UI Components]
        SW[Service Worker]
        Manifest[Web App Manifest]
    end
    
    subgraph "Backend (Next.js API Routes)"
        API[API Routes]
        Scheduler[Scheduler Service]
        ProviderRegistry[Provider Registry]
    end
    
    subgraph "Provider Adapters"
        GasAdapter[Gas Provider Adapter]
        WaterAdapter[Water Provider Adapter]
        ElectricAdapter[Electric Provider Adapter]
        TrashAdapter[Trash Provider Adapter]
    end
    
    subgraph "Storage Layer"
        StorageInterface[Storage Adapter Interface]
        RedisAdapter[Redis Adapter]
        PostgresAdapter[Postgres Adapter]
        SQLiteAdapter[SQLite Adapter]
    end
    
    subgraph "External Services"
        Ntfy[ntfy.sh Server]
        UtilityProviders[Utility Provider APIs]
    end
    
    subgraph "Storage Backends"
        Redis[(Redis)]
        Postgres[(Postgres)]
        SQLite[(SQLite)]
    end
    
    UI --> API
    API --> Scheduler
    API --> ProviderRegistry
    ProviderRegistry --> GasAdapter
    ProviderRegistry --> WaterAdapter
    ProviderRegistry --> ElectricAdapter
    ProviderRegistry --> TrashAdapter
    
    GasAdapter --> UtilityProviders
    WaterAdapter --> UtilityProviders
    ElectricAdapter --> UtilityProviders
    TrashAdapter --> UtilityProviders
    
    API --> StorageInterface
    Scheduler --> StorageInterface
    
    StorageInterface --> RedisAdapter
    StorageInterface --> PostgresAdapter
    StorageInterface --> SQLiteAdapter
    
    RedisAdapter --> Redis
    PostgresAdapter --> Postgres
    SQLiteAdapter --> SQLite
    
    Scheduler --> Ntfy
    API --> Ntfy
```

### Deployment Architecture

```mermaid
graph TB
    subgraph "Local Development"
        DevApp[Next.js Dev Server]
        NodeCron[node-cron]
        DockerCompose[Docker Compose]
        LocalRedis[Redis Container]
        LocalPostgres[Postgres Container]
    end
    
    subgraph "Vercel Production"
        VercelApp[Next.js on Vercel]
        VercelCron[Vercel Cron]
        VercelKV[Vercel KV Redis]
        VercelPostgres[Vercel Postgres]
    end
    
    subgraph "Self-Hosted VPS"
        VPSApp[Next.js on Node.js]
        VPSCron[node-cron]
        VPSRedis[Redis Instance]
        VPSPostgres[Postgres Instance]
    end
    
    DevApp --> NodeCron
    DevApp --> DockerCompose
    DockerCompose --> LocalRedis
    DockerCompose --> LocalPostgres
    
    VercelApp --> VercelCron
    VercelApp --> VercelKV
    VercelApp --> VercelPostgres
    
    VPSApp --> VPSCron
    VPSApp --> VPSRedis
    VPSApp --> VPSPostgres
```

## Components and Interfaces

### Frontend Components

#### 1. Account Management Component
**Responsibility**: Manage utility account configurations

**Key Functions**:
- Add new utility accounts (provider selection, account number input)
- Edit existing accounts
- Delete accounts
- Display account list with current balances
- Validate account number formats per provider

**State Management**:
- Local state for form inputs
- Server state via API calls for persistence

#### 2. Notification Configuration Component
**Responsibility**: Configure ntfy.sh notification settings

**Key Functions**:
- Input ntfy.sh feed URL
- Configure ntfy.sh server URL
- Test notification delivery
- Display subscription instructions

#### 3. Balance Display Component
**Responsibility**: Show current and historical balance data

**Key Functions**:
- Display current balance per account
- Show last check timestamp
- Display overdue day counter
- Render balance history chart
- Visual indicators for overdue accounts

#### 4. Manual Refresh Component
**Responsibility**: Trigger on-demand balance checks

**Key Functions**:
- Refresh button per account
- Loading state indicator
- Error message display
- Success confirmation

#### 5. Configuration Import/Export Component
**Responsibility**: Backup and restore account configurations

**Key Functions**:
- Export configuration to JSON
- Import configuration from JSON file
- Validate imported data
- Display import summary

### Backend API Routes

#### 1. `/api/accounts`
**Methods**: GET, POST, PUT, DELETE

**Responsibilities**:
- CRUD operations for user accounts
- Account number validation
- Provider type validation

**Request/Response**:
```typescript
// POST /api/accounts
Request: {
  userId: string;
  providerType: 'gas' | 'water' | 'electricity' | 'trash';
  providerName: string;
  accountNumber: string;
}
Response: {
  accountId: string;
  created: timestamp;
}

// GET /api/accounts?userId=xxx
Response: {
  accounts: Array<{
    accountId: string;
    providerType: string;
    providerName: string;
    accountNumber: string; // encrypted
    currentBalance: number;
    lastChecked: timestamp;
    overdueDay: number;
  }>;
}
```

#### 2. `/api/balances/check`
**Methods**: POST

**Responsibilities**:
- Trigger manual balance check
- Route to appropriate provider adapter
- Store result via storage adapter
- Return updated balance

**Request/Response**:
```typescript
// POST /api/balances/check
Request: {
  accountId: string;
}
Response: {
  balance: number;
  timestamp: timestamp;
  success: boolean;
  error?: string;
}
```

#### 3. `/api/balances/history`
**Methods**: GET

**Responsibilities**:
- Retrieve historical balance data
- Filter by account and date range

**Request/Response**:
```typescript
// GET /api/balances/history?accountId=xxx&days=30
Response: {
  history: Array<{
    timestamp: timestamp;
    balance: number;
  }>;
}
```

#### 4. `/api/notifications/config`
**Methods**: GET, POST

**Responsibilities**:
- Configure notification settings
- Validate ntfy.sh URLs

**Request/Response**:
```typescript
// POST /api/notifications/config
Request: {
  userId: string;
  ntfyFeedUrl: string;
  ntfyServerUrl: string;
}
Response: {
  success: boolean;
}
```

#### 5. `/api/notifications/test`
**Methods**: POST

**Responsibilities**:
- Send test notification
- Verify delivery

**Request/Response**:
```typescript
// POST /api/notifications/test
Request: {
  userId: string;
}
Response: {
  success: boolean;
  deliveryTimestamp: timestamp;
}
```

#### 6. `/api/notifications/history`
**Methods**: GET

**Responsibilities**:
- Retrieve notification history
- Show delivery status

#### 7. `/api/config/export`
**Methods**: GET

**Responsibilities**:
- Export user configuration as JSON
- Exclude sensitive tokens

#### 8. `/api/config/import`
**Methods**: POST

**Responsibilities**:
- Import configuration from JSON
- Validate and sanitize data

#### 9. `/api/health`
**Methods**: GET

**Responsibilities**:
- System health check
- Provider success rates
- Storage backend status

#### 10. `/api/cron/check-balances`
**Methods**: POST (protected by cron secret)

**Responsibilities**:
- Scheduled balance check endpoint
- Iterate all users and accounts
- Trigger provider adapters
- Send notifications based on rules

### Storage Adapter Interface

```typescript
interface StorageAdapter {
  // User operations
  createUser(userData: UserData): Promise<string>; // returns userId
  getUser(userId: string): Promise<UserData | null>;
  updateUser(userId: string, userData: Partial<UserData>): Promise<void>;
  deleteUser(userId: string): Promise<void>;
  
  // Account operations
  createAccount(accountData: AccountData): Promise<string>; // returns accountId
  getAccount(accountId: string): Promise<AccountData | null>;
  getAccountsByUser(userId: string): Promise<AccountData[]>;
  updateAccount(accountId: string, accountData: Partial<AccountData>): Promise<void>;
  deleteAccount(accountId: string): Promise<void>;
  
  // Balance operations
  recordBalance(balanceData: BalanceData): Promise<void>;
  getLatestBalance(accountId: string): Promise<BalanceData | null>;
  getBalanceHistory(accountId: string, days: number): Promise<BalanceData[]>;
  
  // Notification operations
  recordNotification(notificationData: NotificationData): Promise<void>;
  getNotificationHistory(userId: string, limit: number): Promise<NotificationData[]>;
  
  // Overdue tracking
  incrementOverdueDays(accountId: string): Promise<number>; // returns new count
  resetOverdueDays(accountId: string): Promise<void>;
  getOverdueDays(accountId: string): Promise<number>;
  
  // Health and metrics
  getProviderSuccessRate(providerName: string, days: number): Promise<number>;
  recordCheckAttempt(accountId: string, success: boolean, error?: string): Promise<void>;
  
  // Migration support
  runMigrations(): Promise<void>;
  getMigrationStatus(): Promise<MigrationStatus>;
}
```

### Provider Adapter Interface

```typescript
interface ProviderAdapter {
  // Provider metadata
  readonly providerName: string;
  readonly providerType: 'gas' | 'water' | 'electricity' | 'trash';
  readonly supportedRegions: string[]; // e.g., ['Tbilisi', 'Batumi']
  
  // Account validation
  validateAccountNumber(accountNumber: string): boolean;
  getAccountNumberFormat(): string; // e.g., "12 digits"
  
  // Balance retrieval
  fetchBalance(accountNumber: string): Promise<BalanceResult>;
  
  // Configuration
  getEndpointUrl(): string;
  getTimeout(): number; // milliseconds
  getRetryConfig(): RetryConfig;
}

interface BalanceResult {
  balance: number; // in Georgian Lari
  currency: string; // "GEL"
  timestamp: Date;
  success: boolean;
  error?: string;
  rawResponse?: string; // for debugging
}

interface RetryConfig {
  maxRetries: number;
  initialDelay: number; // milliseconds
  maxDelay: number;
  backoffMultiplier: number;
}
```

### Provider Registry

```typescript
class ProviderRegistry {
  private adapters: Map<string, ProviderAdapter>;
  
  registerAdapter(adapter: ProviderAdapter): void;
  getAdapter(providerName: string): ProviderAdapter | null;
  listProviders(): ProviderMetadata[];
  getProvidersByType(type: string): ProviderAdapter[];
}
```

### Scheduler Service

```typescript
interface SchedulerService {
  // Start/stop scheduler
  start(): Promise<void>;
  stop(): Promise<void>;
  
  // Schedule configuration
  getScheduleInterval(): number; // milliseconds (72 hours)
  
  // Execution
  executeScheduledCheck(): Promise<ScheduleResult>;
  
  // Platform detection
  isVercel(): boolean;
  useVercelCron(): boolean;
  useNodeCron(): boolean;
}

interface ScheduleResult {
  totalAccounts: number;
  successfulChecks: number;
  failedChecks: number;
  notificationsSent: number;
  executionTime: number; // milliseconds
  errors: Array<{accountId: string; error: string}>;
}
```

### Notification Service

```typescript
interface NotificationService {
  // Send notifications
  sendNotification(notification: NotificationPayload): Promise<boolean>;
  sendTestNotification(userId: string): Promise<boolean>;
  
  // Priority levels
  determinePriority(overdueDays: number): 'default' | 'high' | 'urgent';
  
  // Message formatting
  formatBalanceMessage(
    providerName: string,
    accountNumber: string,
    balance: number,
    overdueDays: number
  ): string;
}

interface NotificationPayload {
  topic: string; // ntfy.sh topic from user config
  title: string;
  message: string;
  priority: 'default' | 'high' | 'urgent';
  tags: string[];
  serverUrl: string; // configurable ntfy.sh server
}
```

## Data Models

### User Model

```typescript
interface User {
  userId: string; // UUID
  createdAt: Date;
  updatedAt: Date;
  ntfyFeedUrl: string; // encrypted
  ntfyServerUrl: string; // default: https://ntfy.sh
  notificationEnabled: boolean;
}
```

**Storage**:
- **Redis**: Hash at key `user:{userId}`
- **Postgres**: Table `users` with columns matching interface
- **SQLite**: Table `users` with columns matching interface

### Account Model

```typescript
interface Account {
  accountId: string; // UUID
  userId: string; // foreign key to User
  providerType: 'gas' | 'water' | 'electricity' | 'trash';
  providerName: string; // e.g., "te.ge"
  accountNumber: string; // encrypted
  createdAt: Date;
  updatedAt: Date;
  enabled: boolean; // allow disabling without deleting
}
```

**Storage**:
- **Redis**: Hash at key `account:{accountId}`, Set at key `user:{userId}:accounts`
- **Postgres**: Table `accounts` with foreign key to `users`
- **SQLite**: Table `accounts` with foreign key to `users`

### Balance Model

```typescript
interface Balance {
  balanceId: string; // UUID
  accountId: string; // foreign key to Account
  balance: number; // in Georgian Lari (₾)
  currency: string; // "GEL"
  checkedAt: Date;
  success: boolean;
  error?: string;
  rawResponse?: string; // for debugging failed parses
}
```

**Storage**:
- **Redis**: 
  - Latest: Hash at key `balance:latest:{accountId}`
  - History: Sorted Set at key `balance:history:{accountId}` (score = timestamp)
- **Postgres**: Table `balances` with index on `accountId` and `checkedAt`
- **SQLite**: Table `balances` with index on `accountId` and `checkedAt`

### Notification Model

```typescript
interface Notification {
  notificationId: string; // UUID
  userId: string;
  accountId: string;
  sentAt: Date;
  priority: 'default' | 'high' | 'urgent';
  message: string;
  deliverySuccess: boolean;
  deliveryError?: string;
}
```

**Storage**:
- **Redis**: List at key `notifications:{userId}` (capped at 100 entries)
- **Postgres**: Table `notifications` with index on `userId` and `sentAt`
- **SQLite**: Table `notifications` with index on `userId` and `sentAt`

### Overdue Tracking Model

```typescript
interface OverdueTracking {
  accountId: string;
  overdueDays: number;
  firstNonZeroDate: Date;
  lastCheckedDate: Date;
}
```

**Storage**:
- **Redis**: Hash at key `overdue:{accountId}`
- **Postgres**: Table `overdue_tracking` with primary key `accountId`
- **SQLite**: Table `overdue_tracking` with primary key `accountId`

### Check Attempt Model (for metrics)

```typescript
interface CheckAttempt {
  attemptId: string; // UUID
  accountId: string;
  providerName: string;
  attemptedAt: Date;
  success: boolean;
  error?: string;
  responseTime: number; // milliseconds
}
```

**Storage**:
- **Redis**: Sorted Set at key `checks:{providerName}` (score = timestamp, capped at 1000 entries)
- **Postgres**: Table `check_attempts` with index on `providerName` and `attemptedAt`
- **SQLite**: Table `check_attempts` with index on `providerName` and `attemptedAt`

### Database Schema

#### Postgres Schema

```sql
-- Users table
CREATE TABLE users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ntfy_feed_url TEXT NOT NULL, -- encrypted
  ntfy_server_url TEXT NOT NULL DEFAULT 'https://ntfy.sh',
  notification_enabled BOOLEAN NOT NULL DEFAULT true
);

-- Accounts table
CREATE TABLE accounts (
  account_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  provider_type VARCHAR(20) NOT NULL CHECK (provider_type IN ('gas', 'water', 'electricity', 'trash')),
  provider_name VARCHAR(100) NOT NULL,
  account_number TEXT NOT NULL, -- encrypted
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  enabled BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_accounts_user_id ON accounts(user_id);
CREATE INDEX idx_accounts_provider ON accounts(provider_name);

-- Balances table
CREATE TABLE balances (
  balance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  balance DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'GEL',
  checked_at TIMESTAMP NOT NULL DEFAULT NOW(),
  success BOOLEAN NOT NULL,
  error TEXT,
  raw_response TEXT
);

CREATE INDEX idx_balances_account_id ON balances(account_id);
CREATE INDEX idx_balances_checked_at ON balances(checked_at DESC);

-- Notifications table
CREATE TABLE notifications (
  notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  sent_at TIMESTAMP NOT NULL DEFAULT NOW(),
  priority VARCHAR(10) NOT NULL CHECK (priority IN ('default', 'high', 'urgent')),
  message TEXT NOT NULL,
  delivery_success BOOLEAN NOT NULL,
  delivery_error TEXT
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_sent_at ON notifications(sent_at DESC);

-- Overdue tracking table
CREATE TABLE overdue_tracking (
  account_id UUID PRIMARY KEY REFERENCES accounts(account_id) ON DELETE CASCADE,
  overdue_days INTEGER NOT NULL DEFAULT 0,
  first_non_zero_date TIMESTAMP,
  last_checked_date TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Check attempts table (for metrics)
CREATE TABLE check_attempts (
  attempt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  provider_name VARCHAR(100) NOT NULL,
  attempted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  success BOOLEAN NOT NULL,
  error TEXT,
  response_time INTEGER -- milliseconds
);

CREATE INDEX idx_check_attempts_provider ON check_attempts(provider_name);
CREATE INDEX idx_check_attempts_attempted_at ON check_attempts(attempted_at DESC);

-- Migrations table
CREATE TABLE migrations (
  migration_id SERIAL PRIMARY KEY,
  migration_name VARCHAR(255) NOT NULL UNIQUE,
  applied_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

#### Redis Data Structures

```
# User data
user:{userId} -> Hash {
  createdAt, updatedAt, ntfyFeedUrl, ntfyServerUrl, notificationEnabled
}

# Account data
account:{accountId} -> Hash {
  userId, providerType, providerName, accountNumber, createdAt, updatedAt, enabled
}
user:{userId}:accounts -> Set {accountId1, accountId2, ...}

# Balance data
balance:latest:{accountId} -> Hash {
  balanceId, balance, currency, checkedAt, success, error
}
balance:history:{accountId} -> Sorted Set {
  score: timestamp, value: JSON({balanceId, balance, checkedAt})
}

# Notification data
notifications:{userId} -> List [
  JSON({notificationId, accountId, sentAt, priority, message, deliverySuccess}),
  ... (capped at 100)
]

# Overdue tracking
overdue:{accountId} -> Hash {
  overdueDays, firstNonZeroDate, lastCheckedDate
}

# Check attempts (for metrics)
checks:{providerName} -> Sorted Set {
  score: timestamp, value: JSON({attemptId, accountId, success, error, responseTime})
} (capped at 1000)

# Migrations
migrations -> Set {migration_name1, migration_name2, ...}
```

#### SQLite Schema

```sql
-- Same as Postgres but with SQLite-specific adjustments:
-- - Use TEXT for UUIDs (generated in application code)
-- - Use INTEGER for BOOLEAN (0/1)
-- - Use TEXT for TIMESTAMP (ISO 8601 format)
-- - Use REAL for DECIMAL

CREATE TABLE users (
  user_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  ntfy_feed_url TEXT NOT NULL,
  ntfy_server_url TEXT NOT NULL DEFAULT 'https://ntfy.sh',
  notification_enabled INTEGER NOT NULL DEFAULT 1
);

-- Similar structure for other tables...
```

## Authentication Architecture

### Google OAuth Flow

The system uses Google OAuth 2.0 via NextAuth.js for authentication:

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant NextAuth
    participant Google
    participant Database

    User->>Frontend: Visit app
    Frontend->>NextAuth: Check session
    NextAuth->>Frontend: No session
    Frontend->>User: Show sign-in button
    User->>Frontend: Click "Sign in with Google"
    Frontend->>NextAuth: Initiate OAuth
    NextAuth->>Google: Redirect to Google OAuth
    Google->>User: Show consent screen
    User->>Google: Approve
    Google->>NextAuth: OAuth callback with code
    NextAuth->>Google: Exchange code for tokens
    Google->>NextAuth: Return access token & user info
    NextAuth->>Database: Create/update user record
    NextAuth->>Frontend: Set session cookie
    Frontend->>User: Redirect to dashboard
```

### Session Management

- **Session Storage**: Database-backed sessions (adapter pattern for Redis/Postgres/SQLite)
- **Session Duration**: 30 days with automatic renewal on activity
- **Cookie Configuration**: 
  - HTTP-only: true
  - Secure: true (HTTPS only)
  - SameSite: lax
  - Path: /

### NextAuth Configuration

```typescript
// lib/auth.ts
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { StorageAdapter } from "./storage/types";

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  adapter: createNextAuthAdapter(storageAdapter),
  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
};
```

### Protected API Routes

```typescript
// Example protected route
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

### User Model Updates

Add OAuth-specific fields to the User model:

```typescript
export interface User {
  userId: string; // UUID
  email: string; // From Google OAuth
  name: string; // From Google OAuth
  image?: string; // Profile picture URL from Google
  emailVerified: Date | null; // OAuth verification timestamp
  createdAt: Date;
  updatedAt: Date;
  ntfyFeedUrl: string; // encrypted
  ntfyServerUrl: string; // default: https://ntfy.sh
  notificationEnabled: boolean;
}

// New models for NextAuth
export interface Account {
  id: string;
  userId: string;
  type: string; // "oauth"
  provider: string; // "google"
  providerAccountId: string; // Google user ID
  refresh_token?: string;
  access_token?: string;
  expires_at?: number;
  token_type?: string;
  scope?: string;
  id_token?: string;
  session_state?: string;
}

export interface Session {
  id: string;
  sessionToken: string;
  userId: string;
  expires: Date;
}

export interface VerificationToken {
  identifier: string;
  token: string;
  expires: Date;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Account Storage Round-Trip

*For any* valid account data (provider type, provider name, account number), storing the account via the Storage_Adapter and then retrieving it should return equivalent account data.

**Validates: Requirements 1.6**

### Property 2: Notification Configuration Round-Trip

*For any* valid notification feed URL and server URL, storing the configuration via the Storage_Adapter and then retrieving it should return equivalent configuration data.

**Validates: Requirements 2.6**

### Property 3: Balance Storage Round-Trip

*For any* account and balance data, storing a balance check result via the Storage_Adapter and then retrieving the latest balance should return equivalent balance data with timestamp.

**Validates: Requirements 3.5, 4.4, 5.5, 6.4**

### Property 4: Provider Adapter Request Formation

*For any* provider adapter and account number, triggering a balance check should result in a request to the provider's endpoint with the correct account number and required parameters.

**Validates: Requirements 3.1, 4.1, 5.1, 6.1**

### Property 5: Balance Parsing Correctness

*For any* provider adapter and valid HTML/JSON response containing a balance, parsing the response should extract a non-negative numeric balance value in Georgian Lari.

**Validates: Requirements 3.2, 4.2, 5.2, 6.2, 16.2, 16.5**

### Property 6: Retry on Provider Error

*For any* provider adapter, when a provider endpoint returns an error or is unreachable, the system should retry up to 3 times with exponential backoff before marking the check as failed.

**Validates: Requirements 3.3, 4.3, 5.3, 6.3, 13.1**

### Property 7: Account Validation by Provider

*For any* provider adapter, adding an account with an invalid account number format should be rejected, while valid formats should be accepted.

**Validates: Requirements 1.5**

### Property 8: URL Format Validation

*For any* notification feed URL or server URL, the system should reject malformed URLs and accept valid HTTP/HTTPS URLs.

**Validates: Requirements 2.4, 25.4**

### Property 9: Scheduled Check Completeness

*For any* set of configured accounts, when the scheduler executes, it should invoke balance checks for all enabled accounts regardless of individual check failures.

**Validates: Requirements 7.2, 7.4, 13.5**

### Property 10: User Isolation in Scheduling

*For any* two different users with configured accounts, scheduled checks for one user should not affect the scheduling or execution of checks for the other user.

**Validates: Requirements 7.3**

### Property 11: Non-Zero Balance Triggers Notification

*For any* account, when a balance check returns a non-zero balance, the system should send a notification to the user's configured notification feed.

**Validates: Requirements 8.1**

### Property 12: Zero Balance Suppresses Notification

*For any* account, when a balance check returns a zero balance, the system should not send a notification.

**Validates: Requirements 8.5**

### Property 13: Notification Content Completeness

*For any* notification sent for a non-zero balance, the notification message should contain the provider name, account number (masked), balance amount, and the ₾ currency symbol.

**Validates: Requirements 8.2, 8.3**

### Property 14: Priority Escalation by Overdue Days

*For any* account with a non-zero balance, the notification priority should be 'default' for 0-7 days, 'high' for 8-14 days, and 'urgent' for 15+ days overdue.

**Validates: Requirements 8.4, 9.1, 9.2**

### Property 15: Overdue Counter Increment

*For any* account, when consecutive balance checks return non-zero balances, the overdue day counter should increment with each check.

**Validates: Requirements 9.3**

### Property 16: Overdue Counter Reset

*For any* account with a non-zero overdue counter, when a balance check returns zero, the overdue counter should reset to zero.

**Validates: Requirements 9.5**

### Property 17: Overdue Days in Notification

*For any* escalated notification (high or urgent priority), the notification message should include the number of days the balance has been overdue.

**Validates: Requirements 9.4**

### Property 18: Request Timeout Enforcement

*For any* provider adapter request, if the provider does not respond within 30 seconds, the request should timeout and be counted as a failed attempt eligible for retry.

**Validates: Requirements 13.4**

### Property 19: Malformed Response Handling

*For any* provider response that does not contain expected data structures or parseable balance information, the system should log the error, mark the check as failed, and log the raw response for debugging.

**Validates: Requirements 13.2, 16.1, 16.3**

### Property 20: Failed Check Notification

*For any* account, when all retry attempts for a balance check fail, the system should send a notification to the user informing them of the failed check.

**Validates: Requirements 13.3**

### Property 21: Sensitive Data Encryption at Rest

*For any* account number or notification feed URL stored via the Storage_Adapter, the stored value should be encrypted (not plaintext).

**Validates: Requirements 14.1**

### Property 22: No Plaintext Sensitive Data in Logs

*For any* log entry created by the system, the log should not contain plaintext account numbers, notification URLs, or authentication tokens.

**Validates: Requirements 14.3, 18.4**

### Property 23: HTTPS Provider Communication

*For any* provider adapter, the endpoint URL should use the HTTPS protocol.

**Validates: Requirements 14.2**

### Property 24: Unauthenticated Request Rejection

*For any* API endpoint that accesses user data, requests without valid authentication should be rejected with an appropriate error.

**Validates: Requirements 14.6**

### Property 25: Provider Routing Correctness

*For any* balance check request, the system should route the request to the provider adapter matching the account's provider name.

**Validates: Requirements 15.4**

### Property 26: Currency Normalization

*For any* provider response containing a balance in various formats (with/without currency symbols, different decimal separators), the parsed balance should be normalized to a numeric value in Georgian Lari.

**Validates: Requirements 16.4**

### Property 27: Notification Delivery Logging

*For any* notification sent by the Notification_Service, the system should create a log entry with the delivery attempt timestamp and success/failure status.

**Validates: Requirements 17.1, 17.3**

### Property 28: Notification Delivery Success Rate Calculation

*For any* user, the notification delivery success rate should equal the number of successful deliveries divided by total delivery attempts over the tracked period.

**Validates: Requirements 17.5**

### Property 29: Configuration Export Completeness

*For any* user with configured accounts, exporting the configuration should produce a valid JSON file containing all account configurations without plaintext sensitive tokens.

**Validates: Requirements 18.1, 18.4**

### Property 30: Configuration Import Round-Trip

*For any* valid configuration JSON file, importing it should create accounts that match the exported configuration data.

**Validates: Requirements 18.2, 18.3**

### Property 31: Provider Success Rate Calculation

*For any* provider, the success rate over a time period should equal the number of successful balance checks divided by total check attempts for that provider.

**Validates: Requirements 19.2**

### Property 32: Low Success Rate Alert

*For any* provider, when the success rate falls below 80% over the tracked period, the system should generate an alert for administrators.

**Validates: Requirements 19.4**

### Property 33: Storage Backend Behavioral Equivalence

*For any* storage operation (create, read, update, delete) performed on any supported backend (Redis, Postgres, SQLite), the operation should produce functionally equivalent results regardless of which backend is configured.

**Validates: Requirements 20.6**

### Property 34: Storage Backend Selection

*For any* environment configuration, when the system starts, it should initialize the Storage_Adapter with the backend specified in environment variables (Redis, Postgres, or SQLite).

**Validates: Requirements 20.5**

### Property 35: Environment Variable Configuration

*For any* configuration value, the system should read it from environment variables rather than hardcoded values, and use defaults when optional variables are not set.

**Validates: Requirements 22.1, 22.2**

### Property 36: Required Environment Variable Validation

*For any* required environment variable, if it is missing at startup, the system should fail to start and report which variables are missing.

**Validates: Requirements 22.3**

### Property 37: Environment-Specific Configuration

*For any* deployment environment (Vercel, local, VPS), the system should use the appropriate connection strings and service URLs for that environment based on environment variables.

**Validates: Requirements 22.4, 22.5**

### Property 38: Migration Idempotency

*For any* migration script, running it multiple times should have the same effect as running it once (migrations should not be re-applied).

**Validates: Requirements 23.6**

### Property 39: Pending Migration Detection

*For any* system startup, the system should check for pending migrations and apply them according to the environment mode (automatic in development, manual in production).

**Validates: Requirements 23.3, 23.4, 23.5**

### Property 40: Configurable Notification Server

*For any* notification sent by the system, the HTTP POST should be sent to the ntfy.sh server URL configured in environment variables, not a hardcoded URL.

**Validates: Requirements 25.1, 25.2, 25.3**

### Property 41: Session Expiration Enforcement

*For any* user session, when the session expires after 30 days of inactivity, subsequent requests should be rejected and require re-authentication.

**Validates: Requirements 14.5**

### Property 42: OAuth Token Security

*For any* OAuth tokens (access tokens, refresh tokens, ID tokens) stored in the database, the tokens should never be logged in plain text or exposed through API responses.

**Validates: Requirements 14.10**

## Error Handling

### Error Categories

1. **Provider Communication Errors**
   - Network timeouts (30s limit)
   - Connection failures
   - HTTP error responses (4xx, 5xx)
   - **Handling**: Retry up to 3 times with exponential backoff (initial: 1s, max: 10s, multiplier: 2x)

2. **Parsing Errors**
   - Malformed HTML/JSON responses
   - Missing expected data fields
   - Invalid balance formats
   - **Handling**: Log raw response, mark check as failed, notify user after all retries exhausted

3. **Storage Errors**
   - Database connection failures
   - Query timeouts
   - Constraint violations
   - **Handling**: Log error, return error to caller, implement circuit breaker for repeated failures

4. **Validation Errors**
   - Invalid account numbers
   - Malformed URLs
   - Missing required fields
   - **Handling**: Return validation error to user immediately, do not retry

5. **Authentication Errors**
   - Missing or invalid tokens
   - Expired sessions
   - **Handling**: Return 401/403 status, require re-authentication

6. **Notification Delivery Errors**
   - ntfy.sh server unreachable
   - Invalid topic configuration
   - **Handling**: Log failure, track delivery success rate, alert if rate drops below threshold

### Error Response Format

All API endpoints return errors in a consistent format:

```typescript
interface ErrorResponse {
  error: {
    code: string; // e.g., "VALIDATION_ERROR", "PROVIDER_TIMEOUT"
    message: string; // Human-readable message
    details?: any; // Additional context
    retryable: boolean; // Whether client should retry
  };
}
```

### Circuit Breaker Pattern

For provider adapters experiencing repeated failures:
- **Threshold**: 5 consecutive failures
- **Open Duration**: 5 minutes
- **Behavior**: Return cached balance (if available) or error without attempting request
- **Recovery**: After open duration, attempt one request (half-open state)

### Graceful Degradation

- **Storage Unavailable**: Return cached data from previous successful fetch (if available)
- **Notification Service Down**: Log notifications locally, attempt delivery on next check
- **Provider Temporarily Down**: Use circuit breaker, show last known balance with staleness indicator

## Testing Strategy

### Dual Testing Approach

The Georgia Utility Monitor will employ both unit testing and property-based testing to ensure comprehensive coverage:

- **Unit Tests**: Verify specific examples, edge cases, error conditions, and integration points
- **Property Tests**: Verify universal properties across all inputs using randomized test data

### Property-Based Testing Configuration

**Library**: fast-check (TypeScript/JavaScript property-based testing library)

**Configuration**:
- Minimum 100 iterations per property test
- Each test tagged with reference to design document property
- Tag format: `Feature: georgia-utility-monitor, Property {number}: {property_text}`

**Example Property Test Structure**:

```typescript
import fc from 'fast-check';

// Feature: georgia-utility-monitor, Property 1: Account Storage Round-Trip
test('Account storage round-trip preserves data', async () => {
  await fc.assert(
    fc.asyncProperty(
      accountDataArbitrary(), // Generator for random account data
      async (accountData) => {
        const accountId = await storageAdapter.createAccount(accountData);
        const retrieved = await storageAdapter.getAccount(accountId);
        
        expect(retrieved.providerType).toBe(accountData.providerType);
        expect(retrieved.providerName).toBe(accountData.providerName);
        expect(retrieved.accountNumber).toBe(accountData.accountNumber);
      }
    ),
    { numRuns: 100 }
  );
});
```

### Unit Testing Focus Areas

1. **Specific Provider Adapters**
   - Test with known provider response formats
   - Test edge cases (empty responses, special characters)
   - Test error responses from specific providers

2. **API Endpoint Integration**
   - Test request/response formats
   - Test authentication flows
   - Test error status codes

3. **UI Component Behavior**
   - Test user interactions (button clicks, form submissions)
   - Test loading states
   - Test error message display

4. **Scheduler Timing**
   - Test that 72-hour interval is configured correctly
   - Test scheduler start/stop behavior

5. **Migration Scripts**
   - Test each migration applies correctly
   - Test migration rollback (if supported)

### Property-Based Testing Focus Areas

1. **Storage Adapter Equivalence**
   - Generate random data for all storage operations
   - Verify Redis, Postgres, and SQLite produce equivalent results
   - Test with various data sizes and types

2. **Provider Adapter Behavior**
   - Generate random account numbers (valid and invalid)
   - Generate random HTML responses
   - Verify parsing handles all variations

3. **Notification Logic**
   - Generate random balance sequences
   - Verify notification triggering rules
   - Verify priority escalation logic

4. **Retry and Timeout Logic**
   - Generate random failure scenarios
   - Verify retry counts and backoff timing
   - Verify timeout enforcement

5. **Validation Logic**
   - Generate random inputs (valid and invalid)
   - Verify validation rules are consistent
   - Verify error messages are appropriate

### Test Data Generators (Arbitraries)

```typescript
// Account data generator
const accountDataArbitrary = () => fc.record({
  userId: fc.uuid(),
  providerType: fc.constantFrom('gas', 'water', 'electricity', 'trash'),
  providerName: fc.constantFrom('te.ge', 'tbilwater', 'telasi', 'cleantech'),
  accountNumber: fc.string({ minLength: 8, maxLength: 12 }),
  enabled: fc.boolean()
});

// Balance data generator
const balanceDataArbitrary = () => fc.record({
  accountId: fc.uuid(),
  balance: fc.float({ min: 0, max: 1000, noNaN: true }),
  currency: fc.constant('GEL'),
  checkedAt: fc.date(),
  success: fc.boolean()
});

// Notification config generator
const notificationConfigArbitrary = () => fc.record({
  ntfyFeedUrl: fc.webUrl(),
  ntfyServerUrl: fc.webUrl({ validSchemes: ['https'] })
});
```

### Integration Testing

1. **End-to-End Flows**
   - User registration → account addition → balance check → notification delivery
   - Configuration export → import → verification
   - Scheduled check execution → notification escalation

2. **Multi-Backend Testing**
   - Run same test suite against Redis, Postgres, and SQLite
   - Verify behavioral equivalence

3. **Provider Adapter Testing**
   - Mock provider endpoints with various response scenarios
   - Test timeout and retry behavior
   - Test circuit breaker activation

### Performance Testing

1. **Load Testing**
   - Simulate 1000+ accounts across 100+ users
   - Measure scheduler execution time
   - Measure database query performance

2. **Stress Testing**
   - Test with slow provider responses
   - Test with high notification volume
   - Test with database connection limits

### Security Testing

1. **Authentication Testing**
   - Test unauthorized access attempts
   - Test token expiration
   - Test session management

2. **Encryption Testing**
   - Verify sensitive data is encrypted at rest
   - Verify no plaintext sensitive data in logs
   - Verify HTTPS enforcement

3. **Input Validation Testing**
   - Test SQL injection attempts
   - Test XSS attempts
   - Test malformed input handling

### Test Environment Setup

**Local Development**:
- Docker Compose with test databases
- Mock provider endpoints
- Mock ntfy.sh server

**CI/CD Pipeline**:
- Automated test execution on every commit
- Parallel test execution for speed
- Test coverage reporting (target: 80%+ coverage)
- Property test execution with full iteration count

### Test Documentation

Each property test must include:
- Reference to design document property number
- Description of what is being tested
- Generator descriptions
- Expected invariants

Each unit test must include:
- Description of specific scenario
- Setup requirements
- Expected behavior
- Edge cases covered


## Deployment Configurations

### Local Development with Docker Compose

**docker-compose.yml**:

```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes

  postgres:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: utility_monitor
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: devpassword
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./migrations/postgres:/docker-entrypoint-initdb.d

  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - STORAGE_BACKEND=postgres
      - DATABASE_URL=postgresql://dev:devpassword@postgres:5432/utility_monitor
      - REDIS_URL=redis://redis:6379
      - NTFY_SERVER_URL=https://ntfy.sh
      - SCHEDULER_TYPE=node-cron
    depends_on:
      - redis
      - postgres
    volumes:
      - .:/app
      - /app/node_modules

volumes:
  redis-data:
  postgres-data:
```

**Environment Variables (.env.local)**:

```bash
# Storage Configuration
STORAGE_BACKEND=postgres # or redis, sqlite
DATABASE_URL=postgresql://dev:devpassword@localhost:5432/utility_monitor
REDIS_URL=redis://localhost:6379
SQLITE_PATH=./data/utility_monitor.db

# Notification Configuration
NTFY_SERVER_URL=https://ntfy.sh

# Scheduler Configuration
SCHEDULER_TYPE=node-cron # or vercel-cron
SCHEDULER_INTERVAL_HOURS=72

# Security
ENCRYPTION_KEY=your-32-character-encryption-key-here
NEXTAUTH_SECRET=your-nextauth-secret-here
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
API_SECRET=your-api-secret-for-cron-endpoints

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

### Vercel Deployment

**vercel.json**:

```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "crons": [
    {
      "path": "/api/cron/check-balances",
      "schedule": "0 */72 * * *"
    }
  ]
}
```

**Environment Variables (Vercel Dashboard)**:

```bash
# Storage Configuration
STORAGE_BACKEND=postgres
POSTGRES_URL=<from Vercel Postgres>
POSTGRES_PRISMA_URL=<from Vercel Postgres>
POSTGRES_URL_NON_POOLING=<from Vercel Postgres>
KV_URL=<from Vercel KV>
KV_REST_API_URL=<from Vercel KV>
KV_REST_API_TOKEN=<from Vercel KV>

# Notification Configuration
NTFY_SERVER_URL=https://ntfy.sh

# Security
ENCRYPTION_KEY=<generate secure key>
NEXTAUTH_SECRET=<generate secure key>
NEXTAUTH_URL=https://your-app.vercel.app
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
CRON_SECRET=<generate secure key>

# Application
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
NODE_ENV=production
```

### Self-Hosted VPS Deployment

**Deployment Steps**:

1. **Install Dependencies**:
```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install Redis
sudo apt-get install redis-server

# Install PostgreSQL
sudo apt-get install postgresql postgresql-contrib
```

2. **Setup Application**:
```bash
# Clone repository
git clone <repository-url>
cd georgia-utility-monitor

# Install dependencies
npm install

# Build application
npm run build

# Setup environment variables
cp .env.example .env
nano .env # Edit with production values
```

3. **Setup Database**:
```bash
# Create database
sudo -u postgres createdb utility_monitor

# Run migrations
npm run migrate
```

4. **Start with PM2**:
```bash
# Start application
pm2 start npm --name "utility-monitor" -- start

# Setup PM2 to start on boot
pm2 startup
pm2 save
```

**ecosystem.config.js** (PM2 Configuration):

```javascript
module.exports = {
  apps: [{
    name: 'utility-monitor',
    script: 'npm',
    args: 'start',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '500M',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
```

**Nginx Configuration**:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Docker Production Deployment

**Dockerfile**:

```dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED 1

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

## Security Considerations

### Data Encryption

**At Rest**:
- Account numbers encrypted using AES-256-GCM
- Notification feed URLs encrypted using AES-256-GCM
- Encryption key stored in environment variables, never in code
- Each encrypted value includes initialization vector (IV)

**Encryption Implementation**:

```typescript
import crypto from 'crypto';

class EncryptionService {
  private algorithm = 'aes-256-gcm';
  private key: Buffer;

  constructor(encryptionKey: string) {
    // Derive 32-byte key from environment variable
    this.key = crypto.scryptSync(encryptionKey, 'salt', 32);
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Return: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  decrypt(ciphertext: string): string {
    const [ivHex, authTagHex, encrypted] = ciphertext.split(':');
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
```

**In Transit**:
- All API communication over HTTPS (enforced in production)
- Provider communication over HTTPS only
- TLS 1.2+ required

### Authentication and Authorization

**Authentication Strategy**:
- Google OAuth 2.0 via NextAuth.js for all authentication
- Database-backed sessions with 30-day expiration
- HTTP-only cookies for session storage
- Automatic session renewal on activity
- CSRF protection built into NextAuth

**Authorization Levels**:
1. **User**: Access own accounts and data only
2. **Admin**: Access health metrics and system-wide data

**API Route Protection**:

```typescript
// middleware/auth.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function requireAuth(req: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  return session;
}
```

**Cron Endpoint Protection**:

```typescript
// api/cron/check-balances/route.ts
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  // Execute scheduled checks...
}
```

### Input Validation and Sanitization

**Validation Rules**:
- Account numbers: alphanumeric, 8-20 characters
- URLs: valid HTTP/HTTPS format, no javascript: protocol
- Provider types: enum validation (gas, water, electricity, trash)
- Balance values: non-negative numbers only

**Sanitization**:
- HTML escape all user-provided text before display
- SQL parameterized queries (prevent SQL injection)
- No eval() or dynamic code execution

### Rate Limiting

**API Endpoints**:
- 100 requests per minute per user
- 10 requests per minute for manual balance checks
- 1 request per minute for test notifications

**Implementation** (using Vercel KV or Redis):

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '1 m'),
});

export async function checkRateLimit(userId: string) {
  const { success, limit, remaining } = await ratelimit.limit(userId);
  return { allowed: success, remaining };
}
```

### Logging and Monitoring

**Security Logging**:
- Failed authentication attempts
- Rate limit violations
- Invalid input attempts
- Unauthorized access attempts

**Log Sanitization**:
- Never log plaintext account numbers
- Never log authentication tokens
- Never log encryption keys
- Mask sensitive data in error messages

**Log Format**:

```typescript
interface SecurityLog {
  timestamp: Date;
  level: 'info' | 'warn' | 'error';
  event: string;
  userId?: string; // hashed
  ip?: string; // hashed
  details: Record<string, any>; // sanitized
}
```

### Dependency Security

**Practices**:
- Regular dependency updates (npm audit)
- Automated security scanning (Dependabot, Snyk)
- Minimal dependency footprint
- Pin dependency versions in production

### CORS Configuration

```typescript
// middleware.ts
export function middleware(req: NextRequest) {
  const origin = req.headers.get('origin');
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_APP_URL,
    'http://localhost:3000'
  ];
  
  if (origin && !allowedOrigins.includes(origin)) {
    return new Response('CORS not allowed', { status: 403 });
  }
  
  // Continue...
}
```

## Progressive Web App Configuration

### Web App Manifest

**public/manifest.json**:

```json
{
  "name": "Georgia Utility Monitor",
  "short_name": "Utility Monitor",
  "description": "Monitor utility bills across Georgia",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#0070f3",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-96x96.png",
      "sizes": "96x96",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-128x128.png",
      "sizes": "128x128",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-144x144.png",
      "sizes": "144x144",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-152x152.png",
      "sizes": "152x152",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-384x384.png",
      "sizes": "384x384",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "categories": ["finance", "utilities"],
  "screenshots": [
    {
      "src": "/screenshots/home.png",
      "sizes": "540x720",
      "type": "image/png"
    },
    {
      "src": "/screenshots/accounts.png",
      "sizes": "540x720",
      "type": "image/png"
    }
  ]
}
```

### Service Worker

**public/sw.js**:

```javascript
const CACHE_NAME = 'utility-monitor-v1';
const urlsToCache = [
  '/',
  '/offline',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        
        // Clone the request
        const fetchRequest = event.request.clone();
        
        return fetch(fetchRequest).then((response) => {
          // Check if valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // Clone the response
          const responseToCache = response.clone();
          
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });
          
          return response;
        }).catch(() => {
          // Network failed, return offline page
          return caches.match('/offline');
        });
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
```

### Service Worker Registration

**app/layout.tsx**:

```typescript
'use client';

import { useEffect } from 'react';

export default function RootLayout({ children }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered:', registration);
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    }
  }, []);

  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0070f3" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Monitor utility bills across Georgia" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

### Offline Support

**app/offline/page.tsx**:

```typescript
export default function OfflinePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-2xl font-bold mb-4">You're Offline</h1>
      <p className="text-gray-600 mb-4">
        Please check your internet connection and try again.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        Retry
      </button>
    </div>
  );
}
```

### Install Prompt

**components/InstallPrompt.tsx**:

```typescript
'use client';

import { useState, useEffect } from 'react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    
    setDeferredPrompt(null);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 bg-white shadow-lg rounded-lg p-4 border">
      <h3 className="font-bold mb-2">Install Utility Monitor</h3>
      <p className="text-sm text-gray-600 mb-4">
        Install this app on your device for quick access and offline support.
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleInstall}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Install
        </button>
        <button
          onClick={() => setShowPrompt(false)}
          className="px-4 py-2 bg-gray-200 rounded"
        >
          Not Now
        </button>
      </div>
    </div>
  );
}
```

## Migration Strategy

### Migration File Structure

```
migrations/
├── postgres/
│   ├── 001_initial_schema.sql
│   ├── 002_add_overdue_tracking.sql
│   └── 003_add_check_attempts.sql
├── redis/
│   ├── 001_initial_keys.ts
│   └── 002_add_overdue_tracking.ts
└── sqlite/
    ├── 001_initial_schema.sql
    ├── 002_add_overdue_tracking.sql
    └── 003_add_check_attempts.sql
```

### Migration Runner

**lib/migrations/runner.ts**:

```typescript
interface Migration {
  id: string;
  name: string;
  up: () => Promise<void>;
  down?: () => Promise<void>;
}

class MigrationRunner {
  constructor(private storageAdapter: StorageAdapter) {}

  async runPendingMigrations(): Promise<void> {
    const appliedMigrations = await this.getAppliedMigrations();
    const allMigrations = this.getAllMigrations();
    
    const pendingMigrations = allMigrations.filter(
      m => !appliedMigrations.includes(m.id)
    );
    
    for (const migration of pendingMigrations) {
      console.log(`Running migration: ${migration.name}`);
      await migration.up();
      await this.recordMigration(migration.id, migration.name);
      console.log(`Completed migration: ${migration.name}`);
    }
  }

  private async getAppliedMigrations(): Promise<string[]> {
    return await this.storageAdapter.getAppliedMigrations();
  }

  private getAllMigrations(): Migration[] {
    // Load migrations based on storage backend
    const backend = process.env.STORAGE_BACKEND;
    
    if (backend === 'postgres') {
      return this.loadPostgresMigrations();
    } else if (backend === 'redis') {
      return this.loadRedisMigrations();
    } else if (backend === 'sqlite') {
      return this.loadSQLiteMigrations();
    }
    
    throw new Error(`Unknown storage backend: ${backend}`);
  }

  private async recordMigration(id: string, name: string): Promise<void> {
    await this.storageAdapter.recordMigration(id, name);
  }
}
```

### Example Postgres Migration

**migrations/postgres/001_initial_schema.sql**:

```sql
-- Migration: 001_initial_schema
-- Description: Create initial database schema

BEGIN;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ntfy_feed_url TEXT NOT NULL,
  ntfy_server_url TEXT NOT NULL DEFAULT 'https://ntfy.sh',
  notification_enabled BOOLEAN NOT NULL DEFAULT true
);

-- Accounts table
CREATE TABLE IF NOT EXISTS accounts (
  account_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  provider_type VARCHAR(20) NOT NULL CHECK (provider_type IN ('gas', 'water', 'electricity', 'trash')),
  provider_name VARCHAR(100) NOT NULL,
  account_number TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  enabled BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);

-- Balances table
CREATE TABLE IF NOT EXISTS balances (
  balance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  balance DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'GEL',
  checked_at TIMESTAMP NOT NULL DEFAULT NOW(),
  success BOOLEAN NOT NULL,
  error TEXT,
  raw_response TEXT
);

CREATE INDEX IF NOT EXISTS idx_balances_account_id ON balances(account_id);
CREATE INDEX IF NOT EXISTS idx_balances_checked_at ON balances(checked_at DESC);

-- Record migration
INSERT INTO migrations (migration_name) VALUES ('001_initial_schema')
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
```

### Example Redis Migration

**migrations/redis/001_initial_keys.ts**:

```typescript
import { Redis } from '@upstash/redis';

export const migration_001_initial_keys = {
  id: '001',
  name: 'initial_keys',
  
  async up() {
    const redis = Redis.fromEnv();
    
    // Initialize migration tracking set
    await redis.sadd('migrations', '001_initial_keys');
    
    // No schema to create for Redis, but we can set up key patterns
    console.log('Redis key patterns initialized');
  },
  
  async down() {
    const redis = Redis.fromEnv();
    await redis.srem('migrations', '001_initial_keys');
  }
};
```

## Conclusion

This design document provides a comprehensive blueprint for the Georgia Utility Monitor system. The architecture emphasizes:

1. **Portability**: Storage abstraction and environment-based configuration enable deployment anywhere
2. **Extensibility**: Provider adapter pattern makes adding new utility companies straightforward
3. **Reliability**: Retry logic, error handling, and circuit breakers ensure robust operation
4. **Security**: Encryption, authentication, and input validation protect user data
5. **Testability**: Property-based testing ensures correctness across all inputs
6. **User Experience**: PWA capabilities provide native app-like experience

The system is ready for implementation following the task breakdown in the tasks document.
