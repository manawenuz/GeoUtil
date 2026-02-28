#!/usr/bin/env node

/**
 * Database Migration Script
 * 
 * This script runs pending migrations based on the configured storage backend.
 * Usage: npm run migrate
 */

const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const STORAGE_BACKEND = process.env.STORAGE_BACKEND || 'postgres';

console.log(`Running migrations for backend: ${STORAGE_BACKEND}`);

async function runPostgresMigrations() {
  const { Client } = require('pg');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL');

    // Create migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        migration_id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Get applied migrations
    const result = await client.query('SELECT migration_name FROM migrations ORDER BY migration_id');
    const appliedMigrations = result.rows.map(row => row.migration_name);

    // Get migration files
    const migrationsDir = path.join(__dirname, '../migrations/postgres');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    // Run pending migrations
    for (const file of files) {
      const migrationName = file.replace('.sql', '');
      
      if (appliedMigrations.includes(migrationName)) {
        console.log(`✓ ${migrationName} (already applied)`);
        continue;
      }

      console.log(`Running migration: ${migrationName}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO migrations (migration_name) VALUES ($1)',
          [migrationName]
        );
        await client.query('COMMIT');
        console.log(`✓ ${migrationName} (applied)`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

async function runRedisMigrations() {
  const { Redis } = require('@upstash/redis');
  
  const redis = new Redis({
    url: process.env.REDIS_URL || process.env.KV_REST_API_URL,
    token: process.env.REDIS_TOKEN || process.env.KV_REST_API_TOKEN,
  });

  try {
    console.log('Connected to Redis');

    // Get applied migrations
    const appliedMigrations = await redis.smembers('migrations') || [];

    // Define all known migrations
    const allMigrations = ['001_initial_keys'];

    // Check and apply pending migrations
    for (const migration of allMigrations) {
      if (appliedMigrations.includes(migration)) {
        console.log(`✓ ${migration} (already applied)`);
        continue;
      }

      console.log(`Applying migration: ${migration}`);
      
      // For Redis, migrations are mostly documentation
      // The schema is created by the adapter code
      await redis.sadd('migrations', migration);
      
      console.log(`✓ ${migration} (applied)`);
    }

    console.log('All Redis migrations completed successfully');
    console.log('Note: Redis is schema-less, key patterns are documented in migrations/redis/');
  } catch (error) {
    console.error('Redis migration failed:', error);
    process.exit(1);
  }
}

async function runSQLiteMigrations() {
  const Database = require('better-sqlite3');
  const dbPath = process.env.SQLITE_DB_PATH || './data/georgia-utility-monitor.db';
  
  // Ensure the directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new Database(dbPath);
  
  try {
    // Enable foreign keys
    db.pragma('foreign_keys = ON');
    console.log('Connected to SQLite');

    // Create migrations table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        migration_id INTEGER PRIMARY KEY AUTOINCREMENT,
        migration_name TEXT NOT NULL UNIQUE,
        applied_at TEXT NOT NULL
      );
    `);

    // Get applied migrations
    const appliedMigrations = db.prepare('SELECT migration_name FROM migrations ORDER BY migration_id')
      .all()
      .map(row => row.migration_name);

    // Get migration files
    const migrationsDir = path.join(__dirname, '../migrations/sqlite');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    // Run pending migrations
    for (const file of files) {
      const migrationName = file.replace('.sql', '');
      
      if (appliedMigrations.includes(migrationName)) {
        console.log(`✓ ${migrationName} (already applied)`);
        continue;
      }

      console.log(`Running migration: ${migrationName}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      
      const transaction = db.transaction(() => {
        db.exec(sql);
        db.prepare('INSERT INTO migrations (migration_name, applied_at) VALUES (?, datetime("now"))')
          .run(migrationName);
      });

      try {
        transaction();
        console.log(`✓ ${migrationName} (applied)`);
      } catch (error) {
        console.error(`Failed to apply migration ${migrationName}:`, error);
        throw error;
      }
    }

    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

async function main() {
  switch (STORAGE_BACKEND) {
    case 'postgres':
      await runPostgresMigrations();
      break;
    case 'redis':
      await runRedisMigrations();
      break;
    case 'sqlite':
      await runSQLiteMigrations();
      break;
    default:
      console.error(`Unknown storage backend: ${STORAGE_BACKEND}`);
      process.exit(1);
  }
}

main();
