-- Migration: Change user_id from UUID to TEXT
-- This allows OAuth providers (like Google) to use their native ID formats
-- which are not always UUIDs

-- Step 1: Drop foreign key constraints that reference users(user_id)
ALTER TABLE auth_accounts DROP CONSTRAINT IF EXISTS auth_accounts_user_id_fkey;
ALTER TABLE auth_sessions DROP CONSTRAINT IF EXISTS auth_sessions_user_id_fkey;
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_user_id_fkey;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;

-- Step 2: Change user_id column type in users table
ALTER TABLE users ALTER COLUMN user_id TYPE TEXT;

-- Step 3: Change user_id column type in all referencing tables
ALTER TABLE auth_accounts ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE auth_sessions ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE accounts ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE notifications ALTER COLUMN user_id TYPE TEXT;

-- Step 4: Re-add foreign key constraints
ALTER TABLE auth_accounts 
  ADD CONSTRAINT auth_accounts_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

ALTER TABLE auth_sessions 
  ADD CONSTRAINT auth_sessions_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

ALTER TABLE accounts 
  ADD CONSTRAINT accounts_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

ALTER TABLE notifications 
  ADD CONSTRAINT notifications_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

