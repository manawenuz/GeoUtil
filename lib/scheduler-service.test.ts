import { SchedulerService } from './scheduler-service';
import { StorageAdapter, User, Account } from './storage/types';
import { ProviderRegistry } from './providers/registry';
import { NotificationService } from './notification-service';
import { EncryptionService } from './encryption';
import { ProviderAdapter, BalanceResult } from './providers/types';

describe('SchedulerService', () => {
  let schedulerService: SchedulerService;
  let mockStorageAdapter: jest.Mocked<StorageAdapter>;
  let mockProviderRegistry: ProviderRegistry;
  let mockNotificationService: jest.Mocked<NotificationService>;
  let mockEncryptionService: jest.Mocked<EncryptionService>;

  beforeEach(() => {
    // Create mock storage adapter
    mockStorageAdapter = {
      getUser: jest.fn(),
      getAccountsByUser: jest.fn(),
      getAccount: jest.fn(),
      getAccountsDueForCheck: jest.fn().mockResolvedValue([]),
      getScheduleState: jest.fn().mockResolvedValue(null),
      upsertScheduleState: jest.fn(),
      recordCheckAttempt: jest.fn(),
      recordBalance: jest.fn(),
      incrementOverdueDays: jest.fn(),
      resetOverdueDays: jest.fn(),
      recordNotification: jest.fn(),
    } as any;

    // Create mock provider registry
    mockProviderRegistry = new ProviderRegistry();

    // Create mock notification service
    mockNotificationService = {
      sendNotification: jest.fn(),
      determinePriority: jest.fn(),
      formatBalanceMessage: jest.fn(),
    } as any;

    // Create mock encryption service
    mockEncryptionService = {
      encrypt: jest.fn(),
      decrypt: jest.fn(),
    } as any;

    schedulerService = new SchedulerService(
      mockStorageAdapter,
      mockProviderRegistry,
      mockNotificationService,
      mockEncryptionService,
      72
    );
  });

  describe('Platform Detection', () => {
    it('should detect Vercel environment', () => {
      const originalVercel = process.env.VERCEL;
      process.env.VERCEL = '1';
      
      expect(schedulerService.isVercel()).toBe(true);
      expect(schedulerService.useVercelCron()).toBe(true);
      expect(schedulerService.useNodeCron()).toBe(false);
      
      process.env.VERCEL = originalVercel;
    });

    it('should detect non-Vercel environment', () => {
      const originalVercel = process.env.VERCEL;
      const originalVercelEnv = process.env.VERCEL_ENV;
      delete process.env.VERCEL;
      delete process.env.VERCEL_ENV;
      
      expect(schedulerService.isVercel()).toBe(false);
      expect(schedulerService.useVercelCron()).toBe(false);
      expect(schedulerService.useNodeCron()).toBe(true);
      
      process.env.VERCEL = originalVercel;
      process.env.VERCEL_ENV = originalVercelEnv;
    });
  });

  describe('Schedule Interval', () => {
    it('should return correct interval in milliseconds', () => {
      const expectedInterval = 72 * 60 * 60 * 1000; // 72 hours in ms
      expect(schedulerService.getScheduleInterval()).toBe(expectedInterval);
    });

    it('should support custom interval', () => {
      const customScheduler = new SchedulerService(
        mockStorageAdapter,
        mockProviderRegistry,
        mockNotificationService,
        mockEncryptionService,
        24
      );
      const expectedInterval = 24 * 60 * 60 * 1000; // 24 hours in ms
      expect(customScheduler.getScheduleInterval()).toBe(expectedInterval);
    });
  });

  describe('executeScheduledCheck', () => {
    it('should return empty result when no user IDs provided', async () => {
      const result = await schedulerService.executeScheduledCheck([]);
      
      expect(result.totalAccounts).toBe(0);
      expect(result.successfulChecks).toBe(0);
      expect(result.failedChecks).toBe(0);
      expect(result.notificationsSent).toBe(0);
      expect(result.errors).toEqual([]);
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should skip users with notifications disabled', async () => {
      const userId = 'user-1';
      const user: User = {
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        ntfyFeedUrl: 'encrypted-url',
        ntfyServerUrl: 'https://ntfy.sh',
        notificationEnabled: false,
      };

      mockStorageAdapter.getUser.mockResolvedValue(user);

      const result = await schedulerService.executeScheduledCheck([userId]);

      expect(result.totalAccounts).toBe(0);
      expect(mockStorageAdapter.getAccountsByUser).not.toHaveBeenCalled();
    });

    it('should skip disabled accounts', async () => {
      const userId = 'user-1';
      const user: User = {
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        ntfyFeedUrl: 'encrypted-url',
        ntfyServerUrl: 'https://ntfy.sh',
        notificationEnabled: true,
      };

      const accounts: Account[] = [
        {
          accountId: 'account-1',
          userId,
          providerType: 'gas',
          providerName: 'te.ge',
          accountNumber: 'encrypted-123',
          createdAt: new Date(),
          updatedAt: new Date(),
          enabled: false,
        },
      ];

      mockStorageAdapter.getUser.mockResolvedValue(user);
      mockStorageAdapter.getAccountsByUser.mockResolvedValue(accounts);

      const result = await schedulerService.executeScheduledCheck([userId]);

      expect(result.totalAccounts).toBe(0);
      expect(mockStorageAdapter.getAccount).not.toHaveBeenCalled();
    });

    it('should process enabled accounts and check balances', async () => {
      const userId = 'user-1';
      const accountId = 'account-1';
      const user: User = {
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        ntfyFeedUrl: 'encrypted-url',
        ntfyServerUrl: 'https://ntfy.sh',
        notificationEnabled: true,
      };

      const account: Account = {
        accountId,
        userId,
        providerType: 'gas',
        providerName: 'te.ge',
        accountNumber: 'encrypted-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        enabled: true,
      };

      const balanceResult: BalanceResult = {
        balance: 50.0,
        currency: 'GEL',
        timestamp: new Date(),
        success: true,
      };

      const mockAdapter: ProviderAdapter = {
        providerName: 'te.ge',
        providerType: 'gas',
        supportedRegions: ['Tbilisi'],
        validateAccountNumber: jest.fn(),
        getAccountNumberFormat: jest.fn(),
        fetchBalance: jest.fn().mockResolvedValue(balanceResult),
        getEndpointUrl: jest.fn(),
        getTimeout: jest.fn(),
        getRetryConfig: jest.fn(),
      };

      mockProviderRegistry.registerAdapter(mockAdapter);

      mockStorageAdapter.getAccountsDueForCheck.mockResolvedValue([{ accountId, userId }]);
      mockStorageAdapter.getUser.mockResolvedValue(user);
      mockStorageAdapter.getAccount.mockResolvedValue(account);
      mockEncryptionService.decrypt.mockImplementation((val) => val.replace('encrypted-', ''));
      mockStorageAdapter.incrementOverdueDays.mockResolvedValue(1);
      mockNotificationService.determinePriority.mockReturnValue('default');
      mockNotificationService.formatBalanceMessage.mockReturnValue('Test message');
      mockNotificationService.sendNotification.mockResolvedValue(true);

      const result = await schedulerService.executeScheduledCheck([userId]);

      expect(result.totalAccounts).toBe(1);
      expect(result.successfulChecks).toBe(1);
      expect(result.failedChecks).toBe(0);
      expect(mockStorageAdapter.recordBalance).toHaveBeenCalled();
      expect(mockStorageAdapter.recordCheckAttempt).toHaveBeenCalled();
    });

    it('should handle zero balance without sending notification', async () => {
      const userId = 'user-1';
      const accountId = 'account-1';
      const user: User = {
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        ntfyFeedUrl: 'encrypted-url',
        ntfyServerUrl: 'https://ntfy.sh',
        notificationEnabled: true,
      };

      const account: Account = {
        accountId,
        userId,
        providerType: 'gas',
        providerName: 'te.ge',
        accountNumber: 'encrypted-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        enabled: true,
      };

      const balanceResult: BalanceResult = {
        balance: 0,
        currency: 'GEL',
        timestamp: new Date(),
        success: true,
      };

      const mockAdapter: ProviderAdapter = {
        providerName: 'te.ge',
        providerType: 'gas',
        supportedRegions: ['Tbilisi'],
        validateAccountNumber: jest.fn(),
        getAccountNumberFormat: jest.fn(),
        fetchBalance: jest.fn().mockResolvedValue(balanceResult),
        getEndpointUrl: jest.fn(),
        getTimeout: jest.fn(),
        getRetryConfig: jest.fn(),
      };

      mockProviderRegistry.registerAdapter(mockAdapter);

      mockStorageAdapter.getAccountsDueForCheck.mockResolvedValue([{ accountId, userId }]);
      mockStorageAdapter.getUser.mockResolvedValue(user);
      mockStorageAdapter.getAccount.mockResolvedValue(account);
      mockEncryptionService.decrypt.mockImplementation((val) => val.replace('encrypted-', ''));

      const result = await schedulerService.executeScheduledCheck([userId]);

      expect(result.totalAccounts).toBe(1);
      expect(result.successfulChecks).toBe(1);
      expect(result.notificationsSent).toBe(0);
      expect(mockStorageAdapter.resetOverdueDays).toHaveBeenCalledWith(accountId);
      expect(mockNotificationService.sendNotification).not.toHaveBeenCalled();
    });

    it('should continue processing after individual account failure', async () => {
      const userId = 'user-1';
      const user: User = {
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        ntfyFeedUrl: 'encrypted-url',
        ntfyServerUrl: 'https://ntfy.sh',
        notificationEnabled: true,
      };

      const accounts: Account[] = [
        {
          accountId: 'account-1',
          userId,
          providerType: 'gas',
          providerName: 'te.ge',
          accountNumber: 'encrypted-123',
          createdAt: new Date(),
          updatedAt: new Date(),
          enabled: true,
        },
        {
          accountId: 'account-2',
          userId,
          providerType: 'gas',
          providerName: 'te.ge',
          accountNumber: 'encrypted-456',
          createdAt: new Date(),
          updatedAt: new Date(),
          enabled: true,
        },
      ];

      const balanceResult: BalanceResult = {
        balance: 50.0,
        currency: 'GEL',
        timestamp: new Date(),
        success: true,
      };

      const mockAdapter: ProviderAdapter = {
        providerName: 'te.ge',
        providerType: 'gas',
        supportedRegions: ['Tbilisi'],
        validateAccountNumber: jest.fn(),
        getAccountNumberFormat: jest.fn(),
        fetchBalance: jest.fn().mockResolvedValue(balanceResult),
        getEndpointUrl: jest.fn(),
        getTimeout: jest.fn(),
        getRetryConfig: jest.fn(),
      };

      mockProviderRegistry.registerAdapter(mockAdapter);

      mockStorageAdapter.getAccountsDueForCheck.mockResolvedValue([
        { accountId: 'account-1', userId },
        { accountId: 'account-2', userId },
      ]);
      mockStorageAdapter.getUser.mockResolvedValue(user);
      mockStorageAdapter.getAccount
        .mockResolvedValueOnce(null) // First account fails
        .mockResolvedValueOnce(accounts[1]); // Second account succeeds
      mockEncryptionService.decrypt.mockImplementation((val) => val.replace('encrypted-', ''));
      mockStorageAdapter.incrementOverdueDays.mockResolvedValue(1);
      mockNotificationService.determinePriority.mockReturnValue('default');
      mockNotificationService.formatBalanceMessage.mockReturnValue('Test message');
      mockNotificationService.sendNotification.mockResolvedValue(true);

      const result = await schedulerService.executeScheduledCheck([userId]);

      expect(result.totalAccounts).toBe(2);
      expect(result.successfulChecks).toBe(1);
      expect(result.failedChecks).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].accountId).toBe('account-1');
    });
  });

  describe('start and stop', () => {
    it('should log when starting in node-cron mode', async () => {
      const consoleSpy = jest.spyOn(console, 'log');
      const originalVercel = process.env.VERCEL;
      const originalVercelEnv = process.env.VERCEL_ENV;
      delete process.env.VERCEL;
      delete process.env.VERCEL_ENV;

      await schedulerService.start();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Scheduler started'));
      
      process.env.VERCEL = originalVercel;
      process.env.VERCEL_ENV = originalVercelEnv;
      consoleSpy.mockRestore();
    });

    it('should log when starting in Vercel mode', async () => {
      const consoleSpy = jest.spyOn(console, 'log');
      const originalVercel = process.env.VERCEL;
      process.env.VERCEL = '1';

      await schedulerService.start();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Vercel Cron'));
      
      process.env.VERCEL = originalVercel;
      consoleSpy.mockRestore();
    });
  });
});
