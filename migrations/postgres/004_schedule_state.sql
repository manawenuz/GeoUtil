-- Migration 004: Smart scheduling state
-- Tracks per-account check schedule for billing-cycle-aware balance checking

CREATE TABLE IF NOT EXISTS schedule_state (
  account_id UUID PRIMARY KEY REFERENCES accounts(account_id) ON DELETE CASCADE,
  last_checked_at TIMESTAMP,
  next_check_at TIMESTAMP NOT NULL DEFAULT NOW(),
  check_interval_hours INTEGER NOT NULL DEFAULT 24,
  consecutive_zero_count INTEGER NOT NULL DEFAULT 0,
  last_balance DECIMAL(10, 2),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedule_state_next_check ON schedule_state(next_check_at);
