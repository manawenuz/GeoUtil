import { createNextAuthAdapter } from './auth-adapter';
import type { AuthStorageAdapter } from './auth-adapter';

/**
 * Unit tests for NextAuth Storage Adapter
 * 
 * These tests verify that the adapter correctly bridges NextAuth.js
 * with our StorageAdapter interface.
 * 
 * Note: These are interface/integration tests. Full functionality tests
 * require Task 14.3 (database schema updates) to be complete.
 */

describe('NextAuth Storage Adapter', () => {
  // Mock storage adapter
  let mockStorage: jest.Mocked<AuthStorageAdapter>;

  beforeEach(() => {
    // Create a mock storage adapter with all required methods
    mockStorage = {
      // Base StorageAdapter methods (not all needed for these tests)
      createUser: jest.fn(),
      getUser: jest.fn(),
      updateUser: jest.fn(),
      deleteUser: jest.fn(),
      createAccount: jest.fn(),
      getAccount: jest.fn(),
      getAccountsByUser: jest.fn(),
      updateAccount: jest.fn(),
      deleteAccount: jest.fn(),
      recordBalance: jest.fn(),
      getLatestBalance: jest.fn(),
      getBalanceHistory: jest.fn(),
      recordNotification: jest.fn(),
      getNotificationHistory: jest.fn(),
      incrementOverdueDays: jest.fn(),
      resetOverdueDays: jest.fn(),
      getOverdueDays: jest.fn(),
      getProviderSuccessRate: jest.fn(),
      recordCheckAttempt: jest.fn(),
      runMigrations: jest.fn(),
      getMigrationStatus: jest.fn(),

      // AuthStorageAdapter methods
      createAuthUser: jest.fn(),
      getAuthUser: jest.fn(),
      getAuthUserByEmail: jest.fn(),
      getAuthUserByAccount: jest.fn(),
      updateAuthUser: jest.fn(),
      linkAccount: jest.fn(),
      unlinkAccount: jest.fn(),
      createSession: jest.fn(),
      getSessionAndUser: jest.fn(),
      updateSession: jest.fn(),
      deleteSession: jest.fn(),
      createVerificationToken: jest.fn(),
      useVerificationToken: jest.fn(),
    } as any;
  });

  describe('createNextAuthAdapter', () => {
    it('should create an adapter with all required NextAuth methods', () => {
      const adapter = createNextAuthAdapter(mockStorage);

      // Verify all required NextAuth adapter methods exist
      expect(adapter.createUser).toBeDefined();
      expect(adapter.getUser).toBeDefined();
      expect(adapter.getUserByEmail).toBeDefined();
      expect(adapter.getUserByAccount).toBeDefined();
      expect(adapter.updateUser).toBeDefined();
      expect(adapter.deleteUser).toBeDefined();
      expect(adapter.linkAccount).toBeDefined();
      expect(adapter.unlinkAccount).toBeDefined();
      expect(adapter.createSession).toBeDefined();
      expect(adapter.getSessionAndUser).toBeDefined();
      expect(adapter.updateSession).toBeDefined();
      expect(adapter.deleteSession).toBeDefined();
      expect(adapter.createVerificationToken).toBeDefined();
      expect(adapter.useVerificationToken).toBeDefined();
    });
  });

  describe('User Operations', () => {
    it('should create a user with OAuth fields', async () => {
      const adapter = createNextAuthAdapter(mockStorage);
      const now = new Date();

      mockStorage.createAuthUser.mockResolvedValue({
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        image: 'https://example.com/avatar.jpg',
        emailVerified: now,
        createdAt: now,
        updatedAt: now,
        ntfyFeedUrl: '',
        ntfyServerUrl: 'https://ntfy.sh',
        notificationEnabled: true,
      });

      const result = await adapter.createUser!({
        email: 'test@example.com',
        name: 'Test User',
        image: 'https://example.com/avatar.jpg',
        emailVerified: now,
      });

      expect(mockStorage.createAuthUser).toHaveBeenCalledWith({
        email: 'test@example.com',
        name: 'Test User',
        image: 'https://example.com/avatar.jpg',
        emailVerified: now,
        ntfyFeedUrl: '',
        ntfyServerUrl: expect.any(String),
        notificationEnabled: true,
      });

      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        image: 'https://example.com/avatar.jpg',
        emailVerified: now,
      });
    });

    it('should get a user by ID', async () => {
      const adapter = createNextAuthAdapter(mockStorage);
      const now = new Date();

      mockStorage.getAuthUser.mockResolvedValue({
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        image: 'https://example.com/avatar.jpg',
        emailVerified: now,
        createdAt: now,
        updatedAt: now,
        ntfyFeedUrl: '',
        ntfyServerUrl: 'https://ntfy.sh',
        notificationEnabled: true,
      });

      const result = await adapter.getUser!('user-123');

      expect(mockStorage.getAuthUser).toHaveBeenCalledWith('user-123');
      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        image: 'https://example.com/avatar.jpg',
        emailVerified: now,
      });
    });

    it('should get a user by email', async () => {
      const adapter = createNextAuthAdapter(mockStorage);
      const now = new Date();

      mockStorage.getAuthUserByEmail.mockResolvedValue({
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        image: undefined,
        emailVerified: null,
        createdAt: now,
        updatedAt: now,
        ntfyFeedUrl: '',
        ntfyServerUrl: 'https://ntfy.sh',
        notificationEnabled: true,
      });

      const result = await adapter.getUserByEmail!('test@example.com');

      expect(mockStorage.getAuthUserByEmail).toHaveBeenCalledWith('test@example.com');
      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        image: undefined,
        emailVerified: null,
      });
    });

    it('should return null when user not found', async () => {
      const adapter = createNextAuthAdapter(mockStorage);

      mockStorage.getAuthUser.mockResolvedValue(null);

      const result = await adapter.getUser!('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('Account Operations', () => {
    it('should link an OAuth account to a user', async () => {
      const adapter = createNextAuthAdapter(mockStorage);

      mockStorage.linkAccount.mockResolvedValue({
        id: 'account-123',
        userId: 'user-123',
        type: 'oauth',
        provider: 'google',
        providerAccountId: 'google-123',
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_at: 1234567890,
        token_type: 'Bearer',
        scope: 'openid profile email',
        id_token: 'id-token',
        session_state: undefined,
      });

      const result = await adapter.linkAccount!({
        userId: 'user-123',
        type: 'oauth',
        provider: 'google',
        providerAccountId: 'google-123',
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_at: 1234567890,
        token_type: 'Bearer',
        scope: 'openid profile email',
        id_token: 'id-token',
      });

      expect(mockStorage.linkAccount).toHaveBeenCalled();
      expect(result.userId).toBe('user-123');
      expect(result.provider).toBe('google');
    });

    it('should unlink an OAuth account', async () => {
      const adapter = createNextAuthAdapter(mockStorage);

      mockStorage.unlinkAccount.mockResolvedValue(undefined);

      await adapter.unlinkAccount!({
        provider: 'google',
        providerAccountId: 'google-123',
      });

      expect(mockStorage.unlinkAccount).toHaveBeenCalledWith('google', 'google-123');
    });
  });

  describe('Session Operations', () => {
    it('should create a session', async () => {
      const adapter = createNextAuthAdapter(mockStorage);
      const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      mockStorage.createSession.mockResolvedValue({
        id: 'session-123',
        sessionToken: 'token-123',
        userId: 'user-123',
        expires,
      });

      const result = await adapter.createSession!({
        sessionToken: 'token-123',
        userId: 'user-123',
        expires,
      });

      expect(mockStorage.createSession).toHaveBeenCalledWith({
        sessionToken: 'token-123',
        userId: 'user-123',
        expires,
      });

      expect(result).toEqual({
        sessionToken: 'token-123',
        userId: 'user-123',
        expires,
      });
    });

    it('should get session and user', async () => {
      const adapter = createNextAuthAdapter(mockStorage);
      const now = new Date();
      const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      mockStorage.getSessionAndUser.mockResolvedValue({
        session: {
          id: 'session-123',
          sessionToken: 'token-123',
          userId: 'user-123',
          expires,
        },
        user: {
          userId: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          image: undefined,
          emailVerified: now,
          createdAt: now,
          updatedAt: now,
          ntfyFeedUrl: '',
          ntfyServerUrl: 'https://ntfy.sh',
          notificationEnabled: true,
        },
      });

      const result = await adapter.getSessionAndUser!('token-123');

      expect(mockStorage.getSessionAndUser).toHaveBeenCalledWith('token-123');
      expect(result).not.toBeNull();
      expect(result!.session.sessionToken).toBe('token-123');
      expect(result!.user.id).toBe('user-123');
    });

    it('should delete a session', async () => {
      const adapter = createNextAuthAdapter(mockStorage);

      mockStorage.deleteSession.mockResolvedValue(undefined);

      await adapter.deleteSession!('token-123');

      expect(mockStorage.deleteSession).toHaveBeenCalledWith('token-123');
    });
  });

  describe('Verification Token Operations', () => {
    it('should create a verification token', async () => {
      const adapter = createNextAuthAdapter(mockStorage);
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

      mockStorage.createVerificationToken.mockResolvedValue({
        identifier: 'test@example.com',
        token: 'verification-token',
        expires,
      });

      const result = await adapter.createVerificationToken!({
        identifier: 'test@example.com',
        token: 'verification-token',
        expires,
      });

      expect(mockStorage.createVerificationToken).toHaveBeenCalledWith({
        identifier: 'test@example.com',
        token: 'verification-token',
        expires,
      });

      expect(result).toEqual({
        identifier: 'test@example.com',
        token: 'verification-token',
        expires,
      });
    });

    it('should use (consume) a verification token', async () => {
      const adapter = createNextAuthAdapter(mockStorage);
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

      mockStorage.useVerificationToken.mockResolvedValue({
        identifier: 'test@example.com',
        token: 'verification-token',
        expires,
      });

      const result = await adapter.useVerificationToken!({
        identifier: 'test@example.com',
        token: 'verification-token',
      });

      expect(mockStorage.useVerificationToken).toHaveBeenCalledWith(
        'test@example.com',
        'verification-token'
      );

      expect(result).toEqual({
        identifier: 'test@example.com',
        token: 'verification-token',
        expires,
      });
    });

    it('should return null for expired verification token', async () => {
      const adapter = createNextAuthAdapter(mockStorage);

      mockStorage.useVerificationToken.mockResolvedValue(null);

      const result = await adapter.useVerificationToken!({
        identifier: 'test@example.com',
        token: 'expired-token',
      });

      expect(result).toBeNull();
    });
  });
});
