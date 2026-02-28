import { NextRequest, NextResponse } from "next/server";
import { getStorageAdapter } from "@/lib/storage/factory";
import { getProviderRegistry } from "@/lib/providers/factory";
import { ensureInitialized } from "@/lib/ensure-init";

/**
 * GET /api/health - System health check
 * 
 * Requirements: 19.1, 19.2, 19.3
 * 
 * This endpoint provides system health information including:
 * - Storage backend status
 * - Provider success rates
 * - System metrics
 * 
 * This endpoint is public (no authentication required) to allow monitoring services
 * to check system health.
 */
export async function GET(request: NextRequest) {
  try {
    // Ensure app is initialized
    await ensureInitialized();
    const storageAdapter = getStorageAdapter();
    const providerRegistry = getProviderRegistry();
    
    // Check storage backend status
    let storageStatus = 'unknown';
    let storageError: string | undefined;
    
    try {
      // Try to get migration status as a health check
      await storageAdapter.getMigrationStatus();
      storageStatus = 'healthy';
    } catch (error) {
      storageStatus = 'unhealthy';
      storageError = error instanceof Error ? error.message : 'Unknown error';
    }
    
    // Get provider success rates (last 7 days)
    const providers = providerRegistry.listProviders();
    const providerMetrics: Record<string, { successRate: number; status: string }> = {};
    
    for (const provider of providers) {
      try {
        const successRate = await storageAdapter.getProviderSuccessRate(provider.providerName, 7);
        providerMetrics[provider.providerName] = {
          successRate: Math.round(successRate * 100) / 100, // Round to 2 decimal places
          status: successRate >= 0.8 ? 'healthy' : successRate >= 0.5 ? 'degraded' : 'unhealthy',
        };
      } catch (error) {
        providerMetrics[provider.providerName] = {
          successRate: 0,
          status: 'unknown',
        };
      }
    }
    
    // Determine overall system status
    const allProvidersHealthy = Object.values(providerMetrics).every(
      m => m.status === 'healthy' || m.status === 'unknown'
    );
    const anyProviderDegraded = Object.values(providerMetrics).some(
      m => m.status === 'degraded'
    );
    const anyProviderUnhealthy = Object.values(providerMetrics).some(
      m => m.status === 'unhealthy'
    );
    
    let overallStatus = 'healthy';
    if (storageStatus === 'unhealthy') {
      overallStatus = 'unhealthy';
    } else if (anyProviderUnhealthy) {
      overallStatus = 'unhealthy';
    } else if (anyProviderDegraded) {
      overallStatus = 'degraded';
    }
    
    // Build response
    const healthData = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      storage: {
        backend: process.env.STORAGE_BACKEND || 'unknown',
        status: storageStatus,
        error: storageError,
      },
      providers: providerMetrics,
      environment: {
        nodeEnv: process.env.NODE_ENV || 'unknown',
        isVercel: process.env.VERCEL === '1',
      },
    };
    
    // Return appropriate status code based on health
    const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;
    
    return NextResponse.json(healthData, { status: statusCode });
    
  } catch (error) {
    console.error("Error in health check:", error);
    
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
