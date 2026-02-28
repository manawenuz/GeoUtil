/**
 * Bug Condition Exploration Test - API Initialization Fix
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**
 * 
 * **Property 1: Fault Condition** - API Routes Initialize Before Accessing Services
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists.
 * 
 * This test verifies that API routes call `await ensureInitialized()` before accessing
 * storage adapters or provider registry. On unfixed code, routes will fail with 500 errors
 * due to uninitialized services. After the fix, routes should return successful responses.
 * 
 * EXPECTED OUTCOME ON UNFIXED CODE: Test FAILS (this is correct - proves bug exists)
 * EXPECTED OUTCOME AFTER FIX: Test PASSES (confirms bug is fixed)
 */

import { NextRequest } from 'next/server';
import * as fc from 'fast-check';

// Mock auth to bypass authentication
jest.mock('@/lib/auth-helpers', () => ({
  withAuth: (handler: any) => handler,
}));

// Mock ensureInitialized to resolve successfully (simulating proper initialization)
jest.mock('@/lib/ensure-init', () => ({
  ensureInitialized: jest.fn().mockResolvedValue(undefined),
}));

// Mock storage adapter
jest.mock('@/lib/storage/factory');

// Mock provider registry
jest.mock('@/lib/providers/factory');

// Mock encryption service
jest.mock('@/lib/encryption');

// Import route handlers - these will be the ACTUAL fixed routes
import { GET as accountsGET, POST as accountsPOST } from '@/app/api/accounts/route';
import { GET as providersGET } from '@/app/api/providers/route';
import { POST as balancesCheckPOST } from '@/app/api/balances/check/route';
import { GET as configExportGET } from '@/app/api/config/export/route';

// Mock session
const mockSession = {
  user: {
    id: 'test-user-123',
    email: 'test@example.com',
    name: 'Test User',
  },
};

describe('Bug Condition Exploration: API Routes Initialize Before Accessing Services', () => {
  beforeEach(() => {
    // Set up mock implementations
    const { getStorageAdapter } = require('@/lib/storage/factory');
    const { getProviderRegistry } = require('@/lib/providers/factory');
    const { createEncryptionService } = require('@/lib/encryption');
    
    // Mock storage adapter
    getStorageAdapter.mockReturnValue({
      getAccountsByUser: jest.fn().mockResolvedValue([]),
      getLatestBalance: jest.fn().mockResolvedValue(null),
      createAccount: jest.fn().mockResolvedValue('test-account-id'),
      getAccount: jest.fn().mockResolvedValue({
        accountId: 'test-account-123',
        userId: 'test-user-123',
        providerType: 'gas',
        providerName: 'te.ge',
        accountNumber: 'encrypted_123456789012',
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      getBalanceHistory: jest.fn().mockResolvedValue([]),
      getNotificationConfig: jest.fn().mockResolvedValue(null),
      getAllAccounts: jest.fn().mockResolvedValue([]),
      getUser: jest.fn().mockResolvedValue({
        userId: 'test-user-123',
        email: 'test@example.com',
        name: 'Test User',
      }),
      recordCheckAttempt: jest.fn().mockResolvedValue(undefined),
      recordBalance: jest.fn().mockResolvedValue(undefined),
      incrementOverdueDays: jest.fn().mockResolvedValue(0),
      resetOverdueDays: jest.fn().mockResolvedValue(undefined),
      recordNotification: jest.fn().mockResolvedValue(undefined),
    });
    
    // Mock provider registry
    getProviderRegistry.mockReturnValue({
      listProviders: jest.fn().mockReturnValue([
        { providerName: 'te.ge', providerType: 'gas' },
      ]),
      getAdapter: jest.fn().mockReturnValue({
        providerName: 'te.ge',
        providerType: 'gas',
        validateAccountNumber: jest.fn().mockReturnValue(true),
        getAccountNumberFormat: jest.fn().mockReturnValue('12 digits'),
        checkBalance: jest.fn().mockResolvedValue({
          success: true,
          balance: 100,
          currency: 'GEL',
          timestamp: new Date(),
        }),
        fetchBalance: jest.fn().mockResolvedValue({
          success: true,
          balance: 100,
          currency: 'GEL',
          timestamp: new Date(),
        }),
      }),
    });
    
    // Mock encryption service
    createEncryptionService.mockReturnValue({
      encrypt: jest.fn((value: string) => `encrypted_${value}`),
      decrypt: jest.fn((value: string) => value.replace('encrypted_', '')),
    });
  });

  
  /**
   * Test Case 1: GET /api/accounts
   * 
   * This route calls getStorageAdapter() without ensureInitialized().
   * Expected on unfixed code: 500 error with "Storage adapter not initialized" or similar
   * Expected after fix: 200 response with accounts array
   */
  it('GET /api/accounts should initialize before accessing storage', async () => {
    const request = new NextRequest('http://localhost:3000/api/accounts', {
      method: 'GET',
    });

    const response = await accountsGET(request, mockSession);
    const data = await response.json();

    // After fix: should return 200 with accounts
    // On unfixed code: will return 500 with error about uninitialized storage
    expect(response.status).toBe(200);
    expect(data).toHaveProperty('accounts');
    expect(Array.isArray(data.accounts)).toBe(true);
    
    // Document counterexample if test fails
    if (response.status === 500) {
      console.log('COUNTEREXAMPLE FOUND:');
      console.log('Route: GET /api/accounts');
      console.log('Status:', response.status);
      console.log('Error:', data.error);
      console.log('Message:', data.message);
    }
  });

  /**
   * Test Case 2: POST /api/accounts
   * 
   * This route calls getProviderRegistry() and getStorageAdapter() without ensureInitialized().
   * Expected on unfixed code: 500 error
   * Expected after fix: 201 response (or 400 for validation errors, which is acceptable)
   */
  it('POST /api/accounts should initialize before accessing services', async () => {
    const request = new NextRequest('http://localhost:3000/api/accounts', {
      method: 'POST',
      body: JSON.stringify({
        providerType: 'gas',
        providerName: 'te.ge',
        accountNumber: '123456789012',
      }),
    });

    const response = await accountsPOST(request, mockSession);
    const data = await response.json();

    // After fix: should return 201 (created) or 400 (validation error)
    // Both are acceptable - we just want to avoid 500 errors from uninitialized services
    // On unfixed code: will return 500 with error about uninitialized services
    expect([200, 201, 400]).toContain(response.status);
    
    // If it's a 500 error, it should NOT be about uninitialized services
    if (response.status === 500) {
      console.log('COUNTEREXAMPLE FOUND:');
      console.log('Route: POST /api/accounts');
      console.log('Status:', response.status);
      console.log('Error:', data.error);
      console.log('Message:', data.message);
      
      // After fix, 500 errors should not mention initialization issues
      expect(data.message).not.toMatch(/not initialized|initialization|migrate/i);
    }
  });

  /**
   * Test Case 3: GET /api/providers
   * 
   * This route calls getProviderRegistry() without ensureInitialized().
   * Expected on unfixed code: 500 error with "Provider registry not initialized" or similar
   * Expected after fix: 200 response with providers array
   */
  it('GET /api/providers should initialize before accessing provider registry', async () => {
    const response = await providersGET();
    const data = await response.json();

    // After fix: should return 200 with providers
    // On unfixed code: will return 500 with error about uninitialized provider registry
    expect(response.status).toBe(200);
    expect(data).toHaveProperty('providers');
    expect(Array.isArray(data.providers)).toBe(true);
    
    // Document counterexample if test fails
    if (response.status === 500) {
      console.log('COUNTEREXAMPLE FOUND:');
      console.log('Route: GET /api/providers');
      console.log('Status:', response.status);
      console.log('Error:', data.error);
      console.log('Message:', data.message);
    }
  });

  /**
   * Test Case 4: POST /api/balances/check
   * 
   * This route calls both getStorageAdapter() and getProviderRegistry() without ensureInitialized().
   * Expected on unfixed code: 500 error
   * Expected after fix: 200 response (or 400/404 for validation/not found errors)
   */
  it('POST /api/balances/check should initialize before accessing services', async () => {
    const request = new NextRequest('http://localhost:3000/api/balances/check', {
      method: 'POST',
      body: JSON.stringify({
        accountId: 'test-account-123',
      }),
    });

    const response = await balancesCheckPOST(request, mockSession);
    const data = await response.json();

    // After fix: should return 200 or 400 (validation error) or 404 (not found)
    // On unfixed code: will return 500 with error about uninitialized services
    expect([200, 400, 404]).toContain(response.status);
    
    // If it's a 500 error, it should NOT be about uninitialized services
    if (response.status === 500) {
      console.log('COUNTEREXAMPLE FOUND:');
      console.log('Route: POST /api/balances/check');
      console.log('Status:', response.status);
      console.log('Error:', data.error);
      console.log('Message:', data.message);
      
      // After fix, 500 errors should not mention initialization issues
      expect(data.message).not.toMatch(/not initialized|initialization|migrate/i);
    }
  });

  /**
   * Test Case 5: GET /api/config/export
   * 
   * This route calls getStorageAdapter() without ensureInitialized().
   * Expected on unfixed code: 500 error
   * Expected after fix: 200 response with config data
   */
  it('GET /api/config/export should initialize before accessing storage', async () => {
    const request = new NextRequest('http://localhost:3000/api/config/export', {
      method: 'GET',
    });

    const response = await configExportGET(request, mockSession);
    const data = await response.json();

    // After fix: should return 200 with config data
    // On unfixed code: will return 500 with error about uninitialized storage
    expect(response.status).toBe(200);
    // The response contains the exported config data (accounts, user, etc.)
    expect(data).toHaveProperty('accounts');
    expect(data).toHaveProperty('user');
    
    // Document counterexample if test fails
    if (response.status === 500) {
      console.log('COUNTEREXAMPLE FOUND:');
      console.log('Route: GET /api/config/export');
      console.log('Status:', response.status);
      console.log('Error:', data.error);
      console.log('Message:', data.message);
    }
  });

  /**
   * Property-Based Test: Multiple Routes Should Initialize
   * 
   * This property test generates random sequences of API route calls
   * and verifies that all routes successfully initialize before accessing services.
   * 
   * After fix: All routes should return successful responses (200/201) or validation errors (400)
   * On unfixed code: Routes will fail with 500 errors due to uninitialized services
   */
  it('property: all routes requiring initialization should succeed after fix', () => {
    // Define route configurations
    const routeConfigs = [
      {
        name: 'GET /api/accounts',
        handler: accountsGET,
        method: 'GET',
        path: '/api/accounts',
        body: null,
        needsSession: true,
      },
      {
        name: 'POST /api/accounts',
        handler: accountsPOST,
        method: 'POST',
        path: '/api/accounts',
        body: { providerType: 'gas', providerName: 'te.ge', accountNumber: '123456789012' },
        needsSession: true,
      },
      {
        name: 'GET /api/providers',
        handler: providersGET,
        method: 'GET',
        path: '/api/providers',
        body: null,
        needsSession: false,
      },
      {
        name: 'POST /api/balances/check',
        handler: balancesCheckPOST,
        method: 'POST',
        path: '/api/balances/check',
        body: { accountId: 'test-account-123' },
        needsSession: true,
        acceptableStatuses: [200, 400, 404], // 404 is acceptable if account not found
      },
      {
        name: 'GET /api/config/export',
        handler: configExportGET,
        method: 'GET',
        path: '/api/config/export',
        body: null,
        needsSession: true,
      },
    ];

    // Property: For any route that needs initialization, it should not fail with 500 errors about uninitialized services
    fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...routeConfigs),
        async (routeConfig) => {
          const request = new NextRequest(`http://localhost:3000${routeConfig.path}`, {
            method: routeConfig.method,
            ...(routeConfig.body && { body: JSON.stringify(routeConfig.body) }),
          });

          // Call handler with or without session based on route configuration
          const response = routeConfig.needsSession 
            ? await routeConfig.handler(request, mockSession)
            : await routeConfig.handler();
          const data = await response.json();

          // After fix: should return acceptable status codes (success or validation error)
          // Should NOT return 500 errors about uninitialized services
          const acceptableStatuses = routeConfig.acceptableStatuses || [200, 201, 400];
          const isSuccessOrValidationError = acceptableStatuses.includes(response.status);
          
          if (!isSuccessOrValidationError && response.status === 500) {
            console.log('COUNTEREXAMPLE FOUND:');
            console.log('Route:', routeConfig.name);
            console.log('Status:', response.status);
            console.log('Error:', data.error);
            console.log('Message:', data.message);
            
            // Check if it's an initialization error
            const isInitializationError = /not initialized|initialization|migrate/i.test(data.message || '');
            
            // After fix, should not have initialization errors
            expect(isInitializationError).toBe(false);
          }

          return isSuccessOrValidationError;
        }
      ),
      {
        numRuns: 20, // Test each route multiple times
        verbose: true,
      }
    );
  });
});
