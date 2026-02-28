# Requirements Document

## Introduction

The Georgia Utility Monitor is a web-based Progressive Web App (PWA) that monitors utility bills for residents throughout Georgia. The system periodically checks balances across multiple utility providers (gas, water, electricity, trash) and sends push notifications when bills are due or overdue. The system emphasizes portability and local-first development, with a Next.js frontend deployed to Vercel (or self-hosted), configurable storage backends (Redis, Postgres, SQLite), and ntfy.sh for notifications. The architecture supports both local development with Docker Compose and production deployment to Vercel or any Node.js hosting environment.

## Glossary

- **System**: The complete Georgia Utility Monitor application including frontend, backend, and notification components
- **Frontend**: The Next.js Progressive Web App interface
- **Backend**: The Next.js API routes that fetch utility data and manage scheduling
- **Storage_Adapter**: The abstraction layer supporting multiple storage backends (Redis, Postgres, SQLite)
- **Notification_Service**: The ntfy.sh integration for push notifications
- **Scheduler**: The component that triggers periodic balance checks (Vercel Cron in production, node-cron locally)
- **User**: A Georgia resident monitoring their utility bills
- **Utility_Provider**: An organization providing utilities (gas, water, electricity, trash services) throughout Georgia
- **Account**: A user's account with a specific utility provider, identified by an account number
- **Balance**: The amount owed to a utility provider in Georgian Lari (₾)
- **Balance_Check**: A scheduled query to a utility provider's system to retrieve current balance
- **Notification_Feed**: A unique ntfy.sh topic URL for a specific user
- **Overdue_Period**: The number of days a non-zero balance has persisted
- **Priority_Level**: The urgency level of a notification (normal, high, urgent)
- **Docker_Compose**: The local development environment configuration with Redis and Postgres
- **Migration**: A database schema change script supporting both Postgres and Redis

## Requirements

### Requirement 1: User Account Management

**User Story:** As a user, I want to register and manage my utility accounts, so that I can monitor all my bills in one place.

#### Acceptance Criteria

1. THE Frontend SHALL allow users to add utility accounts by provider type and account number
2. THE Frontend SHALL allow users to edit existing utility account information
3. THE Frontend SHALL allow users to remove utility accounts
4. THE Frontend SHALL display a list of all configured utility accounts
5. WHEN a user adds an account, THE System SHALL validate the account number format for the selected provider
6. THE Storage_Adapter SHALL persist user account configurations to the configured backend

### Requirement 2: Notification Feed Configuration

**User Story:** As a user, I want to configure my notification preferences, so that I receive alerts on my preferred device.

#### Acceptance Criteria

1. THE Frontend SHALL allow users to configure their ntfy.sh notification feed URL
2. THE Frontend SHALL support configurable ntfy.sh server URLs (self-hosted or cloud)
3. THE Frontend SHALL provide instructions for subscribing to the notification feed via web or mobile app
4. WHEN a user configures a notification feed, THE System SHALL validate the feed URL format
5. THE Frontend SHALL allow users to test their notification configuration by sending a test message
6. THE Storage_Adapter SHALL store the notification feed URL securely associated with the user's account

### Requirement 3: Gas Utility Data Retrieval

**User Story:** As a user, I want the system to check my gas bill balance, so that I know when payment is due.

#### Acceptance Criteria

1. WHEN a balance check is triggered for a gas account, THE Backend SHALL POST to the provider's endpoint with the account number
2. THE Backend SHALL parse the HTML response to extract the balance amount in Georgian Lari
3. IF the provider returns an error response, THEN THE Backend SHALL log the error and retry according to the retry policy
4. THE Backend SHALL support multiple gas providers serving Georgia including te.ge
5. WHEN the balance is successfully retrieved, THE Storage_Adapter SHALL store the balance with a timestamp

### Requirement 4: Water Utility Data Retrieval

**User Story:** As a user, I want the system to check my water bill balance, so that I know when payment is due.

#### Acceptance Criteria

1. WHEN a balance check is triggered for a water account, THE Backend SHALL query the water provider's system with the account number
2. THE Backend SHALL parse the provider's response to extract the balance amount in Georgian Lari
3. IF the provider returns an error response, THEN THE Backend SHALL log the error and retry according to the retry policy
4. WHEN the balance is successfully retrieved, THE Storage_Adapter SHALL store the balance with a timestamp

### Requirement 5: Electricity Utility Data Retrieval

**User Story:** As a user, I want the system to check my electricity bill balance, so that I know when payment is due.

#### Acceptance Criteria

1. WHEN a balance check is triggered for an electricity account, THE Backend SHALL query the provider's system with the account number
2. THE Backend SHALL parse the provider's response to extract the balance amount in Georgian Lari
3. IF the provider returns an error response, THEN THE Backend SHALL log the error and retry according to the retry policy
4. THE Backend SHALL support multiple electricity providers serving Georgia
5. WHEN the balance is successfully retrieved, THE Storage_Adapter SHALL store the balance with a timestamp

### Requirement 6: Trash Service Data Retrieval

**User Story:** As a user, I want the system to check my trash service bill balance, so that I know when payment is due.

#### Acceptance Criteria

1. WHEN a balance check is triggered for a trash service account, THE Backend SHALL query the provider's system with the account number
2. THE Backend SHALL parse the provider's response to extract the balance amount in Georgian Lari
3. IF the provider returns an error response, THEN THE Backend SHALL log the error and retry according to the retry policy
4. WHEN the balance is successfully retrieved, THE Storage_Adapter SHALL store the balance with a timestamp

### Requirement 7: Scheduled Balance Monitoring

**User Story:** As a user, I want the system to automatically check my balances every few days, so that I don't have to manually check each provider.

#### Acceptance Criteria

1. THE Scheduler SHALL trigger balance checks for all configured accounts every 72 hours
2. WHEN a scheduled check runs, THE Scheduler SHALL invoke the Backend for each configured account
3. THE Scheduler SHALL execute independently for each user's configured accounts
4. IF a balance check fails, THEN THE Scheduler SHALL continue processing remaining accounts
5. THE System SHALL log all scheduled check executions with timestamps
6. WHERE deployed to Vercel, THE Scheduler SHALL use Vercel Cron
7. WHERE running locally, THE Scheduler SHALL use node-cron or equivalent

### Requirement 8: Balance Change Notification

**User Story:** As a user, I want to receive notifications when I have a non-zero balance, so that I can pay my bills on time.

#### Acceptance Criteria

1. WHEN a balance check returns a non-zero balance, THE System SHALL send a notification to the user's notification feed
2. THE Notification_Service SHALL include the provider name, account number, and balance amount in the notification
3. THE Notification_Service SHALL format the balance amount in Georgian Lari with the ₾ symbol
4. WHEN a balance changes from zero to non-zero, THE System SHALL send a notification with normal priority
5. WHEN a balance remains at zero, THE System SHALL NOT send a notification
6. THE Notification_Service SHALL POST to the configured ntfy.sh server URL

### Requirement 9: Overdue Balance Escalation

**User Story:** As a user, I want to receive escalated notifications for overdue bills, so that I don't miss important payments.

#### Acceptance Criteria

1. WHEN a non-zero balance persists for more than 7 days, THE System SHALL send a notification with high priority
2. WHEN a non-zero balance persists for more than 14 days, THE System SHALL send a notification with urgent priority
3. THE Storage_Adapter SHALL track the number of consecutive days a balance has been non-zero
4. THE Notification_Service SHALL include the number of days overdue in escalated notifications
5. WHEN a balance returns to zero, THE Storage_Adapter SHALL reset the overdue day counter for that account

### Requirement 10: Progressive Web App Installation

**User Story:** As a user, I want to install the app on my mobile device, so that I can access it like a native app.

#### Acceptance Criteria

1. THE Frontend SHALL include a valid web app manifest with app metadata
2. THE Frontend SHALL register a service worker for offline functionality
3. THE Frontend SHALL meet Progressive Web App installability criteria
4. WHEN a user visits the Frontend on a mobile device, THE browser SHALL offer to install the app
5. THE Frontend SHALL function when installed as a standalone app

### Requirement 11: Manual Balance Refresh

**User Story:** As a user, I want to manually refresh my balances, so that I can get immediate updates when needed.

#### Acceptance Criteria

1. THE Frontend SHALL provide a refresh button for each configured account
2. WHEN a user triggers a manual refresh, THE Frontend SHALL invoke the Backend to fetch the current balance
3. THE Frontend SHALL display a loading indicator while the balance is being fetched
4. WHEN the balance is retrieved, THE Frontend SHALL update the display with the new balance and timestamp
5. IF the balance fetch fails, THEN THE Frontend SHALL display an error message to the user

### Requirement 12: Balance History Display

**User Story:** As a user, I want to view my balance history, so that I can track payment patterns over time.

#### Acceptance Criteria

1. THE Frontend SHALL display the current balance for each configured account
2. THE Frontend SHALL display the timestamp of the last balance check
3. THE Frontend SHALL display the number of days a non-zero balance has persisted
4. WHERE historical data is available, THE Frontend SHALL display a chart of balance changes over time
5. THE Frontend SHALL indicate which accounts have overdue balances with visual indicators

### Requirement 13: Error Handling and Retry Logic

**User Story:** As a system administrator, I want robust error handling, so that temporary failures don't prevent monitoring.

#### Acceptance Criteria

1. WHEN a provider endpoint is unreachable, THE Backend SHALL retry up to 3 times with exponential backoff
2. WHEN a provider returns malformed data, THE Backend SHALL log the error and mark the check as failed
3. IF all retry attempts fail, THEN THE System SHALL send a notification to the user about the failed check
4. THE Backend SHALL implement timeout limits of 30 seconds per provider request
5. THE System SHALL continue monitoring other accounts even when one account check fails

### Requirement 14: Authentication and Data Security

**User Story:** As a user, I want to securely sign in with my Google account and have my data protected, so that only I can access my utility monitoring information.

#### Acceptance Criteria

1. THE System SHALL use Google OAuth 2.0 as the sole authentication method
2. WHEN a user visits the application, THE System SHALL redirect unauthenticated users to the Google sign-in page
3. THE System SHALL use NextAuth.js for OAuth flow management and session handling
4. THE System SHALL store user profile information (email, name, profile picture) from Google in the database
5. THE System SHALL create secure HTTP-only session cookies with 30-day expiration
6. THE System SHALL protect all API routes requiring authentication using NextAuth session middleware
7. THE System SHALL automatically create a user record on first Google sign-in
8. THE Storage_Adapter SHALL encrypt account numbers and notification feed URLs at rest
9. THE Backend SHALL communicate with utility providers over HTTPS
10. THE System SHALL NOT log sensitive information such as account numbers, session tokens, or OAuth tokens in plain text
11. THE Frontend SHALL communicate with the Backend over HTTPS
12. THE System SHALL implement CSRF protection for all state-changing operations
13. WHEN a user signs out, THE System SHALL invalidate their session and clear all cookies

### Requirement 15: Multi-Provider Support Architecture

**User Story:** As a developer, I want a flexible provider integration system, so that new utility providers can be added easily.

#### Acceptance Criteria

1. THE Backend SHALL implement a provider adapter interface for utility data retrieval
2. WHEN a new provider is added, THE Backend SHALL require only a new adapter implementation
3. THE System SHALL maintain a registry of supported providers with their adapter implementations
4. THE Backend SHALL route balance check requests to the appropriate provider adapter
5. THE Frontend SHALL display available providers from the provider registry

### Requirement 16: Response Parsing and Validation

**User Story:** As a developer, I want robust HTML parsing, so that balance extraction is reliable across provider updates.

#### Acceptance Criteria

1. WHEN parsing provider responses, THE Backend SHALL validate that the response contains expected data structures
2. THE Backend SHALL extract numeric balance values and convert them to a standard format
3. IF the response format is unrecognized, THEN THE Backend SHALL log the raw response for debugging
4. THE Backend SHALL handle multiple currency formats and normalize to Georgian Lari
5. THE Backend SHALL validate that extracted balance values are non-negative numbers

### Requirement 17: Notification Delivery Verification

**User Story:** As a user, I want confirmation that notifications are being sent, so that I can trust the monitoring system.

#### Acceptance Criteria

1. WHEN the Notification_Service sends a notification, THE System SHALL log the delivery attempt
2. THE Frontend SHALL display the timestamp of the last notification sent for each account
3. WHERE notification delivery fails, THE System SHALL log the failure reason
4. THE Frontend SHALL provide a notification history view showing recent alerts
5. THE System SHALL track notification delivery success rate per user

### Requirement 18: Configuration Import and Export

**User Story:** As a user, I want to export my configuration, so that I can back up or transfer my settings.

#### Acceptance Criteria

1. THE Frontend SHALL provide an export function that generates a JSON file with all account configurations
2. THE Frontend SHALL provide an import function that accepts a configuration JSON file
3. WHEN importing configuration, THE System SHALL validate the file format and account data
4. THE exported configuration SHALL NOT include sensitive authentication tokens in plain text
5. THE Frontend SHALL confirm successful import with a summary of imported accounts

### Requirement 19: System Health Monitoring

**User Story:** As a system administrator, I want to monitor system health, so that I can identify and resolve issues proactively.

#### Acceptance Criteria

1. THE System SHALL log all balance check attempts with success or failure status
2. THE System SHALL track the success rate per provider over time
3. THE Backend SHALL expose health check endpoints for monitoring services
4. WHEN provider success rate falls below 80%, THE System SHALL alert administrators
5. THE System SHALL maintain metrics on notification delivery rates and scheduler execution

### Requirement 20: Storage Backend Abstraction

**User Story:** As a developer, I want a storage abstraction layer, so that the system can run with different backends without code changes.

#### Acceptance Criteria

1. THE Storage_Adapter SHALL implement a common interface for all storage operations
2. THE Storage_Adapter SHALL support Redis as a storage backend
3. THE Storage_Adapter SHALL support Postgres as a storage backend
4. THE Storage_Adapter SHALL support SQLite as a storage backend
5. WHEN the system starts, THE Storage_Adapter SHALL initialize the configured backend based on environment variables
6. THE System SHALL function identically regardless of which storage backend is configured

### Requirement 21: Local Development Environment

**User Story:** As a developer, I want a Docker Compose setup, so that I can develop and test locally without external dependencies.

#### Acceptance Criteria

1. THE System SHALL provide a Docker Compose configuration with Redis and Postgres services
2. WHEN Docker Compose is started, THE System SHALL initialize both Redis and Postgres with appropriate schemas
3. THE System SHALL provide environment configuration templates for local development
4. THE Docker_Compose setup SHALL expose service ports for local debugging
5. THE System SHALL include documentation for starting and stopping the local development environment

### Requirement 22: Environment-Based Configuration

**User Story:** As a developer, I want environment-based configuration, so that the same code runs in local and production environments.

#### Acceptance Criteria

1. THE System SHALL read all configuration from environment variables
2. THE System SHALL provide default values for local development
3. THE System SHALL validate required environment variables at startup
4. WHEN deployed to Vercel, THE System SHALL use Vercel-specific environment variables for KV and Postgres
5. WHEN running locally, THE System SHALL use Docker Compose service URLs
6. THE System SHALL NOT include Vercel-specific APIs in core business logic

### Requirement 23: Database Migration Support

**User Story:** As a developer, I want database migration support, so that schema changes can be applied consistently.

#### Acceptance Criteria

1. THE System SHALL provide migration scripts for Postgres schema changes
2. THE System SHALL provide migration scripts for Redis data structure changes
3. WHEN the system starts, THE System SHALL check for pending migrations
4. THE System SHALL apply migrations automatically in development mode
5. THE System SHALL require manual migration approval in production mode
6. THE System SHALL track applied migrations to prevent duplicate execution

### Requirement 24: Portable Deployment Architecture

**User Story:** As a user, I want to deploy the system anywhere, so that I'm not locked into a specific hosting provider.

#### Acceptance Criteria

1. THE System SHALL use standard Next.js APIs that work on any Node.js hosting
2. THE System SHALL avoid Vercel-specific APIs in core functionality
3. THE System SHALL provide deployment documentation for Vercel, self-hosted VPS, and Docker
4. WHEN deployed to a VPS, THE System SHALL run with standard Node.js and a process manager
5. THE System SHALL support both serverless and traditional server deployment models

### Requirement 25: Configurable Notification Server

**User Story:** As a user, I want to use my self-hosted ntfy.sh instance, so that I control my notification infrastructure.

#### Acceptance Criteria

1. THE System SHALL accept a configurable ntfy.sh server URL via environment variable
2. THE System SHALL NOT hardcode the ntfy.sh cloud service URL
3. WHEN sending notifications, THE Notification_Service SHALL POST to the configured server URL
4. THE System SHALL validate the ntfy.sh server URL format at configuration time
5. THE Frontend SHALL display the configured ntfy.sh server in the settings interface

### Requirement 26: Open Source Preparation

**User Story:** As a project maintainer, I want the codebase ready for open source release, so that the community can contribute and self-host.

#### Acceptance Criteria

1. THE System SHALL include comprehensive README documentation for setup and deployment
2. THE System SHALL include a LICENSE file with an appropriate open source license
3. THE System SHALL include contribution guidelines for community developers
4. THE System SHALL remove any hardcoded credentials or API keys
5. THE System SHALL include example environment configuration files with placeholder values
