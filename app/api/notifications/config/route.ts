import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-helpers";
import { getStorageAdapter } from "@/lib/storage/factory";
import { createEncryptionService } from "@/lib/encryption";
import { ensureInitialized } from "@/lib/ensure-init";

/**
 * Validate ntfy.sh URL format
 * Requirements: 2.4, 25.4
 * 
 * @param url - The URL to validate
 * @returns true if valid, false otherwise
 */
function isValidNtfyUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Must be HTTP or HTTPS protocol
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    // Must have a hostname
    if (!parsed.hostname) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * GET /api/notifications/config - Retrieve notification configuration
 * 
 * Requirements: 2.3, 2.6
 * 
 * This endpoint retrieves the notification configuration for the authenticated user,
 * including the ntfy.sh feed URL (decrypted) and server URL.
 */
export const GET = withAuth(async (request: NextRequest, session) => {
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
    
    // Decrypt feed URL if it exists
    let decryptedFeedUrl = user.ntfyFeedUrl;
    if (decryptedFeedUrl) {
      try {
        const encryptionService = createEncryptionService();
        decryptedFeedUrl = encryptionService.decrypt(decryptedFeedUrl);
      } catch (error) {
        console.error("Error decrypting feed URL:", error);
        // If decryption fails, return empty string rather than encrypted value
        decryptedFeedUrl = "";
      }
    }
    
    return NextResponse.json({
      ntfyFeedUrl: decryptedFeedUrl || "",
      ntfyServerUrl: user.ntfyServerUrl || "https://ntfy.sh",
      notificationEnabled: user.notificationEnabled,
      telegramLinked: !!user.telegramChatId,
      telegramEnabled: user.telegramEnabled ?? false,
      notificationChannel: user.notificationChannel ?? 'ntfy',
    });
    
  } catch (error) {
    console.error("Error retrieving notification config:", error);
    
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "An unexpected error occurred while retrieving notification configuration",
      },
      { status: 500 }
    );
  }
});

/**
 * POST /api/notifications/config - Configure notification settings
 * 
 * Requirements: 2.1, 2.2, 2.4, 2.6, 25.4
 * 
 * This endpoint allows authenticated users to configure their notification settings,
 * including the ntfy.sh feed URL and server URL. It validates URLs, encrypts the
 * feed URL before storage, and stores the configuration via the storage adapter.
 */
export const POST = withAuth(async (request: NextRequest, session) => {
  try {
    await ensureInitialized();
    const userId = session.user.id;
    
    const body = await request.json();
    const storageAdapter = getStorageAdapter();
    const existingUser = await storageAdapter.getUser(userId);

    if (!existingUser) {
      return NextResponse.json(
        { error: "User Not Found", message: "User not found. Please sign in again." },
        { status: 404 }
      );
    }

    // Build update object based on what was sent
    const update: Record<string, unknown> = {};

    // ntfy.sh settings (optional)
    if (body.ntfyFeedUrl !== undefined && body.ntfyServerUrl !== undefined) {
      if (!isValidNtfyUrl(body.ntfyFeedUrl) || !isValidNtfyUrl(body.ntfyServerUrl)) {
        return NextResponse.json(
          { error: "Validation Error", message: "Invalid ntfy.sh URL format." },
          { status: 400 }
        );
      }
      const encryptionService = createEncryptionService();
      update.ntfyFeedUrl = encryptionService.encrypt(body.ntfyFeedUrl);
      update.ntfyServerUrl = body.ntfyServerUrl;
    }

    if (body.notificationEnabled !== undefined) update.notificationEnabled = body.notificationEnabled;
    if (body.telegramEnabled !== undefined) update.telegramEnabled = body.telegramEnabled;
    if (body.notificationChannel !== undefined) update.notificationChannel = body.notificationChannel;

    // Handle unlink: telegramChatId explicitly set to null
    if (body.telegramChatId === null) {
      update.telegramChatId = undefined; // clears it
      update.telegramEnabled = false;
      update.notificationChannel = 'ntfy';
    }

    await storageAdapter.updateUser(userId, update);

    return NextResponse.json(
      {
        success: true,
        message: "Notification configuration saved successfully",
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("Error saving notification config:", error);
    
    // Handle specific error types
    if (error instanceof Error) {
      // Check for encryption errors
      if (error.message.includes('Encryption key')) {
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
            message: "Failed to save notification configuration. Please try again.",
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "An unexpected error occurred while saving notification configuration",
      },
      { status: 500 }
    );
  }
});
