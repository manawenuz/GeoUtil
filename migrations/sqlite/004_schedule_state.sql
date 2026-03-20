-- Migration 004: Smart scheduling state
-- Tracks per-account check schedule for billing-cycle-aware balance checking

CREATE TABLE IF NOT EXISTS schedule_state (
  account_id TEXT PRIMARY KEY REFERENCES accounts(account_id) ON DELETE CASCADE,
  last_checked_at TEXT,
  next_check_at TEXT NOT NULL,
  check_interval_hours INTEGER NOT NULL DEFAULT 24,
  consecutive_zero_count INTEGER NOT NULL DEFAULT 0,
  last_balance REAL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_schedule_state_next_check ON schedule_state(next_check_at);
