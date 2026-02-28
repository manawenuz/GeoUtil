# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Fault Condition** - API Routes Initialize Before Accessing Services
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to concrete failing cases - API routes that call `getStorageAdapter()` or `getProviderRegistry()` without calling `ensureInitialized()` first
  - Test that routes like `GET /api/accounts`, `GET /api/providers`, `POST /api/balances/check`, and `GET /api/config/export` fail with 500 errors on unfixed code
  - The test assertions should verify that routes return successful responses (200/201) instead of 500 errors after the fix
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found (e.g., "GET /api/accounts returns 500 error with 'Storage adapter not initialized' message")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Existing Initialization Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for routes that already work correctly
  - Observe: `GET /api/health` already calls `ensureInitialized()` and returns successful health status
  - Observe: `/api/auth/[...nextauth]` works without initialization (doesn't depend on storage/provider services)
  - Observe: Calling `ensureInitialized()` multiple times is idempotent (doesn't re-run migrations)
  - Write property-based tests capturing these observed behavior patterns
  - Property-based testing generates many test cases for stronger guarantees
  - Test that `/api/health` continues to work exactly as before
  - Test that routes not depending on initialized services continue to work
  - Test that idempotent initialization behavior is preserved
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix for API initialization in 11 affected route files

  - [x] 3.1 Add initialization to accounts routes
    - File: `app/api/accounts/route.ts`
    - Add import: `import { ensureInitialized } from "@/lib/ensure-init";`
    - In `GET` handler: Add `await ensureInitialized();` as first line inside try block (before `const userId = session.user.id;`)
    - In `POST` handler: Add `await ensureInitialized();` as first line inside try block (before `const userId = session.user.id;`)
    - _Bug_Condition: isBugCondition(request) where routeCallsGetStorageAdapter(request.route) AND NOT routeCallsEnsureInitialized(request.route)_
    - _Expected_Behavior: Routes call `await ensureInitialized()` before accessing services and return successful responses (200/201) instead of 500 errors_
    - _Preservation: Routes that already have initialization (like `/api/health`) continue to work exactly as before; idempotent initialization behavior is preserved_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 Add initialization to account detail routes
    - File: `app/api/accounts/[id]/route.ts`
    - Add import: `import { ensureInitialized } from "@/lib/ensure-init";`
    - In `PUT` handler: Add `await ensureInitialized();` as first line inside try block
    - In `DELETE` handler: Add `await ensureInitialized();` as first line inside try block
    - _Bug_Condition: isBugCondition(request) where routeCallsGetStorageAdapter(request.route) AND NOT routeCallsEnsureInitialized(request.route)_
    - _Expected_Behavior: Routes call `await ensureInitialized()` before accessing services and return successful responses instead of 500 errors_
    - _Preservation: Existing error handling and response behavior is preserved_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.3 Add initialization to account overdue route
    - File: `app/api/accounts/[id]/overdue/route.ts`
    - Add import: `import { ensureInitialized } from "@/lib/ensure-init";`
    - In `GET` handler: Add `await ensureInitialized();` as first line inside try block
    - _Bug_Condition: isBugCondition(request) where routeCallsGetStorageAdapter(request.route) AND NOT routeCallsEnsureInitialized(request.route)_
    - _Expected_Behavior: Route calls `await ensureInitialized()` before accessing services and returns successful response instead of 500 error_
    - _Preservation: Existing overdue calculation logic is preserved_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.4 Add initialization to providers route
    - File: `app/api/providers/route.ts`
    - Add import: `import { ensureInitialized } from "@/lib/ensure-init";`
    - In `GET` handler: Add `await ensureInitialized();` as first line inside try block (before `const providerRegistry = getProviderRegistry();`)
    - _Bug_Condition: isBugCondition(request) where routeCallsGetProviderRegistry(request.route) AND NOT routeCallsEnsureInitialized(request.route)_
    - _Expected_Behavior: Route calls `await ensureInitialized()` before accessing provider registry and returns successful response with provider list_
    - _Preservation: Provider list format and content is preserved_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.5 Add initialization to balance check route
    - File: `app/api/balances/check/route.ts`
    - Add import: `import { ensureInitialized } from "@/lib/ensure-init";`
    - In `POST` handler: Add `await ensureInitialized();` as first line inside try block
    - _Bug_Condition: isBugCondition(request) where routeCallsGetStorageAdapter(request.route) AND routeCallsGetProviderRegistry(request.route) AND NOT routeCallsEnsureInitialized(request.route)_
    - _Expected_Behavior: Route calls `await ensureInitialized()` before accessing services and returns successful balance check response_
    - _Preservation: Balance checking logic and response format is preserved_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.6 Add initialization to balance history route
    - File: `app/api/balances/history/route.ts`
    - Add import: `import { ensureInitialized } from "@/lib/ensure-init";`
    - In `GET` handler: Add `await ensureInitialized();` as first line inside try block
    - _Bug_Condition: isBugCondition(request) where routeCallsGetStorageAdapter(request.route) AND NOT routeCallsEnsureInitialized(request.route)_
    - _Expected_Behavior: Route calls `await ensureInitialized()` before accessing storage and returns successful history response_
    - _Preservation: History retrieval logic and response format is preserved_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.7 Add initialization to notification config routes
    - File: `app/api/notifications/config/route.ts`
    - Add import: `import { ensureInitialized } from "@/lib/ensure-init";`
    - In `GET` handler: Add `await ensureInitialized();` as first line inside try block
    - In `POST` handler: Add `await ensureInitialized();` as first line inside try block
    - _Bug_Condition: isBugCondition(request) where routeCallsGetStorageAdapter(request.route) AND NOT routeCallsEnsureInitialized(request.route)_
    - _Expected_Behavior: Routes call `await ensureInitialized()` before accessing storage and return successful config responses_
    - _Preservation: Notification config logic and validation is preserved_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.8 Add initialization to notification history route
    - File: `app/api/notifications/history/route.ts`
    - Add import: `import { ensureInitialized } from "@/lib/ensure-init";`
    - In `GET` handler: Add `await ensureInitialized();` as first line inside try block
    - _Bug_Condition: isBugCondition(request) where routeCallsGetStorageAdapter(request.route) AND NOT routeCallsEnsureInitialized(request.route)_
    - _Expected_Behavior: Route calls `await ensureInitialized()` before accessing storage and returns successful history response_
    - _Preservation: Notification history retrieval logic is preserved_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.9 Add initialization to notification test route
    - File: `app/api/notifications/test/route.ts`
    - Add import: `import { ensureInitialized } from "@/lib/ensure-init";`
    - In `POST` handler: Add `await ensureInitialized();` as first line inside try block
    - _Bug_Condition: isBugCondition(request) where routeCallsGetStorageAdapter(request.route) AND NOT routeCallsEnsureInitialized(request.route)_
    - _Expected_Behavior: Route calls `await ensureInitialized()` before accessing storage and returns successful test notification response_
    - _Preservation: Test notification logic is preserved_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.10 Add initialization to config export route
    - File: `app/api/config/export/route.ts`
    - Add import: `import { ensureInitialized } from "@/lib/ensure-init";`
    - In `GET` handler: Add `await ensureInitialized();` as first line inside try block
    - _Bug_Condition: isBugCondition(request) where routeCallsGetStorageAdapter(request.route) AND NOT routeCallsEnsureInitialized(request.route)_
    - _Expected_Behavior: Route calls `await ensureInitialized()` before accessing storage and returns successful export response_
    - _Preservation: Config export format and encryption logic is preserved_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.11 Add initialization to config import route
    - File: `app/api/config/import/route.ts`
    - Add import: `import { ensureInitialized } from "@/lib/ensure-init";`
    - In `POST` handler: Add `await ensureInitialized();` as first line inside try block
    - _Bug_Condition: isBugCondition(request) where routeCallsGetStorageAdapter(request.route) AND NOT routeCallsEnsureInitialized(request.route)_
    - _Expected_Behavior: Route calls `await ensureInitialized()` before accessing storage and returns successful import response_
    - _Preservation: Config import validation and decryption logic is preserved_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.12 Add initialization to cron balance check route
    - File: `app/api/cron/check-balances/route.ts`
    - Add import: `import { ensureInitialized } from "@/lib/ensure-init";`
    - In `POST` handler: Add `await ensureInitialized();` as first line inside try block (after cron secret validation, before `const storageAdapter = getStorageAdapter();`)
    - _Bug_Condition: isBugCondition(request) where routeCallsGetStorageAdapter(request.route) AND routeCallsGetProviderRegistry(request.route) AND NOT routeCallsEnsureInitialized(request.route)_
    - _Expected_Behavior: Route calls `await ensureInitialized()` before accessing services and returns successful cron execution response_
    - _Preservation: Cron secret validation and scheduled check logic is preserved_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.13 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - API Routes Initialize Before Accessing Services
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - Verify that routes like `GET /api/accounts`, `GET /api/providers`, `POST /api/balances/check` now return successful responses (200/201) instead of 500 errors
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.14 Verify preservation tests still pass
    - **Property 2: Preservation** - Existing Initialization Behavior
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - Verify `GET /api/health` continues to work exactly as before
    - Verify routes not depending on initialized services continue to work
    - Verify idempotent initialization behavior is preserved
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. Checkpoint - Ensure all tests pass
  - Run all exploration tests and verify they pass (bug is fixed)
  - Run all preservation tests and verify they pass (no regressions)
  - Test full user flows (load accounts → add account → check balance)
  - Test that the first request to any route triggers initialization and subsequent requests reuse it
  - Test that cron jobs can successfully run scheduled checks
  - Ensure all tests pass, ask the user if questions arise
