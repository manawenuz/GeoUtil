import Database from 'better-sqlite3';
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
  TelegramLinkToken,
  ScheduleState,
  MigrationStatus,
} from './types';

/**
 * SQLiteAdapter - Storage adapter implementation for SQLite
 * 
 * Uses better-sqlite3 for synchronous SQLite operations
 * All queries use parameterized statements for security
 * 
 * SQLite-Specific Data Types:
 * - UUIDs stored as TEXT
 * - Booleans stored as INTEGER (0/1)
 * - Timestamps stored as TEXT (ISO 8601 format)
 * - Decimals stored as REAL
 * 
 * Database Schema:
 * - users: User accounts with notification configuration
 * - accounts: Utility accounts linked to users
 * - balances: Balance check history
 * - notifications: Notification delivery history
 * - overdue_tracking: Tracks consecutive non-zero balance days
 * - check_attempts: Provider check attempt metrics
 * - migrations: Applied migration tracking
 * 
 * Validates Requirements: 20.1, 20.4, 20.6
 */
export class SQLiteAdapter implements StorageAdapter {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Create a SQLiteAdapter from a database file path
   */
  static fromFilePath(filePath: string): SQLiteAdapter {
    const db = new Database(filePath);
    // Enable foreign keys
    db.pragma('foreign_keys = ON');
    return new SQLiteAdapter(db);
  }

  // ===== User Operations =====

  async createUser(userData: UserData): Promise<string> {
      const userId = userData.userId || randomUUID();
      const now = new Date().toISOString();

      this.db.prepare(
        `INSERT INTO users (user_id, email, name, image, email_verified, created_at, updated_at, ntfy_feed_url, ntfy_server_url, notification_enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        userId,
        userData.email,
        userData.name,
        userData.image || null,
        userData.emailVerified ? userData.emailVerified.toISOString() : null,
        now,
        now,
        userData.ntfyFeedUrl,
        userData.ntfyServerUrl,
        userData.notificationEnabled ? 1 : 0
      );

      return userId;
    }

  async getUser(userId: string): Promise<User | null> {
    const row = this.db.prepare(
      `SELECT user_id, email, name, image, email_verified, created_at, updated_at,
              ntfy_feed_url, ntfy_server_url, notification_enabled,
              telegram_chat_id, telegram_enabled, notification_channel
       FROM users
       WHERE user_id = ?`
    ).get(userId) as any;

    if (!row) {
      return null;
    }

    return this.mapRowToUser(row);
  }

  private mapRowToUser(row: Record<string, unknown>): User {
    return {
      userId: row.user_id as string,
      email: row.email as string,
      name: row.name as string,
      image: row.image as string | undefined,
      emailVerified: row.email_verified ? new Date(row.email_verified as string) : null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
      ntfyFeedUrl: row.ntfy_feed_url as string,
      ntfyServerUrl: row.ntfy_server_url as string,
      notificationEnabled: (row.notification_enabled as number) === 1,
      telegramChatId: row.telegram_chat_id as string | undefined,
      telegramEnabled: (row.telegram_enabled as number) === 1,
      notificationChannel: (row.notification_channel as 'ntfy' | 'telegram' | 'both') ?? 'ntfy',
    };
  }

  async updateUser(userId: string, userData: Partial<UserData>): Promise<void> {
    const updates: string[] = [];
    const values: any[] = [];

    if (userData.ntfyFeedUrl !== undefined) {
      updates.push('ntfy_feed_url = ?');
      values.push(userData.ntfyFeedUrl);
    }
    if (userData.ntfyServerUrl !== undefined) {
      updates.push('ntfy_server_url = ?');
      values.push(userData.ntfyServerUrl);
    }
    if (userData.notificationEnabled !== undefined) {
      updates.push('notification_enabled = ?');
      values.push(userData.notificationEnabled ? 1 : 0);
    }
    if (userData.telegramChatId !== undefined) {
      updates.push('telegram_chat_id = ?');
      values.push(userData.telegramChatId);
    }
    if (userData.telegramEnabled !== undefined) {
      updates.push('telegram_enabled = ?');
      values.push(userData.telegramEnabled ? 1 : 0);
    }
    if (userData.notificationChannel !== undefined) {
      updates.push('notification_channel = ?');
      values.push(userData.notificationChannel);
    }

    if (updates.length === 0) {
      return;
    }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(userId);

    this.db.prepare(
      `UPDATE users SET ${updates.join(', ')} WHERE user_id = ?`
    ).run(...values);
  }

  async deleteUser(userId: string): Promise<void> {
    // Cascade delete will handle accounts, balances, notifications, etc.
    this.db.prepare('DELETE FROM users WHERE user_id = ?').run(userId);
  }

  // ===== Account Operations =====

  async createAccount(accountData: AccountData): Promise<string> {
    const accountId = randomUUID();
    const now = new Date().toISOString();

    this.db.prepare(
      `INSERT INTO accounts (account_id, user_id, provider_type, provider_name, account_number, created_at, updated_at, enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      accountId,
      accountData.userId,
      accountData.providerType,
      accountData.providerName,
      accountData.accountNumber,
      now,
      now,
      accountData.enabled ? 1 : 0
    );

    return accountId;
  }

  async getAccount(accountId: string): Promise<Account | null> {
    const row = this.db.prepare(
      `SELECT account_id, user_id, provider_type, provider_name, account_number,
              created_at, updated_at, enabled
       FROM accounts
       WHERE account_id = ?`
    ).get(accountId) as any;

    if (!row) {
      return null;
    }

    return {
      accountId: row.account_id,
      userId: row.user_id,
      providerType: row.provider_type,
      providerName: row.provider_name,
      accountNumber: row.account_number,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      enabled: row.enabled === 1,
    };
  }

  async getAccountsByUser(userId: string): Promise<Account[]> {
    const rows = this.db.prepare(
      `SELECT account_id, user_id, provider_type, provider_name, account_number,
              created_at, updated_at, enabled
       FROM accounts
       WHERE user_id = ?
       ORDER BY created_at DESC`
    ).all(userId) as any[];

    return rows.map(row => ({
      accountId: row.account_id,
      userId: row.user_id,
      providerType: row.provider_type,
      providerName: row.provider_name,
      accountNumber: row.account_number,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      enabled: row.enabled === 1,
    }));
  }

  async updateAccount(accountId: string, accountData: Partial<AccountData>): Promise<void> {
    const updates: string[] = [];
    const values: any[] = [];

    if (accountData.providerType !== undefined) {
      updates.push('provider_type = ?');
      values.push(accountData.providerType);
    }
    if (accountData.providerName !== undefined) {
      updates.push('provider_name = ?');
      values.push(accountData.providerName);
    }
    if (accountData.accountNumber !== undefined) {
      updates.push('account_number = ?');
      values.push(accountData.accountNumber);
    }
    if (accountData.enabled !== undefined) {
      updates.push('enabled = ?');
      values.push(accountData.enabled ? 1 : 0);
    }

    if (updates.length === 0) {
      return;
    }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(accountId);

    this.db.prepare(
      `UPDATE accounts SET ${updates.join(', ')} WHERE account_id = ?`
    ).run(...values);
  }

  async deleteAccount(accountId: string): Promise<void> {
    // Cascade delete will handle balances, overdue_tracking, etc.
    this.db.prepare('DELETE FROM accounts WHERE account_id = ?').run(accountId);
  }

  // ===== Balance Operations =====

  async recordBalance(balanceData: BalanceData): Promise<void> {
    const balanceId = randomUUID();

    this.db.prepare(
      `INSERT INTO balances (balance_id, account_id, balance, currency, checked_at, success, error, raw_response)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      balanceId,
      balanceData.accountId,
      balanceData.balance,
      balanceData.currency,
      balanceData.checkedAt.toISOString(),
      balanceData.success ? 1 : 0,
      balanceData.error || null,
      balanceData.rawResponse || null
    );
  }

  async getLatestBalance(accountId: string): Promise<Balance | null> {
    const row = this.db.prepare(
      `SELECT balance_id, account_id, balance, currency, checked_at, success, error, raw_response
       FROM balances
       WHERE account_id = ?
       ORDER BY checked_at DESC
       LIMIT 1`
    ).get(accountId) as any;

    if (!row) {
      return null;
    }

    return {
      balanceId: row.balance_id,
      accountId: row.account_id,
      balance: row.balance,
      currency: row.currency,
      checkedAt: new Date(row.checked_at),
      success: row.success === 1,
      error: row.error || undefined,
      rawResponse: row.raw_response || undefined,
    };
  }

  async getBalanceHistory(accountId: string, days: number): Promise<Balance[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffISO = cutoffDate.toISOString();

    const rows = this.db.prepare(
      `SELECT balance_id, account_id, balance, currency, checked_at, success, error, raw_response
       FROM balances
       WHERE account_id = ? AND checked_at >= ?
       ORDER BY checked_at DESC`
    ).all(accountId, cutoffISO) as any[];

    return rows.map(row => ({
      balanceId: row.balance_id,
      accountId: row.account_id,
      balance: row.balance,
      currency: row.currency,
      checkedAt: new Date(row.checked_at),
      success: row.success === 1,
      error: row.error || undefined,
      rawResponse: row.raw_response || undefined,
    }));
  }

  // ===== Notification Operations =====

  async recordNotification(notificationData: NotificationData): Promise<void> {
    const notificationId = randomUUID();

    this.db.prepare(
      `INSERT INTO notifications (notification_id, user_id, account_id, sent_at, priority, message, delivery_success, delivery_error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      notificationId,
      notificationData.userId,
      notificationData.accountId,
      notificationData.sentAt.toISOString(),
      notificationData.priority,
      notificationData.message,
      notificationData.deliverySuccess ? 1 : 0,
      notificationData.deliveryError || null
    );
  }

  async getNotificationHistory(userId: string, limit: number): Promise<Notification[]> {
    const rows = this.db.prepare(
      `SELECT notification_id, user_id, account_id, sent_at, priority, message, delivery_success, delivery_error
       FROM notifications
       WHERE user_id = ?
       ORDER BY sent_at DESC
       LIMIT ?`
    ).all(userId, limit) as any[];

    return rows.map(row => ({
      notificationId: row.notification_id,
      userId: row.user_id,
      accountId: row.account_id,
      sentAt: new Date(row.sent_at),
      priority: row.priority,
      message: row.message,
      deliverySuccess: row.delivery_success === 1,
      deliveryError: row.delivery_error || undefined,
    }));
  }

  // ===== Overdue Tracking Operations =====

  async incrementOverdueDays(accountId: string): Promise<number> {
    const now = new Date().toISOString();

    // Use a transaction for atomic operation
    const transaction = this.db.transaction(() => {
      // Check if overdue tracking exists
      const existing = this.db.prepare(
        'SELECT overdue_days FROM overdue_tracking WHERE account_id = ?'
      ).get(accountId) as any;

      let newCount: number;

      if (!existing) {
        // First time tracking overdue - initialize
        this.db.prepare(
          `INSERT INTO overdue_tracking (account_id, overdue_days, first_non_zero_date, last_checked_date)
           VALUES (?, 1, ?, ?)`
        ).run(accountId, now, now);
        newCount = 1;
      } else {
        // Increment overdue days
        newCount = existing.overdue_days + 1;
        this.db.prepare(
          `UPDATE overdue_tracking
           SET overdue_days = ?, last_checked_date = ?
           WHERE account_id = ?`
        ).run(newCount, now, accountId);
      }

      return newCount;
    });

    return transaction();
  }

  async resetOverdueDays(accountId: string): Promise<void> {
    this.db.prepare('DELETE FROM overdue_tracking WHERE account_id = ?').run(accountId);
  }

  async getOverdueDays(accountId: string): Promise<number> {
    const row = this.db.prepare(
      'SELECT overdue_days FROM overdue_tracking WHERE account_id = ?'
    ).get(accountId) as any;

    if (!row) {
      return 0;
    }

    return row.overdue_days;
  }

  // ===== Health and Metrics Operations =====

  async getProviderSuccessRate(providerName: string, days: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffISO = cutoffDate.toISOString();

    const row = this.db.prepare(
      `SELECT
         SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count,
         COUNT(*) as total_count
       FROM check_attempts
       WHERE provider_name = ? AND attempted_at >= ?`
    ).get(providerName, cutoffISO) as any;

    const totalCount = row.total_count || 0;

    if (totalCount === 0) {
      return 1.0; // No data means 100% success rate (no failures)
    }

    const successCount = row.success_count || 0;
    return successCount / totalCount;
  }

  async recordCheckAttempt(accountId: string, success: boolean, error?: string): Promise<void> {
    // Get account to find provider name
    const account = await this.getAccount(accountId);

    if (!account) {
      return;
    }

    const attemptId = randomUUID();
    const now = new Date().toISOString();

    this.db.prepare(
      `INSERT INTO check_attempts (attempt_id, account_id, provider_name, attempted_at, success, error, response_time)
       VALUES (?, ?, ?, ?, ?, ?, 0)`
    ).run(
      attemptId,
      accountId,
      account.providerName,
      now,
      success ? 1 : 0,
      error || null
    );
  }

  // ===== Migration Operations =====

  async runMigrations(): Promise<void> {
    // Migrations are handled by the migration script (scripts/migrate.js)
    // This method is a no-op for SQLite as migrations are run externally
    // to support both development and production environments
  }

  async getMigrationStatus(): Promise<MigrationStatus> {
    // Check if migrations table exists
    const tableCheck = this.db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'`
    ).get() as any;

    if (!tableCheck) {
      return {
        appliedMigrations: [],
        pendingMigrations: ['migrations_table_not_found'],
      };
    }

    // Get applied migrations
    const rows = this.db.prepare(
      'SELECT migration_name FROM migrations ORDER BY migration_id'
    ).all() as any[];

    const appliedMigrations = rows.map(row => row.migration_name);

    // We don't track pending migrations in the adapter
    // That's handled by the migration script
    return {
      appliedMigrations,
      pendingMigrations: [],
    };
  }

  // ===== NextAuth-Specific Operations =====

  async createAuthUser(userData: Omit<import('../auth-adapter').AuthUser, 'userId' | 'createdAt' | 'updatedAt'>): Promise<import('../auth-adapter').AuthUser> {
    const userId = randomUUID();
    const now = new Date().toISOString();

    this.db.prepare(
      `INSERT INTO users (user_id, email, name, image, email_verified, created_at, updated_at, ntfy_feed_url, ntfy_server_url, notification_enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      userId,
      userData.email,
      userData.name,
      userData.image || null,
      userData.emailVerified ? userData.emailVerified.toISOString() : null,
      now,
      now,
      userData.ntfyFeedUrl,
      userData.ntfyServerUrl,
      userData.notificationEnabled ? 1 : 0
    );

    const user = await this.getAuthUser(userId);
    if (!user) throw new Error('Failed to create user');
    return user;
  }

  async getAuthUser(userId: string): Promise<import('../auth-adapter').AuthUser | null> {
    const row = this.db.prepare(
      `SELECT user_id, email, name, image, email_verified, created_at, updated_at,
              ntfy_feed_url, ntfy_server_url, notification_enabled,
              telegram_chat_id, telegram_enabled, notification_channel
       FROM users WHERE user_id = ?`
    ).get(userId) as any;
    return row ? this.mapRowToUser(row) : null;
  }

  async getAuthUserByEmail(email: string): Promise<import('../auth-adapter').AuthUser | null> {
    const row = this.db.prepare(
      `SELECT user_id, email, name, image, email_verified, created_at, updated_at,
              ntfy_feed_url, ntfy_server_url, notification_enabled,
              telegram_chat_id, telegram_enabled, notification_channel
       FROM users WHERE email = ?`
    ).get(email) as any;
    return row ? this.mapRowToUser(row) : null;
  }

  async getAuthUserByAccount(provider: string, providerAccountId: string): Promise<import('../auth-adapter').AuthUser | null> {
    const row = this.db.prepare(
      `SELECT u.user_id, u.email, u.name, u.image, u.email_verified, u.created_at, u.updated_at,
              u.ntfy_feed_url, u.ntfy_server_url, u.notification_enabled,
              u.telegram_chat_id, u.telegram_enabled, u.notification_channel
       FROM users u
       INNER JOIN auth_accounts a ON u.user_id = a.user_id
       WHERE a.provider = ? AND a.provider_account_id = ?`
    ).get(provider, providerAccountId) as any;
    return row ? this.mapRowToUser(row) : null;
  }

  async updateAuthUser(userId: string, userData: Partial<import('../auth-adapter').AuthUser>): Promise<import('../auth-adapter').AuthUser> {
    const updates: string[] = [];
    const values: any[] = [];

    if (userData.email !== undefined) {
      updates.push('email = ?');
      values.push(userData.email);
    }
    if (userData.name !== undefined) {
      updates.push('name = ?');
      values.push(userData.name);
    }
    if (userData.image !== undefined) {
      updates.push('image = ?');
      values.push(userData.image || null);
    }
    if (userData.emailVerified !== undefined) {
      updates.push('email_verified = ?');
      values.push(userData.emailVerified ? userData.emailVerified.toISOString() : null);
    }
    if (userData.ntfyFeedUrl !== undefined) {
      updates.push('ntfy_feed_url = ?');
      values.push(userData.ntfyFeedUrl);
    }
    if (userData.ntfyServerUrl !== undefined) {
      updates.push('ntfy_server_url = ?');
      values.push(userData.ntfyServerUrl);
    }
    if (userData.notificationEnabled !== undefined) {
      updates.push('notification_enabled = ?');
      values.push(userData.notificationEnabled ? 1 : 0);
    }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(userId);

    this.db.prepare(
      `UPDATE users
       SET ${updates.join(', ')}
       WHERE user_id = ?`
    ).run(...values);

    const updated = await this.getAuthUser(userId);
    if (!updated) {
      throw new Error(`User ${userId} not found after update`);
    }

    return updated;
  }

  async linkAccount(account: Omit<import('../auth-adapter').AuthAccount, 'id'>): Promise<import('../auth-adapter').AuthAccount> {
    const id = randomUUID();

    this.db.prepare(
      `INSERT INTO auth_accounts (id, user_id, type, provider, provider_account_id, refresh_token, access_token, expires_at, token_type, scope, id_token, session_state)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      account.userId,
      account.type,
      account.provider,
      account.providerAccountId,
      account.refresh_token || null,
      account.access_token || null,
      account.expires_at || null,
      account.token_type || null,
      account.scope || null,
      account.id_token || null,
      account.session_state || null
    );

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
    this.db.prepare(
      `DELETE FROM auth_accounts
       WHERE provider = ? AND provider_account_id = ?`
    ).run(provider, providerAccountId);
  }

  async createSession(session: Omit<import('../auth-adapter').AuthSession, 'id'>): Promise<import('../auth-adapter').AuthSession> {
    const id = randomUUID();

    this.db.prepare(
      `INSERT INTO auth_sessions (id, session_token, user_id, expires)
       VALUES (?, ?, ?, ?)`
    ).run(
      id,
      session.sessionToken,
      session.userId,
      session.expires.toISOString()
    );

    return {
      id,
      sessionToken: session.sessionToken,
      userId: session.userId,
      expires: session.expires,
    };
  }

  async getSessionAndUser(sessionToken: string): Promise<{ session: import('../auth-adapter').AuthSession; user: import('../auth-adapter').AuthUser } | null> {
    const row = this.db.prepare(
      `SELECT
         s.id, s.session_token, s.user_id, s.expires,
         u.user_id as u_user_id, u.email, u.name, u.image, u.email_verified, u.created_at, u.updated_at,
         u.ntfy_feed_url, u.ntfy_server_url, u.notification_enabled,
         u.telegram_chat_id, u.telegram_enabled, u.notification_channel
       FROM auth_sessions s
       INNER JOIN users u ON s.user_id = u.user_id
       WHERE s.session_token = ? AND datetime(s.expires) > datetime('now')`
    ).get(sessionToken) as any;

    if (!row) {
      return null;
    }

    return {
      session: {
        id: row.id,
        sessionToken: row.session_token,
        userId: row.user_id,
        expires: new Date(row.expires),
      },
      user: this.mapRowToUser({ ...row, user_id: row.u_user_id }),
    };
  }

  async updateSession(sessionToken: string, session: Partial<import('../auth-adapter').AuthSession>): Promise<import('../auth-adapter').AuthSession | null> {
    const updates: string[] = [];
    const values: any[] = [];

    if (session.expires !== undefined) {
      updates.push('expires = ?');
      values.push(session.expires.toISOString());
    }

    if (updates.length === 0) {
      // No updates to make, just return the existing session
      const row = this.db.prepare(
        `SELECT id, session_token, user_id, expires
         FROM auth_sessions
         WHERE session_token = ?`
      ).get(sessionToken) as any;

      if (!row) {
        return null;
      }

      return {
        id: row.id,
        sessionToken: row.session_token,
        userId: row.user_id,
        expires: new Date(row.expires),
      };
    }

    values.push(sessionToken);

    this.db.prepare(
      `UPDATE auth_sessions
       SET ${updates.join(', ')}
       WHERE session_token = ?`
    ).run(...values);

    const row = this.db.prepare(
      `SELECT id, session_token, user_id, expires
       FROM auth_sessions
       WHERE session_token = ?`
    ).get(sessionToken) as any;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      sessionToken: row.session_token,
      userId: row.user_id,
      expires: new Date(row.expires),
    };
  }

  async deleteSession(sessionToken: string): Promise<void> {
    this.db.prepare(
      `DELETE FROM auth_sessions
       WHERE session_token = ?`
    ).run(sessionToken);
  }

  async createVerificationToken(token: import('../auth-adapter').AuthVerificationToken): Promise<import('../auth-adapter').AuthVerificationToken> {
    this.db.prepare(
      `INSERT INTO auth_verification_tokens (identifier, token, expires)
       VALUES (?, ?, ?)`
    ).run(
      token.identifier,
      token.token,
      token.expires.toISOString()
    );

    return token;
  }

  async useVerificationToken(identifier: string, token: string): Promise<import('../auth-adapter').AuthVerificationToken | null> {
    const row = this.db.prepare(
      `SELECT identifier, token, expires
       FROM auth_verification_tokens
       WHERE identifier = ? AND token = ? AND datetime(expires) > datetime('now')`
    ).get(identifier, token) as any;

    if (!row) {
      return null;
    }

    // Delete the token after retrieving it (one-time use)
    this.db.prepare(
      `DELETE FROM auth_verification_tokens
       WHERE identifier = ? AND token = ?`
    ).run(identifier, token);

    return {
      identifier: row.identifier,
      token: row.token,
      expires: new Date(row.expires),
    };
  }

  // ===== Schedule State Operations =====

  async getScheduleState(accountId: string): Promise<ScheduleState | null> {
    const row = this.db.prepare(
      `SELECT account_id, last_checked_at, next_check_at, check_interval_hours,
              consecutive_zero_count, last_balance, updated_at
       FROM schedule_state WHERE account_id = ?`
    ).get(accountId) as any;
    if (!row) return null;
    return {
      accountId: row.account_id,
      lastCheckedAt: row.last_checked_at ? new Date(row.last_checked_at) : null,
      nextCheckAt: new Date(row.next_check_at),
      checkIntervalHours: row.check_interval_hours,
      consecutiveZeroCount: row.consecutive_zero_count,
      lastBalance: row.last_balance,
      updatedAt: new Date(row.updated_at),
    };
  }

  async upsertScheduleState(state: Partial<ScheduleState> & { accountId: string }): Promise<void> {
    const now = new Date().toISOString();
    const existing = await this.getScheduleState(state.accountId);
    if (existing) {
      this.db.prepare(
        `UPDATE schedule_state SET
           last_checked_at = ?, next_check_at = ?, check_interval_hours = ?,
           consecutive_zero_count = ?, last_balance = ?, updated_at = ?
         WHERE account_id = ?`
      ).run(
        (state.lastCheckedAt ?? existing.lastCheckedAt)?.toISOString() ?? null,
        (state.nextCheckAt ?? existing.nextCheckAt).toISOString(),
        state.checkIntervalHours ?? existing.checkIntervalHours,
        state.consecutiveZeroCount ?? existing.consecutiveZeroCount,
        state.lastBalance ?? existing.lastBalance ?? null,
        now,
        state.accountId,
      );
    } else {
      this.db.prepare(
        `INSERT INTO schedule_state (account_id, last_checked_at, next_check_at, check_interval_hours, consecutive_zero_count, last_balance, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        state.accountId,
        state.lastCheckedAt?.toISOString() ?? null,
        (state.nextCheckAt ?? new Date()).toISOString(),
        state.checkIntervalHours ?? 24,
        state.consecutiveZeroCount ?? 0,
        state.lastBalance ?? null,
        now,
      );
    }
  }

  async getAccountsDueForCheck(asOf?: Date): Promise<Array<{ accountId: string; userId: string }>> {
    const checkTime = (asOf ?? new Date()).toISOString();
    const rows = this.db.prepare(
      `SELECT a.account_id, a.user_id
       FROM accounts a
       LEFT JOIN schedule_state ss ON a.account_id = ss.account_id
       WHERE a.enabled = 1
         AND (ss.account_id IS NULL OR datetime(ss.next_check_at) <= datetime(?))
       ORDER BY ss.next_check_at ASC`
    ).all(checkTime) as any[];
    return rows.map(row => ({ accountId: row.account_id, userId: row.user_id }));
  }

  // ===== Telegram Link Token Operations =====

  async createTelegramLinkToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    this.db.prepare(
      `INSERT INTO telegram_link_tokens (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`
    ).run(token, userId, new Date().toISOString(), expiresAt.toISOString());
  }

  async getTelegramLinkToken(token: string): Promise<TelegramLinkToken | null> {
    const row = this.db.prepare(
      `SELECT token, user_id, created_at, expires_at, used
       FROM telegram_link_tokens
       WHERE token = ? AND used = 0 AND datetime(expires_at) > datetime('now')`
    ).get(token) as any;
    if (!row) return null;
    return {
      token: row.token,
      userId: row.user_id,
      createdAt: new Date(row.created_at),
      expiresAt: new Date(row.expires_at),
      used: row.used === 1,
    };
  }

  async markTelegramLinkTokenUsed(token: string): Promise<void> {
    this.db.prepare(`UPDATE telegram_link_tokens SET used = 1 WHERE token = ?`).run(token);
  }

  async cleanExpiredTelegramLinkTokens(): Promise<void> {
    this.db.prepare(
      `DELETE FROM telegram_link_tokens WHERE datetime(expires_at) < datetime('now') OR used = 1`
    ).run();
  }

  // ===== User Lookup =====

  async getUserByTelegramChatId(chatId: string): Promise<User | null> {
    const row = this.db.prepare(
      `SELECT user_id, email, name, image, email_verified, created_at, updated_at,
              ntfy_feed_url, ntfy_server_url, notification_enabled,
              telegram_chat_id, telegram_enabled, notification_channel
       FROM users WHERE telegram_chat_id = ?`
    ).get(chatId) as any;
    return row ? this.mapRowToUser(row) : null;
  }

  async getAllUserIds(): Promise<string[]> {
    const rows = this.db.prepare(`SELECT user_id FROM users`).all() as any[];
    return rows.map(row => row.user_id);
  }

  /**
   * Close the database connection
   * Should be called when shutting down the application
   */
  close(): void {
    this.db.close();
  }
}
