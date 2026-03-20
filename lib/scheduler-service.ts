import { StorageAdapter, User } from './storage/types';
import { ProviderRegistry } from './providers/registry';
import { NotificationService } from './notification-service';
import { EncryptionService } from './encryption';
import { SmartScheduler } from './smart-scheduler';

/**
 * Result of a scheduled check execution
 */
export interface ScheduleResult {
  totalAccounts: number;
  successfulChecks: number;
  failedChecks: number;
  notificationsSent: number;
  executionTime: number; // milliseconds
  errors: Array<{ accountId: string; error: string }>;
}

/**
 * SchedulerService handles automated balance checking
 * 
 * Requirements:
 * - 7.1: Trigger balance checks every 72 hours
 * - 7.2: Invoke backend for each configured account
 * - 7.3: Execute independently for each user
 * - 7.4: Continue processing if individual checks fail
 * - 13.5: Handle individual check failures gracefully
 */
export class SchedulerService {
  private storageAdapter: StorageAdapter;
  private providerRegistry: ProviderRegistry;
  private notificationService: NotificationService;
  private encryptionService: EncryptionService;
  private scheduleIntervalHours: number;
  private smartScheduler: SmartScheduler;

  constructor(
    storageAdapter: StorageAdapter,
    providerRegistry: ProviderRegistry,
    notificationService: NotificationService,
    encryptionService: EncryptionService,
    scheduleIntervalHours: number = 72
  ) {
    this.storageAdapter = storageAdapter;
    this.providerRegistry = providerRegistry;
    this.notificationService = notificationService;
    this.encryptionService = encryptionService;
    this.scheduleIntervalHours = scheduleIntervalHours;
    this.smartScheduler = new SmartScheduler();
  }

  /**
   * Detect if running on Vercel platform
   * 
   * @returns true if running on Vercel
   */
  isVercel(): boolean {
    return process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;
  }

  /**
   * Determine if Vercel Cron should be used
   * 
   * @returns true if Vercel Cron should be used
   */
  useVercelCron(): boolean {
    return this.isVercel();
  }

  /**
   * Determine if node-cron should be used
   * 
   * @returns true if node-cron should be used
   */
  useNodeCron(): boolean {
    return !this.isVercel();
  }

  /**
   * Get the schedule interval in milliseconds
   * 
   * @returns Schedule interval in milliseconds
   */
  getScheduleInterval(): number {
    return this.scheduleIntervalHours * 60 * 60 * 1000;
  }

  /**
   * Execute scheduled balance checks for all users and accounts
   * 
   * This method:
   * 1. Retrieves all users from storage
   * 2. For each user, retrieves their accounts
   * 3. For each account, performs a balance check
   * 4. Sends notifications based on balance and overdue status
   * 5. Handles failures gracefully and continues processing
   * 
   * Requirements:
   * - 7.2: Invoke backend for each configured account
   * - 7.3: Execute independently for each user
   * - 7.4: Continue processing if individual checks fail
   * - 13.5: Handle individual check failures gracefully
   * 
   * @param userIds - Optional array of user IDs to check. If not provided, checks all users.
   * @returns Promise<ScheduleResult> - Summary of the execution
   */
  async executeScheduledCheck(userIds?: string[]): Promise<ScheduleResult> {
    const startTime = Date.now();
    const result: ScheduleResult = {
      totalAccounts: 0,
      successfulChecks: 0,
      failedChecks: 0,
      notificationsSent: 0,
      executionTime: 0,
      errors: [],
    };

    try {
      // Use smart scheduling: only check accounts that are due
      const accountsDue = await this.storageAdapter.getAccountsDueForCheck(new Date());

      // If userIds provided, filter to only those users
      const filtered = userIds?.length
        ? accountsDue.filter(a => userIds.includes(a.userId))
        : accountsDue;

      // Group by userId to load user data once
      const byUser = new Map<string, string[]>();
      for (const { accountId, userId } of filtered) {
        const list = byUser.get(userId) || [];
        list.push(accountId);
        byUser.set(userId, list);
      }

      for (const [userId, accountIds] of byUser) {
        const user = await this.storageAdapter.getUser(userId);
        if (!user || !user.notificationEnabled) continue;

        for (const accountId of accountIds) {
          result.totalAccounts++;
          try {
            const notificationSent = await this.processAccount(accountId, user);
            result.successfulChecks++;
            if (notificationSent) result.notificationsSent++;
          } catch (error) {
            result.failedChecks++;
            result.errors.push({
              accountId,
              error: error instanceof Error ? error.message : String(error),
            });
            console.error(`Error processing account ${accountId}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error in executeScheduledCheck:', error);
    }

    result.executionTime = Date.now() - startTime;
    return result;
  }

  /**
   * Process a single account: check balance, update schedule, send notification if needed
   */
  private async processAccount(
    accountId: string,
    user: User,
  ): Promise<boolean> {
    const account = await this.storageAdapter.getAccount(accountId);
    if (!account) throw new Error(`Account ${accountId} not found`);

    const adapter = this.providerRegistry.getAdapter(account.providerName);
    if (!adapter) throw new Error(`Provider adapter not found for ${account.providerName}`);

    const decryptedAccountNumber = this.encryptionService.decrypt(account.accountNumber);

    // Get current schedule state
    const scheduleState = await this.storageAdapter.getScheduleState(accountId);
    const lastBalance = scheduleState?.lastBalance ?? null;
    const consecutiveZeroCount = scheduleState?.consecutiveZeroCount ?? 0;

    // Fetch balance
    const balanceResult = await adapter.fetchBalance(decryptedAccountNumber);
    const now = new Date();

    // Record the check attempt
    await this.storageAdapter.recordCheckAttempt(accountId, balanceResult.success, balanceResult.error);

    // Record the balance
    await this.storageAdapter.recordBalance({
      accountId,
      balance: balanceResult.balance,
      currency: balanceResult.currency,
      checkedAt: balanceResult.timestamp,
      success: balanceResult.success,
      error: balanceResult.error,
      rawResponse: balanceResult.rawResponse,
    });

    // Calculate next check using smart scheduler
    const decision = this.smartScheduler.calculateNextCheck(
      now, lastBalance, balanceResult.balance, balanceResult.success, consecutiveZeroCount
    );

    // Update schedule state
    await this.storageAdapter.upsertScheduleState({
      accountId,
      lastCheckedAt: now,
      nextCheckAt: decision.nextCheckAt,
      checkIntervalHours: decision.intervalHours,
      consecutiveZeroCount: decision.newConsecutiveZeroCount,
      lastBalance: balanceResult.success ? balanceResult.balance : lastBalance,
    });

    if (!balanceResult.success) {
      throw new Error(balanceResult.error || 'Balance check failed');
    }

    // Send notification if smart scheduler says so (bill arrived)
    if (decision.shouldNotify) {
      return await this.handleBalanceNotification(
        accountId, user, account.providerName, account.providerType,
        decryptedAccountNumber, balanceResult.balance
      );
    }

    // Also handle ongoing overdue notifications
    if (balanceResult.balance > 0) {
      return await this.handleBalanceNotification(
        accountId, user, account.providerName, account.providerType,
        decryptedAccountNumber, balanceResult.balance
      );
    }

    // Zero balance — reset overdue
    if (balanceResult.balance === 0) {
      await this.storageAdapter.resetOverdueDays(accountId);
    }

    return false;
  }

  /**
   * Handle overdue tracking and send notification if needed.
   * Routes to ntfy, Telegram, or both based on user.notificationChannel.
   */
  private async handleBalanceNotification(
    accountId: string,
    user: import('./storage/types').User,
    providerName: string,
    providerType: string,
    accountNumber: string,
    balance: number,
  ): Promise<boolean> {
    if (balance === 0) {
      await this.storageAdapter.resetOverdueDays(accountId);
      return false;
    }

    const overdueDays = await this.storageAdapter.incrementOverdueDays(accountId);
    const priority = this.notificationService.determinePriority(overdueDays);
    const message = this.notificationService.formatBalanceMessage(
      providerName, accountNumber, balance, overdueDays
    );

    const channel = user.notificationChannel ?? 'ntfy';
    let deliverySuccess = false;

    // Send via ntfy
    if (channel === 'ntfy' || channel === 'both') {
      try {
        const decryptedFeedUrl = this.encryptionService.decrypt(user.ntfyFeedUrl);
        const topic = decryptedFeedUrl.split('/').pop() || 'utility-monitor';
        deliverySuccess = await this.notificationService.sendNotification({
          topic,
          title: 'Utility Bill Due',
          message,
          priority,
          tags: ['bill', 'utility'],
          serverUrl: user.ntfyServerUrl,
        });
      } catch (err) {
        console.error('ntfy notification failed:', err);
      }
    }

    // Send via Telegram
    if ((channel === 'telegram' || channel === 'both') && user.telegramEnabled && user.telegramChatId) {
      const { TelegramService } = await import('./telegram-service');
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (botToken) {
        const tg = new TelegramService(botToken);
        const tgMessage = tg.formatBalanceNotification(providerName, providerType, balance);
        const tgSuccess = await tg.sendMessage(user.telegramChatId, tgMessage);
        deliverySuccess = deliverySuccess || tgSuccess;
      }
    }

    await this.storageAdapter.recordNotification({
      userId: user.userId,
      accountId,
      sentAt: new Date(),
      priority,
      message,
      deliverySuccess,
      deliveryError: deliverySuccess ? undefined : 'Failed to send notification',
    });

    return deliverySuccess;
  }

  private cronTask: any = null;

  /**
   * Start the scheduler (for node-cron environments)
   * 
   * Uses node-cron to schedule periodic balance checks.
   * Only runs in non-Vercel environments (local/VPS).
   * 
   * Requirements:
   * - 21.3: Use node-cron for local/VPS deployment
   * - 21.4: Start scheduler on app initialization
   */
  async start(): Promise<void> {
    if (this.useNodeCron()) {
      const cron = await import('node-cron');
      
      // Convert hours to cron expression
      // For 72 hours, we run every 3 days at midnight
      const cronExpression = this.getCronExpression();
      
      console.log(`Starting node-cron scheduler with expression: ${cronExpression}`);
      console.log(`Interval: ${this.scheduleIntervalHours} hours`);
      
      this.cronTask = cron.schedule(cronExpression, async () => {
        console.log('Executing scheduled balance check...');
        try {
          const result = await this.executeScheduledCheck();
          console.log('Scheduled check completed:', result);
        } catch (error) {
          console.error('Error in scheduled check:', error);
        }
      });
      
      console.log('✓ Scheduler started successfully');
    } else {
      console.log('Running on Vercel, using Vercel Cron (configured in vercel.json)');
    }
  }

  /**
   * Stop the scheduler (for node-cron environments)
   */
  async stop(): Promise<void> {
    if (this.useNodeCron() && this.cronTask) {
      this.cronTask.stop();
      this.cronTask = null;
      console.log('✓ Scheduler stopped');
    }
  }

  /**
   * Get cron expression based on schedule interval
   * 
   * @returns Cron expression string
   */
  private getCronExpression(): string {
    // For simplicity, convert hours to a cron expression
    // If interval is 72 hours (3 days), run every 3 days at midnight
    // If interval is 24 hours, run daily at midnight
    // For other intervals, use a simple hourly pattern
    
    if (this.scheduleIntervalHours === 24) {
      return '0 0 * * *'; // Daily at midnight
    } else if (this.scheduleIntervalHours === 72) {
      return '0 0 */3 * *'; // Every 3 days at midnight
    } else if (this.scheduleIntervalHours % 24 === 0) {
      const days = this.scheduleIntervalHours / 24;
      return `0 0 */${days} * *`; // Every N days at midnight
    } else if (this.scheduleIntervalHours < 24) {
      return `0 */${this.scheduleIntervalHours} * * *`; // Every N hours
    } else {
      // For complex intervals, default to every 3 days
      console.warn(`Complex interval ${this.scheduleIntervalHours}h, defaulting to every 3 days`);
      return '0 0 */3 * *';
    }
  }
}
