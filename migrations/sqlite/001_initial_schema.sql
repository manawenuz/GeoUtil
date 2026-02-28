-- Initial schema for Georgia Utility Monitor
-- SQLite version

-- Users table with OAuth fields
CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  image TEXT,
  email_verified TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  ntfy_feed_url TEXT NOT NULL DEFAULT '',
  ntfy_server_url TEXT NOT NULL DEFAULT 'https://ntfy.sh',
  notification_enabled INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- OAuth accounts table (for NextAuth)
CREATE TABLE IF NOT EXISTS auth_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at INTEGER,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  UNIQUE(provider, provider_account_id)
);

CREATE INDEX IF NOT EXISTS idx_auth_accounts_user_id ON auth_accounts(user_id);

-- OAuth sessions table (for NextAuth)
CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  session_token TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  expires TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON auth_sessions(expires);

-- OAuth verification tokens table (for NextAuth)
CREATE TABLE IF NOT EXISTS auth_verification_tokens (
  identifier TEXT NOT NULL,
  token TEXT NOT NULL,
  expires TEXT NOT NULL,
  PRIMARY KEY (identifier, token)
);

CREATE INDEX IF NOT EXISTS idx_auth_verification_tokens_expires ON auth_verification_tokens(expires);

-- Utility accounts table
CREATE TABLE IF NOT EXISTS accounts (
  account_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  provider_type TEXT NOT NULL CHECK (provider_type IN ('gas', 'water', 'electricity', 'trash')),
  provider_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_provider ON accounts(provider_name);

-- Balances table
CREATE TABLE IF NOT EXISTS balances (
  balance_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  balance REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GEL',
  checked_at TEXT NOT NULL,
  success INTEGER NOT NULL,
  error TEXT,
  raw_response TEXT
);

CREATE INDEX IF NOT EXISTS idx_balances_account_id ON balances(account_id);
CREATE INDEX IF NOT EXISTS idx_balances_checked_at ON balances(checked_at DESC);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  notification_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  sent_at TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('default', 'high', 'urgent')),
  message TEXT NOT NULL,
  delivery_success INTEGER NOT NULL,
  delivery_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_at ON notifications(sent_at DESC);

-- Overdue tracking table
CREATE TABLE IF NOT EXISTS overdue_tracking (
  account_id TEXT PRIMARY KEY REFERENCES accounts(account_id) ON DELETE CASCADE,
  overdue_days INTEGER NOT NULL DEFAULT 0,
  first_non_zero_date TEXT,
  last_checked_date TEXT NOT NULL
);

-- Check attempts table (for metrics)
CREATE TABLE IF NOT EXISTS check_attempts (
  attempt_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  provider_name TEXT NOT NULL,
  attempted_at TEXT NOT NULL,
  success INTEGER NOT NULL,
  error TEXT,
  response_time INTEGER
);

CREATE INDEX IF NOT EXISTS idx_check_attempts_provider ON check_attempts(provider_name);
CREATE INDEX IF NOT EXISTS idx_check_attempts_attempted_at ON check_attempts(attempted_at DESC);

-- Migrations table
CREATE TABLE IF NOT EXISTS migrations (
  migration_id INTEGER PRIMARY KEY AUTOINCREMENT,
  migration_name TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL
);

-- Record this migration
INSERT OR IGNORE INTO migrations (migration_name, applied_at) 
VALUES ('001_initial_schema', datetime('now'));
