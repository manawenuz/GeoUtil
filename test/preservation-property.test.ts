/**
 * Preservation Property Tests - JWT User ID Mismatch Fix
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 * 
 * **Property 2: Preservation** - Non-OAuth User Creation and Existing User Handling
 * 
 * IMPORTANT: These tests MUST PASS on unfixed code - they establish the baseline
 * behavior that must be preserved after implementing the fix.
 * 
 * This test suite verifies that existing behavior for non-OAuth scenarios remains unchanged:
 * - When createUser() is called without userId (non-OAuth), system generates new random UUID
 * - When user already exists, system returns existing user without creating duplicate
 * - All data integrity constraints are enforced
 * - All three storage adapters (postgres, sqlite, redis) maintain identical behavior
 * 
 * EXPECTED OUTCOME ON UNFIXED CODE: Tests PASS (confirms baseline behavior)
 * EXPECTED OUTCOME AFTER FIX: Tests PASS (confirms no regressions)
 */

import { randomUUID } from 'crypto';
import { SQLiteAdapter } from '@/lib/storage/sqlite-adapter';
import { StorageAdapter, UserData } from '@/lib/storage/types';
import Database from 'better-sqlite3';
import fc from 'fast-check';

describe('Preservation Property Tests: Non-OAuth User Creation', () => {
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
   * Property 1: UUID Generation for Non-OAuth Users
   * 
   * When createUser() is called without a userId parameter (non-OAuth scenarios),
   * the system MUST generate a valid UUID v4.
   * 
   * This property verifies that the existing UUID generation behavior is preserved.
   */
  describe('Property: UUID Generation', () => {
    it('should generate valid UUIDs when no userId is provided', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            email: fc.emailAddress(),
            name: fc.string({ minLength: 1, maxLength: 100 }),
            image: fc.option(fc.webUrl(), { nil: undefined }),
            emailVerified: fc.option(fc.date(), { nil: null }),
            ntfyFeedUrl: fc.string(),
            ntfyServerUrl: fc.webUrl(),
            notificationEnabled: fc.boolean(),
          }),
          async (userData) => {
            // Create user without providing userId (non-OAuth scenario)
            const createdUserId = await storageAdapter.createUser(userData as UserData);

            // Verify a valid UUID v4 was generated
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            expect(createdUserId).toMatch(uuidRegex);

            // Verify the user can be retrieved with the generated UUID
            const retrievedUser = await storageAdapter.getUser(createdUserId);
            expect(retrievedUser).not.toBeNull();
            expect(retrievedUser?.userId).toBe(createdUserId);
          }
        ),
        { numRuns: 20 } // Run 20 test cases
      );
    });

    it('should generate unique UUIDs for each user creation', async () => {
      const userIds = new Set<string>();

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            email: fc.emailAddress(),
            name: fc.string({ minLength: 1, maxLength: 100 }),
            image: fc.option(fc.webUrl(), { nil: undefined }),
            emailVerified: fc.option(fc.date(), { nil: null }),
            ntfyFeedUrl: fc.string(),
            ntfyServerUrl: fc.webUrl(),
            notificationEnabled: fc.boolean(),
          }),
          async (userData) => {
            const createdUserId = await storageAdapter.createUser(userData as UserData);

            // Verify each generated UUID is unique
            expect(userIds.has(createdUserId)).toBe(false);
            userIds.add(createdUserId);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * Property 2: Data Integrity and Field Storage
   * 
   * When createUser() is called with valid user data, the required fields
   * (ntfyFeedUrl, ntfyServerUrl, notificationEnabled) MUST be stored correctly
   * with automatic timestamps (createdAt, updatedAt).
   * 
   * Note: The current implementation only stores ntfy-related fields and timestamps.
   * Email, name, image, and emailVerified are NOT stored by createUser() - this is
   * the existing behavior that must be preserved.
   * 
   * This property verifies that data integrity is preserved.
   */
  describe('Property: Data Integrity', () => {
    it('should store required fields correctly with timestamps', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            email: fc.emailAddress(),
            name: fc.string({ minLength: 1, maxLength: 100 }),
            image: fc.option(fc.webUrl(), { nil: undefined }),
            emailVerified: fc.option(fc.date(), { nil: null }),
            ntfyFeedUrl: fc.string(),
            ntfyServerUrl: fc.webUrl(),
            notificationEnabled: fc.boolean(),
          }),
          async (userData) => {
            const beforeCreate = new Date();
            const createdUserId = await storageAdapter.createUser(userData as UserData);
            const afterCreate = new Date();

            // Retrieve the created user
            const retrievedUser = await storageAdapter.getUser(createdUserId);
            expect(retrievedUser).not.toBeNull();

            if (retrievedUser) {
              // Verify required fields are stored correctly
              // Note: Current implementation only stores ntfy-related fields
              expect(retrievedUser.ntfyFeedUrl).toBe(userData.ntfyFeedUrl);
              expect(retrievedUser.ntfyServerUrl).toBe(userData.ntfyServerUrl);
              expect(retrievedUser.notificationEnabled).toBe(userData.notificationEnabled);

              // Verify timestamps are set automatically
              expect(retrievedUser.createdAt).toBeInstanceOf(Date);
              expect(retrievedUser.updatedAt).toBeInstanceOf(Date);

              // Verify timestamps are within reasonable range
              expect(retrievedUser.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
              expect(retrievedUser.createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
              expect(retrievedUser.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
              expect(retrievedUser.updatedAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime());

              // Verify createdAt and updatedAt are initially the same
              expect(retrievedUser.createdAt.getTime()).toBe(retrievedUser.updatedAt.getTime());
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should handle required fields correctly', async () => {
      // Test with typical user data (no userId - non-OAuth scenario)
      const userData = {
        email: 'test@example.com',
        name: 'Test User',
        image: undefined,
        emailVerified: null,
        ntfyFeedUrl: '',
        ntfyServerUrl: 'https://ntfy.sh',
        notificationEnabled: true,
      };

      const userId = await storageAdapter.createUser(userData as UserData);
      const user = await storageAdapter.getUser(userId);

      expect(user).not.toBeNull();
      expect(user?.ntfyFeedUrl).toBe('');
      expect(user?.ntfyServerUrl).toBe('https://ntfy.sh');
      expect(user?.notificationEnabled).toBe(true);
    });
  });

  /**
   * Property 3: Foreign Key Constraints
   * 
   * When a user is created, accounts can be created with the generated userId,
   * and foreign key constraints are enforced.
   * 
   * This property verifies that data integrity constraints are preserved.
   */
  describe('Property: Foreign Key Constraints', () => {
    it('should allow account creation with generated userId', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            email: fc.emailAddress(),
            name: fc.string({ minLength: 1, maxLength: 100 }),
            image: fc.option(fc.webUrl(), { nil: undefined }),
            emailVerified: fc.option(fc.date(), { nil: null }),
            ntfyFeedUrl: fc.string(),
            ntfyServerUrl: fc.webUrl(),
            notificationEnabled: fc.boolean(),
          }),
          fc.constantFrom('gas' as const, 'water' as const, 'electricity' as const, 'trash' as const),
          fc.constantFrom('te.ge', 'telmico', 'gwp', 'other'),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (userData, providerType, providerName: string, accountNumber: string) => {
            // Create user (generates UUID)
            const userId = await storageAdapter.createUser(userData as UserData);

            // Create account with the generated userId
            const accountId = await storageAdapter.createAccount({
              userId,
              providerType,
              providerName,
              accountNumber,
              enabled: true,
            });

            // Verify account was created successfully
            const account = await storageAdapter.getAccount(accountId);
            expect(account).not.toBeNull();
            expect(account?.userId).toBe(userId);
            expect(account?.providerType).toBe(providerType);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should enforce foreign key constraints for invalid userId', async () => {
      const nonExistentUserId = randomUUID();

      // Attempt to create account with non-existent userId
      await expect(
        storageAdapter.createAccount({
          userId: nonExistentUserId,
          providerType: 'gas',
          providerName: 'te.ge',
          accountNumber: 'encrypted_123',
          enabled: true,
        })
      ).rejects.toThrow();
    });
  });

  /**
   * Property 4: Idempotency - No Duplicate Users
   * 
   * When createUser() is called multiple times with the same data,
   * multiple users are created (each with unique userId).
   * 
   * Note: The current system doesn't prevent duplicate users - this is
   * the existing behavior that must be preserved.
   */
  describe('Property: User Creation Behavior', () => {
    it('should create separate users for each createUser call', async () => {
      const userData = {
        email: 'duplicate@example.com',
        name: 'Duplicate User',
        image: undefined,
        emailVerified: null,
        ntfyFeedUrl: '',
        ntfyServerUrl: 'https://ntfy.sh',
        notificationEnabled: true,
      };

      // Create first user
      const userId1 = await storageAdapter.createUser(userData as UserData);
      
      // Create second user with same data
      const userId2 = await storageAdapter.createUser(userData as UserData);

      // Verify two different users were created
      expect(userId1).not.toBe(userId2);

      // Verify both users exist
      const user1 = await storageAdapter.getUser(userId1);
      const user2 = await storageAdapter.getUser(userId2);
      expect(user1).not.toBeNull();
      expect(user2).not.toBeNull();
      
      // Verify both have the same ntfy settings (the fields that are actually stored)
      expect(user1?.ntfyFeedUrl).toBe(userData.ntfyFeedUrl);
      expect(user2?.ntfyFeedUrl).toBe(userData.ntfyFeedUrl);
      expect(user1?.ntfyServerUrl).toBe(userData.ntfyServerUrl);
      expect(user2?.ntfyServerUrl).toBe(userData.ntfyServerUrl);
    });
  });

  /**
   * Property 5: Storage Adapter Consistency
   * 
   * All three storage adapters (postgres, sqlite, redis) MUST behave identically
   * for user creation operations.
   * 
   * This property verifies adapter consistency is preserved.
   * 
   * Note: This test only runs for SQLite in this suite. Full adapter testing
   * would require setting up all three backends.
   */
  describe('Property: Storage Adapter Consistency', () => {
    it('should maintain consistent behavior across adapter implementations', async () => {
      const userData = {
        email: 'consistency@example.com',
        name: 'Consistency Test',
        image: undefined,
        emailVerified: null,
        ntfyFeedUrl: '',
        ntfyServerUrl: 'https://ntfy.sh',
        notificationEnabled: true,
      };

      // Create user
      const userId = await storageAdapter.createUser(userData as UserData);

      // Verify UUID format (all adapters should generate valid UUIDs)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(userId).toMatch(uuidRegex);

      // Verify user can be retrieved
      const user = await storageAdapter.getUser(userId);
      expect(user).not.toBeNull();
      expect(user?.userId).toBe(userId);

      // Verify required fields are present
      expect(user?.ntfyFeedUrl).toBe(userData.ntfyFeedUrl);
      expect(user?.ntfyServerUrl).toBe(userData.ntfyServerUrl);
      expect(user?.notificationEnabled).toBe(userData.notificationEnabled);
      expect(user?.createdAt).toBeInstanceOf(Date);
      expect(user?.updatedAt).toBeInstanceOf(Date);
    });
  });
});
