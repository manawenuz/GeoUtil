import { Redis } from '@upstash/redis';
import { randomUUID } from 'crypto';
import {
  StorageAdapter,
  User,
  UserData,
  Account,
  AccountData,
  Balance,
  BalanceData,
  Notification,
  NotificationData,
  OverdueTracking,
  MigrationStatus,
} from './types';

/**
 * RedisAdapter - Storage adapter implementation for Redis
 * 
 * Redis Data Structures:
 * - user:{userId} -> Hash (user data)
 * - account:{accountId} -> Hash (account data)
 * - user:{userId}:accounts -> Set (accountIds)
 * - balance:latest:{accountId} -> Hash (latest balance)
 * - balance:history:{accountId} -> Sorted Set (balance history, score = timestamp)
 * - notifications:{userId} -> List (notification history, capped at 100)
 * - overdue:{accountId} -> Hash (overdue tracking)
 * - checks:{providerName} -> Sorted Set (check attempts, score = timestamp, capped at 1000)
 * - migrations -> Set (applied migration names)
 * 
 * Validates Requirements: 20.1, 20.4, 20.6
 */
export class RedisAdapter implements StorageAdapter {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  // ===== User Operations =====

  async createUser(userData: UserData): Promise<string> {
    const userId = randomUUID();
    const now = new Date().toISOString();

    await this.redis.hset(`user:${userId}`, {
      userId,
      createdAt: now,
      updatedAt: now,
      ntfyFeedUrl: userData.ntfyFeedUrl,
      ntfyServerUrl: userData.ntfyServerUrl,
      notificationEnabled: userData.notificationEnabled ? '1' : '0',
    });

    return userId;
  }

  async getUser(userId: string): Promise<User | null> {
    const data = await this.redis.hgetall(`user:${userId}`);
    
    if (!data || Object.keys(data).length === 0) {
      return null;
    }

    return {
      userId: data.userId as string,
      email: data.email as string,
      name: data.name as string,
      image: data.image as string | undefined,
      emailVerified: data.emailVerified ? new Date(data.emailVerified as string) : null,
      createdAt: new Date(data.createdAt as string),
      updatedAt: new Date(data.updatedAt as string),
      ntfyFeedUrl: data.ntfyFeedUrl as string,
      ntfyServerUrl: data.ntfyServerUrl as string,
      notificationEnabled: data.notificationEnabled === '1',
    };
  }

  async updateUser(userId: string, userData: Partial<UserData>): Promise<void> {
    const updates: Record<string, string> = {
      updatedAt: new Date().toISOString(),
    };

    if (userData.ntfyFeedUrl !== undefined) {
      updates.ntfyFeedUrl = userData.ntfyFeedUrl;
    }
    if (userData.ntfyServerUrl !== undefined) {
      updates.ntfyServerUrl = userData.ntfyServerUrl;
    }
    if (userData.notificationEnabled !== undefined) {
      updates.notificationEnabled = userData.notificationEnabled ? '1' : '0';
    }

    await this.redis.hset(`user:${userId}`, updates);
  }

  async deleteUser(userId: string): Promise<void> {
    // Get all accounts for this user
    const accountIds = await this.redis.smembers(`user:${userId}:accounts`);

    // Delete all accounts and their associated data
    for (const accountId of accountIds) {
      await this.deleteAccount(accountId as string);
    }

    // Delete user's notification history
    await this.redis.del(`notifications:${userId}`);

    // Delete user's account set
    await this.redis.del(`user:${userId}:accounts`);

    // Delete user data
    await this.redis.del(`user:${userId}`);
  }

  // ===== Account Operations =====

  async createAccount(accountData: AccountData): Promise<string> {
    const accountId = randomUUID();
    const now = new Date().toISOString();

    await this.redis.hset(`account:${accountId}`, {
      accountId,
      userId: accountData.userId,
      providerType: accountData.providerType,
      providerName: accountData.providerName,
      accountNumber: accountData.accountNumber,
      createdAt: now,
      updatedAt: now,
      enabled: accountData.enabled ? '1' : '0',
    });

    // Add to user's account set
    await this.redis.sadd(`user:${accountData.userId}:accounts`, accountId);

    return accountId;
  }

  async getAccount(accountId: string): Promise<Account | null> {
    const data = await this.redis.hgetall(`account:${accountId}`);
    
    if (!data || Object.keys(data).length === 0) {
      return null;
    }

    return {
      accountId: data.accountId as string,
      userId: data.userId as string,
      providerType: data.providerType as 'gas' | 'water' | 'electricity' | 'trash',
      providerName: data.providerName as string,
      accountNumber: data.accountNumber as string,
      createdAt: new Date(data.createdAt as string),
      updatedAt: new Date(data.updatedAt as string),
      enabled: data.enabled === '1',
    };
  }

  async getAccountsByUser(userId: string): Promise<Account[]> {
    const accountIds = await this.redis.smembers(`user:${userId}:accounts`);
    
    const accounts: Account[] = [];
    for (const accountId of accountIds) {
      const account = await this.getAccount(accountId as string);
      if (account) {
        accounts.push(account);
      }
    }

    return accounts;
  }

  async updateAccount(accountId: string, accountData: Partial<AccountData>): Promise<void> {
    const updates: Record<string, string> = {
      updatedAt: new Date().toISOString(),
    };

    if (accountData.providerType !== undefined) {
      updates.providerType = accountData.providerType;
    }
    if (accountData.providerName !== undefined) {
      updates.providerName = accountData.providerName;
    }
    if (accountData.accountNumber !== undefined) {
      updates.accountNumber = accountData.accountNumber;
    }
    if (accountData.enabled !== undefined) {
      updates.enabled = accountData.enabled ? '1' : '0';
    }

    await this.redis.hset(`account:${accountId}`, updates);
  }

  async deleteAccount(accountId: string): Promise<void> {
    // Get account to find userId
    const account = await this.getAccount(accountId);
    
    if (account) {
      // Remove from user's account set
      await this.redis.srem(`user:${account.userId}:accounts`, accountId);
    }

    // Delete balance history
    await this.redis.del(`balance:history:${accountId}`);

    // Delete latest balance
    await this.redis.del(`balance:latest:${accountId}`);

    // Delete overdue tracking
    await this.redis.del(`overdue:${accountId}`);

    // Delete account data
    await this.redis.del(`account:${accountId}`);
  }

  // ===== Balance Operations =====

  async recordBalance(balanceData: BalanceData): Promise<void> {
    const balanceId = randomUUID();
    const timestamp = balanceData.checkedAt.getTime();

    const balanceRecord = {
      balanceId,
      accountId: balanceData.accountId,
      balance: balanceData.balance.toString(),
      currency: balanceData.currency,
      checkedAt: balanceData.checkedAt.toISOString(),
      success: balanceData.success ? '1' : '0',
      error: balanceData.error || '',
      rawResponse: balanceData.rawResponse || '',
    };

    // Store as latest balance
    await this.redis.hset(`balance:latest:${balanceData.accountId}`, balanceRecord);

    // Add to balance history (sorted set with timestamp as score)
    await this.redis.zadd(`balance:history:${balanceData.accountId}`, {
      score: timestamp,
      member: JSON.stringify(balanceRecord),
    });
  }

  async getLatestBalance(accountId: string): Promise<Balance | null> {
    const data = await this.redis.hgetall(`balance:latest:${accountId}`);
    
    if (!data || Object.keys(data).length === 0) {
      return null;
    }

    return {
      balanceId: data.balanceId as string,
      accountId: data.accountId as string,
      balance: parseFloat(data.balance as string),
      currency: data.currency as string,
      checkedAt: new Date(data.checkedAt as string),
      success: data.success === '1',
      error: data.error ? (data.error as string) : undefined,
      rawResponse: data.rawResponse ? (data.rawResponse as string) : undefined,
    };
  }

  async getBalanceHistory(accountId: string, days: number): Promise<Balance[]> {
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
    
    // Get all balance records with timestamp >= cutoffTime, ordered by score descending
    const records = await this.redis.zrange(
      `balance:history:${accountId}`,
      cutoffTime,
      '+inf',
      {
        byScore: true,
        rev: true,
      }
    );

    const balances: Balance[] = [];
    for (const record of records) {
      const data = JSON.parse(record as string);
      balances.push({
        balanceId: data.balanceId,
        accountId: data.accountId,
        balance: parseFloat(data.balance),
        currency: data.currency,
        checkedAt: new Date(data.checkedAt),
        success: data.success === '1',
        error: data.error || undefined,
        rawResponse: data.rawResponse || undefined,
      });
    }

    return balances;
  }

  // ===== Notification Operations =====

  async recordNotification(notificationData: NotificationData): Promise<void> {
    const notificationId = randomUUID();

    const notification = {
      notificationId,
      userId: notificationData.userId,
      accountId: notificationData.accountId,
      sentAt: notificationData.sentAt.toISOString(),
      priority: notificationData.priority,
      message: notificationData.message,
      deliverySuccess: notificationData.deliverySuccess ? '1' : '0',
      deliveryError: notificationData.deliveryError || '',
    };

    // Add to the front of the list (most recent first)
    await this.redis.lpush(`notifications:${notificationData.userId}`, JSON.stringify(notification));

    // Trim to keep only the most recent 100 notifications
    await this.redis.ltrim(`notifications:${notificationData.userId}`, 0, 99);
  }

  async getNotificationHistory(userId: string, limit: number): Promise<Notification[]> {
    // Get the most recent 'limit' notifications
    const records = await this.redis.lrange(`notifications:${userId}`, 0, limit - 1);

    const notifications: Notification[] = [];
    for (const record of records) {
      const data = JSON.parse(record as string);
      notifications.push({
        notificationId: data.notificationId,
        userId: data.userId,
        accountId: data.accountId,
        sentAt: new Date(data.sentAt),
        priority: data.priority,
        message: data.message,
        deliverySuccess: data.deliverySuccess === '1',
        deliveryError: data.deliveryError || undefined,
      });
    }

    return notifications;
  }

  // ===== Overdue Tracking Operations =====

  async incrementOverdueDays(accountId: string): Promise<number> {
    const key = `overdue:${accountId}`;
    const now = new Date().toISOString();

    // Check if overdue tracking exists
    const exists = await this.redis.exists(key);

    if (!exists) {
      // First time tracking overdue - initialize
      await this.redis.hset(key, {
        accountId,
        overdueDays: '1',
        firstNonZeroDate: now,
        lastCheckedDate: now,
      });
      return 1;
    }

    // Increment overdue days
    const newCount = await this.redis.hincrby(key, 'overdueDays', 1);
    await this.redis.hset(key, { lastCheckedDate: now });

    return newCount;
  }

  async resetOverdueDays(accountId: string): Promise<void> {
    await this.redis.del(`overdue:${accountId}`);
  }

  async getOverdueDays(accountId: string): Promise<number> {
    const data = await this.redis.hget(`overdue:${accountId}`, 'overdueDays');
    
    if (!data) {
      return 0;
    }

    return parseInt(data as string, 10);
  }

  // ===== Health and Metrics Operations =====

  async getProviderSuccessRate(providerName: string, days: number): Promise<number> {
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
    
    // Get all check attempts for this provider within the time range
    const records = await this.redis.zrange(
      `checks:${providerName}`,
      cutoffTime,
      '+inf',
      {
        byScore: true,
      }
    );

    if (records.length === 0) {
      return 1.0; // No data means 100% success rate (no failures)
    }

    let successCount = 0;
    for (const record of records) {
      const data = JSON.parse(record as string);
      if (data.success) {
        successCount++;
      }
    }

    return successCount / records.length;
  }

  async recordCheckAttempt(accountId: string, success: boolean, error?: string): Promise<void> {
    // Get account to find provider name
    const account = await this.getAccount(accountId);
    
    if (!account) {
      return;
    }

    const attemptId = randomUUID();
    const timestamp = Date.now();

    const attempt = {
      attemptId,
      accountId,
      providerName: account.providerName,
      attemptedAt: new Date().toISOString(),
      success,
      error: error || '',
      responseTime: 0, // This would be set by the caller in a real implementation
    };

    // Add to sorted set with timestamp as score
    await this.redis.zadd(`checks:${account.providerName}`, {
      score: timestamp,
      member: JSON.stringify(attempt),
    });

    // Keep only the most recent 1000 check attempts
    const count = await this.redis.zcard(`checks:${account.providerName}`);
    if (count > 1000) {
      await this.redis.zpopmin(`checks:${account.providerName}`, count - 1000);
    }
  }

  // ===== Migration Operations =====

  async runMigrations(): Promise<void> {
    // For Redis, migrations are minimal since it's schemaless
    // We just need to ensure the migrations set exists
    const migrationKey = 'migrations';
    
    // Check if initial migration has been applied
    const hasInitial = await this.redis.sismember(migrationKey, '001_initial_keys');
    
    if (!hasInitial) {
      // Apply initial migration
      await this.redis.sadd(migrationKey, '001_initial_keys');
    }
  }

  async getMigrationStatus(): Promise<MigrationStatus> {
    const appliedMigrations = await this.redis.smembers('migrations');
    
    // Define all known migrations
    const allMigrations = ['001_initial_keys'];
    
    const applied = appliedMigrations.map(m => m as string);
    const pending = allMigrations.filter(m => !applied.includes(m));

    return {
      appliedMigrations: applied,
      pendingMigrations: pending,
    };
  }

  // ===== NextAuth-Specific Operations =====

  async createAuthUser(userData: Omit<import('../auth-adapter').AuthUser, 'userId' | 'createdAt' | 'updatedAt'>): Promise<import('../auth-adapter').AuthUser> {
    const userId = randomUUID();
    const now = new Date();

    const authUser = {
      userId,
      email: userData.email,
      name: userData.name,
      image: userData.image || '',
      emailVerified: userData.emailVerified ? userData.emailVerified.toISOString() : '',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      ntfyFeedUrl: userData.ntfyFeedUrl,
      ntfyServerUrl: userData.ntfyServerUrl,
      notificationEnabled: userData.notificationEnabled ? '1' : '0',
    };

    await this.redis.hset(`user:${userId}`, authUser);

    return {
      userId,
      email: userData.email,
      name: userData.name,
      image: userData.image,
      emailVerified: userData.emailVerified,
      createdAt: now,
      updatedAt: now,
      ntfyFeedUrl: userData.ntfyFeedUrl,
      ntfyServerUrl: userData.ntfyServerUrl,
      notificationEnabled: userData.notificationEnabled,
    };
  }

  async getAuthUser(userId: string): Promise<import('../auth-adapter').AuthUser | null> {
    const data = await this.redis.hgetall(`user:${userId}`);
    
    if (!data || Object.keys(data).length === 0) {
      return null;
    }

    return {
      userId: data.userId as string,
      email: data.email as string,
      name: data.name as string,
      image: data.image ? (data.image as string) : undefined,
      emailVerified: data.emailVerified ? new Date(data.emailVerified as string) : null,
      createdAt: new Date(data.createdAt as string),
      updatedAt: new Date(data.updatedAt as string),
      ntfyFeedUrl: data.ntfyFeedUrl as string,
      ntfyServerUrl: data.ntfyServerUrl as string,
      notificationEnabled: data.notificationEnabled === '1',
    };
  }

  async getAuthUserByEmail(email: string): Promise<import('../auth-adapter').AuthUser | null> {
    // Redis doesn't have efficient email lookup, so we need to scan all users
    // In production, consider maintaining an email->userId index
    const keys = await this.redis.keys('user:*');
    
    for (const key of keys) {
      const data = await this.redis.hgetall(key as string);
      if (data && data.email === email) {
        return {
          userId: data.userId as string,
          email: data.email as string,
          name: data.name as string,
          image: data.image ? (data.image as string) : undefined,
          emailVerified: data.emailVerified ? new Date(data.emailVerified as string) : null,
          createdAt: new Date(data.createdAt as string),
          updatedAt: new Date(data.updatedAt as string),
          ntfyFeedUrl: data.ntfyFeedUrl as string,
          ntfyServerUrl: data.ntfyServerUrl as string,
          notificationEnabled: data.notificationEnabled === '1',
        };
      }
    }
    
    return null;
  }

  async getAuthUserByAccount(provider: string, providerAccountId: string): Promise<import('../auth-adapter').AuthUser | null> {
    // Get account by provider and providerAccountId
    const accountKey = `account:${provider}:${providerAccountId}`;
    const accountData = await this.redis.hgetall(accountKey);
    
    if (!accountData || Object.keys(accountData).length === 0) {
      return null;
    }

    const userId = accountData.userId as string;
    return this.getAuthUser(userId);
  }

  async updateAuthUser(userId: string, userData: Partial<import('../auth-adapter').AuthUser>): Promise<import('../auth-adapter').AuthUser> {
    const updates: Record<string, string> = {
      updatedAt: new Date().toISOString(),
    };

    if (userData.email !== undefined) {
      updates.email = userData.email;
    }
    if (userData.name !== undefined) {
      updates.name = userData.name;
    }
    if (userData.image !== undefined) {
      updates.image = userData.image || '';
    }
    if (userData.emailVerified !== undefined) {
      updates.emailVerified = userData.emailVerified ? userData.emailVerified.toISOString() : '';
    }
    if (userData.ntfyFeedUrl !== undefined) {
      updates.ntfyFeedUrl = userData.ntfyFeedUrl;
    }
    if (userData.ntfyServerUrl !== undefined) {
      updates.ntfyServerUrl = userData.ntfyServerUrl;
    }
    if (userData.notificationEnabled !== undefined) {
      updates.notificationEnabled = userData.notificationEnabled ? '1' : '0';
    }

    await this.redis.hset(`user:${userId}`, updates);

    const updated = await this.getAuthUser(userId);
    if (!updated) {
      throw new Error(`User ${userId} not found after update`);
    }

    return updated;
  }

  async linkAccount(account: Omit<import('../auth-adapter').AuthAccount, 'id'>): Promise<import('../auth-adapter').AuthAccount> {
    const id = randomUUID();
    const accountKey = `account:${account.provider}:${account.providerAccountId}`;

    const accountData = {
      id,
      userId: account.userId,
      type: account.type,
      provider: account.provider,
      providerAccountId: account.providerAccountId,
      refresh_token: account.refresh_token || '',
      access_token: account.access_token || '',
      expires_at: account.expires_at?.toString() || '',
      token_type: account.token_type || '',
      scope: account.scope || '',
      id_token: account.id_token || '',
      session_state: account.session_state || '',
    };

    await this.redis.hset(accountKey, accountData);

    // Add to user's linked accounts set
    await this.redis.sadd(`user:${account.userId}:linked_accounts`, accountKey);

    return {
      id,
      userId: account.userId,
      type: account.type,
      provider: account.provider,
      providerAccountId: account.providerAccountId,
      refresh_token: account.refresh_token,
      access_token: account.access_token,
      expires_at: account.expires_at,
      token_type: account.token_type,
      scope: account.scope,
      id_token: account.id_token,
      session_state: account.session_state,
    };
  }

  async unlinkAccount(provider: string, providerAccountId: string): Promise<void> {
    const accountKey = `account:${provider}:${providerAccountId}`;
    const accountData = await this.redis.hgetall(accountKey);

    if (accountData && accountData.userId) {
      // Remove from user's linked accounts set
      await this.redis.srem(`user:${accountData.userId}:linked_accounts`, accountKey);
    }

    // Delete the account
    await this.redis.del(accountKey);
  }

  async createSession(session: Omit<import('../auth-adapter').AuthSession, 'id'>): Promise<import('../auth-adapter').AuthSession> {
    const id = randomUUID();
    const sessionKey = `session:${session.sessionToken}`;

    const sessionData = {
      id,
      sessionToken: session.sessionToken,
      userId: session.userId,
      expires: session.expires.toISOString(),
    };

    await this.redis.hset(sessionKey, sessionData);

    // Set expiration on the session key
    const expiresIn = Math.floor((session.expires.getTime() - Date.now()) / 1000);
    if (expiresIn > 0) {
      await this.redis.expire(sessionKey, expiresIn);
    }

    // Add to user's sessions set
    await this.redis.sadd(`user:${session.userId}:sessions`, session.sessionToken);

    return {
      id,
      sessionToken: session.sessionToken,
      userId: session.userId,
      expires: session.expires,
    };
  }

  async getSessionAndUser(sessionToken: string): Promise<{ session: import('../auth-adapter').AuthSession; user: import('../auth-adapter').AuthUser } | null> {
    const sessionKey = `session:${sessionToken}`;
    const sessionData = await this.redis.hgetall(sessionKey);

    if (!sessionData || Object.keys(sessionData).length === 0) {
      return null;
    }

    const session: import('../auth-adapter').AuthSession = {
      id: sessionData.id as string,
      sessionToken: sessionData.sessionToken as string,
      userId: sessionData.userId as string,
      expires: new Date(sessionData.expires as string),
    };

    // Check if session is expired
    if (session.expires < new Date()) {
      await this.deleteSession(sessionToken);
      return null;
    }

    const user = await this.getAuthUser(session.userId);
    if (!user) {
      return null;
    }

    return { session, user };
  }

  async updateSession(sessionToken: string, session: Partial<import('../auth-adapter').AuthSession>): Promise<import('../auth-adapter').AuthSession | null> {
    const sessionKey = `session:${sessionToken}`;
    const existingData = await this.redis.hgetall(sessionKey);

    if (!existingData || Object.keys(existingData).length === 0) {
      return null;
    }

    const updates: Record<string, string> = {};

    if (session.expires !== undefined) {
      updates.expires = session.expires.toISOString();

      // Update expiration on the key
      const expiresIn = Math.floor((session.expires.getTime() - Date.now()) / 1000);
      if (expiresIn > 0) {
        await this.redis.expire(sessionKey, expiresIn);
      }
    }

    if (Object.keys(updates).length > 0) {
      await this.redis.hset(sessionKey, updates);
    }

    const updatedData = await this.redis.hgetall(sessionKey);

    if (!updatedData || Object.keys(updatedData).length === 0) {
      return null;
    }

    return {
      id: updatedData.id as string,
      sessionToken: updatedData.sessionToken as string,
      userId: updatedData.userId as string,
      expires: new Date(updatedData.expires as string),
    };
  }

  async deleteSession(sessionToken: string): Promise<void> {
    const sessionKey = `session:${sessionToken}`;
    const sessionData = await this.redis.hgetall(sessionKey);

    if (sessionData && sessionData.userId) {
      // Remove from user's sessions set
      await this.redis.srem(`user:${sessionData.userId}:sessions`, sessionToken);
    }

    // Delete the session
    await this.redis.del(sessionKey);
  }

  async createVerificationToken(token: import('../auth-adapter').AuthVerificationToken): Promise<import('../auth-adapter').AuthVerificationToken> {
    const tokenKey = `verification:${token.identifier}:${token.token}`;

    const tokenData = {
      identifier: token.identifier,
      token: token.token,
      expires: token.expires.toISOString(),
    };

    await this.redis.hset(tokenKey, tokenData);

    // Set expiration on the token key
    const expiresIn = Math.floor((token.expires.getTime() - Date.now()) / 1000);
    if (expiresIn > 0) {
      await this.redis.expire(tokenKey, expiresIn);
    }

    return token;
  }

  async useVerificationToken(identifier: string, token: string): Promise<import('../auth-adapter').AuthVerificationToken | null> {
    const tokenKey = `verification:${identifier}:${token}`;
    const tokenData = await this.redis.hgetall(tokenKey);

    if (!tokenData || Object.keys(tokenData).length === 0) {
      return null;
    }

    const verificationToken: import('../auth-adapter').AuthVerificationToken = {
      identifier: tokenData.identifier as string,
      token: tokenData.token as string,
      expires: new Date(tokenData.expires as string),
    };

    // Check if token is expired
    if (verificationToken.expires < new Date()) {
      await this.redis.del(tokenKey);
      return null;
    }

    // Delete the token after use (one-time use)
    await this.redis.del(tokenKey);

    return verificationToken;
  }
}
