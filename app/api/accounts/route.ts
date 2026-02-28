import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-helpers";
import { getStorageAdapter } from "@/lib/storage/factory";
import { getProviderRegistry } from "@/lib/providers/factory";
import { createEncryptionService } from "@/lib/encryption";
import { ensureInitialized } from "@/lib/ensure-init";

/**
 * GET /api/accounts - List all accounts for authenticated user
 * 
 * Requirements: 1.3, 1.6
 * 
 * This endpoint retrieves all utility accounts for the authenticated user,
 * decrypts account numbers for display, and includes current balance and
 * last checked timestamp for each account.
 */
export const GET = withAuth(async (request: NextRequest, session) => {
  try {
    await ensureInitialized();
    const userId = session.user.id;
    
    // Get storage adapter and encryption service
    const storageAdapter = getStorageAdapter();
    const encryptionService = createEncryptionService();
    
    // Retrieve all accounts for the user
    const accounts = await storageAdapter.getAccountsByUser(userId);
    
    // Decrypt account numbers and fetch latest balance for each account
    const accountsWithBalances = await Promise.all(
      accounts.map(async (account) => {
        // Decrypt account number
        const decryptedAccountNumber = encryptionService.decrypt(account.accountNumber);
        
        // Get latest balance
        const latestBalance = await storageAdapter.getLatestBalance(account.accountId);
        
        return {
          accountId: account.accountId,
          providerType: account.providerType,
          providerName: account.providerName,
          accountNumber: decryptedAccountNumber,
          enabled: account.enabled,
          currentBalance: latestBalance?.balance ?? null,
          lastChecked: latestBalance?.checkedAt ?? null,
          createdAt: account.createdAt,
          updatedAt: account.updatedAt,
        };
      })
    );
    
    return NextResponse.json({
      accounts: accountsWithBalances,
    });
    
  } catch (error) {
    console.error("Error retrieving accounts:", error);
    
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
      if (error.message.includes('storage') || error.message.includes('database')) {
        return NextResponse.json(
          {
            error: "Storage Error",
            message: "Failed to retrieve accounts. Please try again.",
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "An unexpected error occurred while retrieving accounts",
      },
      { status: 500 }
    );
  }
});

/**
 * POST /api/accounts - Create a new utility account
 * 
 * Requirements: 1.1, 1.2, 1.5, 1.6, 14.8
 * 
 * This endpoint allows authenticated users to add utility accounts
 * by provider type and account number. It validates the provider type,
 * validates the account number format using the provider adapter,
 * encrypts the account number before storage, and stores via the storage adapter.
 */
export const POST = withAuth(async (request: NextRequest, session) => {
  try {
    await ensureInitialized();
    const userId = session.user.id;
    
    // Parse request body
    const body = await request.json();
    const { providerType, providerName, accountNumber } = body;

    // Validate required fields
    if (!providerType || !providerName || !accountNumber) {
      return NextResponse.json(
        {
          error: "Validation Error",
          message: "Missing required fields: providerType, providerName, accountNumber",
        },
        { status: 400 }
      );
    }

    // Validate provider type
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

    // Get provider registry and validate provider exists
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

    // Validate provider type matches
    if (providerAdapter.providerType !== providerType) {
      return NextResponse.json(
        {
          error: "Validation Error",
          message: `Provider ${providerName} is a ${providerAdapter.providerType} provider, not ${providerType}`,
        },
        { status: 400 }
      );
    }

    // Validate account number format using provider adapter
    if (!providerAdapter.validateAccountNumber(accountNumber)) {
      return NextResponse.json(
        {
          error: "Validation Error",
          message: `Invalid account number format for ${providerName}. Expected: ${
            providerAdapter.getAccountNumberFormat()
          }`,
        },
        { status: 400 }
      );
    }

    // Encrypt account number before storage
    const encryptionService = createEncryptionService();
    const encryptedAccountNumber = encryptionService.encrypt(accountNumber);

    // Store account via storage adapter
    const storageAdapter = getStorageAdapter();
    const accountId = await storageAdapter.createAccount({
      userId,
      providerType,
      providerName,
      accountNumber: encryptedAccountNumber,
      enabled: true,
    });

    return NextResponse.json(
      {
        accountId,
        created: new Date().toISOString(),
        message: "Account created successfully",
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("Error creating account:", error);
    
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
            message: "Failed to store account. Please try again.",
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "An unexpected error occurred while creating the account",
      },
      { status: 500 }
    );
  }
});
