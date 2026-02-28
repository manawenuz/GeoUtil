import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-helpers";
import { getStorageAdapter } from "@/lib/storage/factory";
import { ensureInitialized } from "@/lib/ensure-init";

/**
 * GET /api/config/export - Export user configuration as JSON
 * 
 * Requirements: 18.1, 18.4
 * 
 * This endpoint exports all user account configurations to JSON format.
 * It does NOT include plaintext sensitive data - encrypted values remain encrypted.
 * This allows users to backup their configuration.
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
    
    // Retrieve all accounts for the user
    const accounts = await storageAdapter.getAccountsByUser(userId);
    
    // Build export configuration
    // Keep encrypted values encrypted (Requirement 18.4)
    const exportConfig = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      user: {
        email: user.email,
        name: user.name,
        ntfyServerUrl: user.ntfyServerUrl,
        notificationEnabled: user.notificationEnabled,
        // Keep ntfyFeedUrl encrypted (Requirement 18.4)
        ntfyFeedUrl: user.ntfyFeedUrl,
      },
      accounts: accounts.map(account => ({
        providerType: account.providerType,
        providerName: account.providerName,
        // Keep accountNumber encrypted (Requirement 18.4)
        accountNumber: account.accountNumber,
        enabled: account.enabled,
        createdAt: account.createdAt.toISOString(),
      })),
    };
    
    return NextResponse.json(exportConfig, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="utility-monitor-config-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
    
  } catch (error) {
    console.error("Error exporting configuration:", error);
    
    // Handle specific error types
    if (error instanceof Error) {
      // Check for storage errors
      if (error.message.includes('storage') || error.message.includes('database') || error.message.includes('Database')) {
        return NextResponse.json(
          {
            error: "Storage Error",
            message: "Failed to retrieve configuration. Please try again.",
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "An unexpected error occurred while exporting configuration",
      },
      { status: 500 }
    );
  }
});
