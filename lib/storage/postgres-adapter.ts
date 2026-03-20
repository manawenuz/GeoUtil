import { Pool, PoolClient } from 'pg';
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

const USER_COLUMNS = 'user_id, email, name, image, email_verified, created_at, updated_at, ntfy_feed_url, ntfy_server_url, notification_enabled, telegram_chat_id, telegram_enabled, notification_channel';

/**
 * PostgresAdapter - Storage adapter implementation for PostgreSQL
 * 
 * Uses connection pooling for efficient database access
 * All queries use parameterized statements for security
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
export class PostgresAdapter implements StorageAdapter {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Create a PostgresAdapter from a connection string
   */
  static fromConnectionString(connectionString: string): PostgresAdapter {
    const pool = new Pool({
      connectionString,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    return new PostgresAdapter(pool);
  }

  // ===== User Operations =====

  async createUser(userData: UserData): Promise<string> {
    const userId = userData.userId || randomUUID();
    
    await this.pool.query(
      `INSERT INTO users (user_id, email, name, image, email_verified, ntfy_feed_url, ntfy_server_url, notification_enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        userId,
        userData.email,
        userData.name,
        userData.image || null,
        userData.emailVerified || null,
        userData.ntfyFeedUrl,
        userData.ntfyServerUrl,
        userData.notificationEnabled
      ]
    );

    return userId;
  }

  async getUser(userId: string): Promise<User | null> {
    const result = await this.pool.query(
      `SELECT user_id, email, name, image, email_verified, created_at, updated_at,
              ntfy_feed_url, ntfy_server_url, notification_enabled,
              telegram_chat_id, telegram_enabled, notification_channel
       FROM users
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToUser(result.rows[0]);
  }

  private mapRowToUser(row: Record<string, unknown>): User {
    return {
      userId: row.user_id as string,
      email: row.email as string,
      name: row.name as string,
      image: row.image as string | undefined,
      emailVerified: row.email_verified as Date | null,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
      ntfyFeedUrl: row.ntfy_feed_url as string,
      ntfyServerUrl: row.ntfy_server_url as string,
      notificationEnabled: row.notification_enabled as boolean,
      telegramChatId: row.telegram_chat_id as string | undefined,
      telegramEnabled: (row.telegram_enabled as boolean) ?? false,
      notificationChannel: (row.notification_channel as 'ntfy' | 'telegram' | 'both') ?? 'ntfy',
    };
  }

  async updateUser(userId: string, userData: Partial<UserData>): Promise<void> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (userData.ntfyFeedUrl !== undefined) {
      updates.push(`ntfy_feed_url = $${paramIndex++}`);
      values.push(userData.ntfyFeedUrl);
    }
    if (userData.ntfyServerUrl !== undefined) {
      updates.push(`ntfy_server_url = $${paramIndex++}`);
      values.push(userData.ntfyServerUrl);
    }
    if (userData.notificationEnabled !== undefined) {
      updates.push(`notification_enabled = $${paramIndex++}`);
      values.push(userData.notificationEnabled);
    }
    if (userData.telegramChatId !== undefined) {
      updates.push(`telegram_chat_id = $${paramIndex++}`);
      values.push(userData.telegramChatId);
    }
    if (userData.telegramEnabled !== undefined) {
      updates.push(`telegram_enabled = $${paramIndex++}`);
      values.push(userData.telegramEnabled);
    }
    if (userData.notificationChannel !== undefined) {
      updates.push(`notification_channel = $${paramIndex++}`);
      values.push(userData.notificationChannel);
    }

    if (updates.length === 0) {
      return;
    }

    updates.push(`updated_at = NOW()`);
    values.push(userId);

    await this.pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE user_id = $${paramIndex}`,
      values
    );
  }

  async deleteUser(userId: string): Promise<void> {
    // Cascade delete will handle accounts, balances, notifications, etc.
    await this.pool.query('DELETE FROM users WHERE user_id = $1', [userId]);
  }

  // ===== Account Operations =====

  async createAccount(accountData: AccountData): Promise<string> {
    const accountId = randomUUID();
    
    await this.pool.query(
      `INSERT INTO accounts (account_id, user_id, provider_type, provider_name, account_number, enabled)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        accountId,
        accountData.userId,
        accountData.providerType,
        accountData.providerName,
        accountData.accountNumber,
        accountData.enabled,
      ]
    );

    return accountId;
  }

  async getAccount(accountId: string): Promise<Account | null> {
    const result = await this.pool.query(
      `SELECT account_id, user_id, provider_type, provider_name, account_number, 
              created_at, updated_at, enabled
       FROM accounts
       WHERE account_id = $1`,
      [accountId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      accountId: row.account_id,
      userId: row.user_id,
      providerType: row.provider_type,
      providerName: row.provider_name,
      accountNumber: row.account_number,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      enabled: row.enabled,
    };
  }

  async getAccountsByUser(userId: string): Promise<Account[]> {
    const result = await this.pool.query(
      `SELECT account_id, user_id, provider_type, provider_name, account_number,
              created_at, updated_at, enabled
       FROM accounts
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    return result.rows.map(row => ({
      accountId: row.account_id,
      userId: row.user_id,
      providerType: row.provider_type,
      providerName: row.provider_name,
      accountNumber: row.account_number,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      enabled: row.enabled,
    }));
  }

  async updateAccount(accountId: string, accountData: Partial<AccountData>): Promise<void> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (accountData.providerType !== undefined) {
      updates.push(`provider_type = $${paramIndex++}`);
      values.push(accountData.providerType);
    }
    if (accountData.providerName !== undefined) {
      updates.push(`provider_name = $${paramIndex++}`);
      values.push(accountData.providerName);
    }
    if (accountData.accountNumber !== undefined) {
      updates.push(`account_number = $${paramIndex++}`);
      values.push(accountData.accountNumber);
    }
    if (accountData.enabled !== undefined) {
      updates.push(`enabled = $${paramIndex++}`);
      values.push(accountData.enabled);
    }

    if (updates.length === 0) {
      return;
    }

    updates.push(`updated_at = NOW()`);
    values.push(accountId);

    await this.pool.query(
      `UPDATE accounts SET ${updates.join(', ')} WHERE account_id = $${paramIndex}`,
      values
    );
  }

  async deleteAccount(accountId: string): Promise<void> {
    // Cascade delete will handle balances, overdue_tracking, etc.
    await this.pool.query('DELETE FROM accounts WHERE account_id = $1', [accountId]);
  }

  // ===== Balance Operations =====

  async recordBalance(balanceData: BalanceData): Promise<void> {
    const balanceId = randomUUID();
    
    await this.pool.query(
      `INSERT INTO balances (balance_id, account_id, balance, currency, checked_at, success, error, raw_response)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        balanceId,
        balanceData.accountId,
        balanceData.balance,
        balanceData.currency,
        balanceData.checkedAt,
        balanceData.success,
        balanceData.error || null,
        balanceData.rawResponse || null,
      ]
    );
  }

  async getLatestBalance(accountId: string): Promise<Balance | null> {
    const result = await this.pool.query(
      `SELECT balance_id, account_id, balance, currency, checked_at, success, error, raw_response
       FROM balances
       WHERE account_id = $1
       ORDER BY checked_at DESC
       LIMIT 1`,
      [accountId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      balanceId: row.balance_id,
      accountId: row.account_id,
      balance: parseFloat(row.balance),
      currency: row.currency,
      checkedAt: row.checked_at,
      success: row.success,
      error: row.error || undefined,
      rawResponse: row.raw_response || undefined,
    };
  }

  async getBalanceHistory(accountId: string, days: number): Promise<Balance[]> {
    const result = await this.pool.query(
      `SELECT balance_id, account_id, balance, currency, checked_at, success, error, raw_response
       FROM balances
       WHERE account_id = $1 AND checked_at >= NOW() - INTERVAL '1 day' * $2
       ORDER BY checked_at DESC`,
      [accountId, days]
    );

    return result.rows.map(row => ({
      balanceId: row.balance_id,
      accountId: row.account_id,
      balance: parseFloat(row.balance),
      currency: row.currency,
      checkedAt: row.checked_at,
      success: row.success,
      error: row.error || undefined,
      rawResponse: row.raw_response || undefined,
    }));
  }

  // ===== Notification Operations =====

  async recordNotification(notificationData: NotificationData): Promise<void> {
    const notificationId = randomUUID();
    
    await this.pool.query(
      `INSERT INTO notifications (notification_id, user_id, account_id, sent_at, priority, message, delivery_success, delivery_error)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        notificationId,
        notificationData.userId,
        notificationData.accountId,
        notificationData.sentAt,
        notificationData.priority,
        notificationData.message,
        notificationData.deliverySuccess,
        notificationData.deliveryError || null,
      ]
    );
  }

  async getNotificationHistory(userId: string, limit: number): Promise<Notification[]> {
    const result = await this.pool.query(
      `SELECT notification_id, user_id, account_id, sent_at, priority, message, delivery_success, delivery_error
       FROM notifications
       WHERE user_id = $1
       ORDER BY sent_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows.map(row => ({
      notificationId: row.notification_id,
      userId: row.user_id,
      accountId: row.account_id,
      sentAt: row.sent_at,
      priority: row.priority,
      message: row.message,
      deliverySuccess: row.delivery_success,
      deliveryError: row.delivery_error || undefined,
    }));
  }

  // ===== Overdue Tracking Operations =====

  async incrementOverdueDays(accountId: string): Promise<number> {
    const client: PoolClient = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check if overdue tracking exists
      const checkResult = await client.query(
        'SELECT overdue_days FROM overdue_tracking WHERE account_id = $1',
        [accountId]
      );

      let newCount: number;

      if (checkResult.rows.length === 0) {
        // First time tracking overdue - initialize
        await client.query(
          `INSERT INTO overdue_tracking (account_id, overdue_days, first_non_zero_date, last_checked_date)
           VALUES ($1, 1, NOW(), NOW())`,
          [accountId]
        );
        newCount = 1;
      } else {
        // Increment overdue days
        const updateResult = await client.query(
          `UPDATE overdue_tracking 
           SET overdue_days = overdue_days + 1, last_checked_date = NOW()
           WHERE account_id = $1
           RETURNING overdue_days`,
          [accountId]
        );
        newCount = updateResult.rows[0].overdue_days;
      }

      await client.query('COMMIT');
      return newCount;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async resetOverdueDays(accountId: string): Promise<void> {
    await this.pool.query('DELETE FROM overdue_tracking WHERE account_id = $1', [accountId]);
  }

  async getOverdueDays(accountId: string): Promise<number> {
    const result = await this.pool.query(
      'SELECT overdue_days FROM overdue_tracking WHERE account_id = $1',
      [accountId]
    );

    if (result.rows.length === 0) {
      return 0;
    }

    return result.rows[0].overdue_days;
  }

  // ===== Health and Metrics Operations =====

  async getProviderSuccessRate(providerName: string, days: number): Promise<number> {
    const result = await this.pool.query(
      `SELECT 
         COUNT(*) FILTER (WHERE success = true) as success_count,
         COUNT(*) as total_count
       FROM check_attempts
       WHERE provider_name = $1 AND attempted_at >= NOW() - INTERVAL '1 day' * $2`,
      [providerName, days]
    );

    const row = result.rows[0];
    const totalCount = parseInt(row.total_count, 10);

    if (totalCount === 0) {
      return 1.0; // No data means 100% success rate (no failures)
    }

    const successCount = parseInt(row.success_count, 10);
    return successCount / totalCount;
  }

  async recordCheckAttempt(accountId: string, success: boolean, error?: string): Promise<void> {
    // Get account to find provider name
    const account = await this.getAccount(accountId);
    
    if (!account) {
      return;
    }

    const attemptId = randomUUID();
    
    await this.pool.query(
      `INSERT INTO check_attempts (attempt_id, account_id, provider_name, attempted_at, success, error, response_time)
       VALUES ($1, $2, $3, NOW(), $4, $5, 0)`,
      [attemptId, accountId, account.providerName, success, error || null]
    );
  }

  // ===== Migration Operations =====

  async runMigrations(): Promise<void> {
    // Migrations are handled by the migration script (scripts/migrate.js)
    // This method is a no-op for Postgres as migrations are run externally
    // to support both development and production environments
  }

  async getMigrationStatus(): Promise<MigrationStatus> {
    // Check if migrations table exists
    const tableCheck = await this.pool.query(
      `SELECT EXISTS (
         SELECT FROM information_schema.tables 
         WHERE table_name = 'migrations'
       )`
    );

    if (!tableCheck.rows[0].exists) {
      return {
        appliedMigrations: [],
        pendingMigrations: ['migrations_table_not_found'],
      };
    }

    // Get applied migrations
    const result = await this.pool.query(
      'SELECT migration_name FROM migrations ORDER BY migration_id'
    );

    const appliedMigrations = result.rows.map(row => row.migration_name);

    // We don't track pending migrations in the adapter
    // That's handled by the migration script
    return {
      appliedMigrations,
      pendingMigrations: [],
    };
  }

  // ===== Schedule State Operations =====

  async getScheduleState(accountId: string): Promise<ScheduleState | null> {
    const result = await this.pool.query(
      `SELECT account_id, last_checked_at, next_check_at, check_interval_hours,
              consecutive_zero_count, last_balance, updated_at
       FROM schedule_state WHERE account_id = $1`,
      [accountId]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      accountId: row.account_id,
      lastCheckedAt: row.last_checked_at,
      nextCheckAt: row.next_check_at,
      checkIntervalHours: row.check_interval_hours,
      consecutiveZeroCount: row.consecutive_zero_count,
      lastBalance: row.last_balance !== null ? parseFloat(row.last_balance) : null,
      updatedAt: row.updated_at,
    };
  }

  async upsertScheduleState(state: Partial<ScheduleState> & { accountId: string }): Promise<void> {
    await this.pool.query(
      `INSERT INTO schedule_state (account_id, last_checked_at, next_check_at, check_interval_hours, consecutive_zero_count, last_balance, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (account_id) DO UPDATE SET
         last_checked_at = COALESCE($2, schedule_state.last_checked_at),
         next_check_at = COALESCE($3, schedule_state.next_check_at),
         check_interval_hours = COALESCE($4, schedule_state.check_interval_hours),
         consecutive_zero_count = COALESCE($5, schedule_state.consecutive_zero_count),
         last_balance = COALESCE($6, schedule_state.last_balance),
         updated_at = NOW()`,
      [
        state.accountId,
        state.lastCheckedAt ?? null,
        state.nextCheckAt ?? new Date(),
        state.checkIntervalHours ?? 24,
        state.consecutiveZeroCount ?? 0,
        state.lastBalance ?? null,
      ]
    );
  }

  async getAccountsDueForCheck(asOf?: Date): Promise<Array<{ accountId: string; userId: string }>> {
    const checkTime = asOf ?? new Date();
    const result = await this.pool.query(
      `SELECT a.account_id, a.user_id
       FROM accounts a
       LEFT JOIN schedule_state ss ON a.account_id = ss.account_id
       WHERE a.enabled = true
         AND (ss.account_id IS NULL OR ss.next_check_at <= $1)
       ORDER BY ss.next_check_at ASC NULLS FIRST`,
      [checkTime]
    );
    return result.rows.map(row => ({ accountId: row.account_id, userId: row.user_id }));
  }

  // ===== Telegram Link Token Operations =====

  async createTelegramLinkToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    await this.pool.query(
      `INSERT INTO telegram_link_tokens (token, user_id, expires_at) VALUES ($1, $2, $3)`,
      [token, userId, expiresAt]
    );
  }

  async getTelegramLinkToken(token: string): Promise<TelegramLinkToken | null> {
    const result = await this.pool.query(
      `SELECT token, user_id, created_at, expires_at, used
       FROM telegram_link_tokens
       WHERE token = $1 AND used = false AND expires_at > NOW()`,
      [token]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      token: row.token,
      userId: row.user_id,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      used: row.used,
    };
  }

  async markTelegramLinkTokenUsed(token: string): Promise<void> {
    await this.pool.query(
      `UPDATE telegram_link_tokens SET used = true WHERE token = $1`,
      [token]
    );
  }

  async cleanExpiredTelegramLinkTokens(): Promise<void> {
    await this.pool.query(
      `DELETE FROM telegram_link_tokens WHERE expires_at < NOW() OR used = true`
    );
  }

  // ===== User Lookup =====

  async getUserByTelegramChatId(chatId: string): Promise<User | null> {
    const result = await this.pool.query(
      `SELECT ${USER_COLUMNS} FROM users WHERE telegram_chat_id = $1`,
      [chatId]
    );
    return result.rows.length === 0 ? null : this.mapRowToUser(result.rows[0]);
  }

  async getAllUserIds(): Promise<string[]> {
    const result = await this.pool.query(`SELECT user_id FROM users`);
    return result.rows.map(row => row.user_id);
  }

  /**
   * Close the connection pool
   * Should be called when shutting down the application
   */
  async close(): Promise<void> {
    await this.pool.end();
  }

  // ===== NextAuth-Specific Operations =====

  async createAuthUser(userData: Omit<import('../auth-adapter').AuthUser, 'userId' | 'createdAt' | 'updatedAt'>): Promise<import('../auth-adapter').AuthUser> {
    const result = await this.pool.query(
      `INSERT INTO users (email, name, image, email_verified, ntfy_feed_url, ntfy_server_url, notification_enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${USER_COLUMNS}`,
      [
        userData.email,
        userData.name,
        userData.image || null,
        userData.emailVerified || null,
        userData.ntfyFeedUrl,
        userData.ntfyServerUrl,
        userData.notificationEnabled,
      ]
    );

    return this.mapRowToUser(result.rows[0]);
  }

  async getAuthUser(userId: string): Promise<import('../auth-adapter').AuthUser | null> {
    const result = await this.pool.query(
      `SELECT ${USER_COLUMNS} FROM users WHERE user_id = $1`,
      [userId]
    );
    return result.rows.length === 0 ? null : this.mapRowToUser(result.rows[0]);
  }

  async getAuthUserByEmail(email: string): Promise<import('../auth-adapter').AuthUser | null> {
    const result = await this.pool.query(
      `SELECT ${USER_COLUMNS} FROM users WHERE email = $1`,
      [email]
    );
    return result.rows.length === 0 ? null : this.mapRowToUser(result.rows[0]);
  }

  async getAuthUserByAccount(provider: string, providerAccountId: string): Promise<import('../auth-adapter').AuthUser | null> {
    const result = await this.pool.query(
      `SELECT ${USER_COLUMNS.split(', ').map(c => `u.${c}`).join(', ')}
       FROM users u
       INNER JOIN auth_accounts a ON u.user_id = a.user_id
       WHERE a.provider = $1 AND a.provider_account_id = $2`,
      [provider, providerAccountId]
    );
    return result.rows.length === 0 ? null : this.mapRowToUser(result.rows[0]);
  }

  async updateAuthUser(userId: string, userData: Partial<import('../auth-adapter').AuthUser>): Promise<import('../auth-adapter').AuthUser> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (userData.email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      values.push(userData.email);
    }
    if (userData.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(userData.name);
    }
    if (userData.image !== undefined) {
      updates.push(`image = $${paramIndex++}`);
      values.push(userData.image || null);
    }
    if (userData.emailVerified !== undefined) {
      updates.push(`email_verified = $${paramIndex++}`);
      values.push(userData.emailVerified || null);
    }
    if (userData.ntfyFeedUrl !== undefined) {
      updates.push(`ntfy_feed_url = $${paramIndex++}`);
      values.push(userData.ntfyFeedUrl);
    }
    if (userData.ntfyServerUrl !== undefined) {
      updates.push(`ntfy_server_url = $${paramIndex++}`);
      values.push(userData.ntfyServerUrl);
    }
    if (userData.notificationEnabled !== undefined) {
      updates.push(`notification_enabled = $${paramIndex++}`);
      values.push(userData.notificationEnabled);
    }

    updates.push(`updated_at = NOW()`);
    values.push(userId);

    const result = await this.pool.query(
      `UPDATE users
       SET ${updates.join(', ')}
       WHERE user_id = $${paramIndex}
       RETURNING ${USER_COLUMNS}`,
      values
    );

    return this.mapRowToUser(result.rows[0]);
  }

  async linkAccount(account: Omit<import('../auth-adapter').AuthAccount, 'id'>): Promise<import('../auth-adapter').AuthAccount> {
    const result = await this.pool.query(
      `INSERT INTO auth_accounts (user_id, type, provider, provider_account_id, refresh_token, access_token, expires_at, token_type, scope, id_token, session_state)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, user_id, type, provider, provider_account_id, refresh_token, access_token, expires_at, token_type, scope, id_token, session_state`,
      [
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
        account.session_state || null,
      ]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      provider: row.provider,
      providerAccountId: row.provider_account_id,
      refresh_token: row.refresh_token,
      access_token: row.access_token,
      expires_at: row.expires_at,
      token_type: row.token_type,
      scope: row.scope,
      id_token: row.id_token,
      session_state: row.session_state,
    };
  }

  async unlinkAccount(provider: string, providerAccountId: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM auth_accounts
       WHERE provider = $1 AND provider_account_id = $2`,
      [provider, providerAccountId]
    );
  }

  async createSession(session: Omit<import('../auth-adapter').AuthSession, 'id'>): Promise<import('../auth-adapter').AuthSession> {
    const result = await this.pool.query(
      `INSERT INTO auth_sessions (session_token, user_id, expires)
       VALUES ($1, $2, $3)
       RETURNING id, session_token, user_id, expires`,
      [session.sessionToken, session.userId, session.expires]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      sessionToken: row.session_token,
      userId: row.user_id,
      expires: row.expires,
    };
  }

  async getSessionAndUser(sessionToken: string): Promise<{ session: import('../auth-adapter').AuthSession; user: import('../auth-adapter').AuthUser } | null> {
    const result = await this.pool.query(
      `SELECT 
         s.id, s.session_token, s.user_id, s.expires,
         u.user_id, u.email, u.name, u.image, u.email_verified, u.created_at, u.updated_at, u.ntfy_feed_url, u.ntfy_server_url, u.notification_enabled
       FROM auth_sessions s
       INNER JOIN users u ON s.user_id = u.user_id
       WHERE s.session_token = $1 AND s.expires > NOW()`,
      [sessionToken]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      session: {
        id: row.id,
        sessionToken: row.session_token,
        userId: row.user_id,
        expires: row.expires,
      },
      user: {
        userId: row.user_id,
        email: row.email,
        name: row.name,
        image: row.image,
        emailVerified: row.email_verified,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        ntfyFeedUrl: row.ntfy_feed_url,
        ntfyServerUrl: row.ntfy_server_url,
        notificationEnabled: row.notification_enabled,
      },
    };
  }

  async updateSession(sessionToken: string, session: Partial<import('../auth-adapter').AuthSession>): Promise<import('../auth-adapter').AuthSession | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (session.expires !== undefined) {
      updates.push(`expires = $${paramIndex++}`);
      values.push(session.expires);
    }

    if (updates.length === 0) {
      // No updates to make, just return the existing session
      const result = await this.pool.query(
        `SELECT id, session_token, user_id, expires
         FROM auth_sessions
         WHERE session_token = $1`,
        [sessionToken]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        sessionToken: row.session_token,
        userId: row.user_id,
        expires: row.expires,
      };
    }

    values.push(sessionToken);

    const result = await this.pool.query(
      `UPDATE auth_sessions
       SET ${updates.join(', ')}
       WHERE session_token = $${paramIndex}
       RETURNING id, session_token, user_id, expires`,
      values
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      sessionToken: row.session_token,
      userId: row.user_id,
      expires: row.expires,
    };
  }

  async deleteSession(sessionToken: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM auth_sessions
       WHERE session_token = $1`,
      [sessionToken]
    );
  }

  async createVerificationToken(token: import('../auth-adapter').AuthVerificationToken): Promise<import('../auth-adapter').AuthVerificationToken> {
    await this.pool.query(
      `INSERT INTO auth_verification_tokens (identifier, token, expires)
       VALUES ($1, $2, $3)`,
      [token.identifier, token.token, token.expires]
    );

    return token;
  }

  async useVerificationToken(identifier: string, token: string): Promise<import('../auth-adapter').AuthVerificationToken | null> {
    const result = await this.pool.query(
      `DELETE FROM auth_verification_tokens
       WHERE identifier = $1 AND token = $2 AND expires > NOW()
       RETURNING identifier, token, expires`,
      [identifier, token]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      identifier: row.identifier,
      token: row.token,
      expires: row.expires,
    };
  }
}
