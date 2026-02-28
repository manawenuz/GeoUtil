# Bugfix Requirements Document

## Introduction

API routes are failing with 500 errors because they attempt to access storage adapters and the provider registry without first ensuring the application is initialized. This causes the app to fail when loading accounts or providers, as migrations have not been run and services have not been started. The fix requires adding `await ensureInitialized()` calls to all affected API routes before they access any initialized services.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN an API route calls `getStorageAdapter()` without first calling `await ensureInitialized()` THEN the system returns a 500 error due to uninitialized storage

1.2 WHEN an API route calls `getProviderRegistry()` without first calling `await ensureInitialized()` THEN the system returns a 500 error due to uninitialized provider registry

1.3 WHEN `/api/accounts` is accessed without initialization THEN the system returns a 500 error and displays "Failed to load accounts" in the UI

1.4 WHEN `/api/providers` is accessed without initialization THEN the system returns a 500 error and the provider dropdown shows "Select a provider..." with no options

1.5 WHEN any of the following routes are accessed without initialization THEN the system returns 500 errors: `/api/accounts/[id]`, `/api/accounts/[id]/overdue`, `/api/balances/check`, `/api/balances/history`, `/api/notifications/config`, `/api/notifications/history`, `/api/notifications/test`, `/api/config/export`, `/api/config/import`, `/api/cron/check-balances`

### Expected Behavior (Correct)

2.1 WHEN an API route needs to access `getStorageAdapter()` THEN the system SHALL call `await ensureInitialized()` before accessing the storage adapter

2.2 WHEN an API route needs to access `getProviderRegistry()` THEN the system SHALL call `await ensureInitialized()` before accessing the provider registry

2.3 WHEN `/api/accounts` is accessed THEN the system SHALL initialize first and return account data successfully without errors

2.4 WHEN `/api/providers` is accessed THEN the system SHALL initialize first and return provider data successfully, populating the provider dropdown

2.5 WHEN any API route that depends on initialized services is accessed THEN the system SHALL call `await ensureInitialized()` before accessing those services and return successful responses

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `/api/health` is accessed THEN the system SHALL CONTINUE TO call `ensureInitialized()` and function correctly as it already does

3.2 WHEN initialization has already been completed by a previous request THEN the system SHALL CONTINUE TO skip redundant initialization (idempotent behavior)

3.3 WHEN API routes that do not depend on storage or provider services are accessed THEN the system SHALL CONTINUE TO function without requiring initialization

3.4 WHEN the initialization process encounters an error THEN the system SHALL CONTINUE TO return appropriate error responses as currently implemented
