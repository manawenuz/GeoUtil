import { POST } from './route';
import { NextRequest } from 'next/server';
import { getStorageAdapter } from '@/lib/storage/factory';
import { getProviderRegistry } from '@/lib/providers/factory';
import { SchedulerService } from '@/lib/scheduler-service';

// Mock dependencies
jest.mock('@/lib/ensure-init');
jest.mock('@/lib/storage/factory');
jest.mock('@/lib/providers/factory');
jest.mock('@/lib/notification-service');
jest.mock('@/lib/encryption');
jest.mock('@/lib/scheduler-service');

describe('POST /api/cron/check-balances', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.CRON_SECRET = 'test-secret-123';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should execute scheduled checks successfully with valid cron secret', async () => {
    // Mock scheduler result
    const mockResult = {
      totalAccounts: 5,
      successfulChecks: 4,
      failedChecks: 1,
      notificationsSent: 3,
      executionTime: 1500,
      errors: [
        { accountId: 'account-5', error: 'Provider timeout' },
      ],
    };

    const mockExecuteScheduledCheck = jest.fn().mockResolvedValue(mockResult);
    (SchedulerService as jest.Mock).mockImplementation(() => ({
      executeScheduledCheck: mockExecuteScheduledCheck,
    }));

    // Mock storage and provider registry
    (getStorageAdapter as jest.Mock).mockReturnValue({});
    (getProviderRegistry as jest.Mock).mockReturnValue({});

    // Create request with cron secret
    const request = new NextRequest('http://localhost:3000/api/cron/check-balances', {
      method: 'POST',
      headers: {
        'x-cron-secret': 'test-secret-123',
      },
      body: JSON.stringify({ userIds: ['user-1', 'user-2'] }),
    });

    // Call handler
    const response = await POST(request);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.result).toEqual(mockResult);
    expect(mockExecuteScheduledCheck).toHaveBeenCalledWith(['user-1', 'user-2']);
  });

  it('should accept cron secret in Authorization header', async () => {
    // Mock scheduler result
    const mockResult = {
      totalAccounts: 0,
      successfulChecks: 0,
      failedChecks: 0,
      notificationsSent: 0,
      executionTime: 100,
      errors: [],
    };

    const mockExecuteScheduledCheck = jest.fn().mockResolvedValue(mockResult);
    (SchedulerService as jest.Mock).mockImplementation(() => ({
      executeScheduledCheck: mockExecuteScheduledCheck,
    }));

    // Mock storage and provider registry
    (getStorageAdapter as jest.Mock).mockReturnValue({});
    (getProviderRegistry as jest.Mock).mockReturnValue({});

    // Create request with Authorization header
    const request = new NextRequest('http://localhost:3000/api/cron/check-balances', {
      method: 'POST',
      headers: {
        'authorization': 'Bearer test-secret-123',
      },
    });

    // Call handler
    const response = await POST(request);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should return 401 with invalid cron secret', async () => {
    // Create request with wrong secret
    const request = new NextRequest('http://localhost:3000/api/cron/check-balances', {
      method: 'POST',
      headers: {
        'x-cron-secret': 'wrong-secret',
      },
    });

    // Call handler
    const response = await POST(request);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 401 with missing cron secret', async () => {
    // Create request without secret
    const request = new NextRequest('http://localhost:3000/api/cron/check-balances', {
      method: 'POST',
    });

    // Call handler
    const response = await POST(request);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 500 if CRON_SECRET not configured', async () => {
    // Remove CRON_SECRET from environment
    delete process.env.CRON_SECRET;

    // Create request
    const request = new NextRequest('http://localhost:3000/api/cron/check-balances', {
      method: 'POST',
      headers: {
        'x-cron-secret': 'any-secret',
      },
    });

    // Call handler
    const response = await POST(request);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(500);
    expect(data.error).toBe('Configuration Error');
  });

  it('should handle request without body', async () => {
    // Mock scheduler result
    const mockResult = {
      totalAccounts: 0,
      successfulChecks: 0,
      failedChecks: 0,
      notificationsSent: 0,
      executionTime: 50,
      errors: [],
    };

    const mockExecuteScheduledCheck = jest.fn().mockResolvedValue(mockResult);
    (SchedulerService as jest.Mock).mockImplementation(() => ({
      executeScheduledCheck: mockExecuteScheduledCheck,
    }));

    // Mock storage and provider registry
    (getStorageAdapter as jest.Mock).mockReturnValue({});
    (getProviderRegistry as jest.Mock).mockReturnValue({});

    // Create request without body
    const request = new NextRequest('http://localhost:3000/api/cron/check-balances', {
      method: 'POST',
      headers: {
        'x-cron-secret': 'test-secret-123',
      },
    });

    // Call handler
    const response = await POST(request);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockExecuteScheduledCheck).toHaveBeenCalledWith(undefined);
  });

  it('should handle scheduler errors gracefully', async () => {
    // Mock scheduler to throw error
    const mockExecuteScheduledCheck = jest.fn().mockRejectedValue(
      new Error('Database connection failed')
    );
    (SchedulerService as jest.Mock).mockImplementation(() => ({
      executeScheduledCheck: mockExecuteScheduledCheck,
    }));

    // Mock storage and provider registry
    (getStorageAdapter as jest.Mock).mockReturnValue({});
    (getProviderRegistry as jest.Mock).mockReturnValue({});

    // Create request
    const request = new NextRequest('http://localhost:3000/api/cron/check-balances', {
      method: 'POST',
      headers: {
        'x-cron-secret': 'test-secret-123',
      },
    });

    // Call handler
    const response = await POST(request);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(500);
    expect(data.error).toBe('Internal Server Error');
    expect(data.details).toBe('Database connection failed');
  });

  it('should include execution summary in response', async () => {
    // Mock scheduler result with detailed data
    const mockResult = {
      totalAccounts: 10,
      successfulChecks: 8,
      failedChecks: 2,
      notificationsSent: 5,
      executionTime: 3000,
      errors: [
        { accountId: 'account-1', error: 'Timeout' },
        { accountId: 'account-2', error: 'Invalid response' },
      ],
    };

    const mockExecuteScheduledCheck = jest.fn().mockResolvedValue(mockResult);
    (SchedulerService as jest.Mock).mockImplementation(() => ({
      executeScheduledCheck: mockExecuteScheduledCheck,
    }));

    // Mock storage and provider registry
    (getStorageAdapter as jest.Mock).mockReturnValue({});
    (getProviderRegistry as jest.Mock).mockReturnValue({});

    // Create request
    const request = new NextRequest('http://localhost:3000/api/cron/check-balances', {
      method: 'POST',
      headers: {
        'x-cron-secret': 'test-secret-123',
      },
    });

    // Call handler
    const response = await POST(request);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(200);
    expect(data.result.totalAccounts).toBe(10);
    expect(data.result.successfulChecks).toBe(8);
    expect(data.result.failedChecks).toBe(2);
    expect(data.result.notificationsSent).toBe(5);
    expect(data.result.executionTime).toBe(3000);
    expect(data.result.errors).toHaveLength(2);
    expect(data.timestamp).toBeDefined();
  });
});
