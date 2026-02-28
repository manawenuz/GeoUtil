import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-helpers";
import { getStorageAdapter } from "@/lib/storage/factory";
import { ensureInitialized } from "@/lib/ensure-init";

/**
 * GET /api/notifications/history - Retrieve notification history
 * 
 * Requirements: 17.1, 17.3
 * 
 * This endpoint retrieves the notification history for the authenticated user,
 * including delivery status and timestamps. Supports optional limit parameter.
 * 
 * Query Parameters:
 * - limit: Maximum number of notifications to retrieve (default: 50, max: 100)
 */
export const GET = withAuth(async (request: NextRequest, session) => {
  try {
    await ensureInitialized();
    const userId = session.user.id;
    
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    
    // Validate and parse limit
    let limit = 50; // default
    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1) {
        return NextResponse.json(
          {
            error: "Validation Error",
            message: "Invalid limit parameter. Must be a positive integer.",
          },
          { status: 400 }
        );
      }
      // Cap at 100 to prevent excessive data retrieval
      limit = Math.min(parsedLimit, 100);
    }
    
    // Get storage adapter
    const storageAdapter = getStorageAdapter();
    
    // Retrieve notification history
    const notifications = await storageAdapter.getNotificationHistory(userId, limit);
    
    // Format response
    const formattedNotifications = notifications.map(notification => ({
      notificationId: notification.notificationId,
      accountId: notification.accountId,
      sentAt: notification.sentAt.toISOString(),
      priority: notification.priority,
      message: notification.message,
      deliverySuccess: notification.deliverySuccess,
      deliveryError: notification.deliveryError,
    }));
    
    return NextResponse.json({
      notifications: formattedNotifications,
      count: formattedNotifications.length,
      limit,
    });
    
  } catch (error) {
    console.error("Error retrieving notification history:", error);
    
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "An unexpected error occurred while retrieving notification history",
      },
      { status: 500 }
    );
  }
});
