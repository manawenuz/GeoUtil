-- Migration 003: Add Telegram bot support
-- Adds Telegram notification channel alongside ntfy.sh

-- Add Telegram columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_channel VARCHAR(20) NOT NULL DEFAULT 'ntfy';

CREATE INDEX IF NOT EXISTS idx_users_telegram_chat_id ON users(telegram_chat_id);

-- Telegram link tokens table for account linking flow
CREATE TABLE IF NOT EXISTS telegram_link_tokens (
  token VARCHAR(64) PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_telegram_link_tokens_user_id ON telegram_link_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_link_tokens_expires_at ON telegram_link_tokens(expires_at);
