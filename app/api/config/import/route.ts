import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-helpers";
import { getStorageAdapter } from "@/lib/storage/factory";
import { getProviderRegistry } from "@/lib/providers/factory";
import { ensureInitialized } from "@/lib/ensure-init";

/**
 * POST /api/config/import - Import user configuration from JSON
 * 
 * Requirements: 18.2, 18.3
 * 
 * This endpoint accepts a JSON configuration file (matching the export format)
 * and imports the account configurations for the authenticated user.
 * It validates the JSON structure, sanitizes the data, and creates accounts
 * in the storage adapter. The encrypted values in the import remain encrypted.
 */
export const POST = withAuth(async (request: NextRequest, session) => {
  try {
    await ensureInitialized();
    const userId = session.user.id;
    
    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json(
        {
          error: "Invalid JSON",
          message: "The uploaded file contains invalid JSON",
        },
        { status: 400 }
      );
    }
    
    // Validate JSON structure (Requirement 18.2)
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        {
          error: "Validation Error",
          message: "Invalid JSON format",
        },
        { status: 400 }
      );
    }
    
    // Validate required fields
    if (!body.version) {
      return NextResponse.json(
        {
          error: "Validation Error",
          message: "Missing required field: version",
        },
        { status: 400 }
      );
    }
    
    if (!body.accounts || !Array.isArray(body.accounts)) {
      return NextResponse.json(
        {
          error: "Validation Error",
          message: "Missing or invalid field: accounts (must be an array)",
        },
        { status: 400 }
      );
    }
    
    // Validate version compatibility
    if (body.version !== "1.0") {
      return NextResponse.json(
        {
          error: "Validation Error",
          message: `Unsupported configuration version: ${body.version}. Expected: 1.0`,
        },
        { status: 400 }
      );
    }
    
    // Get storage adapter and provider registry
    const storageAdapter = getStorageAdapter();
    const providerRegistry = getProviderRegistry();
    
    // Validate and sanitize account data (Requirement 18.3)
    const validatedAccounts = [];
    const validationErrors = [];
    
    for (let i = 0; i < body.accounts.length; i++) {
      const account = body.accounts[i];
      const accountIndex = i + 1;
      
      // Validate required account fields
      if (!account.providerType) {
        validationErrors.push(`Account ${accountIndex}: Missing providerType`);
        continue;
      }
      
      if (!account.providerName) {
        validationErrors.push(`Account ${accountIndex}: Missing providerName`);
        continue;
      }
      
      if (!account.accountNumber) {
        validationErrors.push(`Account ${accountIndex}: Missing accountNumber`);
        continue;
      }
      
      // Validate provider type
      const validProviderTypes = ['gas', 'water', 'electricity', 'trash'];
      if (!validProviderTypes.includes(account.providerType)) {
        validationErrors.push(
          `Account ${accountIndex}: Invalid providerType "${account.providerType}". Must be one of: ${validProviderTypes.join(', ')}`
        );
        continue;
      }
      
      // Validate provider exists in registry
      const providerAdapter = providerRegistry.getAdapter(account.providerName);
      if (!providerAdapter) {
        validationErrors.push(
          `Account ${accountIndex}: Unknown provider "${account.providerName}"`
        );
        continue;
      }
      
      // Validate provider type matches
      if (providerAdapter.providerType !== account.providerType) {
        validationErrors.push(
          `Account ${accountIndex}: Provider ${account.providerName} is a ${providerAdapter.providerType} provider, not ${account.providerType}`
        );
        continue;
      }
      
      // Sanitize account data (Requirement 18.3)
      const sanitizedAccount = {
        providerType: account.providerType,
        providerName: account.providerName,
        accountNumber: account.accountNumber, // Keep encrypted as-is
        enabled: typeof account.enabled === 'boolean' ? account.enabled : true,
      };
      
      validatedAccounts.push(sanitizedAccount);
    }
    
    // If there are validation errors, return them
    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          error: "Validation Error",
          message: "Configuration contains invalid accounts",
          details: validationErrors,
        },
        { status: 400 }
      );
    }
    
    // If no accounts to import, return early
    if (validatedAccounts.length === 0) {
      return NextResponse.json(
        {
          message: "No accounts to import",
          imported: 0,
          failed: 0,
        },
        { status: 200 }
      );
    }
    
    // Import accounts (Requirement 18.3)
    const importResults = {
      imported: 0,
      failed: 0,
      errors: [] as string[],
    };
    
    for (let i = 0; i < validatedAccounts.length; i++) {
      const account = validatedAccounts[i];
      const accountIndex = i + 1;
      
      try {
        // Create account in storage
        await storageAdapter.createAccount({
          userId,
          providerType: account.providerType,
          providerName: account.providerName,
          accountNumber: account.accountNumber, // Already encrypted from export
          enabled: account.enabled,
        });
        
        importResults.imported++;
      } catch (error) {
        importResults.failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        importResults.errors.push(
          `Account ${accountIndex} (${account.providerName}): ${errorMessage}`
        );
      }
    }
    
    // Return import summary
    return NextResponse.json(
      {
        message: "Configuration import completed",
        imported: importResults.imported,
        failed: importResults.failed,
        total: validatedAccounts.length,
        errors: importResults.errors.length > 0 ? importResults.errors : undefined,
      },
      { status: importResults.failed > 0 ? 207 : 200 } // 207 Multi-Status if partial success
    );
    
  } catch (error) {
    console.error("Error importing configuration:", error);
    
    // Handle specific error types
    if (error instanceof Error) {
      // Check for storage errors
      if (error.message.includes('storage') || error.message.includes('database') || error.message.includes('Database')) {
        return NextResponse.json(
          {
            error: "Storage Error",
            message: "Failed to import configuration. Please try again.",
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "An unexpected error occurred while importing configuration",
      },
      { status: 500 }
    );
  }
});
