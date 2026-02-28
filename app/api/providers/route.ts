import { NextResponse } from "next/server";
import { getProviderRegistry } from "@/lib/providers/factory";
import { ensureInitialized } from "@/lib/ensure-init";

/**
 * GET /api/providers - List all available utility providers
 * 
 * Requirements: 15.5
 * 
 * This endpoint returns a list of all registered utility providers
 * with their metadata including provider type, supported regions,
 * and account number format requirements.
 */
export async function GET() {
  try {
    await ensureInitialized();
    const providerRegistry = getProviderRegistry();
    const providers = providerRegistry.listProviders();

    return NextResponse.json({
      providers,
      count: providers.length,
    });
  } catch (error) {
    console.error("Error retrieving providers:", error);

    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "Failed to retrieve provider list",
      },
      { status: 500 }
    );
  }
}
