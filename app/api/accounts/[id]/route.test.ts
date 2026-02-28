/**
 * Unit tests for PUT /api/accounts/:id endpoint
 * 
 * Tests account update with validation, encryption, and authorization
 */

import { NextRequest } from 'next/server';

// Mock dependencies BEFORE importing the route
jest.mock('@/lib/auth-helpers');
jest.mock('@/lib/storage/factory');
jest.mock('@/lib/providers/factory');
jest.mock('@/lib/encryption');
jest.mock('@/lib/ensure-init');

import { withAuth } from '@/lib/auth-helpers';
import { getStorageAdapter } from '@/lib/storage/factory';
import { getProviderRegistry } from '@/lib/providers/factory';
import { createEncryptionService } from '@/lib/encryption';
import { ensureInitialized } from '@/lib/ensure-init';

// Set up withAuth mock before importing route
(withAuth as jest.Mock).mockImplementation((handler) => {
  return handler;
});

// Mock ensureInitialized to resolve immediately
(ensureInitialized as jest.Mock).mockResolvedValue(undefined);

// Now import the route handlers
import { PUT, DELETE } from './route';

describe('PUT /api/accounts/:id', () => {
  let mockStorageAdapter: any;
  let mockProviderRegistry: any;
  let mockProviderAdapter: any;
  let mockEncryptionService: any;
  let mockSession: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock session
    mockSession = {
      user: {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      },
    };

    // Mock existing account
    const mockExistingAccount = {
      accountId: 'account-456',
      userId: 'user-123',
      providerType: 'gas',
      providerName: 'te.ge',
      accountNumber: 'encrypted-old-number',
      enabled: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };

    // Mock storage adapter
    mockStorageAdapter = {
      getAccount: jest.fn().mockResolvedValue(mockExistingAccount),
      updateAccount: jest.fn().mockResolvedValue(undefined),
      deleteAccount: jest.fn().mockResolvedValue(undefined),
    };
    (getStorageAdapter as jest.Mock).mockReturnValue(mockStorageAdapter);

    // Mock provider adapter
    mockProviderAdapter = {
      providerName: 'te.ge',
      providerType: 'gas',
      validateAccountNumber: jest.fn().mockReturnValue(true),
      getAccountNumberFormat: jest.fn().mockReturnValue('12 digits'),
    };

    // Mock provider registry
    mockProviderRegistry = {
      getAdapter: jest.fn().mockReturnValue(mockProviderAdapter),
      listProviders: jest.fn().mockReturnValue([
        { providerName: 'te.ge', providerType: 'gas' },
      ]),
    };
    (getProviderRegistry as jest.Mock).mockReturnValue(mockProviderRegistry);

    // Mock encryption service
    mockEncryptionService = {
      encrypt: jest.fn().mockReturnValue('encrypted-new-number'),
    };
    (createEncryptionService as jest.Mock).mockReturnValue(mockEncryptionService);
  });

  it('should update account number successfully', async () => {
    const request = new NextRequest('http://localhost:3000/api/accounts/account-456', {
      method: 'PUT',
      body: JSON.stringify({
        accountNumber: '987654321098',
      }),
    });

    const response = await PUT(request, mockSession);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.accountId).toBe('account-456');
    expect(data.message).toBe('Account updated successfully');
    
    // Verify encryption was called
    expect(mockEncryptionService.encrypt).toHaveBeenCalledWith('987654321098');
    
    // Verify storage adapter was called with encrypted account number
    expect(mockStorageAdapter.updateAccount).toHaveBeenCalledWith('account-456', {
      accountNumber: 'encrypted-new-number',
    });
  });

  it('should update enabled status successfully', async () => {
    const request = new NextRequest('http://localhost:3000/api/accounts/account-456', {
      method: 'PUT',
      body: JSON.stringify({
        enabled: false,
      }),
    });

    const response = await PUT(request, mockSession);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockStorageAdapter.updateAccount).toHaveBeenCalledWith('account-456', {
      enabled: false,
    });
  });

  it('should update multiple fields successfully', async () => {
    const request = new NextRequest('http://localhost:3000/api/accounts/account-456', {
      method: 'PUT',
      body: JSON.stringify({
        accountNumber: '987654321098',
        enabled: false,
      }),
    });

    const response = await PUT(request, mockSession);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockStorageAdapter.updateAccount).toHaveBeenCalledWith('account-456', {
      accountNumber: 'encrypted-new-number',
      enabled: false,
    });
  });

  it('should return 404 when account does not exist', async () => {
    mockStorageAdapter.getAccount.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/accounts/nonexistent', {
      method: 'PUT',
      body: JSON.stringify({
        accountNumber: '987654321098',
      }),
    });

    const response = await PUT(request, mockSession);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Not Found');
    expect(data.message).toBe('Account not found');
  });

  it('should return 403 when account belongs to different user', async () => {
    const otherUserAccount = {
      accountId: 'account-456',
      userId: 'other-user',
      providerType: 'gas',
      providerName: 'te.ge',
      accountNumber: 'encrypted-old-number',
      enabled: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };
    mockStorageAdapter.getAccount.mockResolvedValue(otherUserAccount);

    const request = new NextRequest('http://localhost:3000/api/accounts/account-456', {
      method: 'PUT',
      body: JSON.stringify({
        accountNumber: '987654321098',
      }),
    });

    const response = await PUT(request, mockSession);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Forbidden');
    expect(data.message).toContain('do not have permission');
  });

  it('should return 400 when no fields provided for update', async () => {
    const request = new NextRequest('http://localhost:3000/api/accounts/account-456', {
      method: 'PUT',
      body: JSON.stringify({}),
    });

    const response = await PUT(request, mockSession);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation Error');
    expect(data.message).toContain('No valid fields provided');
  });

  it('should return 400 when provider type is invalid', async () => {
    const request = new NextRequest('http://localhost:3000/api/accounts/account-456', {
      method: 'PUT',
      body: JSON.stringify({
        providerType: 'invalid',
      }),
    });

    const response = await PUT(request, mockSession);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation Error');
    expect(data.message).toContain('Invalid provider type');
  });

  it('should return 400 when provider name is unknown', async () => {
    mockProviderRegistry.getAdapter.mockReturnValue(null);

    const request = new NextRequest('http://localhost:3000/api/accounts/account-456', {
      method: 'PUT',
      body: JSON.stringify({
        providerName: 'unknown-provider',
      }),
    });

    const response = await PUT(request, mockSession);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation Error');
    expect(data.message).toContain('Unknown provider');
  });

  it('should return 400 when provider type does not match provider name', async () => {
    mockProviderAdapter.providerType = 'water';

    const request = new NextRequest('http://localhost:3000/api/accounts/account-456', {
      method: 'PUT',
      body: JSON.stringify({
        providerType: 'gas',
        providerName: 'te.ge',
      }),
    });

    const response = await PUT(request, mockSession);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation Error');
    expect(data.message).toContain('is a water provider, not gas');
  });

  it('should return 400 when account number format is invalid', async () => {
    mockProviderAdapter.validateAccountNumber.mockReturnValue(false);

    const request = new NextRequest('http://localhost:3000/api/accounts/account-456', {
      method: 'PUT',
      body: JSON.stringify({
        accountNumber: 'invalid',
      }),
    });

    const response = await PUT(request, mockSession);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation Error');
    expect(data.message).toContain('Invalid account number format');
    expect(data.message).toContain('12 digits');
  });

  it('should return 400 when enabled is not a boolean', async () => {
    const request = new NextRequest('http://localhost:3000/api/accounts/account-456', {
      method: 'PUT',
      body: JSON.stringify({
        enabled: 'yes',
      }),
    });

    const response = await PUT(request, mockSession);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation Error');
    expect(data.message).toContain('enabled must be a boolean');
  });

  it('should validate account number against updated provider name', async () => {
    const waterAdapter = {
      providerName: 'water.ge',
      providerType: 'water',
      validateAccountNumber: jest.fn().mockReturnValue(true),
      getAccountNumberFormat: jest.fn().mockReturnValue('10 digits'),
    };

    mockProviderRegistry.getAdapter.mockImplementation((name: string) => {
      if (name === 'water.ge') return waterAdapter;
      return mockProviderAdapter;
    });

    const request = new NextRequest('http://localhost:3000/api/accounts/account-456', {
      method: 'PUT',
      body: JSON.stringify({
        providerType: 'water',
        providerName: 'water.ge',
        accountNumber: '1234567890',
      }),
    });

    const response = await PUT(request, mockSession);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(waterAdapter.validateAccountNumber).toHaveBeenCalledWith('1234567890');
  });

  it('should return 500 when encryption service fails', async () => {
    mockEncryptionService.encrypt.mockImplementation(() => {
      throw new Error('Encryption key is required');
    });

    const request = new NextRequest('http://localhost:3000/api/accounts/account-456', {
      method: 'PUT',
      body: JSON.stringify({
        accountNumber: '987654321098',
      }),
    });

    const response = await PUT(request, mockSession);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Configuration Error');
    expect(data.message).toContain('encryption configuration');
  });

  it('should return 500 when storage adapter fails', async () => {
    mockStorageAdapter.updateAccount.mockRejectedValue(
      new Error('storage connection failed')
    );

    const request = new NextRequest('http://localhost:3000/api/accounts/account-456', {
      method: 'PUT',
      body: JSON.stringify({
        enabled: false,
      }),
    });

    const response = await PUT(request, mockSession);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Storage Error');
    expect(data.message).toContain('Failed to update account');
  });
});

describe('DELETE /api/accounts/:id', () => {
  let mockStorageAdapter: any;
  let mockSession: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock session
    mockSession = {
      user: {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      },
    };

    // Mock existing account
    const mockExistingAccount = {
      accountId: 'account-456',
      userId: 'user-123',
      providerType: 'gas',
      providerName: 'te.ge',
      accountNumber: 'encrypted-number',
      enabled: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };

    // Mock storage adapter
    mockStorageAdapter = {
      getAccount: jest.fn().mockResolvedValue(mockExistingAccount),
      deleteAccount: jest.fn().mockResolvedValue(undefined),
    };
    (getStorageAdapter as jest.Mock).mockReturnValue(mockStorageAdapter);
  });

  it('should delete account successfully', async () => {
    const request = new NextRequest('http://localhost:3000/api/accounts/account-456', {
      method: 'DELETE',
    });

    const response = await DELETE(request, mockSession);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.accountId).toBe('account-456');
    expect(data.message).toBe('Account deleted successfully');
    expect(data.deleted).toBeDefined();
    
    // Verify storage adapter was called
    expect(mockStorageAdapter.deleteAccount).toHaveBeenCalledWith('account-456');
  });

  it('should return 404 when account does not exist', async () => {
    mockStorageAdapter.getAccount.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/accounts/nonexistent', {
      method: 'DELETE',
    });

    const response = await DELETE(request, mockSession);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Not Found');
    expect(data.message).toBe('Account not found');
    
    // Verify deleteAccount was not called
    expect(mockStorageAdapter.deleteAccount).not.toHaveBeenCalled();
  });

  it('should return 403 when account belongs to different user', async () => {
    const otherUserAccount = {
      accountId: 'account-456',
      userId: 'other-user',
      providerType: 'gas',
      providerName: 'te.ge',
      accountNumber: 'encrypted-number',
      enabled: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };
    mockStorageAdapter.getAccount.mockResolvedValue(otherUserAccount);

    const request = new NextRequest('http://localhost:3000/api/accounts/account-456', {
      method: 'DELETE',
    });

    const response = await DELETE(request, mockSession);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Forbidden');
    expect(data.message).toContain('do not have permission to delete');
    
    // Verify deleteAccount was not called
    expect(mockStorageAdapter.deleteAccount).not.toHaveBeenCalled();
  });

  it('should return 500 when storage adapter fails', async () => {
    mockStorageAdapter.deleteAccount.mockRejectedValue(
      new Error('database connection failed')
    );

    const request = new NextRequest('http://localhost:3000/api/accounts/account-456', {
      method: 'DELETE',
    });

    const response = await DELETE(request, mockSession);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Storage Error');
    expect(data.message).toContain('Failed to delete account');
  });

  it('should return 500 for unexpected errors', async () => {
    mockStorageAdapter.deleteAccount.mockRejectedValue(
      new Error('Unexpected error')
    );

    const request = new NextRequest('http://localhost:3000/api/accounts/account-456', {
      method: 'DELETE',
    });

    const response = await DELETE(request, mockSession);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Internal Server Error');
    expect(data.message).toContain('unexpected error occurred');
  });
});
