# Database Migrations

This directory contains database migration scripts for all supported storage backends in the Georgia Utility Monitor application.

## Directory Structure

```
migrations/
├── postgres/     # PostgreSQL migration scripts (.sql files)
├── redis/        # Redis migration documentation (.md files)
├── sqlite/       # SQLite migration scripts (.sql files)
└── README.md     # This file
```

## Running Migrations

### Prerequisites

1. Set up your environment variables in `.env.local`:
   - `STORAGE_BACKEND`: Set to `postgres`, `redis`, or `sqlite`
   - Backend-specific connection variables (see below)

2. Install dependencies:
   ```bash
   npm install
   ```

### PostgreSQL Migrations

**Environment Variables:**
```bash
STORAGE_BACKEND=postgres
DATABASE_URL=postgresql://user:password@localhost:5432/georgia_utility_monitor
```

**Run migrations:**
```bash
npm run migrate
```

The script will:
1. Connect to PostgreSQL using `DATABASE_URL`
2. Create a `migrations` table if it doesn't exist
3. Check which migrations have been applied
4. Run pending migrations in order
5. Record each migration in the `migrations` table

### SQLite Migrations

**Environment Variables:**
```bash
STORAGE_BACKEND=sqlite
SQLITE_DB_PATH=./data/georgia-utility-monitor.db
```

**Run migrations:**
```bash
npm run migrate
```

The script will:
1. Create the database directory if it doesn't exist
2. Connect to SQLite database
3. Enable foreign key constraints
4. Create a `migrations` table if it doesn't exist
5. Check which migrations have been applied
6. Run pending migrations in order
7. Record each migration in the `migrations` table

### Redis Migrations

**Environment Variables:**
```bash
STORAGE_BACKEND=redis
REDIS_URL=https://your-redis-instance.upstash.io
REDIS_TOKEN=your-redis-token
# OR for Vercel KV:
KV_REST_API_URL=https://your-kv-instance.upstash.io
KV_REST_API_TOKEN=your-kv-token
```

**Run migrations:**
```bash
npm run migrate
```

The script will:
1. Connect to Redis
2. Check the `migrations` set for applied migrations
3. Add migration names to the `migrations` set
4. Note: Redis is schema-less, so migrations are primarily documentation

## Migration Files

### Naming Convention

Migration files follow the pattern: `NNN_description.sql` or `NNN_description.md`

- `NNN`: Three-digit sequence number (e.g., `001`, `002`)
- `description`: Brief description of the migration (e.g., `initial_schema`, `add_oauth_tables`)
- Extension: `.sql` for SQL scripts, `.md` for documentation (Redis)

### Current Migrations

#### 001_initial_schema

Creates the initial database schema including:

**Users Table:**
- OAuth fields: `email`, `name`, `image`, `email_verified`
- Notification configuration: `ntfy_feed_url`, `ntfy_server_url`, `notification_enabled`
- Timestamps: `created_at`, `updated_at`

**OAuth Tables (NextAuth):**
- `auth_accounts`: OAuth provider accounts linked to users
- `auth_sessions`: Active user sessions
- `auth_verification_tokens`: Email verification tokens

**Application Tables:**
- `accounts`: Utility accounts (gas, water, electricity, trash)
- `balances`: Balance check history
- `notifications`: Notification delivery history
- `overdue_tracking`: Tracks consecutive non-zero balance days
- `check_attempts`: Provider check attempt metrics

## Creating New Migrations

### PostgreSQL/SQLite

1. Create a new `.sql` file in the appropriate directory:
   ```bash
   touch migrations/postgres/002_add_new_feature.sql
   touch migrations/sqlite/002_add_new_feature.sql
   ```

2. Write your SQL migration:
   ```sql
   -- Add new column
   ALTER TABLE users ADD COLUMN new_field TEXT;
   
   -- Create new table
   CREATE TABLE IF NOT EXISTS new_table (
     id UUID PRIMARY KEY,
     ...
   );
   ```

3. Run the migration:
   ```bash
   npm run migrate
   ```

### Redis

1. Create a new `.md` file in the Redis directory:
   ```bash
   touch migrations/redis/002_add_new_feature.md
   ```

2. Document the new key patterns:
   ```markdown
   # Redis Migration 002 - Add New Feature
   
   ## New Key Patterns
   - `new_pattern:{id}` → Hash containing...
   ```

3. Update the migration list in `scripts/migrate.js`:
   ```javascript
   const allMigrations = ['001_initial_keys', '002_add_new_feature'];
   ```

4. Run the migration:
   ```bash
   npm run migrate
   ```

## Rollback

Currently, rollback is not automated. To rollback:

1. **PostgreSQL/SQLite**: Write a reverse migration or manually execute SQL
2. **Redis**: Remove keys manually or clear the database
3. Remove the migration record from the `migrations` table/set

## Best Practices

1. **Test migrations locally** before running in production
2. **Backup your database** before running migrations in production
3. **Make migrations idempotent** using `IF NOT EXISTS` and `IF EXISTS`
4. **Keep migrations small** and focused on a single change
5. **Never modify existing migrations** that have been applied
6. **Document breaking changes** in migration comments
7. **Test rollback procedures** before deploying

## Troubleshooting

### Migration fails with "relation already exists"

The migration script uses `IF NOT EXISTS` clauses to make migrations idempotent. If you see this error, check if:
- The migration was partially applied
- Another process created the table
- You're running an old migration on a new database

### Redis migration doesn't create keys

Redis migrations are documentation-only. The actual key patterns are created by the application code (storage adapters). The migration script only tracks which migrations have been "applied" for consistency.

### SQLite foreign key constraint errors

Ensure foreign keys are enabled:
```sql
PRAGMA foreign_keys = ON;
```

The migration script enables this automatically.

## Support

For issues or questions about migrations, please refer to:
- [Main README](../README.md)
- [Setup Guide](../SETUP.md)
- [Storage Adapter Documentation](../lib/storage/README.md)
