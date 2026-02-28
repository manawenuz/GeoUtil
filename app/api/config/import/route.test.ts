import { NextRequest } from 'next/server';

// Mock dependencies BEFORE importing the route
jest.mock('@/lib/auth-helpers');
jest.mock('@/lib/storage/factory');
jest.mock('@/lib/providers/factory');
jest.mock('@/lib/ensure-init');

import { withAuth } from '@/lib/auth-helpers';
import { getStorageAdapter } from '@/lib/storage/factory';
import { getProviderRegistry } from '@/lib/providers/factory';
import { ensureInitialized } from '@/lib/ensure-init';

// Set up withAuth mock before importing route
(withAuth as jest.Mock).mockImplementation((handler) => {
  return handler;
});

// Mock ensureInitialized to resolve immediately
(ensureInitialized as jest.Mock).mockResolvedValue(undefined);

// Now import the route handlers
import { POST } from './route';

describe('POST /api/config/import', () => {
  let mockStorageAdapter: any;
  let mockProviderRegistry: any;
  let mockSession: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock session
    mockSession = {
      user: {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      },
    };

    // Mock provider registry
    mockProviderRegistry = {
      getAdapter: jest.fn(),
      listProviders: jest.fn().mockReturnValue([
        { providerName: 'te.ge', providerType: 'gas' },
        { providerName: 'water-provider', providerType: 'water' },
      ]),
    };

    (getProviderRegistry as jest.Mock).mockReturnValue(mockProviderRegistry);
  });

  it('should successfully import valid configuration', async () => {
    // Mock storage adapter
    mockStorageAdapter = {
      createAccount: jest.fn().mockResolvedValue('account-1'),
    };

    (getStorageAdapter as jest.Mock).mockReturnValue(mockStorageAdapter);

    // Mock provider adapters
    mockProviderRegistry.getAdapter.mockImplementation((name: string) => {
      if (name === 'te.ge') {
        return {
          providerName: 'te.ge',
          providerType: 'gas',
          validateAccountNumber: jest.fn().mockReturnValue(true),
        };
      }
      if (name === 'water-provider') {
        return {
          providerName: 'water-provider',
          providerType: 'water',
          validateAccountNumber: jest.fn().mockReturnValue(true),
        };
      }
      return null;
    });

    // Create valid import configuration
    const importConfig = {
      version: '1.0',
      exportedAt: '2024-01-01T00:00:00.000Z',
      user: {
        email: 'test@example.com',
        name: 'Test User',
        ntfyServerUrl: 'https://ntfy.sh',
        notificationEnabled: true,
        ntfyFeedUrl: 'encrypted-feed-url',
      },
      accounts: [
        {
          providerType: 'gas',
          providerName: 'te.ge',
          accountNumber: 'encrypted-account-number-1',
          enabled: true,
          createdAt: '2024-01-01T00:00:00.000Z',
        },
        {
          providerType: 'water',
          providerName: 'water-provider',
          accountNumber: 'encrypted-account-number-2',
          enabled: true,
          createdAt: '2024-01-02T00:00:00.000Z',
        },
      ],
    };

    // Create mock request
    const request = new NextRequest('http://localhost:3000/api/config/import', {
      method: 'POST',
      body: JSON.stringify(importConfig),
    });

    // Call the handler
    const response = await POST(request, mockSession);

    // Verify response
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.imported).toBe(2);
    expect(data.failed).toBe(0);
    expect(data.total).toBe(2);
    expect(data.message).toBe('Configuration import completed');

    // Verify createAccount was called for each account
    expect(mockStorageAdapter.createAccount).toHaveBeenCalledTimes(2);
    expect(mockStorageAdapter.createAccount).toHaveBeenCalledWith({
      userId: 'user-123',
      providerType: 'gas',
      providerName: 'te.ge',
      accountNumber: 'encrypted-account-number-1',
      enabled: true,
    });
    expect(mockStorageAdapter.createAccount).toHaveBeenCalledWith({
      userId: 'user-123',
      providerType: 'water',
      providerName: 'water-provider',
      accountNumber: 'encrypted-account-number-2',
      enabled: true,
    });
  });

  it('should return 400 for invalid JSON format', async () => {
    // Create mock request with invalid JSON
    const request = new NextRequest('http://localhost:3000/api/config/import', {
      method: 'POST',
      body: 'not valid json',
    });

    // Call the handler
    const response = await POST(request, mockSession);

    // Verify response
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe('Invalid JSON');
  });

  it('should return 400 for missing version field', async () => {
    // Create invalid import configuration
    const importConfig = {
      accounts: [],
    };

    // Create mock request
    const request = new NextRequest('http://localhost:3000/api/config/import', {
      method: 'POST',
      body: JSON.stringify(importConfig),
    });

    // Call the handler
    const response = await POST(request, mockSession);

    // Verify response
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe('Validation Error');
    expect(data.message).toContain('version');
  });

  it('should return 400 for missing accounts field', async () => {
    // Create invalid import configuration
    const importConfig = {
      version: '1.0',
    };

    // Create mock request
    const request = new NextRequest('http://localhost:3000/api/config/import', {
      method: 'POST',
      body: JSON.stringify(importConfig),
    });

    // Call the handler
    const response = await POST(request, mockSession);

    // Verify response
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe('Validation Error');
    expect(data.message).toContain('accounts');
  });

  it('should return 400 for unsupported version', async () => {
    // Create import configuration with unsupported version
    const importConfig = {
      version: '2.0',
      accounts: [],
    };

    // Create mock request
    const request = new NextRequest('http://localhost:3000/api/config/import', {
      method: 'POST',
      body: JSON.stringify(importConfig),
    });

    // Call the handler
    const response = await POST(request, mockSession);

    // Verify response
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe('Validation Error');
    expect(data.message).toContain('Unsupported configuration version');
  });

  it('should validate account fields and return errors', async () => {
    // Mock provider adapters
    mockProviderRegistry.getAdapter.mockImplementation((name: string) => {
      if (name === 'te.ge') {
        return {
          providerName: 'te.ge',
          providerType: 'gas',
        };
      }
      return null;
    });

    // Create import configuration with invalid accounts
    const importConfig = {
      version: '1.0',
      accounts: [
        {
          // Missing providerType
          providerName: 'te.ge',
          accountNumber: 'encrypted-account-number-1',
        },
        {
          providerType: 'gas',
          // Missing providerName
          accountNumber: 'encrypted-account-number-2',
        },
        {
          providerType: 'gas',
          providerName: 'te.ge',
          // Missing accountNumber
        },
      ],
    };

    // Create mock request
    const request = new NextRequest('http://localhost:3000/api/config/import', {
      method: 'POST',
      body: JSON.stringify(importConfig),
    });

    // Call the handler
    const response = await POST(request, mockSession);

    // Verify response
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe('Validation Error');
    expect(data.details).toHaveLength(3);
    expect(data.details[0]).toContain('Missing providerType');
    expect(data.details[1]).toContain('Missing providerName');
    expect(data.details[2]).toContain('Missing accountNumber');
  });

  it('should validate provider type', async () => {
    // Create import configuration with invalid provider type
    const importConfig = {
      version: '1.0',
      accounts: [
        {
          providerType: 'invalid-type',
          providerName: 'te.ge',
          accountNumber: 'encrypted-account-number-1',
        },
      ],
    };

    // Create mock request
    const request = new NextRequest('http://localhost:3000/api/config/import', {
      method: 'POST',
      body: JSON.stringify(importConfig),
    });

    // Call the handler
    const response = await POST(request, mockSession);

    // Verify response
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe('Validation Error');
    expect(data.details[0]).toContain('Invalid providerType');
  });

  it('should validate provider exists in registry', async () => {
    // Mock provider registry to return null for unknown provider
    mockProviderRegistry.getAdapter.mockReturnValue(null);

    // Create import configuration with unknown provider
    const importConfig = {
      version: '1.0',
      accounts: [
        {
          providerType: 'gas',
          providerName: 'unknown-provider',
          accountNumber: 'encrypted-account-number-1',
        },
      ],
    };

    // Create mock request
    const request = new NextRequest('http://localhost:3000/api/config/import', {
      method: 'POST',
      body: JSON.stringify(importConfig),
    });

    // Call the handler
    const response = await POST(request, mockSession);

    // Verify response
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe('Validation Error');
    expect(data.details[0]).toContain('Unknown provider');
  });

  it('should validate provider type matches adapter', async () => {
    // Mock provider adapter with mismatched type
    mockProviderRegistry.getAdapter.mockReturnValue({
      providerName: 'te.ge',
      providerType: 'water', // Mismatch: account says gas, adapter says water
    });

    // Create import configuration
    const importConfig = {
      version: '1.0',
      accounts: [
        {
          providerType: 'gas',
          providerName: 'te.ge',
          accountNumber: 'encrypted-account-number-1',
        },
      ],
    };

    // Create mock request
    const request = new NextRequest('http://localhost:3000/api/config/import', {
      method: 'POST',
      body: JSON.stringify(importConfig),
    });

    // Call the handler
    const response = await POST(request, mockSession);

    // Verify response
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe('Validation Error');
    expect(data.details[0]).toContain('is a water provider, not gas');
  });

  it('should handle empty accounts array', async () => {
    // Create import configuration with no accounts
    const importConfig = {
      version: '1.0',
      accounts: [],
    };

    // Create mock request
    const request = new NextRequest('http://localhost:3000/api/config/import', {
      method: 'POST',
      body: JSON.stringify(importConfig),
    });

    // Call the handler
    const response = await POST(request, mockSession);

    // Verify response
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.message).toBe('No accounts to import');
    expect(data.imported).toBe(0);
    expect(data.failed).toBe(0);
  });

  it('should handle partial import success', async () => {
    // Mock storage adapter that fails on second account
    mockStorageAdapter = {
      createAccount: jest.fn()
        .mockResolvedValueOnce('account-1')
        .mockRejectedValueOnce(new Error('Database constraint violation')),
    };

    (getStorageAdapter as jest.Mock).mockReturnValue(mockStorageAdapter);

    // Mock provider adapters
    mockProviderRegistry.getAdapter.mockImplementation((name: string) => {
      if (name === 'te.ge') {
        return {
          providerName: 'te.ge',
          providerType: 'gas',
        };
      }
      if (name === 'water-provider') {
        return {
          providerName: 'water-provider',
          providerType: 'water',
        };
      }
      return null;
    });

    // Create import configuration
    const importConfig = {
      version: '1.0',
      accounts: [
        {
          providerType: 'gas',
          providerName: 'te.ge',
          accountNumber: 'encrypted-account-number-1',
          enabled: true,
        },
        {
          providerType: 'water',
          providerName: 'water-provider',
          accountNumber: 'encrypted-account-number-2',
          enabled: true,
        },
      ],
    };

    // Create mock request
    const request = new NextRequest('http://localhost:3000/api/config/import', {
      method: 'POST',
      body: JSON.stringify(importConfig),
    });

    // Call the handler
    const response = await POST(request, mockSession);

    // Verify response - 207 Multi-Status for partial success
    expect(response.status).toBe(207);

    const data = await response.json();
    expect(data.imported).toBe(1);
    expect(data.failed).toBe(1);
    expect(data.total).toBe(2);
    expect(data.errors).toHaveLength(1);
    expect(data.errors[0]).toContain('Database constraint violation');
  });

  it('should sanitize enabled field to boolean', async () => {
    // Mock storage adapter
    mockStorageAdapter = {
      createAccount: jest.fn().mockResolvedValue('account-1'),
    };

    (getStorageAdapter as jest.Mock).mockReturnValue(mockStorageAdapter);

    // Mock provider adapter
    mockProviderRegistry.getAdapter.mockReturnValue({
      providerName: 'te.ge',
      providerType: 'gas',
    });

    // Create import configuration with missing enabled field
    const importConfig = {
      version: '1.0',
      accounts: [
        {
          providerType: 'gas',
          providerName: 'te.ge',
          accountNumber: 'encrypted-account-number-1',
          // enabled field missing - should default to true
        },
      ],
    };

    // Create mock request
    const request = new NextRequest('http://localhost:3000/api/config/import', {
      method: 'POST',
      body: JSON.stringify(importConfig),
    });

    // Call the handler
    const response = await POST(request, mockSession);

    // Verify response
    expect(response.status).toBe(200);

    // Verify createAccount was called with enabled: true
    expect(mockStorageAdapter.createAccount).toHaveBeenCalledWith({
      userId: 'user-123',
      providerType: 'gas',
      providerName: 'te.ge',
      accountNumber: 'encrypted-account-number-1',
      enabled: true,
    });
  });

  it('should preserve encrypted account numbers', async () => {
    // Mock storage adapter
    mockStorageAdapter = {
      createAccount: jest.fn().mockResolvedValue('account-1'),
    };

    (getStorageAdapter as jest.Mock).mockReturnValue(mockStorageAdapter);

    // Mock provider adapter
    mockProviderRegistry.getAdapter.mockReturnValue({
      providerName: 'te.ge',
      providerType: 'gas',
    });

    // Create import configuration with encrypted account number
    const encryptedAccountNumber = 'encrypted-value-from-export';
    const importConfig = {
      version: '1.0',
      accounts: [
        {
          providerType: 'gas',
          providerName: 'te.ge',
          accountNumber: encryptedAccountNumber,
          enabled: true,
        },
      ],
    };

    // Create mock request
    const request = new NextRequest('http://localhost:3000/api/config/import', {
      method: 'POST',
      body: JSON.stringify(importConfig),
    });

    // Call the handler
    const response = await POST(request, mockSession);

    // Verify response
    expect(response.status).toBe(200);

    // Verify encrypted account number is preserved as-is
    expect(mockStorageAdapter.createAccount).toHaveBeenCalledWith({
      userId: 'user-123',
      providerType: 'gas',
      providerName: 'te.ge',
      accountNumber: encryptedAccountNumber, // Should be unchanged
      enabled: true,
    });
  });

  it('should handle storage errors gracefully', async () => {
    // Mock storage adapter that throws error
    mockStorageAdapter = {
      createAccount: jest.fn().mockRejectedValue(new Error('Database connection failed')),
    };

    (getStorageAdapter as jest.Mock).mockReturnValue(mockStorageAdapter);

    // Mock provider adapter
    mockProviderRegistry.getAdapter.mockReturnValue({
      providerName: 'te.ge',
      providerType: 'gas',
    });

    // Create import configuration
    const importConfig = {
      version: '1.0',
      accounts: [
        {
          providerType: 'gas',
          providerName: 'te.ge',
          accountNumber: 'encrypted-account-number-1',
          enabled: true,
        },
      ],
    };

    // Create mock request
    const request = new NextRequest('http://localhost:3000/api/config/import', {
      method: 'POST',
      body: JSON.stringify(importConfig),
    });

    // Call the handler
    const response = await POST(request, mockSession);

    // Verify response - 207 because import was attempted but failed
    expect(response.status).toBe(207);

    const data = await response.json();
    expect(data.imported).toBe(0);
    expect(data.failed).toBe(1);
  });
});
