# Implementation Plan: Georgia Utility Monitor

## Overview

This implementation plan breaks down the Georgia Utility Monitor into discrete, implementable tasks. The system is a Next.js PWA with TypeScript that monitors utility bills across multiple providers in Georgia, featuring storage abstraction (Redis/Postgres/SQLite), provider adapters, scheduled checks, and ntfy.sh notifications.

## Tasks

- [x] 1. Project setup and core infrastructure
  - Initialize Next.js 14+ project with TypeScript and App Router
  - Configure package.json with dependencies (React, Axios, Cheerio, fast-check, etc.)
  - Create Docker Compose configuration for local development (Redis, Postgres)
  - Set up environment variable structure (.env.local, .env.example)
  - Configure TypeScript (tsconfig.json) and ESLint
  - Create basic project directory structure (lib/, app/, components/, migrations/)
  - _Requirements: 20.1, 20.2, 20.3, 22.1, 22.2_

- [~] 2. Storage adapter interface and base implementation
  - [x] 2.1 Define StorageAdapter interface with all required methods
    - Create TypeScript interface for storage operations (users, accounts, balances, notifications, overdue tracking)
    - Define data model interfaces (User, Account, Balance, Notification, OverdueTracking, CheckAttempt)
    - _Requirements: 1.6, 2.6, 3.5, 20.1_

  - [ ]* 2.2 Write property test for storage adapter interface
    - **Property 1: Account Storage Round-Trip**
    - **Property 2: Notification Configuration Round-Trip**
    - **Property 3: Balance Storage Round-Trip**
    - **Validates: Requirements 1.6, 2.6, 3.5, 4.4, 5.5, 6.4**

- [~] 3. Implement Redis storage adapter
  - [x] 3.1 Create RedisAdapter class implementing StorageAdapter interface
    - Implement user operations (createUser, getUser, updateUser, deleteUser)
    - Implement account operations with Set-based indexing
    - Implement balance operations with Sorted Sets for history
    - Implement notification operations with capped Lists
    - Implement overdue tracking with Hashes
    - Implement check attempt tracking with Sorted Sets
    - _Requirements: 20.1, 20.4, 20.6_

  - [ ]* 3.2 Write unit tests for Redis adapter
    - Test CRUD operations for all data models
    - Test edge cases (missing keys, expired data)
    - _Requirements: 20.6_


- [~] 4. Implement Postgres storage adapter
  - [x] 4.1 Create PostgresAdapter class implementing StorageAdapter interface
    - Implement all storage operations using SQL queries
    - Use parameterized queries for security
    - Implement connection pooling
    - _Requirements: 20.1, 20.4, 20.6_

  - [ ]* 4.2 Write unit tests for Postgres adapter
    - Test CRUD operations for all data models
    - Test foreign key constraints and cascading deletes
    - _Requirements: 20.6_

- [~] 5. Implement SQLite storage adapter
  - [x] 5.1 Create SQLiteAdapter class implementing StorageAdapter interface
    - Implement all storage operations using SQLite-specific syntax
    - Handle TEXT-based UUIDs and timestamps
    - _Requirements: 20.1, 20.4, 20.6_

  - [ ]* 5.2 Write unit tests for SQLite adapter
    - Test CRUD operations for all data models
    - Test SQLite-specific data type handling
    - _Requirements: 20.6_

  - [ ]* 5.3 Write property test for storage backend equivalence
    - **Property 33: Storage Backend Behavioral Equivalence**
    - **Validates: Requirements 20.6**

- [x] 6. Checkpoint - Storage layer complete
  - Ensure all tests pass, ask the user if questions arise.

- [~] 7. Encryption service implementation
  - [x] 7.1 Create EncryptionService class with AES-256-GCM
    - Implement encrypt() method with IV generation
    - Implement decrypt() method with auth tag verification
    - Load encryption key from environment variables
    - _Requirements: 14.1, 14.3_

  - [ ]* 7.2 Write property test for encryption round-trip
    - **Property 21: Sensitive Data Encryption at Rest**
    - **Validates: Requirements 14.1**

  - [ ]* 7.3 Write unit tests for encryption service
    - Test encryption/decryption with various input sizes
    - Test error handling for invalid ciphertext
    - _Requirements: 14.1_

- [~] 8. Provider adapter interface and registry
  - [x] 8.1 Define ProviderAdapter interface
    - Create TypeScript interface with metadata, validation, and balance fetching methods
    - Define BalanceResult and RetryConfig interfaces
    - _Requirements: 3.1, 4.1, 5.1, 6.1, 15.4_

  - [x] 8.2 Create ProviderRegistry class
    - Implement adapter registration and lookup
    - Implement provider listing by type
    - _Requirements: 15.4_

  - [ ]* 8.3 Write property test for provider routing
    - **Property 25: Provider Routing Correctness**
    - **Validates: Requirements 15.4**

- [~] 9. Implement te.ge gas provider adapter
  - [x] 9.1 Create TeGeGasAdapter implementing ProviderAdapter
    - Implement account number validation (12 digits)
    - Implement fetchBalance() with Cheerio HTML parsing
    - Configure endpoint URL, timeout (30s), and retry logic (3 attempts, exponential backoff)
    - _Requirements: 3.1, 3.2, 3.3, 13.1, 13.4, 14.2_

  - [ ]* 9.2 Write property tests for te.ge adapter
    - **Property 4: Provider Adapter Request Formation**
    - **Property 5: Balance Parsing Correctness**
    - **Property 6: Retry on Provider Error**
    - **Property 7: Account Validation by Provider**
    - **Property 18: Request Timeout Enforcement**
    - **Property 19: Malformed Response Handling**
    - **Property 23: HTTPS Provider Communication**
    - **Property 26: Currency Normalization**
    - **Validates: Requirements 3.1, 3.2, 3.3, 13.1, 13.4, 14.2, 16.2, 16.4, 16.5**

  - [ ]* 9.3 Write unit tests for te.ge adapter
    - Test with known HTML response formats
    - Test error responses and edge cases
    - _Requirements: 3.1, 3.2, 3.3_


- [~] 10. Implement placeholder provider adapters
  - [x] 10.1 Create WaterProviderAdapter stub
    - Implement basic structure with validation and placeholder fetchBalance
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 10.2 Create ElectricityProviderAdapter stub
    - Implement basic structure with validation and placeholder fetchBalance
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 10.3 Create TrashProviderAdapter stub
    - Implement basic structure with validation and placeholder fetchBalance
    - _Requirements: 6.1, 6.2, 6.3_

- [~] 11. Notification service implementation
  - [x] 11.1 Create NotificationService class
    - Implement sendNotification() with ntfy.sh HTTP POST
    - Implement determinePriority() based on overdue days (0-7: default, 8-14: high, 15+: urgent)
    - Implement formatBalanceMessage() with provider name, masked account, balance, and ₾ symbol
    - Use configurable ntfy.sh server URL from environment
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 9.1, 9.2, 9.4, 25.1, 25.2, 25.3_

  - [ ]* 11.2 Write property tests for notification service
    - **Property 11: Non-Zero Balance Triggers Notification**
    - **Property 12: Zero Balance Suppresses Notification**
    - **Property 13: Notification Content Completeness**
    - **Property 14: Priority Escalation by Overdue Days**
    - **Property 17: Overdue Days in Notification**
    - **Property 40: Configurable Notification Server**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 9.1, 9.2, 9.4, 25.1, 25.2, 25.3**

  - [ ]* 11.3 Write unit tests for notification service
    - Test message formatting with various inputs
    - Test priority determination edge cases
    - Mock ntfy.sh HTTP calls
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [~] 12. Scheduler service implementation
  - [x] 12.1 Create SchedulerService class
    - Implement platform detection (Vercel vs local/VPS)
    - Implement executeScheduledCheck() to iterate all users and accounts
    - Configure 72-hour interval
    - Integrate with storage adapter and provider registry
    - Handle individual check failures gracefully
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 13.5_

  - [ ]* 12.2 Write property tests for scheduler service
    - **Property 9: Scheduled Check Completeness**
    - **Property 10: User Isolation in Scheduling**
    - **Validates: Requirements 7.2, 7.3, 7.4, 13.5**

  - [ ]* 12.3 Write unit tests for scheduler service
    - Test 72-hour interval configuration
    - Test execution with mock accounts
    - Test error handling for failed checks
    - _Requirements: 7.1, 7.2, 7.4_

- [x] 13. Checkpoint - Core services complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Authentication with Google OAuth
  - [x] 14.1 Install and configure NextAuth.js
    - Install next-auth package
    - Create NextAuth API route at app/api/auth/[...nextauth]/route.ts
    - Configure Google OAuth provider with client ID and secret
    - Set up environment variables (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET, NEXTAUTH_URL)
    - _Requirements: 14.1, 14.2, 14.3_

  - [x] 14.2 Create NextAuth storage adapter
    - Implement NextAuth Adapter interface for StorageAdapter
    - Add methods for session, account, and verification token management
    - Support all three storage backends (Redis, Postgres, SQLite)
    - _Requirements: 14.4, 14.7_

  - [x] 14.3 Update database schema for OAuth
    - Add OAuth-specific tables/keys: accounts, sessions, verification_tokens
    - Update users table with email, name, image, emailVerified fields
    - Create migration scripts for all storage backends
    - _Requirements: 14.4, 14.7_

  - [x] 14.4 Create authentication middleware
    - Implement getServerSession wrapper for API routes
    - Create requireAuth() helper for protected routes
    - Add session validation and error handling
    - _Requirements: 14.6_

  - [x] 14.5 Create sign-in and sign-out pages
    - Create app/auth/signin/page.tsx with Google sign-in button
    - Create app/auth/error/page.tsx for OAuth errors
    - Implement sign-out functionality
    - Add loading states and error handling
    - _Requirements: 14.2, 14.13_

  - [x] 14.6 Implement session management
    - Configure session cookies (HTTP-only, secure, SameSite)
    - Set 30-day session expiration
    - Implement automatic session renewal
    - Add CSRF protection
    - _Requirements: 14.5, 14.12_

  - [ ]* 14.7 Write unit tests for authentication
    - Test OAuth callback handling
    - Test session creation and validation
    - Test protected route middleware
    - Test sign-out flow
    - _Requirements: 14.1-14.13_

  - [ ]* 14.8 Write property test for authentication
    - **Property 24: Unauthenticated Request Rejection**
    - **Property 41: Session Expiration Enforcement**
    - **Property 42: OAuth Token Security**
    - **Validates: Requirements 14.6, 14.10**

- [~] 15. API route: /api/accounts
  - [x] 15.1 Implement POST /api/accounts (create account)
    - Validate provider type and account number format
    - Encrypt account number before storage
    - Store via storage adapter
    - _Requirements: 1.1, 1.2, 1.5, 1.6, 14.8_

  - [x] 15.2 Implement GET /api/accounts (list accounts)
    - Retrieve accounts for authenticated user
    - Decrypt account numbers for display
    - Include current balance and last checked timestamp
    - _Requirements: 1.3, 1.6_

  - [x] 15.3 Implement PUT /api/accounts/:id (update account)
    - Validate and encrypt updated data
    - _Requirements: 1.4, 1.6_

  - [x] 15.4 Implement DELETE /api/accounts/:id (delete account)
    - Remove account and associated data
    - _Requirements: 1.4, 1.6_

  - [ ]* 15.5 Write unit tests for /api/accounts
    - Test CRUD operations with authentication
    - Test validation errors
    - Test encryption/decryption
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_


- [~] 16. API route: /api/balances/check
  - [x] 16.1 Implement POST /api/balances/check (manual balance check)
    - Route request to appropriate provider adapter
    - Store result via storage adapter
    - Update overdue counter based on balance
    - Send notification if balance is non-zero
    - Handle provider errors and retries
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 8.1, 8.5, 9.3, 9.5, 13.1, 13.2, 13.3_

  - [ ]* 16.2 Write property tests for balance check
    - **Property 15: Overdue Counter Increment**
    - **Property 16: Overdue Counter Reset**
    - **Property 20: Failed Check Notification**
    - **Validates: Requirements 9.3, 9.5, 13.3**

  - [ ]* 16.3 Write unit tests for /api/balances/check
    - Test successful balance check flow
    - Test provider error handling
    - Test notification triggering
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [~] 17. API route: /api/balances/history
  - [x] 17.1 Implement GET /api/balances/history
    - Retrieve historical balance data for account
    - Filter by date range (days parameter)
    - _Requirements: 3.5, 10.1, 10.2_

  - [ ]* 17.2 Write unit tests for /api/balances/history
    - Test data retrieval with various date ranges
    - Test empty history handling
    - _Requirements: 10.1, 10.2_

- [~] 18. API route: /api/notifications/config
  - [x] 18.1 Implement POST /api/notifications/config
    - Validate ntfy.sh URLs (HTTP/HTTPS format)
    - Encrypt feed URL before storage
    - Store configuration via storage adapter
    - _Requirements: 2.1, 2.2, 2.4, 2.6, 25.4_

  - [x] 18.2 Implement GET /api/notifications/config
    - Retrieve and decrypt notification configuration
    - _Requirements: 2.3, 2.6_

  - [ ]* 18.3 Write property test for URL validation
    - **Property 8: URL Format Validation**
    - **Validates: Requirements 2.4, 25.4**

  - [ ]* 18.4 Write unit tests for /api/notifications/config
    - Test configuration save and retrieve
    - Test URL validation
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6_

- [~] 19. API route: /api/notifications/test
  - [x] 19.1 Implement POST /api/notifications/test
    - Send test notification to user's configured feed
    - Verify delivery and return status
    - _Requirements: 2.5_

  - [ ]* 19.2 Write unit tests for /api/notifications/test
    - Test notification sending with mock ntfy.sh
    - Test error handling
    - _Requirements: 2.5_

- [~] 20. API route: /api/notifications/history
  - [x] 20.1 Implement GET /api/notifications/history
    - Retrieve notification history for user
    - Include delivery status and timestamps
    - _Requirements: 17.1, 17.3_

  - [ ]* 20.2 Write property test for notification logging
    - **Property 27: Notification Delivery Logging**
    - **Property 28: Notification Delivery Success Rate Calculation**
    - **Validates: Requirements 17.1, 17.3, 17.5**

  - [ ]* 20.3 Write unit tests for /api/notifications/history
    - Test history retrieval
    - Test success rate calculation
    - _Requirements: 17.1, 17.3, 17.5_

- [~] 21. API route: /api/config/export
  - [x] 21.1 Implement GET /api/config/export
    - Export user configuration as JSON
    - Exclude sensitive tokens (keep encrypted values)
    - _Requirements: 18.1, 18.4_

  - [ ]* 21.2 Write property test for configuration export
    - **Property 29: Configuration Export Completeness**
    - **Validates: Requirements 18.1, 18.4**

  - [ ]* 21.3 Write unit tests for /api/config/export
    - Test JSON export format
    - Verify sensitive data handling
    - _Requirements: 18.1, 18.4_

- [~] 22. API route: /api/config/import
  - [x] 22.1 Implement POST /api/config/import
    - Validate imported JSON structure
    - Sanitize and import account configurations
    - _Requirements: 18.2, 18.3_

  - [ ]* 22.2 Write property test for configuration import
    - **Property 30: Configuration Import Round-Trip**
    - **Validates: Requirements 18.2, 18.3**

  - [ ]* 22.3 Write unit tests for /api/config/import
    - Test import with valid JSON
    - Test validation errors
    - _Requirements: 18.2, 18.3_


- [~] 23. API route: /api/health
  - [x] 23.1 Implement GET /api/health
    - Check storage backend status
    - Calculate provider success rates
    - Return system health metrics
    - _Requirements: 19.1, 19.2, 19.3_

  - [ ]* 23.2 Write property test for provider success rate
    - **Property 31: Provider Success Rate Calculation**
    - **Property 32: Low Success Rate Alert**
    - **Validates: Requirements 19.2, 19.4**

  - [ ]* 23.3 Write unit tests for /api/health
    - Test health check with various backend states
    - Test success rate calculations
    - _Requirements: 19.1, 19.2, 19.3_

- [~] 24. API route: /api/cron/check-balances
  - [x] 24.1 Implement POST /api/cron/check-balances
    - Protect with cron secret authentication
    - Execute scheduled checks for all users
    - Integrate with SchedulerService
    - Log execution results
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 21.1, 21.2_

  - [ ]* 24.2 Write unit tests for /api/cron/check-balances
    - Test cron secret authentication
    - Test scheduled execution flow
    - Mock scheduler service
    - _Requirements: 7.1, 7.2, 21.1, 21.2_

- [~] 25. Checkpoint - API routes complete
  - Ensure all tests pass, ask the user if questions arise.

- [~] 26. Frontend: Account management component
  - [x] 26.1 Create AccountManagement component
    - Implement add account form with provider selection and account number input
    - Implement account list display with current balances
    - Implement edit and delete functionality
    - Validate account number formats per provider
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 26.2 Write unit tests for AccountManagement component
    - Test form submission and validation
    - Test account list rendering
    - Test edit and delete actions
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [~] 27. Frontend: Notification configuration component
  - [x] 27.1 Create NotificationConfig component
    - Implement ntfy.sh feed URL input
    - Implement ntfy.sh server URL input
    - Implement test notification button
    - Display subscription instructions
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 27.2 Write unit tests for NotificationConfig component
    - Test form submission
    - Test URL validation
    - Test notification button
    - _Requirements: 2.1, 2.2, 2.5_

- [~] 28. Frontend: Balance display component
  - [x] 28.1 Create BalanceDisplay component
    - Display current balance per account
    - Show last check timestamp
    - Display overdue day counter with visual indicators
    - Render balance history chart
    - _Requirements: 3.4, 9.4, 10.1, 10.2, 10.3_

  - [ ]* 28.2 Write unit tests for BalanceDisplay component
    - Test balance rendering
    - Test overdue indicator display
    - Test chart rendering
    - _Requirements: 3.4, 10.1, 10.2_

- [~] 29. Frontend: Manual refresh component
  - [x] 29.1 Create ManualRefresh component
    - Implement refresh button per account
    - Show loading state during check
    - Display error messages
    - Show success confirmation
    - _Requirements: 3.4_

  - [ ]* 29.2 Write unit tests for ManualRefresh component
    - Test button click and loading state
    - Test error display
    - Test success confirmation
    - _Requirements: 3.4_

- [~] 30. Frontend: Configuration import/export component
  - [x] 30.1 Create ConfigImportExport component
    - Implement export to JSON button
    - Implement import from JSON file upload
    - Validate imported data
    - Display import summary
    - _Requirements: 18.1, 18.2, 18.3_

  - [ ]* 30.2 Write unit tests for ConfigImportExport component
    - Test export functionality
    - Test import with valid/invalid files
    - Test validation display
    - _Requirements: 18.1, 18.2, 18.3_

- [~] 31. Frontend: Main layout and navigation
  - [x] 31.1 Create app layout with navigation
    - Implement responsive layout
    - Add navigation between pages (accounts, notifications, history, settings)
    - Integrate service worker registration
    - Add PWA meta tags
    - _Requirements: 11.1, 11.2_

  - [ ]* 31.2 Write unit tests for layout component
    - Test navigation rendering
    - Test responsive behavior
    - _Requirements: 11.1_


- [~] 32. PWA configuration
  - [x] 32.1 Create Web App Manifest (public/manifest.json)
    - Configure app name, icons, theme colors
    - Add icon files in multiple sizes (72x72 to 512x512)
    - Configure display mode as standalone
    - _Requirements: 11.1, 11.2, 11.3_

  - [x] 32.2 Create Service Worker (public/sw.js)
    - Implement install event with static asset caching
    - Implement fetch event with cache-first strategy
    - Implement activate event with cache cleanup
    - _Requirements: 11.1, 11.2, 11.4_

  - [~] 32.3 Create offline page (app/offline/page.tsx)
    - Display offline message
    - Add retry button
    - _Requirements: 11.4_

  - [x] 32.4 Create InstallPrompt component
    - Detect beforeinstallprompt event
    - Show install banner
    - Handle install acceptance/dismissal
    - _Requirements: 11.3_

  - [ ]* 32.5 Write unit tests for PWA components
    - Test service worker registration
    - Test install prompt behavior
    - _Requirements: 11.1, 11.3_

- [~] 33. Vercel Cron integration
  - [x] 33.1 Create vercel.json configuration
    - Configure cron job for /api/cron/check-balances
    - Set 72-hour schedule (0 */72 * * *)
    - _Requirements: 21.1, 21.2_

  - [~] 33.2 Implement platform detection in SchedulerService
    - Detect Vercel environment
    - Use Vercel Cron when on Vercel platform
    - _Requirements: 21.1, 21.2_

- [~] 34. Node-cron integration for local/VPS
  - [x] 34.1 Implement node-cron scheduler
    - Configure 72-hour interval
    - Call /api/cron/check-balances endpoint
    - Start scheduler on app initialization (non-Vercel environments)
    - _Requirements: 21.3, 21.4_

  - [ ]* 34.2 Write unit tests for node-cron scheduler
    - Test scheduler initialization
    - Test interval configuration
    - _Requirements: 21.3, 21.4_

- [~] 35. Environment configuration and validation
  - [x] 35.1 Create environment variable validation
    - Validate required variables at startup (STORAGE_BACKEND, ENCRYPTION_KEY, JWT_SECRET)
    - Provide defaults for optional variables (NTFY_SERVER_URL, SCHEDULER_INTERVAL_HOURS)
    - Fail fast with clear error messages for missing required variables
    - _Requirements: 22.1, 22.2, 22.3_

  - [x] 35.2 Create .env.example file
    - Document all environment variables with descriptions
    - Provide example values
    - _Requirements: 22.1, 22.2_

  - [ ]* 35.3 Write property tests for environment configuration
    - **Property 35: Environment Variable Configuration**
    - **Property 36: Required Environment Variable Validation**
    - **Property 37: Environment-Specific Configuration**
    - **Validates: Requirements 22.1, 22.2, 22.3, 22.4, 22.5**

  - [ ]* 35.4 Write unit tests for environment validation
    - Test with missing required variables
    - Test with valid configuration
    - Test default value application
    - _Requirements: 22.1, 22.2, 22.3_

- [~] 36. Checkpoint - Configuration and scheduling complete
  - Ensure all tests pass, ask the user if questions arise.

- [~] 37. Migration system implementation
  - [x] 37.1 Create MigrationRunner class
    - Implement runPendingMigrations() method
    - Detect storage backend and load appropriate migrations
    - Track applied migrations
    - _Requirements: 23.1, 23.2_

  - [~] 37.2 Create Postgres migration: 001_initial_schema.sql
    - Create users, accounts, balances, notifications, overdue_tracking, check_attempts tables
    - Add indexes and foreign keys
    - _Requirements: 23.1_

  - [~] 37.3 Create Postgres migration: 002_add_migrations_table.sql
    - Create migrations tracking table
    - _Requirements: 23.2_

  - [~] 37.4 Create Redis migration: 001_initial_keys.ts
    - Initialize migration tracking set
    - Document key patterns
    - _Requirements: 23.1_

  - [~] 37.5 Create SQLite migration: 001_initial_schema.sql
    - Create tables with SQLite-specific types
    - Add indexes
    - _Requirements: 23.1_

  - [ ]* 37.6 Write property tests for migrations
    - **Property 38: Migration Idempotency**
    - **Property 39: Pending Migration Detection**
    - **Validates: Requirements 23.3, 23.4, 23.5**

  - [ ]* 37.7 Write unit tests for migration system
    - Test migration detection and execution
    - Test idempotency
    - Test rollback (if supported)
    - _Requirements: 23.1, 23.2, 23.3_


- [~] 38. Security hardening
  - [~] 38.1 Implement rate limiting
    - Add rate limiting middleware using Redis/Vercel KV
    - Configure limits: 100 req/min general, 10 req/min for balance checks, 1 req/min for test notifications
    - _Requirements: 14.4_

  - [~] 38.2 Implement input validation and sanitization
    - Validate account numbers (alphanumeric, 8-20 chars)
    - Validate URLs (HTTP/HTTPS only, no javascript: protocol)
    - Validate provider types (enum)
    - Validate balance values (non-negative)
    - HTML escape user-provided text
    - _Requirements: 14.6, 16.1_

  - [~] 38.3 Implement log sanitization
    - Create logging utility that masks sensitive data
    - Ensure no plaintext account numbers, tokens, or keys in logs
    - _Requirements: 14.3, 18.4_

  - [ ]* 38.4 Write property test for log sanitization
    - **Property 22: No Plaintext Sensitive Data in Logs**
    - **Validates: Requirements 14.3, 18.4**

  - [ ]* 38.5 Write unit tests for security features
    - Test rate limiting enforcement
    - Test input validation rejection
    - Test log sanitization
    - _Requirements: 14.3, 14.4, 14.6_

- [~] 39. Error handling and circuit breaker
  - [~] 39.1 Implement error response format
    - Create standardized ErrorResponse interface
    - Return consistent error format from all API routes
    - Include error code, message, details, and retryable flag
    - _Requirements: 13.1, 13.2_

  - [~] 39.2 Implement circuit breaker for provider adapters
    - Track consecutive failures (threshold: 5)
    - Open circuit for 5 minutes after threshold
    - Return cached balance or error during open state
    - Implement half-open state for recovery
    - _Requirements: 13.1, 19.3_

  - [ ]* 39.3 Write unit tests for error handling
    - Test error response format
    - Test circuit breaker activation and recovery
    - _Requirements: 13.1, 13.2, 19.3_

- [~] 40. Docker Compose configuration
  - [x] 40.1 Create docker-compose.yml
    - Configure Redis service with persistence
    - Configure Postgres service with initialization scripts
    - Configure app service with environment variables
    - Set up volume mounts
    - _Requirements: 20.2, 20.3_

  - [x] 40.2 Create Dockerfile for production
    - Multi-stage build with dependencies, builder, and runner stages
    - Configure Next.js standalone output
    - Set up non-root user
    - _Requirements: 20.3_

  - [ ]* 40.3 Write integration tests for Docker setup
    - Test Docker Compose startup
    - Test service connectivity
    - _Requirements: 20.2, 20.3_

- [~] 41. Checkpoint - Security and deployment complete
  - Ensure all tests pass, ask the user if questions arise.

- [~] 42. Storage adapter factory and initialization
  - [~] 42.1 Create StorageAdapterFactory
    - Implement factory method to create adapter based on STORAGE_BACKEND env var
    - Initialize connection pools and clients
    - _Requirements: 20.5, 22.4_

  - [ ]* 42.2 Write property test for storage backend selection
    - **Property 34: Storage Backend Selection**
    - **Validates: Requirements 20.5**

  - [ ]* 42.3 Write unit tests for storage factory
    - Test adapter creation for each backend type
    - Test error handling for invalid backend
    - _Requirements: 20.5_

- [~] 43. Integration testing
  - [ ]* 43.1 Write end-to-end integration tests
    - Test user registration → account addition → balance check → notification flow
    - Test configuration export → import → verification flow
    - Test scheduled check execution → notification escalation flow
    - _Requirements: 1.1, 1.2, 3.1, 3.2, 3.4, 8.1, 9.1_

  - [ ]* 43.2 Write multi-backend integration tests
    - Run same test suite against Redis, Postgres, and SQLite
    - Verify behavioral equivalence
    - _Requirements: 20.6_

  - [ ]* 43.3 Write provider adapter integration tests
    - Mock provider endpoints with various response scenarios
    - Test timeout and retry behavior
    - Test circuit breaker activation
    - _Requirements: 3.3, 13.1, 13.4_

- [~] 44. Documentation
  - [x] 44.1 Create README.md
    - Document project overview and features
    - Add installation instructions for local development
    - Document environment variable configuration
    - Add usage instructions
    - Include troubleshooting section
    - _Requirements: 24.1, 24.2_

  - [~] 44.2 Create DEPLOYMENT.md
    - Document Vercel deployment steps
    - Document self-hosted VPS deployment steps
    - Document Docker deployment steps
    - Include environment-specific configuration examples
    - _Requirements: 24.3, 24.4_

  - [~] 44.3 Create API.md
    - Document all API endpoints with request/response examples
    - Document authentication requirements
    - Document error codes and responses
    - _Requirements: 24.2_

  - [~] 44.4 Create CONTRIBUTING.md
    - Document development setup
    - Document testing requirements
    - Document code style guidelines
    - _Requirements: 24.2_


- [~] 45. Performance optimization
  - [~] 45.1 Implement database query optimization
    - Add indexes for frequently queried fields
    - Implement connection pooling
    - Optimize balance history queries
    - _Requirements: 19.1_

  - [~] 45.2 Implement caching strategy
    - Cache provider success rates
    - Cache latest balances with TTL
    - Implement cache invalidation on updates
    - _Requirements: 19.1, 19.2_

  - [ ]* 45.3 Write performance tests
    - Test with 1000+ accounts across 100+ users
    - Measure scheduler execution time
    - Measure database query performance
    - _Requirements: 19.1_

- [~] 46. Monitoring and logging
  - [~] 46.1 Implement structured logging
    - Create logger utility with log levels
    - Log all provider check attempts
    - Log all notification deliveries
    - Log authentication failures
    - _Requirements: 17.1, 17.3, 19.1_

  - [~] 46.2 Implement metrics collection
    - Track provider success rates
    - Track notification delivery rates
    - Track API response times
    - _Requirements: 17.5, 19.2_

  - [ ]* 46.3 Write unit tests for logging and metrics
    - Test log formatting
    - Test metrics calculation
    - _Requirements: 17.1, 17.5, 19.2_

- [~] 47. Final integration and wiring
  - [x] 47.1 Wire all components together
    - Initialize storage adapter factory in app startup
    - Register all provider adapters in registry
    - Initialize scheduler service
    - Connect API routes to services
    - _Requirements: All_

  - [x] 47.2 Create app initialization script
    - Run migrations on startup
    - Validate environment configuration
    - Initialize services
    - Start scheduler (if not Vercel)
    - _Requirements: 22.3, 23.3, 23.4_

  - [ ]* 47.3 Write end-to-end system tests
    - Test complete user flows
    - Test all deployment configurations
    - _Requirements: All_

- [~] 48. Final checkpoint - System complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (40 properties total)
- Unit tests validate specific examples and edge cases
- The system uses TypeScript with Next.js 14+ and supports three storage backends (Redis, Postgres, SQLite)
- All sensitive data (account numbers, notification URLs) must be encrypted at rest
- The scheduler adapts to deployment environment (Vercel Cron vs node-cron)
- Provider adapters use retry logic with exponential backoff and circuit breaker pattern

## Property Test Summary

The following 42 correctness properties from the design document should be tested:

1. Account Storage Round-Trip (Task 2.2)
2. Notification Configuration Round-Trip (Task 2.2)
3. Balance Storage Round-Trip (Task 2.2)
4. Provider Adapter Request Formation (Task 9.2)
5. Balance Parsing Correctness (Task 9.2)
6. Retry on Provider Error (Task 9.2)
7. Account Validation by Provider (Task 9.2)
8. URL Format Validation (Task 18.3)
9. Scheduled Check Completeness (Task 12.2)
10. User Isolation in Scheduling (Task 12.2)
11. Non-Zero Balance Triggers Notification (Task 11.2)
12. Zero Balance Suppresses Notification (Task 11.2)
13. Notification Content Completeness (Task 11.2)
14. Priority Escalation by Overdue Days (Task 11.2)
15. Overdue Counter Increment (Task 16.2)
16. Overdue Counter Reset (Task 16.2)
17. Overdue Days in Notification (Task 11.2)
18. Request Timeout Enforcement (Task 9.2)
19. Malformed Response Handling (Task 9.2)
20. Failed Check Notification (Task 16.2)
21. Sensitive Data Encryption at Rest (Task 7.2)
22. No Plaintext Sensitive Data in Logs (Task 38.4)
23. HTTPS Provider Communication (Task 9.2)
24. Unauthenticated Request Rejection (Task 14.8)
25. Provider Routing Correctness (Task 8.3)
26. Currency Normalization (Task 9.2)
27. Notification Delivery Logging (Task 20.2)
28. Notification Delivery Success Rate Calculation (Task 20.2)
29. Configuration Export Completeness (Task 21.2)
30. Configuration Import Round-Trip (Task 22.2)
31. Provider Success Rate Calculation (Task 23.2)
32. Low Success Rate Alert (Task 23.2)
33. Storage Backend Behavioral Equivalence (Task 5.3)
34. Storage Backend Selection (Task 42.2)
35. Environment Variable Configuration (Task 35.3)
36. Required Environment Variable Validation (Task 35.3)
37. Environment-Specific Configuration (Task 35.3)
38. Migration Idempotency (Task 37.6)
39. Pending Migration Detection (Task 37.6)
40. Configurable Notification Server (Task 11.2)
41. Session Expiration Enforcement (Task 14.8)
42. OAuth Token Security (Task 14.8)

## Test Configuration

All property-based tests should use fast-check with:
- Minimum 100 iterations per test
- Tag format: `Feature: georgia-utility-monitor, Property {number}: {property_text}`
- Custom arbitraries for domain-specific data generation

## Implementation Order

The tasks are ordered to enable incremental development:
1. Foundation (project setup, interfaces, storage adapters)
2. Core services (encryption, providers, notifications, scheduler)
3. API layer (all endpoints)
4. Frontend (UI components)
5. PWA and deployment (manifest, service worker, Docker)
6. Security and optimization (rate limiting, caching, monitoring)
7. Integration and documentation

Each checkpoint allows for validation before proceeding to the next phase.
