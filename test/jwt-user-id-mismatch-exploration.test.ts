/**
 * Bug Condition Exploration Test - JWT User ID Mismatch Fix
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3**
 * 
 * **Property 1: Fault Condition** - OAuth User ID Preservation
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists.
 * DO NOT attempt to fix the test or the code when it fails.
 * 
 * This test verifies that when a user is created with an OAuth ID (e.g., from Google),
 * the database user_id matches the provided OAuth ID. On unfixed code, the storage adapter
 * generates a new random UUID instead of using the OAuth ID, causing a mismatch.
 * 
 * EXPECTED OUTCOME ON UNFIXED CODE: Test FAILS (this is correct - proves bug exists)
 * EXPECTED OUTCOME AFTER FIX: Test PASSES (confirms bug is fixed)
 */

import { randomUUID } from 'crypto';
import { PostgresAdapter } from '@/lib/storage/postgres-adapter';
import { SQLiteAdapter } from '@/lib/storage/sqlite-adapter';
import { RedisAdapter } from '@/lib/storage/redis-adapter';
import { StorageAdapter } from '@/lib/storage/types';
import Database from 'better-sqlite3';
import { Pool } from 'pg';
import { Redis } from '@upstash/redis';

describe('Bug Condition Exploration: OAuth User ID Preservation', () => {
  let storageAdapter: StorageAdapter;
  let cleanupFn: () => Promise<void>;

  beforeAll(async () => {
    // Use SQLite for testing (in-memory database)
    const db = new Database(':memory:');
    
    // Run migrations to set up schema
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        email TEXT,
        name TEXT,
        image TEXT,
        email_verified TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        ntfy_feed_url TEXT NOT NULL,
        ntfy_server_url TEXT NOT NULL,
        notification_enabled INTEGER NOT NULL DEFAULT 1,
        telegram_chat_id TEXT,
        telegram_enabled INTEGER NOT NULL DEFAULT 0,
        notification_channel TEXT NOT NULL DEFAULT 'ntfy'
      );

      CREATE TABLE IF NOT EXISTS accounts (
        account_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        provider_type TEXT NOT NULL,
        provider_name TEXT NOT NULL,
        account_number TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      );
    `);

    storageAdapter = new SQLiteAdapter(db);
    
    cleanupFn = async () => {
      db.close();
    };
  });

  afterAll(async () => {
    await cleanupFn();
  });

  /**
   * Test Case 1: OAuth User Creation - Database user_id Mismatch
   * 
   * This test creates a user with a specific OAuth ID (simulating Google OAuth)
   * and verifies that the database user_id matches the provided OAuth ID.
   * 
   * On unfixed code: The storage adapter generates a new UUID, so the returned
   * userId will NOT match the OAuth ID we want to use.
   * 
   * After fix: The storage adapter uses the provided userId, so they match.
   */
  it('should fail on unfixed code: createUser generates UUID instead of using OAuth ID', async () => {
    const oauthUserId = '100535385232710598610'; // Google OAuth ID format
    
    // After fix: createUser() accepts userId parameter and uses it
    const createdUserId = await storageAdapter.createUser({
      userId: oauthUserId, // Pass OAuth ID to be used as user_id
      email: 'oauth-user@example.com',
      name: 'OAuth User',
      image: 'https://example.com/avatar.jpg',
      emailVerified: null,
      ntfyFeedUrl: '',
      ntfyServerUrl: 'https://ntfy.sh',
      notificationEnabled: true,
    });

    // EXPECTED OUTCOME AFTER FIX:
    // createdUserId will match the OAuth ID "100535385232710598610"
    
    console.log('COUNTEREXAMPLE:');
    console.log('Expected OAuth ID:', oauthUserId);
    console.log('Actual database user_id:', createdUserId);
    console.log('Match:', createdUserId === oauthUserId ? 'YES' : 'NO');
    
    // This assertion will PASS after fix
    expect(createdUserId).toBe(oauthUserId);
  });

  /**
   * Test Case 2: OAuth User Retrieval - User Not Found
   * 
   * This test simulates the actual bug scenario:
   * 1. User signs in with OAuth (session has OAuth ID)
   * 2. System creates user in database (but generates new UUID)
   * 3. System tries to retrieve user with OAuth ID from session
   * 4. User is not found because database has different ID
   * 
   * On unfixed code: getUser(oauthUserId) returns null
   * After fix: getUser(oauthUserId) returns the user
   */
  it('should fail on unfixed code: getUser(oauthId) returns null after user creation', async () => {
    const oauthUserId = '100535385232710598611'; // Different OAuth ID
    
    // Create user with OAuth ID (after fix, this uses the provided ID)
    const createdUserId = await storageAdapter.createUser({
      userId: oauthUserId, // Pass OAuth ID to be used as user_id
      email: 'oauth-user2@example.com',
      name: 'OAuth User 2',
      image: 'https://example.com/avatar2.jpg',
      emailVerified: null,
      ntfyFeedUrl: '',
      ntfyServerUrl: 'https://ntfy.sh',
      notificationEnabled: true,
    });

    // Try to retrieve user with OAuth ID (simulating session.user.id)
    const retrievedUser = await storageAdapter.getUser(oauthUserId);

    console.log('COUNTEREXAMPLE:');
    console.log('OAuth ID from session:', oauthUserId);
    console.log('Created user_id in database:', createdUserId);
    console.log('Retrieved user with OAuth ID:', retrievedUser ? 'FOUND' : 'NULL');
    
    // EXPECTED OUTCOME AFTER FIX:
    // retrievedUser will be the user object because database has the OAuth ID
    expect(retrievedUser).not.toBeNull();
    expect(retrievedUser?.userId).toBe(oauthUserId);
  });

  /**
   * Test Case 3: Account Creation - Foreign Key Constraint Violation
   * 
   * This test simulates the full bug scenario that users experience:
   * 1. User signs in with OAuth (session has OAuth ID "100535385232710598612")
   * 2. System creates user in database (generates UUID "a1b2c3d4-...")
   * 3. User tries to create an account
   * 4. Account creation uses session.user.id ("100535385232710598612")
   * 5. Foreign key constraint fails because user_id doesn't exist
   * 
   * On unfixed code: createAccount throws foreign key constraint error
   * After fix: createAccount succeeds
   */
  it('should fail on unfixed code: account creation fails with foreign key constraint', async () => {
    const oauthUserId = '100535385232710598612'; // OAuth ID from session
    
    // Create user with OAuth ID (after fix, this uses the provided ID)
    const createdUserId = await storageAdapter.createUser({
      userId: oauthUserId, // Pass OAuth ID to be used as user_id
      email: 'oauth-user3@example.com',
      name: 'OAuth User 3',
      image: 'https://example.com/avatar3.jpg',
      emailVerified: null,
      ntfyFeedUrl: '',
      ntfyServerUrl: 'https://ntfy.sh',
      notificationEnabled: true,
    });

    console.log('COUNTEREXAMPLE:');
    console.log('OAuth ID from session:', oauthUserId);
    console.log('Created user_id in database:', createdUserId);
    console.log('Attempting to create account with userId:', oauthUserId);

    // Try to create an account using the OAuth ID (simulating the bug scenario)
    // On unfixed code: This will throw a foreign key constraint error
    // After fix: This will succeed
    let accountCreationError: Error | null = null;
    let accountId: string | null = null;

    try {
      accountId = await storageAdapter.createAccount({
        userId: oauthUserId, // Using OAuth ID from session
        providerType: 'gas',
        providerName: 'te.ge',
        accountNumber: 'encrypted_123456789012',
        enabled: true,
      });
    } catch (error) {
      accountCreationError = error as Error;
      console.log('Account creation error:', error);
    }

    // EXPECTED OUTCOME AFTER FIX:
    // accountId will be created successfully because user_id matches
    expect(accountCreationError).toBeNull();
    expect(accountId).not.toBeNull();
    
    // Verify the account was created with the correct userId
    if (accountId) {
      const account = await storageAdapter.getAccount(accountId);
      expect(account?.userId).toBe(oauthUserId);
    }
  });

  /**
   * Test Case 4: Concrete Failing Case - Google OAuth ID Format
   * 
   * This test uses the exact OAuth ID format from Google (21 digits)
   * to demonstrate the bug with real-world data.
   */
  it('should fail on unfixed code: Google OAuth ID is not preserved', async () => {
    const googleOAuthId = '100535385232710598613'; // Real Google OAuth ID format (21 digits)
    
    // Simulate user creation after OAuth sign-in with userId parameter
    const createdUserId = await storageAdapter.createUser({
      userId: googleOAuthId, // Pass Google OAuth ID to be used as user_id
      email: 'google-user@gmail.com',
      name: 'Google User',
      image: 'https://lh3.googleusercontent.com/a/default-user',
      emailVerified: new Date(),
      ntfyFeedUrl: '',
      ntfyServerUrl: 'https://ntfy.sh',
      notificationEnabled: true,
    });

    console.log('COUNTEREXAMPLE:');
    console.log('Google OAuth ID:', googleOAuthId);
    console.log('Database user_id:', createdUserId);
    console.log('Is UUID format:', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(createdUserId));
    console.log('Is Google OAuth format:', /^\d{21}$/.test(createdUserId));

    // EXPECTED OUTCOME AFTER FIX:
    // createdUserId should match the Google OAuth ID (21 digits)
    
    // After fix: createdUserId should match the Google OAuth ID format
    expect(createdUserId).toBe(googleOAuthId);
    expect(/^\d{21}$/.test(createdUserId)).toBe(true);
  });
});
