import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-helpers";
import { ensureInitialized } from "@/lib/ensure-init";
import { getStorageAdapter } from "@/lib/storage/factory";
import { getProviderRegistry } from "@/lib/providers/factory";
import { NotificationService } from "@/lib/notification-service";
import { createEncryptionService } from "@/lib/encryption";

/**
 * POST /api/balances/check - Trigger manual balance check
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 8.1, 8.5, 9.3, 9.5, 13.1, 13.2, 13.3
 * 
 * This endpoint triggers a manual balance check for a specific account.
 * It routes the request to the appropriate provider adapter, stores the result,
 * updates the overdue counter, and sends notifications if needed.
 */
export const POST = withAuth(async (request: NextRequest, session) => {
  try {
    await ensureInitialized();
    
    const userId = session.user.id;
    
    // Parse request body
    const body = await request.json();
    const { accountId } = body;

    // Validate required fields
    if (!accountId) {
      return NextResponse.json(
        {
          error: "Validation Error",
          message: "Missing required field: accountId",
        },
        { status: 400 }
      );
    }

    // Get storage adapter
    const storageAdapter = getStorageAdapter();
    
    // Retrieve the account
    const account = await storageAdapter.getAccount(accountId);
    
    if (!account) {
      return NextResponse.json(
        {
          error: "Not Found",
          message: "Account not found",
        },
        { status: 404 }
      );
    }

    // Verify the account belongs to the authenticated user
    if (account.userId !== userId) {
      return NextResponse.json(
        {
          error: "Forbidden",
          message: "You do not have permission to access this account",
        },
        { status: 403 }
      );
    }

    // Check if account is enabled
    if (!account.enabled) {
      return NextResponse.json(
        {
          error: "Account Disabled",
          message: "This account is disabled. Enable it before checking balance.",
        },
        { status: 400 }
      );
    }

    // Get provider adapter
    const providerRegistry = getProviderRegistry();
    const providerAdapter = providerRegistry.getAdapter(account.providerName);

    if (!providerAdapter) {
      return NextResponse.json(
        {
          error: "Provider Not Found",
          message: `Provider adapter for ${account.providerName} is not available`,
        },
        { status: 500 }
      );
    }

    // Decrypt account number
    const encryptionService = createEncryptionService();
    const decryptedAccountNumber = encryptionService.decrypt(account.accountNumber);

    // Fetch balance from provider (includes retry logic in adapter)
    const startTime = Date.now();
    const balanceResult = await providerAdapter.fetchBalance(decryptedAccountNumber);
    const responseTime = Date.now() - startTime;

    // Record the check attempt for metrics
    await storageAdapter.recordCheckAttempt(
      accountId,
      balanceResult.success,
      balanceResult.error
    );

    // Store balance result
    await storageAdapter.recordBalance({
      accountId,
      balance: balanceResult.balance,
      currency: balanceResult.currency,
      checkedAt: balanceResult.timestamp,
      success: balanceResult.success,
      error: balanceResult.error,
      rawResponse: balanceResult.rawResponse,
    });

    // If the check failed, send failure notification and return error
    if (!balanceResult.success) {
      // Get user for notification config
      const user = await storageAdapter.getUser(userId);
      
      if (user && user.notificationEnabled && user.ntfyFeedUrl) {
        const notificationService = new NotificationService();
        const decryptedFeedUrl = encryptionService.decrypt(user.ntfyFeedUrl);
        
        // Extract topic from feed URL (last segment)
        const topic = decryptedFeedUrl.split('/').pop() || 'default';
        
        const failureNotification = {
          topic,
          title: 'Balance Check Failed',
          message: `Failed to check balance for ${account.providerName} account. ${balanceResult.error || 'Unknown error'}`,
          priority: 'default' as const,
          tags: ['warning', 'balance-check'],
          serverUrl: user.ntfyServerUrl,
        };
        
        const deliverySuccess = await notificationService.sendNotification(failureNotification);
        
        // Record notification
        await storageAdapter.recordNotification({
          userId,
          accountId,
          sentAt: new Date(),
          priority: 'default',
          message: failureNotification.message,
          deliverySuccess,
          deliveryError: deliverySuccess ? undefined : 'Failed to send notification',
        });
      }

      return NextResponse.json(
        {
          success: false,
          balance: null,
          timestamp: balanceResult.timestamp.toISOString(),
          error: balanceResult.error || 'Balance check failed',
          responseTime,
        },
        { status: 200 }
      );
    }

    // Update overdue counter based on balance
    let overdueDays = 0;
    
    if (balanceResult.balance > 0) {
      // Non-zero balance: increment overdue counter
      overdueDays = await storageAdapter.incrementOverdueDays(accountId);
    } else {
      // Zero balance: reset overdue counter
      await storageAdapter.resetOverdueDays(accountId);
      overdueDays = 0;
    }

    // Send notification if balance is non-zero
    if (balanceResult.balance > 0) {
      // Get user for notification config
      const user = await storageAdapter.getUser(userId);
      
      if (user && user.notificationEnabled && user.ntfyFeedUrl) {
        const notificationService = new NotificationService();
        const decryptedFeedUrl = encryptionService.decrypt(user.ntfyFeedUrl);
        
        // Extract topic from feed URL (last segment)
        const topic = decryptedFeedUrl.split('/').pop() || 'default';
        
        // Determine priority based on overdue days
        const priority = notificationService.determinePriority(overdueDays);
        
        // Format message
        const message = notificationService.formatBalanceMessage(
          account.providerName,
          decryptedAccountNumber,
          balanceResult.balance,
          overdueDays
        );
        
        const notification = {
          topic,
          title: 'Utility Bill Due',
          message,
          priority,
          tags: ['bill', 'payment'],
          serverUrl: user.ntfyServerUrl,
        };
        
        const deliverySuccess = await notificationService.sendNotification(notification);
        
        // Record notification
        await storageAdapter.recordNotification({
          userId,
          accountId,
          sentAt: new Date(),
          priority,
          message,
          deliverySuccess,
          deliveryError: deliverySuccess ? undefined : 'Failed to send notification',
        });
      }
    }

    return NextResponse.json({
      success: true,
      balance: balanceResult.balance,
      currency: balanceResult.currency,
      timestamp: balanceResult.timestamp.toISOString(),
      overdueDays,
      responseTime,
    });

  } catch (error) {
    console.error("Error checking balance:", error);
    
    // Handle specific error types
    if (error instanceof Error) {
      // Check for encryption errors
      if (error.message.includes('Encryption key') || error.message.includes('ciphertext')) {
        return NextResponse.json(
          {
            error: "Configuration Error",
            message: "Server encryption configuration is invalid",
          },
          { status: 500 }
        );
      }

      // Check for storage errors
      if (error.message.includes('storage') || error.message.includes('database') || error.message.includes('Database')) {
        return NextResponse.json(
          {
            error: "Storage Error",
            message: "Failed to access storage. Please try again.",
          },
          { status: 500 }
        );
      }

      // Check for timeout errors
      if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
        return NextResponse.json(
          {
            error: "Timeout Error",
            message: "Provider request timed out. Please try again.",
          },
          { status: 504 }
        );
      }
    }

    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "An unexpected error occurred while checking balance",
      },
      { status: 500 }
    );
  }
});
