/**
 * Storage Adapter Factory
 * 
 * Creates the appropriate storage adapter based on environment configuration.
 * Supports Redis, Postgres, and SQLite backends.
 */

import { StorageAdapter } from './types';
import { RedisAdapter } from './redis-adapter';
import { PostgresAdapter } from './postgres-adapter';
import { SQLiteAdapter } from './sqlite-adapter';
import { Redis } from '@upstash/redis';
import { Pool } from 'pg';
import Database from 'better-sqlite3';

/**
 * Creates a storage adapter based on the STORAGE_BACKEND environment variable
 * 
 * @returns StorageAdapter instance
 * @throws Error if STORAGE_BACKEND is not set or invalid
 */
export function createStorageAdapter(): StorageAdapter {
  const backend = process.env.STORAGE_BACKEND;

  if (!backend) {
    throw new Error(
      'STORAGE_BACKEND environment variable is required. ' +
      'Valid values: redis, postgres, sqlite'
    );
  }

  switch (backend.toLowerCase()) {
    case 'redis':
      return createRedisAdapter();
    
    case 'postgres':
      return createPostgresAdapter();
    
    case 'sqlite':
      return createSQLiteAdapter();
    
    default:
      throw new Error(
        `Invalid STORAGE_BACKEND: "${backend}". ` +
        'Valid values: redis, postgres, sqlite'
      );
  }
}

/**
 * Creates a Redis storage adapter
 */
function createRedisAdapter(): RedisAdapter {
  const redisUrl = process.env.REDIS_URL || process.env.KV_URL;
  const redisToken = process.env.REDIS_TOKEN || process.env.KV_REST_API_TOKEN;
  
  if (!redisUrl) {
    throw new Error(
      'Redis configuration missing. Set REDIS_URL or KV_URL environment variable.'
    );
  }

  // Create Redis client
  const redis = redisToken 
    ? new Redis({ url: redisUrl, token: redisToken })
    : Redis.fromEnv();

  return new RedisAdapter(redis);
}

/**
 * Creates a Postgres storage adapter
 */
function createPostgresAdapter(): PostgresAdapter {
  const databaseUrl = 
    process.env.DATABASE_URL || 
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL;
  
  if (!databaseUrl) {
    throw new Error(
      'Postgres configuration missing. Set DATABASE_URL, POSTGRES_URL, ' +
      'or POSTGRES_PRISMA_URL environment variable.'
    );
  }

  // Create Postgres connection pool
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  });

  return new PostgresAdapter(pool);
}

/**
 * Creates a SQLite storage adapter
 */
function createSQLiteAdapter(): SQLiteAdapter {
  const sqlitePath = process.env.SQLITE_PATH || './data/utility_monitor.db';
  
  // Create SQLite database instance
  const db = new Database(sqlitePath);
  
  return new SQLiteAdapter(db);
}

/**
 * Singleton instance of the storage adapter
 * Initialized on first access
 */
let storageAdapterInstance: StorageAdapter | null = null;

/**
 * Gets the singleton storage adapter instance
 * Creates it on first access
 * 
 * @returns StorageAdapter instance
 */
export function getStorageAdapter(): StorageAdapter {
  if (!storageAdapterInstance) {
    storageAdapterInstance = createStorageAdapter();
  }
  return storageAdapterInstance;
}

/**
 * Resets the singleton instance (useful for testing)
 */
export function resetStorageAdapter(): void {
  storageAdapterInstance = null;
}
