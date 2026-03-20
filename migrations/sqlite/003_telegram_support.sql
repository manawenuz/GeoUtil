-- Migration 003: Add Telegram bot support
-- Adds Telegram notification channel alongside ntfy.sh

-- Add Telegram columns to users table
ALTER TABLE users ADD COLUMN telegram_chat_id TEXT;
ALTER TABLE users ADD COLUMN telegram_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN notification_channel TEXT NOT NULL DEFAULT 'ntfy';

CREATE INDEX IF NOT EXISTS idx_users_telegram_chat_id ON users(telegram_chat_id);

-- Telegram link tokens table for account linking flow
CREATE TABLE IF NOT EXISTS telegram_link_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_telegram_link_tokens_user_id ON telegram_link_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_link_tokens_expires_at ON telegram_link_tokens(expires_at);
