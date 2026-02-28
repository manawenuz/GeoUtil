import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-helpers";
import { getStorageAdapter } from "@/lib/storage/factory";
import { ensureInitialized } from "@/lib/ensure-init";

/**
 * GET /api/accounts/[id]/overdue - Get overdue days for an account
 * 
 * Requirements: 9.3, 9.4
 * 
 * This endpoint retrieves the number of days a balance has been overdue
 * for a specific account.
 */
export const GET = withAuth(async (request: NextRequest, session) => {
  try {
    await ensureInitialized();
    const userId = session.user.id;
    
    // Extract account ID from URL path
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const accountId = pathParts[pathParts.length - 2]; // -2 because last part is "overdue"

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

    // Get overdue days
    const overdueDays = await storageAdapter.getOverdueDays(accountId);

    return NextResponse.json({
      accountId,
      overdueDays,
    });

  } catch (error) {
    console.error("Error retrieving overdue days:", error);
    
    // Handle specific error types
    if (error instanceof Error) {
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
    }

    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "An unexpected error occurred while retrieving overdue days",
      },
      { status: 500 }
    );
  }
});
