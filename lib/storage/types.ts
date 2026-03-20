/**
 * Data model interfaces for the Georgia Utility Monitor
 * These interfaces define the structure of data stored across all storage backends
 */

/**
 * User model - represents a user of the system with OAuth fields
 */
export interface User {
  userId: string; // UUID
  email: string; // From OAuth provider
  name: string; // From OAuth provider
  image?: string; // Profile picture URL from OAuth provider
  emailVerified: Date | null; // OAuth verification timestamp
  createdAt: Date;
  updatedAt: Date;
  ntfyFeedUrl: string; // encrypted
  ntfyServerUrl: string; // default: https://ntfy.sh
  notificationEnabled: boolean;
  telegramChatId?: string;
  telegramEnabled: boolean;
  notificationChannel: 'ntfy' | 'telegram' | 'both';
}

/**
 * Telegram link token - short-lived token for linking Telegram account
 */
export interface TelegramLinkToken {
  token: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
  used: boolean;
}

/**
 * Account model - represents a utility account for a user
 */
export interface Account {
  accountId: string; // UUID
  userId: string; // foreign key to User
  providerType: 'gas' | 'water' | 'electricity' | 'trash';
  providerName: string; // e.g., "te.ge"
  accountNumber: string; // encrypted
  createdAt: Date;
  updatedAt: Date;
  enabled: boolean; // allow disabling without deleting
}

/**
 * Balance model - represents a balance check result
 */
export interface Balance {
  balanceId: string; // UUID
  accountId: string; // foreign key to Account
  balance: number; // in Georgian Lari (₾)
  currency: string; // "GEL"
  checkedAt: Date;
  success: boolean;
  error?: string;
  rawResponse?: string; // for debugging failed parses
}

/**
 * Notification model - represents a sent notification
 */
export interface Notification {
  notificationId: string; // UUID
  userId: string;
  accountId: string;
  sentAt: Date;
  priority: 'default' | 'high' | 'urgent';
  message: string;
  deliverySuccess: boolean;
  deliveryError?: string;
}

/**
 * Overdue tracking model - tracks how long a balance has been non-zero
 */
export interface OverdueTracking {
  accountId: string;
  overdueDays: number;
  firstNonZeroDate: Date;
  lastCheckedDate: Date;
}

/**
 * Check attempt model - tracks provider check attempts for metrics
 */
export interface CheckAttempt {
  attemptId: string; // UUID
  accountId: string;
  providerName: string;
  attemptedAt: Date;
  success: boolean;
  error?: string;
  responseTime: number; // milliseconds
}

/**
 * Schedule state model - tracks per-account smart scheduling
 */
export interface ScheduleState {
  accountId: string;
  lastCheckedAt: Date | null;
  nextCheckAt: Date;
  checkIntervalHours: number;
  consecutiveZeroCount: number;
  lastBalance: number | null;
  updatedAt: Date;
}

/**
 * Migration status model - tracks applied migrations
 */
export interface MigrationStatus {
  appliedMigrations: string[];
  pendingMigrations: string[];
}

/**
 * Partial data types for create/update operations
 */
export type UserData = Omit<User, 'createdAt' | 'updatedAt' | 'telegramChatId' | 'telegramEnabled' | 'notificationChannel'> & {
  userId?: string;
  telegramChatId?: string;
  telegramEnabled?: boolean;
  notificationChannel?: 'ntfy' | 'telegram' | 'both';
};
export type AccountData = Omit<Account, 'accountId' | 'createdAt' | 'updatedAt'>;
export type BalanceData = Omit<Balance, 'balanceId'>;
export type NotificationData = Omit<Notification, 'notificationId'>;

/**
 * StorageAdapter interface - unified interface for all storage backends
 * Supports Redis, Postgres, and SQLite with identical behavior
 * 
 * Validates Requirements: 1.6, 2.6, 3.5, 20.1
 */
export interface StorageAdapter {
  // ===== User Operations =====
  
  /**
   * Create a new user
   * @param userData - User data without userId, createdAt, updatedAt
   * @returns The generated userId
   */
  createUser(userData: UserData): Promise<string>;
  
  /**
   * Get a user by ID
   * @param userId - The user's unique identifier
   * @returns The user data or null if not found
   */
  getUser(userId: string): Promise<User | null>;
  
  /**
   * Update a user's data
   * @param userId - The user's unique identifier
   * @param userData - Partial user data to update
   */
  updateUser(userId: string, userData: Partial<UserData>): Promise<void>;
  
  /**
   * Delete a user and all associated data
   * @param userId - The user's unique identifier
   */
  deleteUser(userId: string): Promise<void>;
  
  // ===== Account Operations =====
  
  /**
   * Create a new account
   * @param accountData - Account data without accountId, createdAt, updatedAt
   * @returns The generated accountId
   */
  createAccount(accountData: AccountData): Promise<string>;
  
  /**
   * Get an account by ID
   * @param accountId - The account's unique identifier
   * @returns The account data or null if not found
   */
  getAccount(accountId: string): Promise<Account | null>;
  
  /**
   * Get all accounts for a user
   * @param userId - The user's unique identifier
   * @returns Array of accounts belonging to the user
   */
  getAccountsByUser(userId: string): Promise<Account[]>;
  
  /**
   * Update an account's data
   * @param accountId - The account's unique identifier
   * @param accountData - Partial account data to update
   */
  updateAccount(accountId: string, accountData: Partial<AccountData>): Promise<void>;
  
  /**
   * Delete an account and all associated data
   * @param accountId - The account's unique identifier
   */
  deleteAccount(accountId: string): Promise<void>;
  
  // ===== Balance Operations =====
  
  /**
   * Record a balance check result
   * @param balanceData - Balance data without balanceId
   */
  recordBalance(balanceData: BalanceData): Promise<void>;
  
  /**
   * Get the most recent balance for an account
   * @param accountId - The account's unique identifier
   * @returns The latest balance data or null if no balance exists
   */
  getLatestBalance(accountId: string): Promise<Balance | null>;
  
  /**
   * Get balance history for an account
   * @param accountId - The account's unique identifier
   * @param days - Number of days of history to retrieve
   * @returns Array of balance records ordered by checkedAt descending
   */
  getBalanceHistory(accountId: string, days: number): Promise<Balance[]>;
  
  // ===== Notification Operations =====
  
  /**
   * Record a notification delivery attempt
   * @param notificationData - Notification data without notificationId
   */
  recordNotification(notificationData: NotificationData): Promise<void>;
  
  /**
   * Get notification history for a user
   * @param userId - The user's unique identifier
   * @param limit - Maximum number of notifications to retrieve
   * @returns Array of notifications ordered by sentAt descending
   */
  getNotificationHistory(userId: string, limit: number): Promise<Notification[]>;
  
  // ===== Overdue Tracking Operations =====
  
  /**
   * Increment the overdue day counter for an account
   * @param accountId - The account's unique identifier
   * @returns The new overdue day count
   */
  incrementOverdueDays(accountId: string): Promise<number>;
  
  /**
   * Reset the overdue day counter for an account (when balance returns to zero)
   * @param accountId - The account's unique identifier
   */
  resetOverdueDays(accountId: string): Promise<void>;
  
  /**
   * Get the current overdue day count for an account
   * @param accountId - The account's unique identifier
   * @returns The number of days the balance has been non-zero
   */
  getOverdueDays(accountId: string): Promise<number>;
  
  // ===== Health and Metrics Operations =====
  
  /**
   * Calculate the success rate for a provider over a time period
   * @param providerName - The provider's name
   * @param days - Number of days to calculate over
   * @returns Success rate as a decimal (0.0 to 1.0)
   */
  getProviderSuccessRate(providerName: string, days: number): Promise<number>;
  
  /**
   * Record a balance check attempt for metrics
   * @param accountId - The account's unique identifier
   * @param success - Whether the check succeeded
   * @param error - Error message if the check failed
   */
  recordCheckAttempt(accountId: string, success: boolean, error?: string): Promise<void>;
  
  // ===== Schedule State Operations =====

  getScheduleState(accountId: string): Promise<ScheduleState | null>;
  upsertScheduleState(state: Partial<ScheduleState> & { accountId: string }): Promise<void>;
  getAccountsDueForCheck(asOf?: Date): Promise<Array<{ accountId: string; userId: string }>>;

  // ===== Telegram Link Token Operations =====

  createTelegramLinkToken(userId: string, token: string, expiresAt: Date): Promise<void>;
  getTelegramLinkToken(token: string): Promise<TelegramLinkToken | null>;
  markTelegramLinkTokenUsed(token: string): Promise<void>;
  cleanExpiredTelegramLinkTokens(): Promise<void>;

  // ===== User Lookup =====

  getUserByTelegramChatId(chatId: string): Promise<User | null>;
  getAllUserIds(): Promise<string[]>;

  // ===== Migration Operations =====
  
  /**
   * Run pending migrations for the storage backend
   */
  runMigrations(): Promise<void>;
  
  /**
   * Get the current migration status
   * @returns Status showing applied and pending migrations
   */
  getMigrationStatus(): Promise<MigrationStatus>;
}
