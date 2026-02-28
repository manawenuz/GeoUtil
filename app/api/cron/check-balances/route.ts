import { NextRequest, NextResponse } from "next/server";
import { ensureInitialized } from "@/lib/ensure-init";
import { getStorageAdapter } from "@/lib/storage/factory";
import { getProviderRegistry } from "@/lib/providers/factory";
import { NotificationService } from "@/lib/notification-service";
import { createEncryptionService } from "@/lib/encryption";
import { SchedulerService } from "@/lib/scheduler-service";

/**
 * POST /api/cron/check-balances - Cron endpoint for scheduled balance checks
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 21.1, 21.2
 * 
 * This endpoint is called by Vercel Cron (or node-cron) to execute scheduled
 * balance checks for all users. It is protected by a cron secret to prevent
 * unauthorized access.
 * 
 * Authentication:
 * - Requires CRON_SECRET header matching CRON_SECRET environment variable
 * 
 * Request Body (optional):
 * - userIds: Array of user IDs to check (if not provided, checks all users)
 * 
 * Note: The current StorageAdapter interface does not have a getAllUsers method.
 * Until this is added, the endpoint requires userIds to be provided in the request body,
 * or it will return an error. This is a known limitation that should be addressed
 * by adding getAllUsers() to the StorageAdapter interface.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret for authentication
    const cronSecret = request.headers.get('x-cron-secret') || request.headers.get('authorization')?.replace('Bearer ', '');
    const expectedSecret = process.env.CRON_SECRET;
    
    if (!expectedSecret) {
      console.error('CRON_SECRET environment variable not set');
      return NextResponse.json(
        {
          error: "Configuration Error",
          message: "Cron secret not configured on server",
        },
        { status: 500 }
      );
    }
    
    if (!cronSecret || cronSecret !== expectedSecret) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "Invalid or missing cron secret",
        },
        { status: 401 }
      );
    }
    
    // Parse request body for optional userIds
    let userIds: string[] | undefined;
    try {
      const body = await request.json();
      userIds = body.userIds;
    } catch {
      // No body or invalid JSON - will check all users
      userIds = undefined;
    }
    
    // Ensure initialization before accessing services
    await ensureInitialized();
    
    // Initialize services
    const storageAdapter = getStorageAdapter();
    const providerRegistry = getProviderRegistry();
    const notificationService = new NotificationService();
    const encryptionService = createEncryptionService();
    
    const schedulerService = new SchedulerService(
      storageAdapter,
      providerRegistry,
      notificationService,
      encryptionService
    );
    
    // Execute scheduled checks
    // Note: If userIds is undefined and StorageAdapter doesn't have getAllUsers,
    // the scheduler will log a warning and return empty results
    const result = await schedulerService.executeScheduledCheck(userIds);
    
    // Log execution summary
    console.log('Scheduled check completed:', {
      totalAccounts: result.totalAccounts,
      successfulChecks: result.successfulChecks,
      failedChecks: result.failedChecks,
      notificationsSent: result.notificationsSent,
      executionTime: result.executionTime,
      errorCount: result.errors.length,
    });
    
    // Return success response with execution summary
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result: {
        totalAccounts: result.totalAccounts,
        successfulChecks: result.successfulChecks,
        failedChecks: result.failedChecks,
        notificationsSent: result.notificationsSent,
        executionTime: result.executionTime,
        errors: result.errors,
      },
    });
    
  } catch (error) {
    console.error("Error in scheduled balance check:", error);
    
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "An unexpected error occurred during scheduled balance check",
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
