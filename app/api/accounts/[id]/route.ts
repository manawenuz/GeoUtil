import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-helpers";
import { getStorageAdapter } from "@/lib/storage/factory";
import { getProviderRegistry } from "@/lib/providers/factory";
import { createEncryptionService } from "@/lib/encryption";
import { ensureInitialized } from "@/lib/ensure-init";

/**
 * PUT /api/accounts/:id - Update an existing utility account
 * 
 * Requirements: 1.4, 1.6
 * 
 * This endpoint allows authenticated users to update their utility accounts.
 * It validates the updated data, encrypts sensitive fields (account number),
 * and ensures the account belongs to the authenticated user.
 */
export const PUT = withAuth(async (request: NextRequest, session) => {
  try {
    await ensureInitialized();
    const userId = session.user.id;
    
    // Extract account ID from URL path
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const accountId = pathParts[pathParts.length - 1];
    
    // Parse request body
    const body = await request.json();
    const { providerType, providerName, accountNumber, enabled } = body;

    // Get storage adapter
    const storageAdapter = getStorageAdapter();
    
    // Verify account exists and belongs to user
    const existingAccount = await storageAdapter.getAccount(accountId);
    
    if (!existingAccount) {
      return NextResponse.json(
        {
          error: "Not Found",
          message: "Account not found",
        },
        { status: 404 }
      );
    }
    
    if (existingAccount.userId !== userId) {
      return NextResponse.json(
        {
          error: "Forbidden",
          message: "You do not have permission to update this account",
        },
        { status: 403 }
      );
    }

    // Build update data object
    const updateData: any = {};

    // Validate and add provider type if provided
    if (providerType !== undefined) {
      const validProviderTypes = ['gas', 'water', 'electricity', 'trash'];
      if (!validProviderTypes.includes(providerType)) {
        return NextResponse.json(
          {
            error: "Validation Error",
            message: `Invalid provider type. Must be one of: ${validProviderTypes.join(', ')}`,
          },
          { status: 400 }
        );
      }
      updateData.providerType = providerType;
    }

    // Validate and add provider name if provided
    if (providerName !== undefined) {
      const providerRegistry = getProviderRegistry();
      const providerAdapter = providerRegistry.getAdapter(providerName);

      if (!providerAdapter) {
        return NextResponse.json(
          {
            error: "Validation Error",
            message: `Unknown provider: ${providerName}. Available providers: ${
              providerRegistry.listProviders().map(p => p.providerName).join(', ')
            }`,
          },
          { status: 400 }
        );
      }

      // If both providerType and providerName are being updated, validate they match
      const typeToCheck = updateData.providerType || existingAccount.providerType;
      if (providerAdapter.providerType !== typeToCheck) {
        return NextResponse.json(
          {
            error: "Validation Error",
            message: `Provider ${providerName} is a ${providerAdapter.providerType} provider, not ${typeToCheck}`,
          },
          { status: 400 }
        );
      }

      updateData.providerName = providerName;
    }

    // Validate and encrypt account number if provided
    if (accountNumber !== undefined) {
      // Get the provider adapter for validation
      const providerRegistry = getProviderRegistry();
      const nameToCheck = updateData.providerName || existingAccount.providerName;
      const providerAdapter = providerRegistry.getAdapter(nameToCheck);

      if (!providerAdapter) {
        return NextResponse.json(
          {
            error: "Validation Error",
            message: `Cannot validate account number: provider ${nameToCheck} not found`,
          },
          { status: 400 }
        );
      }

      // Validate account number format using provider adapter
      if (!providerAdapter.validateAccountNumber(accountNumber)) {
        return NextResponse.json(
          {
            error: "Validation Error",
            message: `Invalid account number format for ${nameToCheck}. Expected: ${
              providerAdapter.getAccountNumberFormat()
            }`,
          },
          { status: 400 }
        );
      }

      // Encrypt account number before storage
      const encryptionService = createEncryptionService();
      updateData.accountNumber = encryptionService.encrypt(accountNumber);
    }

    // Add enabled flag if provided
    if (enabled !== undefined) {
      if (typeof enabled !== 'boolean') {
        return NextResponse.json(
          {
            error: "Validation Error",
            message: "enabled must be a boolean value",
          },
          { status: 400 }
        );
      }
      updateData.enabled = enabled;
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        {
          error: "Validation Error",
          message: "No valid fields provided for update",
        },
        { status: 400 }
      );
    }

    // Update account via storage adapter
    await storageAdapter.updateAccount(accountId, updateData);

    return NextResponse.json(
      {
        accountId,
        updated: new Date().toISOString(),
        message: "Account updated successfully",
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("Error updating account:", error);
    
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
      if (error.message.includes('storage') || error.message.includes('database')) {
        return NextResponse.json(
          {
            error: "Storage Error",
            message: "Failed to update account. Please try again.",
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "An unexpected error occurred while updating the account",
      },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/accounts/:id - Delete a utility account
 * 
 * Requirements: 1.4, 1.6
 * 
 * This endpoint allows authenticated users to delete their utility accounts.
 * It removes the account and all associated data (balances, overdue tracking, etc.)
 * via cascade delete. The endpoint ensures the account belongs to the authenticated user.
 */
export const DELETE = withAuth(async (request: NextRequest, session) => {
  try {
    await ensureInitialized();
    const userId = session.user.id;
    
    // Extract account ID from URL path
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const accountId = pathParts[pathParts.length - 1];
    
    // Get storage adapter
    const storageAdapter = getStorageAdapter();
    
    // Verify account exists and belongs to user
    const existingAccount = await storageAdapter.getAccount(accountId);
    
    if (!existingAccount) {
      return NextResponse.json(
        {
          error: "Not Found",
          message: "Account not found",
        },
        { status: 404 }
      );
    }
    
    if (existingAccount.userId !== userId) {
      return NextResponse.json(
        {
          error: "Forbidden",
          message: "You do not have permission to delete this account",
        },
        { status: 403 }
      );
    }

    // Delete account via storage adapter (cascade delete handles associated data)
    await storageAdapter.deleteAccount(accountId);

    return NextResponse.json(
      {
        accountId,
        deleted: new Date().toISOString(),
        message: "Account deleted successfully",
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("Error deleting account:", error);
    
    // Handle specific error types
    if (error instanceof Error) {
      // Check for storage errors
      if (error.message.includes('storage') || error.message.includes('database')) {
        return NextResponse.json(
          {
            error: "Storage Error",
            message: "Failed to delete account. Please try again.",
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "An unexpected error occurred while deleting the account",
      },
      { status: 500 }
    );
  }
});
