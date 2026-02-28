/**
 * Environment Configuration and Validation
 * 
 * Validates required environment variables at startup and provides
 * type-safe access to configuration values.
 * 
 * Requirements:
 * - 22.1: Read all configuration from environment variables
 * - 22.2: Provide default values for local development
 * - 22.3: Validate required environment variables at startup
 */

export interface EnvConfig {
  // Storage configuration
  storageBackend: 'redis' | 'postgres' | 'sqlite';
  redisUrl?: string;
  redisToken?: string;
  postgresUrl?: string;
  sqlitePath?: string;

  // Security
  encryptionKey: string;
  nextAuthSecret: string;
  nextAuthUrl: string;

  // OAuth
  googleClientId: string;
  googleClientSecret: string;

  // Notification defaults
  ntfyServerUrl: string;

  // Scheduler
  schedulerIntervalHours: number;
  cronSecret: string;

  // Environment
  nodeEnv: string;
  isVercel: boolean;
}

/**
 * Validates and returns environment configuration
 * 
 * @throws Error if required variables are missing or invalid
 * @returns EnvConfig object with validated configuration
 */
export function validateEnvConfig(): EnvConfig {
  const errors: string[] = [];

  // Storage backend (required)
  const storageBackend = process.env.STORAGE_BACKEND?.toLowerCase();
  if (!storageBackend) {
    errors.push('STORAGE_BACKEND is required (redis, postgres, or sqlite)');
  } else if (!['redis', 'postgres', 'sqlite'].includes(storageBackend)) {
    errors.push(`STORAGE_BACKEND must be redis, postgres, or sqlite (got: ${storageBackend})`);
  }

  // Encryption key (required)
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    errors.push('ENCRYPTION_KEY is required (32-byte hex string)');
  } else if (encryptionKey.length !== 64) {
    errors.push('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }

  // NextAuth configuration (required)
  const nextAuthSecret = process.env.NEXTAUTH_SECRET;
  if (!nextAuthSecret) {
    errors.push('NEXTAUTH_SECRET is required');
  }

  const nextAuthUrl = process.env.NEXTAUTH_URL;
  if (!nextAuthUrl) {
    errors.push('NEXTAUTH_URL is required');
  }

  // Google OAuth (required)
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  if (!googleClientId) {
    errors.push('GOOGLE_CLIENT_ID is required');
  }

  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!googleClientSecret) {
    errors.push('GOOGLE_CLIENT_SECRET is required');
  }

  // Cron secret (required)
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    errors.push('CRON_SECRET is required');
  }

  // Storage-specific validation
  if (storageBackend === 'redis') {
    const redisUrl = process.env.REDIS_URL || process.env.KV_URL;
    if (!redisUrl) {
      errors.push('REDIS_URL or KV_URL is required when STORAGE_BACKEND=redis');
    }
  } else if (storageBackend === 'postgres') {
    const postgresUrl = 
      process.env.DATABASE_URL || 
      process.env.POSTGRES_URL ||
      process.env.POSTGRES_PRISMA_URL;
    if (!postgresUrl) {
      errors.push('DATABASE_URL, POSTGRES_URL, or POSTGRES_PRISMA_URL is required when STORAGE_BACKEND=postgres');
    }
  }

  // Throw error if any validation failed
  if (errors.length > 0) {
    throw new Error(
      'Environment configuration validation failed:\n' +
      errors.map(e => `  - ${e}`).join('\n')
    );
  }

  // Return validated config with defaults
  return {
    storageBackend: storageBackend as 'redis' | 'postgres' | 'sqlite',
    redisUrl: process.env.REDIS_URL || process.env.KV_URL,
    redisToken: process.env.REDIS_TOKEN || process.env.KV_REST_API_TOKEN,
    postgresUrl: 
      process.env.DATABASE_URL || 
      process.env.POSTGRES_URL ||
      process.env.POSTGRES_PRISMA_URL,
    sqlitePath: process.env.SQLITE_PATH || './data/utility_monitor.db',
    encryptionKey: encryptionKey!,
    nextAuthSecret: nextAuthSecret!,
    nextAuthUrl: nextAuthUrl!,
    googleClientId: googleClientId!,
    googleClientSecret: googleClientSecret!,
    ntfyServerUrl: process.env.NTFY_SERVER_URL || 'https://ntfy.sh',
    schedulerIntervalHours: parseInt(process.env.SCHEDULER_INTERVAL_HOURS || '72', 10),
    cronSecret: cronSecret!,
    nodeEnv: process.env.NODE_ENV || 'development',
    isVercel: process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined,
  };
}

/**
 * Cached environment configuration
 * Initialized on first access
 */
let envConfigCache: EnvConfig | null = null;

/**
 * Gets the validated environment configuration
 * Caches the result after first validation
 * 
 * @returns EnvConfig object
 */
export function getEnvConfig(): EnvConfig {
  if (!envConfigCache) {
    envConfigCache = validateEnvConfig();
  }
  return envConfigCache;
}

/**
 * Resets the cached configuration (useful for testing)
 */
export function resetEnvConfig(): void {
  envConfigCache = null;
}
