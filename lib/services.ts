/**
 * Service Initialization and Wiring
 * 
 * Centralizes the creation and initialization of all application services.
 * Ensures proper dependency injection and singleton patterns.
 * 
 * Requirements:
 * - Wire storage adapter factory
 * - Register all provider adapters
 * - Initialize scheduler service
 * - Connect API routes to services
 */

import { StorageAdapter } from './storage/types';
import { getStorageAdapter } from './storage/factory';
import { ProviderRegistry } from './providers/registry';
import { TeGeGasAdapter } from './providers/te-ge-gas-adapter';
import { NotificationService } from './notification-service';
import { SchedulerService } from './scheduler-service';
import { EncryptionService } from './encryption';
import { getEnvConfig } from './env-config';

/**
 * Application services container
 */
export interface AppServices {
  storageAdapter: StorageAdapter;
  providerRegistry: ProviderRegistry;
  notificationService: NotificationService;
  schedulerService: SchedulerService;
  encryptionService: EncryptionService;
}

/**
 * Singleton instance of application services
 */
let servicesInstance: AppServices | null = null;

/**
 * Initialize all application services
 * 
 * This function:
 * 1. Validates environment configuration
 * 2. Creates storage adapter based on configuration
 * 3. Initializes encryption service
 * 4. Creates and registers provider adapters
 * 5. Initializes notification service
 * 6. Creates scheduler service
 * 
 * @returns AppServices instance
 */
export function initializeServices(): AppServices {
  if (servicesInstance) {
    return servicesInstance;
  }

  console.log('Initializing application services...');

  // Validate environment configuration
  const config = getEnvConfig();
  console.log(`✓ Environment configuration validated`);
  console.log(`  - Storage backend: ${config.storageBackend}`);
  console.log(`  - Environment: ${config.nodeEnv}`);
  console.log(`  - Vercel: ${config.isVercel ? 'Yes' : 'No'}`);

  // Initialize storage adapter
  const storageAdapter = getStorageAdapter();
  console.log(`✓ Storage adapter initialized (${config.storageBackend})`);

  // Initialize encryption service
  const encryptionService = new EncryptionService(config.encryptionKey);
  console.log(`✓ Encryption service initialized`);

  // Initialize provider registry and register adapters
  const providerRegistry = new ProviderRegistry();
  
  // Register te.ge gas provider
  const teGeGasAdapter = new TeGeGasAdapter();
  providerRegistry.registerAdapter(teGeGasAdapter);
  console.log(`✓ Registered provider: ${teGeGasAdapter.providerName}`);

  // TODO: Register additional provider adapters as they are implemented
  // providerRegistry.registerAdapter(new WaterProviderAdapter());
  // providerRegistry.registerAdapter(new ElectricityProviderAdapter());
  // providerRegistry.registerAdapter(new TrashProviderAdapter());

  console.log(`✓ Provider registry initialized (${providerRegistry.listProviders().length} providers)`);

  // Initialize notification service
  const notificationService = new NotificationService();
  console.log(`✓ Notification service initialized`);

  // Initialize scheduler service
  const schedulerService = new SchedulerService(
    storageAdapter,
    providerRegistry,
    notificationService,
    encryptionService,
    config.schedulerIntervalHours
  );
  console.log(`✓ Scheduler service initialized (${config.schedulerIntervalHours}h interval)`);

  servicesInstance = {
    storageAdapter,
    providerRegistry,
    notificationService,
    schedulerService,
    encryptionService,
  };

  console.log('✓ All services initialized successfully');

  return servicesInstance;
}

/**
 * Get the initialized services instance
 * Creates and initializes services on first access
 * 
 * @returns AppServices instance
 */
export function getServices(): AppServices {
  if (!servicesInstance) {
    servicesInstance = initializeServices();
  }
  return servicesInstance;
}

/**
 * Reset services instance (useful for testing)
 */
export function resetServices(): void {
  servicesInstance = null;
}

/**
 * Start background services (scheduler)
 * Should be called after app initialization
 */
export async function startBackgroundServices(): Promise<void> {
  const services = getServices();
  
  // Start scheduler if not on Vercel (Vercel uses Vercel Cron)
  if (!services.schedulerService.isVercel()) {
    console.log('Starting background scheduler...');
    await services.schedulerService.start();
    console.log('✓ Background services started');
  } else {
    console.log('Vercel environment detected, scheduler will use Vercel Cron');
  }
}

/**
 * Stop background services (scheduler)
 * Should be called on app shutdown
 */
export async function stopBackgroundServices(): Promise<void> {
  if (servicesInstance) {
    console.log('Stopping background services...');
    await servicesInstance.schedulerService.stop();
    console.log('✓ Background services stopped');
  }
}
