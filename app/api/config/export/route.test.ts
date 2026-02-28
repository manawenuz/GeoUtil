import { NextRequest } from 'next/server';

// Mock dependencies BEFORE importing the route
jest.mock('@/lib/auth-helpers');
jest.mock('@/lib/storage/factory');
jest.mock('@/lib/ensure-init');

import { withAuth } from '@/lib/auth-helpers';
import { getStorageAdapter } from '@/lib/storage/factory';
import { ensureInitialized } from '@/lib/ensure-init';

// Set up withAuth mock before importing route
(withAuth as jest.Mock).mockImplementation((handler) => {
  return handler;
});

// Set up ensureInitialized mock
(ensureInitialized as jest.Mock).mockResolvedValue(undefined);

// Now import the route handlers
import { GET } from './route';

describe('GET /api/config/export', () => {
  let mockStorageAdapter: any;
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
  });

  it('should export user configuration with encrypted values', async () => {
    // Mock storage adapter
    mockStorageAdapter = {
      getUser: jest.fn().mockResolvedValue({
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        ntfyFeedUrl: 'encrypted-feed-url',
        ntfyServerUrl: 'https://ntfy.sh',
        notificationEnabled: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      }),
      getAccountsByUser: jest.fn().mockResolvedValue([
        {
          accountId: 'account-1',
          userId: 'user-123',
          providerType: 'gas',
          providerName: 'te.ge',
          accountNumber: 'encrypted-account-number-1',
          enabled: true,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          accountId: 'account-2',
          userId: 'user-123',
          providerType: 'water',
          providerName: 'water-provider',
          accountNumber: 'encrypted-account-number-2',
          enabled: true,
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
        },
      ]),
    };

    (getStorageAdapter as jest.Mock).mockReturnValue(mockStorageAdapter);

    // Create mock request
    const request = new NextRequest('http://localhost:3000/api/config/export');

    // Call the handler
    const response = await GET(request, mockSession);

    // Verify response
    expect(response.status).toBe(200);

    const data = await response.json();

    // Verify export structure
    expect(data).toHaveProperty('version', '1.0');
    expect(data).toHaveProperty('exportedAt');
    expect(data).toHaveProperty('user');
    expect(data).toHaveProperty('accounts');

    // Verify user data
    expect(data.user.email).toBe('test@example.com');
    expect(data.user.name).toBe('Test User');
    expect(data.user.ntfyServerUrl).toBe('https://ntfy.sh');
    expect(data.user.notificationEnabled).toBe(true);

    // Verify encrypted values are kept encrypted (Requirement 18.4)
    expect(data.user.ntfyFeedUrl).toBe('encrypted-feed-url');

    // Verify accounts
    expect(data.accounts).toHaveLength(2);
    expect(data.accounts[0].providerType).toBe('gas');
    expect(data.accounts[0].providerName).toBe('te.ge');
    // Verify account numbers are kept encrypted (Requirement 18.4)
    expect(data.accounts[0].accountNumber).toBe('encrypted-account-number-1');
    expect(data.accounts[1].accountNumber).toBe('encrypted-account-number-2');

    // Verify Content-Disposition header for download
    const contentDisposition = response.headers.get('Content-Disposition');
    expect(contentDisposition).toContain('attachment');
    expect(contentDisposition).toContain('utility-monitor-config-');
  });

  it('should return 404 if user not found', async () => {
    // Mock storage adapter with no user
    mockStorageAdapter = {
      getUser: jest.fn().mockResolvedValue(null),
      getAccountsByUser: jest.fn(),
    };

    (getStorageAdapter as jest.Mock).mockReturnValue(mockStorageAdapter);

    // Create mock request
    const request = new NextRequest('http://localhost:3000/api/config/export');

    // Call the handler
    const response = await GET(request, mockSession);

    // Verify response
    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data.error).toBe('User Not Found');
  });

  it('should handle storage errors gracefully', async () => {
    // Mock storage adapter that throws error
    mockStorageAdapter = {
      getUser: jest.fn().mockRejectedValue(new Error('Database connection failed')),
      getAccountsByUser: jest.fn(),
    };

    (getStorageAdapter as jest.Mock).mockReturnValue(mockStorageAdapter);

    // Create mock request
    const request = new NextRequest('http://localhost:3000/api/config/export');

    // Call the handler
    const response = await GET(request, mockSession);

    // Verify response
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data.error).toBe('Storage Error');
  });

  it('should export empty accounts array if user has no accounts', async () => {
    // Mock storage adapter with user but no accounts
    mockStorageAdapter = {
      getUser: jest.fn().mockResolvedValue({
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        ntfyFeedUrl: 'encrypted-feed-url',
        ntfyServerUrl: 'https://ntfy.sh',
        notificationEnabled: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      }),
      getAccountsByUser: jest.fn().mockResolvedValue([]),
    };

    (getStorageAdapter as jest.Mock).mockReturnValue(mockStorageAdapter);

    // Create mock request
    const request = new NextRequest('http://localhost:3000/api/config/export');

    // Call the handler
    const response = await GET(request, mockSession);

    // Verify response
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.accounts).toEqual([]);
  });

  it('should include all account fields in export', async () => {
    // Mock storage adapter
    mockStorageAdapter = {
      getUser: jest.fn().mockResolvedValue({
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        ntfyFeedUrl: 'encrypted-feed-url',
        ntfyServerUrl: 'https://ntfy.sh',
        notificationEnabled: false,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      }),
      getAccountsByUser: jest.fn().mockResolvedValue([
        {
          accountId: 'account-1',
          userId: 'user-123',
          providerType: 'electricity',
          providerName: 'electric-provider',
          accountNumber: 'encrypted-account-number',
          enabled: false,
          createdAt: new Date('2024-01-15T10:30:00Z'),
          updatedAt: new Date('2024-01-15T10:30:00Z'),
        },
      ]),
    };

    (getStorageAdapter as jest.Mock).mockReturnValue(mockStorageAdapter);

    // Create mock request
    const request = new NextRequest('http://localhost:3000/api/config/export');

    // Call the handler
    const response = await GET(request, mockSession);

    // Verify response
    expect(response.status).toBe(200);

    const data = await response.json();

    // Verify all account fields are present
    const account = data.accounts[0];
    expect(account.providerType).toBe('electricity');
    expect(account.providerName).toBe('electric-provider');
    expect(account.accountNumber).toBe('encrypted-account-number');
    expect(account.enabled).toBe(false);
    expect(account.createdAt).toBe('2024-01-15T10:30:00.000Z');
  });
});
