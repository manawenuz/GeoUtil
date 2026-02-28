/**
 * Migration Runner
 * 
 * Handles database migrations for all storage backends.
 * Detects the storage backend and runs appropriate migrations.
 * 
 * Requirements:
 * - 23.1: Provide migration scripts for Postgres and Redis
 * - 23.2: Track applied migrations
 * - 23.3: Check for pending migrations on startup
 * - 23.4: Apply migrations automatically in development
 * - 23.5: Require manual approval in production
 * - 23.6: Prevent duplicate execution
 */

import { StorageAdapter } from './storage/types';
import { Pool } from 'pg';
import { Redis } from '@upstash/redis';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

export interface MigrationStatus {
  appliedMigrations: string[];
  pendingMigrations: string[];
  lastMigration?: string;
}

export interface Migration {
  name: string;
  up: (client: any) => Promise<void>;
}

/**
 * MigrationRunner handles database schema migrations
 */
export class MigrationRunner {
  private storageBackend: string;
  private client: any;
  private migrationsDir: string;

  constructor(storageBackend: string, client: any) {
    this.storageBackend = storageBackend.toLowerCase();
    this.client = client;
    this.migrationsDir = path.join(process.cwd(), 'migrations', this.storageBackend);
  }

  /**
   * Get the status of migrations
   * 
   * @returns MigrationStatus with applied and pending migrations
   */
  async getMigrationStatus(): Promise<MigrationStatus> {
    const appliedMigrations = await this.getAppliedMigrations();
    const allMigrations = await this.getAllMigrations();
    const pendingMigrations = allMigrations.filter(
      m => !appliedMigrations.includes(m)
    );

    return {
      appliedMigrations,
      pendingMigrations,
      lastMigration: appliedMigrations[appliedMigrations.length - 1],
    };
  }

  /**
   * Run all pending migrations
   * 
   * @param autoApprove - If true, apply migrations without confirmation (development mode)
   * @returns Array of applied migration names
   */
  async runPendingMigrations(autoApprove: boolean = false): Promise<string[]> {
    const status = await this.getMigrationStatus();

    if (status.pendingMigrations.length === 0) {
      console.log('No pending migrations');
      return [];
    }

    console.log(`Found ${status.pendingMigrations.length} pending migrations:`);
    status.pendingMigrations.forEach(m => console.log(`  - ${m}`));

    if (!autoApprove && process.env.NODE_ENV === 'production') {
      throw new Error(
        'Migrations require manual approval in production. ' +
        'Set autoApprove=true or run migrations manually.'
      );
    }

    const appliedMigrations: string[] = [];

    for (const migrationName of status.pendingMigrations) {
      try {
        console.log(`Applying migration: ${migrationName}`);
        await this.applyMigration(migrationName);
        await this.recordMigration(migrationName);
        appliedMigrations.push(migrationName);
        console.log(`✓ Applied migration: ${migrationName}`);
      } catch (error) {
        console.error(`✗ Failed to apply migration ${migrationName}:`, error);
        throw error;
      }
    }

    return appliedMigrations;
  }

  /**
   * Get list of all available migrations
   */
  private async getAllMigrations(): Promise<string[]> {
    if (!fs.existsSync(this.migrationsDir)) {
      return [];
    }

    const files = fs.readdirSync(this.migrationsDir);
    return files
      .filter(f => f.endsWith('.sql') || f.endsWith('.ts') || f.endsWith('.js'))
      .sort();
  }

  /**
   * Get list of applied migrations from storage
   */
  private async getAppliedMigrations(): Promise<string[]> {
    switch (this.storageBackend) {
      case 'postgres':
        return this.getAppliedMigrationsPostgres();
      case 'redis':
        return this.getAppliedMigrationsRedis();
      case 'sqlite':
        return this.getAppliedMigrationsSQLite();
      default:
        throw new Error(`Unsupported storage backend: ${this.storageBackend}`);
    }
  }

  /**
   * Apply a single migration
   */
  private async applyMigration(migrationName: string): Promise<void> {
    const migrationPath = path.join(this.migrationsDir, migrationName);

    if (migrationName.endsWith('.sql')) {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      await this.executeSqlMigration(sql);
    } else {
      // TypeScript/JavaScript migration
      const migration = await import(migrationPath);
      await migration.up(this.client);
    }
  }

  /**
   * Execute SQL migration
   */
  private async executeSqlMigration(sql: string): Promise<void> {
    switch (this.storageBackend) {
      case 'postgres':
        await (this.client as Pool).query(sql);
        break;
      case 'sqlite':
        (this.client as Database.Database).exec(sql);
        break;
      default:
        throw new Error(`SQL migrations not supported for ${this.storageBackend}`);
    }
  }

  /**
   * Record that a migration has been applied
   */
  private async recordMigration(migrationName: string): Promise<void> {
    switch (this.storageBackend) {
      case 'postgres':
        await this.recordMigrationPostgres(migrationName);
        break;
      case 'redis':
        await this.recordMigrationRedis(migrationName);
        break;
      case 'sqlite':
        await this.recordMigrationSQLite(migrationName);
        break;
    }
  }

  // Postgres-specific methods
  private async getAppliedMigrationsPostgres(): Promise<string[]> {
    const pool = this.client as Pool;
    
    // Create migrations table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        migration_id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    const result = await pool.query(
      'SELECT migration_name FROM migrations ORDER BY migration_id'
    );
    return result.rows.map(r => r.migration_name);
  }

  private async recordMigrationPostgres(migrationName: string): Promise<void> {
    const pool = this.client as Pool;
    await pool.query(
      'INSERT INTO migrations (migration_name) VALUES ($1)',
      [migrationName]
    );
  }

  // Redis-specific methods
  private async getAppliedMigrationsRedis(): Promise<string[]> {
    const redis = this.client as Redis;
    const migrations = await redis.smembers('migrations');
    return (migrations || []).sort();
  }

  private async recordMigrationRedis(migrationName: string): Promise<void> {
    const redis = this.client as Redis;
    await redis.sadd('migrations', migrationName);
  }

  // SQLite-specific methods
  private async getAppliedMigrationsSQLite(): Promise<string[]> {
    const db = this.client as Database.Database;
    
    // Create migrations table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        migration_id INTEGER PRIMARY KEY AUTOINCREMENT,
        migration_name TEXT NOT NULL UNIQUE,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const rows = db.prepare('SELECT migration_name FROM migrations ORDER BY migration_id').all();
    return rows.map((r: any) => r.migration_name);
  }

  private async recordMigrationSQLite(migrationName: string): Promise<void> {
    const db = this.client as Database.Database;
    db.prepare('INSERT INTO migrations (migration_name) VALUES (?)').run(migrationName);
  }
}

/**
 * Create a MigrationRunner for the configured storage backend
 */
export function createMigrationRunner(storageBackend: string, client: any): MigrationRunner {
  return new MigrationRunner(storageBackend, client);
}
