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
    
    // Parse request body
    const body = await request.json();
    const { ntfyFeedUrl, ntfyServerUrl, notificationEnabled } = body;

    // Validate required fields
    if (!ntfyFeedUrl || !ntfyServerUrl) {
      return NextResponse.json(
        {
          error: "Validation Error",
          message: "Missing required fields: ntfyFeedUrl, ntfyServerUrl",
        },
        { status: 400 }
      );
    }

    // Validate ntfy.sh feed URL format (Requirements 2.4, 25.4)
    if (!isValidNtfyUrl(ntfyFeedUrl)) {
      return NextResponse.json(
        {
          error: "Validation Error",
          message: "Invalid ntfy.sh feed URL. Must be a valid HTTP or HTTPS URL.",
        },
        { status: 400 }
      );
    }

    // Validate ntfy.sh server URL format (Requirements 2.4, 25.4)
    if (!isValidNtfyUrl(ntfyServerUrl)) {
      return NextResponse.json(
        {
          error: "Validation Error",
          message: "Invalid ntfy.sh server URL. Must be a valid HTTP or HTTPS URL.",
        },
        { status: 400 }
      );
    }

    // Encrypt feed URL before storage (Requirement 2.6)
    const encryptionService = createEncryptionService();
    const encryptedFeedUrl = encryptionService.encrypt(ntfyFeedUrl);

    // Store configuration via storage adapter
    const storageAdapter = getStorageAdapter();
    
    // Check if user exists
    const existingUser = await storageAdapter.getUser(userId);
    
    if (!existingUser) {
      return NextResponse.json(
        {
          error: "User Not Found",
          message: "User not found. Please sign in again.",
        },
        { status: 404 }
      );
    }

    // Update user with notification configuration
    await storageAdapter.updateUser(userId, {
      ntfyFeedUrl: encryptedFeedUrl,
      ntfyServerUrl,
      notificationEnabled: notificationEnabled !== undefined ? notificationEnabled : true,
    });

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
