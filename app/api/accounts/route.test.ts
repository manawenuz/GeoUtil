/**
 * Unit tests for /api/accounts endpoints
 * 
 * Tests account creation (POST) and listing (GET) with validation, encryption, and storage
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
import { GET, POST } from './route';

describe('POST /api/accounts', () => {
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

    // Mock storage adapter
    mockStorageAdapter = {
      createAccount: jest.fn().mockResolvedValue('account-456'),
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
      encrypt: jest.fn().mockReturnValue('encrypted-account-number'),
    };
    (createEncryptionService as jest.Mock).mockReturnValue(mockEncryptionService);
  });

  it('should create account successfully with valid data', async () => {
    const request = new NextRequest('http://localhost:3000/api/accounts', {
      method: 'POST',
      body: JSON.stringify({
        providerType: 'gas',
        providerName: 'te.ge',
        accountNumber: '123456789012',
      }),
    });

    const response = await POST(request, mockSession);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.accountId).toBe('account-456');
    expect(data.message).toBe('Account created successfully');
    
    // Verify encryption was called
    expect(mockEncryptionService.encrypt).toHaveBeenCalledWith('123456789012');
    
    // Verify storage adapter was called with encrypted account number
    expect(mockStorageAdapter.createAccount).toHaveBeenCalledWith({
      userId: 'user-123',
      providerType: 'gas',
      providerName: 'te.ge',
      accountNumber: 'encrypted-account-number',
      enabled: true,
    });
  });

  it('should return 400 when required fields are missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/accounts', {
      method: 'POST',
      body: JSON.stringify({
        providerType: 'gas',
        // Missing providerName and accountNumber
      }),
    });

    const response = await POST(request, mockSession);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation Error');
    expect(data.message).toContain('Missing required fields');
  });

  it('should return 400 when provider type is invalid', async () => {
    const request = new NextRequest('http://localhost:3000/api/accounts', {
      method: 'POST',
      body: JSON.stringify({
        providerType: 'invalid',
        providerName: 'te.ge',
        accountNumber: '123456789012',
      }),
    });

    const response = await POST(request, mockSession);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation Error');
    expect(data.message).toContain('Invalid provider type');
  });

  it('should return 400 when provider does not exist', async () => {
    mockProviderRegistry.getAdapter.mockReturnValue(null);

    const request = new NextRequest('http://localhost:3000/api/accounts', {
      method: 'POST',
      body: JSON.stringify({
        providerType: 'gas',
        providerName: 'unknown-provider',
        accountNumber: '123456789012',
      }),
    });

    const response = await POST(request, mockSession);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation Error');
    expect(data.message).toContain('Unknown provider');
  });

  it('should return 400 when provider type does not match', async () => {
    mockProviderAdapter.providerType = 'water';

    const request = new NextRequest('http://localhost:3000/api/accounts', {
      method: 'POST',
      body: JSON.stringify({
        providerType: 'gas',
        providerName: 'te.ge',
        accountNumber: '123456789012',
      }),
    });

    const response = await POST(request, mockSession);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation Error');
    expect(data.message).toContain('is a water provider, not gas');
  });

  it('should return 400 when account number format is invalid', async () => {
    mockProviderAdapter.validateAccountNumber.mockReturnValue(false);

    const request = new NextRequest('http://localhost:3000/api/accounts', {
      method: 'POST',
      body: JSON.stringify({
        providerType: 'gas',
        providerName: 'te.ge',
        accountNumber: 'invalid',
      }),
    });

    const response = await POST(request, mockSession);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation Error');
    expect(data.message).toContain('Invalid account number format');
    expect(data.message).toContain('12 digits');
  });

  it('should return 500 when encryption service fails', async () => {
    mockEncryptionService.encrypt.mockImplementation(() => {
      throw new Error('Encryption key is required');
    });

    const request = new NextRequest('http://localhost:3000/api/accounts', {
      method: 'POST',
      body: JSON.stringify({
        providerType: 'gas',
        providerName: 'te.ge',
        accountNumber: '123456789012',
      }),
    });

    const response = await POST(request, mockSession);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Configuration Error');
    expect(data.message).toContain('encryption configuration');
  });

  it('should return 500 when storage adapter fails', async () => {
    mockStorageAdapter.createAccount.mockRejectedValue(
      new Error('storage connection failed')
    );

    const request = new NextRequest('http://localhost:3000/api/accounts', {
      method: 'POST',
      body: JSON.stringify({
        providerType: 'gas',
        providerName: 'te.ge',
        accountNumber: '123456789012',
      }),
    });

    const response = await POST(request, mockSession);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Storage Error');
    expect(data.message).toContain('Failed to store account');
  });
});

describe('GET /api/accounts', () => {
  let mockStorageAdapter: any;
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

    // Mock storage adapter
    mockStorageAdapter = {
      getAccountsByUser: jest.fn(),
      getLatestBalance: jest.fn(),
    };
    (getStorageAdapter as jest.Mock).mockReturnValue(mockStorageAdapter);

    // Mock encryption service
    mockEncryptionService = {
      decrypt: jest.fn(),
    };
    (createEncryptionService as jest.Mock).mockReturnValue(mockEncryptionService);
  });

  it('should return empty array when user has no accounts', async () => {
    mockStorageAdapter.getAccountsByUser.mockResolvedValue([]);

    const request = new NextRequest('http://localhost:3000/api/accounts', {
      method: 'GET',
    });

    const response = await GET(request, mockSession);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.accounts).toEqual([]);
    expect(mockStorageAdapter.getAccountsByUser).toHaveBeenCalledWith('user-123');
  });

  it('should return accounts with decrypted account numbers and balances', async () => {
    const mockAccounts = [
      {
        accountId: 'account-1',
        userId: 'user-123',
        providerType: 'gas',
        providerName: 'te.ge',
        accountNumber: 'encrypted-123',
        enabled: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
      {
        accountId: 'account-2',
        userId: 'user-123',
        providerType: 'water',
        providerName: 'water.ge',
        accountNumber: 'encrypted-456',
        enabled: true,
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02'),
      },
    ];

    const mockBalances = {
      'account-1': {
        balanceId: 'balance-1',
        accountId: 'account-1',
        balance: 25.50,
        currency: 'GEL',
        checkedAt: new Date('2024-01-15'),
        success: true,
      },
      'account-2': {
        balanceId: 'balance-2',
        accountId: 'account-2',
        balance: 0,
        currency: 'GEL',
        checkedAt: new Date('2024-01-16'),
        success: true,
      },
    };

    mockStorageAdapter.getAccountsByUser.mockResolvedValue(mockAccounts);
    mockStorageAdapter.getLatestBalance.mockImplementation((accountId: string) => {
      return Promise.resolve(mockBalances[accountId as keyof typeof mockBalances]);
    });
    mockEncryptionService.decrypt.mockImplementation((encrypted: string) => {
      if (encrypted === 'encrypted-123') return '123456789012';
      if (encrypted === 'encrypted-456') return '987654321098';
      return encrypted;
    });

    const request = new NextRequest('http://localhost:3000/api/accounts', {
      method: 'GET',
    });

    const response = await GET(request, mockSession);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.accounts).toHaveLength(2);
    
    // Check first account
    expect(data.accounts[0]).toMatchObject({
      accountId: 'account-1',
      providerType: 'gas',
      providerName: 'te.ge',
      accountNumber: '123456789012',
      enabled: true,
      currentBalance: 25.50,
    });
    expect(data.accounts[0].lastChecked).toBeTruthy();
    
    // Check second account
    expect(data.accounts[1]).toMatchObject({
      accountId: 'account-2',
      providerType: 'water',
      providerName: 'water.ge',
      accountNumber: '987654321098',
      enabled: true,
      currentBalance: 0,
    });
    expect(data.accounts[1].lastChecked).toBeTruthy();

    // Verify decryption was called for each account
    expect(mockEncryptionService.decrypt).toHaveBeenCalledTimes(2);
    expect(mockEncryptionService.decrypt).toHaveBeenCalledWith('encrypted-123');
    expect(mockEncryptionService.decrypt).toHaveBeenCalledWith('encrypted-456');
  });

  it('should return null balance when no balance exists for account', async () => {
    const mockAccounts = [
      {
        accountId: 'account-1',
        userId: 'user-123',
        providerType: 'gas',
        providerName: 'te.ge',
        accountNumber: 'encrypted-123',
        enabled: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
    ];

    mockStorageAdapter.getAccountsByUser.mockResolvedValue(mockAccounts);
    mockStorageAdapter.getLatestBalance.mockResolvedValue(null);
    mockEncryptionService.decrypt.mockReturnValue('123456789012');

    const request = new NextRequest('http://localhost:3000/api/accounts', {
      method: 'GET',
    });

    const response = await GET(request, mockSession);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.accounts).toHaveLength(1);
    expect(data.accounts[0].currentBalance).toBeNull();
    expect(data.accounts[0].lastChecked).toBeNull();
  });

  it('should return 500 when encryption service fails', async () => {
    const mockAccounts = [
      {
        accountId: 'account-1',
        userId: 'user-123',
        providerType: 'gas',
        providerName: 'te.ge',
        accountNumber: 'encrypted-123',
        enabled: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
    ];

    mockStorageAdapter.getAccountsByUser.mockResolvedValue(mockAccounts);
    mockEncryptionService.decrypt.mockImplementation(() => {
      throw new Error('Invalid ciphertext format');
    });

    const request = new NextRequest('http://localhost:3000/api/accounts', {
      method: 'GET',
    });

    const response = await GET(request, mockSession);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Configuration Error');
    expect(data.message).toContain('encryption configuration');
  });

  it('should return 500 when storage adapter fails', async () => {
    mockStorageAdapter.getAccountsByUser.mockRejectedValue(
      new Error('storage connection failed')
    );

    const request = new NextRequest('http://localhost:3000/api/accounts', {
      method: 'GET',
    });

    const response = await GET(request, mockSession);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Storage Error');
    expect(data.message).toContain('Failed to retrieve accounts');
  });

  it('should handle accounts with disabled status', async () => {
    const mockAccounts = [
      {
        accountId: 'account-1',
        userId: 'user-123',
        providerType: 'gas',
        providerName: 'te.ge',
        accountNumber: 'encrypted-123',
        enabled: false,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
    ];

    mockStorageAdapter.getAccountsByUser.mockResolvedValue(mockAccounts);
    mockStorageAdapter.getLatestBalance.mockResolvedValue(null);
    mockEncryptionService.decrypt.mockReturnValue('123456789012');

    const request = new NextRequest('http://localhost:3000/api/accounts', {
      method: 'GET',
    });

    const response = await GET(request, mockSession);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.accounts).toHaveLength(1);
    expect(data.accounts[0].enabled).toBe(false);
  });
});
