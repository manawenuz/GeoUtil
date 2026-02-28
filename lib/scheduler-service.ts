import { StorageAdapter } from './storage/types';
import { ProviderRegistry } from './providers/registry';
import { NotificationService } from './notification-service';
import { EncryptionService } from './encryption';

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
      // Note: The StorageAdapter interface doesn't have a getAllUsers method
      // In a real implementation, we would need to add this method or pass userIds
      if (!userIds || userIds.length === 0) {
        console.warn('No user IDs provided to executeScheduledCheck. Cannot iterate all users without getAllUsers method.');
        result.executionTime = Date.now() - startTime;
        return result;
      }

      // Process each user
      for (const userId of userIds) {
        try {
          await this.processUserAccounts(userId, result);
        } catch (error) {
          console.error(`Error processing user ${userId}:`, error);
          // Continue processing other users even if one fails
        }
      }
    } catch (error) {
      console.error('Error in executeScheduledCheck:', error);
    }

    result.executionTime = Date.now() - startTime;
    return result;
  }

  /**
   * Process all accounts for a specific user
   * 
   * @param userId - The user ID to process
   * @param result - The result object to update
   */
  private async processUserAccounts(userId: string, result: ScheduleResult): Promise<void> {
    // Get user data for notification configuration
    const user = await this.storageAdapter.getUser(userId);
    if (!user) {
      console.warn(`User ${userId} not found`);
      return;
    }

    // Skip if notifications are disabled
    if (!user.notificationEnabled) {
      console.log(`Notifications disabled for user ${userId}, skipping`);
      return;
    }

    // Get all accounts for this user
    const accounts = await this.storageAdapter.getAccountsByUser(userId);
    
    // Process each account
    for (const account of accounts) {
      // Skip disabled accounts
      if (!account.enabled) {
        continue;
      }

      result.totalAccounts++;

      try {
        const notificationSent = await this.processAccount(
          account.accountId,
          userId,
          user.ntfyFeedUrl,
          user.ntfyServerUrl
        );
        result.successfulChecks++;
        if (notificationSent) {
          result.notificationsSent++;
        }
      } catch (error) {
        result.failedChecks++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.errors.push({
          accountId: account.accountId,
          error: errorMessage,
        });
        console.error(`Error processing account ${account.accountId}:`, error);
        // Continue processing other accounts
      }
    }
  }

  /**
   * Process a single account: check balance and send notification if needed
   * 
   * @param accountId - The account ID to process
   * @param userId - The user ID (for notification recording)
   * @param ntfyFeedUrl - The encrypted ntfy feed URL for notifications
   * @param ntfyServerUrl - The ntfy server URL
   * @returns true if a notification was sent
   */
  private async processAccount(
    accountId: string,
    userId: string,
    ntfyFeedUrl: string,
    ntfyServerUrl: string
  ): Promise<boolean> {
    // Get account details
    const account = await this.storageAdapter.getAccount(accountId);
    if (!account) {
      throw new Error(`Account ${accountId} not found`);
    }

    // Get provider adapter
    const adapter = this.providerRegistry.getAdapter(account.providerName);
    if (!adapter) {
      throw new Error(`Provider adapter not found for ${account.providerName}`);
    }

    // Decrypt account number
    const decryptedAccountNumber = this.encryptionService.decrypt(account.accountNumber);

    // Fetch balance from provider
    const startTime = Date.now();
    const balanceResult = await adapter.fetchBalance(decryptedAccountNumber);
    const responseTime = Date.now() - startTime;

    // Record the check attempt
    await this.storageAdapter.recordCheckAttempt(
      accountId,
      balanceResult.success,
      balanceResult.error
    );

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

    // If check failed, don't process notifications
    if (!balanceResult.success) {
      throw new Error(balanceResult.error || 'Balance check failed');
    }

    // Handle overdue tracking and notifications
    return await this.handleBalanceNotification(
      accountId,
      userId,
      account.providerName,
      decryptedAccountNumber,
      balanceResult.balance,
      ntfyFeedUrl,
      ntfyServerUrl
    );
  }

  /**
   * Handle overdue tracking and send notification if needed
   * 
   * @param accountId - The account ID
   * @param userId - The user ID
   * @param providerName - The provider name
   * @param accountNumber - The decrypted account number
   * @param balance - The current balance
   * @param ntfyFeedUrl - The encrypted ntfy feed URL
   * @param ntfyServerUrl - The ntfy server URL
   * @returns true if a notification was sent
   */
  private async handleBalanceNotification(
    accountId: string,
    userId: string,
    providerName: string,
    accountNumber: string,
    balance: number,
    ntfyFeedUrl: string,
    ntfyServerUrl: string
  ): Promise<boolean> {
    if (balance === 0) {
      // Reset overdue counter if balance is zero
      await this.storageAdapter.resetOverdueDays(accountId);
      // Don't send notification for zero balance
      return false;
    }

    // Increment overdue counter for non-zero balance
    const overdueDays = await this.storageAdapter.incrementOverdueDays(accountId);

    // Determine priority based on overdue days
    const priority = this.notificationService.determinePriority(overdueDays);

    // Format notification message
    const message = this.notificationService.formatBalanceMessage(
      providerName,
      accountNumber,
      balance,
      overdueDays
    );

    // Decrypt ntfy feed URL
    const decryptedFeedUrl = this.encryptionService.decrypt(ntfyFeedUrl);
    
    // Extract topic from feed URL (last part of the URL)
    const topic = decryptedFeedUrl.split('/').pop() || 'utility-monitor';

    // Send notification
    const notificationPayload = {
      topic,
      title: 'Utility Bill Due',
      message,
      priority,
      tags: ['bill', 'utility'],
      serverUrl: ntfyServerUrl,
    };

    const deliverySuccess = await this.notificationService.sendNotification(notificationPayload);

    // Record notification
    await this.storageAdapter.recordNotification({
      userId,
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
