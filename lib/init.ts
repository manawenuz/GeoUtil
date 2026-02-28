/**
 * Application Initialization
 * 
 * Handles startup tasks including:
 * - Environment validation
 * - Database migrations
 * - Service initialization
 * - Scheduler startup
 * 
 * Requirements:
 * - 22.3: Validate environment configuration at startup
 * - 23.3: Check for pending migrations on startup
 * - 23.4: Apply migrations automatically in development mode
 */

import { getEnvConfig } from './env-config';
import { initializeServices, startBackgroundServices } from './services';
import { createMigrationRunner } from './migration-runner';
import { Pool } from 'pg';
import { Redis } from '@upstash/redis';
import Database from 'better-sqlite3';

/**
 * Initialize the application
 * 
 * This function should be called once during app startup.
 * It performs all necessary initialization steps in order:
 * 1. Validate environment configuration
 * 2. Run database migrations
 * 3. Initialize services
 * 4. Start background services (scheduler)
 * 
 * @param options - Initialization options
 * @returns Promise that resolves when initialization is complete
 */
export async function initializeApp(options: {
  runMigrations?: boolean;
  autoApproveMigrations?: boolean;
  startScheduler?: boolean;
} = {}): Promise<void> {
  const {
    runMigrations = true,
    autoApproveMigrations = process.env.NODE_ENV === 'development',
    startScheduler = true,
  } = options;

  console.log('='.repeat(60));
  console.log('Georgia Utility Monitor - Application Initialization');
  console.log('='.repeat(60));

  try {
    // Step 1: Validate environment configuration
    console.log('\n[1/4] Validating environment configuration...');
    const config = getEnvConfig();
    console.log('✓ Environment configuration is valid');

    // Step 2: Run database migrations
    if (runMigrations) {
      console.log('\n[2/4] Checking database migrations...');
      await runDatabaseMigrations(config.storageBackend, autoApproveMigrations);
    } else {
      console.log('\n[2/4] Skipping database migrations (disabled)');
    }

    // Step 3: Initialize services
    console.log('\n[3/4] Initializing application services...');
    initializeServices();

    // Step 4: Start background services
    if (startScheduler) {
      console.log('\n[4/4] Starting background services...');
      await startBackgroundServices();
    } else {
      console.log('\n[4/4] Skipping background services (disabled)');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✓ Application initialized successfully');
    console.log('='.repeat(60) + '\n');
  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('✗ Application initialization failed');
    console.error('='.repeat(60));
    console.error(error);
    throw error;
  }
}

/**
 * Run database migrations for the configured storage backend
 * 
 * @param storageBackend - The storage backend type
 * @param autoApprove - Whether to auto-approve migrations
 */
async function runDatabaseMigrations(
  storageBackend: string,
  autoApprove: boolean
): Promise<void> {
  let client: any;
  let migrationRunner: any;

  try {
    // Create appropriate client for the storage backend
    switch (storageBackend.toLowerCase()) {
      case 'postgres': {
        const postgresUrl = 
          process.env.DATABASE_URL || 
          process.env.POSTGRES_URL ||
          process.env.POSTGRES_PRISMA_URL;
        
        if (!postgresUrl) {
          throw new Error('Postgres URL not configured');
        }

        client = new Pool({
          connectionString: postgresUrl,
          ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
        });
        break;
      }

      case 'redis': {
        const redisUrl = process.env.REDIS_URL || process.env.KV_URL;
        const redisToken = process.env.REDIS_TOKEN || process.env.KV_REST_API_TOKEN;
        
        if (!redisUrl) {
          throw new Error('Redis URL not configured');
        }

        client = redisToken 
          ? new Redis({ url: redisUrl, token: redisToken })
          : Redis.fromEnv();
        break;
      }

      case 'sqlite': {
        const sqlitePath = process.env.SQLITE_PATH || './data/utility_monitor.db';
        
        // Ensure data directory exists
        const fs = await import('fs');
        const path = await import('path');
        const dataDir = path.dirname(sqlitePath);
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }

        client = new Database(sqlitePath);
        break;
      }

      default:
        throw new Error(`Unsupported storage backend: ${storageBackend}`);
    }

    // Create migration runner
    migrationRunner = createMigrationRunner(storageBackend, client);

    // Check migration status
    const status = await migrationRunner.getMigrationStatus();
    
    console.log(`  Applied migrations: ${status.appliedMigrations.length}`);
    if (status.appliedMigrations.length > 0) {
      console.log(`  Last migration: ${status.lastMigration}`);
    }
    
    if (status.pendingMigrations.length > 0) {
      console.log(`  Pending migrations: ${status.pendingMigrations.length}`);
      
      if (autoApprove) {
        console.log('  Auto-applying migrations (development mode)...');
        const applied = await migrationRunner.runPendingMigrations(true);
        console.log(`  ✓ Applied ${applied.length} migrations`);
      } else {
        console.warn('  ⚠ Pending migrations require manual approval in production');
        console.warn('  Run migrations manually or set autoApproveMigrations=true');
      }
    } else {
      console.log('  ✓ No pending migrations');
    }
  } finally {
    // Clean up client connections
    if (client) {
      if (storageBackend === 'postgres' && client.end) {
        await client.end();
      } else if (storageBackend === 'sqlite' && client.close) {
        client.close();
      }
    }
  }
}

/**
 * Graceful shutdown handler
 * 
 * Call this function when the app is shutting down to clean up resources.
 */
export async function shutdownApp(): Promise<void> {
  console.log('\nShutting down application...');
  
  const { stopBackgroundServices } = await import('./services');
  await stopBackgroundServices();
  
  console.log('✓ Application shutdown complete\n');
}

/**
 * Setup process signal handlers for graceful shutdown
 */
export function setupShutdownHandlers(): void {
  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM signal');
    await shutdownApp();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('Received SIGINT signal');
    await shutdownApp();
    process.exit(0);
  });
}
