-- Initial schema for Georgia Utility Monitor
-- PostgreSQL version

-- Users table with OAuth fields
CREATE TABLE IF NOT EXISTS users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  image TEXT,
  email_verified TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ntfy_feed_url TEXT NOT NULL DEFAULT '',
  ntfy_server_url TEXT NOT NULL DEFAULT 'https://ntfy.sh',
  notification_enabled BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- OAuth accounts table (for NextAuth)
CREATE TABLE IF NOT EXISTS auth_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  provider_account_id VARCHAR(255) NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at BIGINT,
  token_type VARCHAR(50),
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  UNIQUE(provider, provider_account_id)
);

CREATE INDEX IF NOT EXISTS idx_auth_accounts_user_id ON auth_accounts(user_id);

-- OAuth sessions table (for NextAuth)
CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token VARCHAR(255) NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  expires TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON auth_sessions(expires);

-- OAuth verification tokens table (for NextAuth)
CREATE TABLE IF NOT EXISTS auth_verification_tokens (
  identifier VARCHAR(255) NOT NULL,
  token VARCHAR(255) NOT NULL,
  expires TIMESTAMP NOT NULL,
  PRIMARY KEY (identifier, token)
);

CREATE INDEX IF NOT EXISTS idx_auth_verification_tokens_expires ON auth_verification_tokens(expires);

-- Utility accounts table
CREATE TABLE IF NOT EXISTS accounts (
  account_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  provider_type VARCHAR(20) NOT NULL CHECK (provider_type IN ('gas', 'water', 'electricity', 'trash')),
  provider_name VARCHAR(100) NOT NULL,
  account_number TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  enabled BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_provider ON accounts(provider_name);

-- Balances table
CREATE TABLE IF NOT EXISTS balances (
  balance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  balance DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'GEL',
  checked_at TIMESTAMP NOT NULL DEFAULT NOW(),
  success BOOLEAN NOT NULL,
  error TEXT,
  raw_response TEXT
);

CREATE INDEX IF NOT EXISTS idx_balances_account_id ON balances(account_id);
CREATE INDEX IF NOT EXISTS idx_balances_checked_at ON balances(checked_at DESC);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  sent_at TIMESTAMP NOT NULL DEFAULT NOW(),
  priority VARCHAR(10) NOT NULL CHECK (priority IN ('default', 'high', 'urgent')),
  message TEXT NOT NULL,
  delivery_success BOOLEAN NOT NULL,
  delivery_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_at ON notifications(sent_at DESC);

-- Overdue tracking table
CREATE TABLE IF NOT EXISTS overdue_tracking (
  account_id UUID PRIMARY KEY REFERENCES accounts(account_id) ON DELETE CASCADE,
  overdue_days INTEGER NOT NULL DEFAULT 0,
  first_non_zero_date TIMESTAMP,
  last_checked_date TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Check attempts table (for metrics)
CREATE TABLE IF NOT EXISTS check_attempts (
  attempt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  provider_name VARCHAR(100) NOT NULL,
  attempted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  success BOOLEAN NOT NULL,
  error TEXT,
  response_time INTEGER
);

CREATE INDEX IF NOT EXISTS idx_check_attempts_provider ON check_attempts(provider_name);
CREATE INDEX IF NOT EXISTS idx_check_attempts_attempted_at ON check_attempts(attempted_at DESC);

-- Migrations table
CREATE TABLE IF NOT EXISTS migrations (
  migration_id SERIAL PRIMARY KEY,
  migration_name VARCHAR(255) NOT NULL UNIQUE,
  applied_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Record this migration
INSERT INTO migrations (migration_name) VALUES ('001_initial_schema')
ON CONFLICT (migration_name) DO NOTHING;
