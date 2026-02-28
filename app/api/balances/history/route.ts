import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-helpers";
import { getStorageAdapter } from "@/lib/storage/factory";
import { ensureInitialized } from "@/lib/ensure-init";

/**
 * GET /api/balances/history - Retrieve historical balance data
 * 
 * Requirements: 3.5, 10.1, 10.2
 * 
 * This endpoint retrieves historical balance data for a specific account,
 * filtered by date range using the days parameter.
 */
export const GET = withAuth(async (request: NextRequest, session) => {
  try {
    await ensureInitialized();
    const userId = session.user.id;
    
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const daysParam = searchParams.get("days");

    // Validate required fields
    if (!accountId) {
      return NextResponse.json(
        {
          error: "Validation Error",
          message: "Missing required query parameter: accountId",
        },
        { status: 400 }
      );
    }

    // Parse and validate days parameter (default to 30 days)
    let days = 30;
    if (daysParam) {
      const parsedDays = parseInt(daysParam, 10);
      if (isNaN(parsedDays) || parsedDays < 1) {
        return NextResponse.json(
          {
            error: "Validation Error",
            message: "Invalid days parameter. Must be a positive integer.",
          },
          { status: 400 }
        );
      }
      days = parsedDays;
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

    // Retrieve balance history
    const history = await storageAdapter.getBalanceHistory(accountId, days);

    // Format the response
    const formattedHistory = history.map((balance) => ({
      balanceId: balance.balanceId,
      balance: balance.balance,
      currency: balance.currency,
      timestamp: balance.checkedAt.toISOString(),
      success: balance.success,
      error: balance.error,
    }));

    return NextResponse.json({
      accountId,
      days,
      count: formattedHistory.length,
      history: formattedHistory,
    });

  } catch (error) {
    console.error("Error retrieving balance history:", error);
    
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
        message: "An unexpected error occurred while retrieving balance history",
      },
      { status: 500 }
    );
  }
});
