import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-helpers";
import { ensureInitialized } from "@/lib/ensure-init";
import { getStorageAdapter } from "@/lib/storage/factory";
import { createEncryptionService } from "@/lib/encryption";
import { NotificationService } from "@/lib/notification-service";

/**
 * POST /api/notifications/test - Send test notification
 * 
 * Requirements: 2.5
 * 
 * This endpoint sends a test notification to the user's configured ntfy.sh feed
 * to verify that the notification configuration is working correctly.
 */
export const POST = withAuth(async (request: NextRequest, session) => {
  try {
    await ensureInitialized();
    
    const userId = session.user.id;
    
    // Get storage adapter
    const storageAdapter = getStorageAdapter();
    
    // Retrieve user data
    const user = await storageAdapter.getUser(userId);
    
    if (!user) {
      return NextResponse.json(
        {
          error: "User Not Found",
          message: "User configuration not found",
        },
        { status: 404 }
      );
    }
    
    // Check if notification configuration exists
    if (!user.ntfyFeedUrl || !user.ntfyServerUrl) {
      return NextResponse.json(
        {
          error: "Configuration Missing",
          message: "Notification configuration not set. Please configure your ntfy.sh settings first.",
        },
        { status: 400 }
      );
    }
    
    // Decrypt feed URL
    const encryptionService = createEncryptionService();
    const decryptedFeedUrl = encryptionService.decrypt(user.ntfyFeedUrl);
    
    // Extract topic from feed URL (last part of the URL)
    const topic = decryptedFeedUrl.split('/').pop() || 'utility-monitor';
    
    // Create notification service
    const notificationService = new NotificationService(user.ntfyServerUrl);
    
    // Send test notification
    const deliveryTimestamp = new Date();
    const success = await notificationService.sendNotification({
      topic,
      title: 'Test Notification',
      message: 'This is a test notification from Georgia Utility Monitor. If you received this, your notification configuration is working correctly!',
      priority: 'default',
      tags: ['test', 'utility-monitor'],
      serverUrl: user.ntfyServerUrl,
    });
    
    if (!success) {
      return NextResponse.json(
        {
          error: "Delivery Failed",
          message: "Failed to send test notification. Please check your ntfy.sh configuration.",
          success: false,
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      deliveryTimestamp: deliveryTimestamp.toISOString(),
      message: "Test notification sent successfully",
    });
    
  } catch (error) {
    console.error("Error sending test notification:", error);
    
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "An unexpected error occurred while sending test notification",
        success: false,
      },
      { status: 500 }
    );
  }
});
