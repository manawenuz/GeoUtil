import type { Adapter } from "next-auth/adapters";
import type { StorageAdapter } from "./storage/types";

/**
 * NextAuth Adapter for StorageAdapter
 * 
 * This adapter bridges NextAuth.js with our StorageAdapter interface,
 * enabling database-backed sessions across all storage backends
 * (Redis, Postgres, SQLite).
 * 
 * Validates Requirements: 14.4, 14.7
 */

// Extended User model for NextAuth OAuth
export interface AuthUser {
  userId: string;
  email: string;
  name: string;
  image?: string;
  emailVerified: Date | null;
  createdAt: Date;
  updatedAt: Date;
  ntfyFeedUrl: string;
  ntfyServerUrl: string;
  notificationEnabled: boolean;
  telegramChatId?: string;
  telegramEnabled: boolean;
  notificationChannel: 'ntfy' | 'telegram' | 'both';
}

// OAuth Account model
export interface AuthAccount {
  id: string;
  userId: string;
  type: string; // "oauth"
  provider: string; // "google"
  providerAccountId: string; // Google user ID
  refresh_token?: string;
  access_token?: string;
  expires_at?: number;
  token_type?: string;
  scope?: string;
  id_token?: string;
  session_state?: string;
}

// Session model
export interface AuthSession {
  id: string;
  sessionToken: string;
  userId: string;
  expires: Date;
}

// Verification token model
export interface AuthVerificationToken {
  identifier: string;
  token: string;
  expires: Date;
}

/**
 * Extended StorageAdapter interface with NextAuth-specific methods
 */
export interface AuthStorageAdapter extends StorageAdapter {
  // User operations with OAuth fields
  createAuthUser(userData: Omit<AuthUser, 'userId' | 'createdAt' | 'updatedAt'>): Promise<AuthUser>;
  getAuthUser(userId: string): Promise<AuthUser | null>;
  getAuthUserByEmail(email: string): Promise<AuthUser | null>;
  getAuthUserByAccount(provider: string, providerAccountId: string): Promise<AuthUser | null>;
  updateAuthUser(userId: string, userData: Partial<AuthUser>): Promise<AuthUser>;
  
  // Account operations
  linkAccount(account: Omit<AuthAccount, 'id'>): Promise<AuthAccount>;
  unlinkAccount(provider: string, providerAccountId: string): Promise<void>;
  
  // Session operations
  createSession(session: Omit<AuthSession, 'id'>): Promise<AuthSession>;
  getSessionAndUser(sessionToken: string): Promise<{ session: AuthSession; user: AuthUser } | null>;
  updateSession(sessionToken: string, session: Partial<AuthSession>): Promise<AuthSession | null>;
  deleteSession(sessionToken: string): Promise<void>;
  
  // Verification token operations
  createVerificationToken(token: AuthVerificationToken): Promise<AuthVerificationToken>;
  useVerificationToken(identifier: string, token: string): Promise<AuthVerificationToken | null>;
}

/**
 * Create a NextAuth adapter from a StorageAdapter
 * 
 * @param storage - The storage adapter instance (must implement AuthStorageAdapter)
 * @returns NextAuth Adapter
 */
export function createNextAuthAdapter(storage: AuthStorageAdapter): Adapter {
  return {
    // Create a new user
    async createUser(user: any) {
      const authUser = await storage.createAuthUser({
        email: user.email,
        name: user.name || "",
        image: user.image,
        emailVerified: user.emailVerified || null,
        ntfyFeedUrl: "",
        ntfyServerUrl: process.env.NTFY_SERVER_URL || "https://ntfy.sh",
        notificationEnabled: true,
        telegramEnabled: false,
        notificationChannel: 'telegram',
      });
      
      return {
        id: authUser.userId,
        email: authUser.email,
        emailVerified: authUser.emailVerified,
        name: authUser.name,
        image: authUser.image,
      };
    },

    // Get a user by ID
    async getUser(id) {
      const user = await storage.getAuthUser(id);
      if (!user) return null;
      
      return {
        id: user.userId,
        email: user.email,
        emailVerified: user.emailVerified,
        name: user.name,
        image: user.image,
      };
    },

    // Get a user by email
    async getUserByEmail(email) {
      const user = await storage.getAuthUserByEmail(email);
      if (!user) return null;
      
      return {
        id: user.userId,
        email: user.email,
        emailVerified: user.emailVerified,
        name: user.name,
        image: user.image,
      };
    },

    // Get a user by account (provider + providerAccountId)
    async getUserByAccount({ provider, providerAccountId }) {
      const user = await storage.getAuthUserByAccount(provider, providerAccountId);
      if (!user) return null;
      
      return {
        id: user.userId,
        email: user.email,
        emailVerified: user.emailVerified,
        name: user.name,
        image: user.image,
      };
    },

    // Update a user
    async updateUser(user) {
      const updated = await storage.updateAuthUser(user.id, {
        email: user.email,
        name: user.name,
        image: user.image,
        emailVerified: user.emailVerified,
      });
      
      return {
        id: updated.userId,
        email: updated.email,
        emailVerified: updated.emailVerified,
        name: updated.name,
        image: updated.image,
      };
    },

    // Delete a user
    async deleteUser(userId) {
      await storage.deleteUser(userId);
    },

    // Link an account to a user
    async linkAccount(account: any) {
      const linked = await storage.linkAccount({
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
      });
      
      return {
        ...linked,
        userId: linked.userId,
        type: linked.type as any,
      };
    },

    // Unlink an account from a user
    async unlinkAccount({ provider, providerAccountId }: any) {
      await storage.unlinkAccount(provider, providerAccountId);
    },

    // Create a session
    async createSession(session) {
      const created = await storage.createSession({
        sessionToken: session.sessionToken,
        userId: session.userId,
        expires: session.expires,
      });
      
      return {
        sessionToken: created.sessionToken,
        userId: created.userId,
        expires: created.expires,
      };
    },

    // Get a session and user
    async getSessionAndUser(sessionToken) {
      const result = await storage.getSessionAndUser(sessionToken);
      if (!result) return null;
      
      return {
        session: {
          sessionToken: result.session.sessionToken,
          userId: result.session.userId,
          expires: result.session.expires,
        },
        user: {
          id: result.user.userId,
          email: result.user.email,
          emailVerified: result.user.emailVerified,
          name: result.user.name,
          image: result.user.image,
        },
      };
    },

    // Update a session
    async updateSession(session) {
      const updated = await storage.updateSession(session.sessionToken, {
        expires: session.expires,
      });
      
      if (!updated) return null;
      
      return {
        sessionToken: updated.sessionToken,
        userId: updated.userId,
        expires: updated.expires,
      };
    },

    // Delete a session
    async deleteSession(sessionToken) {
      await storage.deleteSession(sessionToken);
    },

    // Create a verification token
    async createVerificationToken(token) {
      const created = await storage.createVerificationToken({
        identifier: token.identifier,
        token: token.token,
        expires: token.expires,
      });
      
      return {
        identifier: created.identifier,
        token: created.token,
        expires: created.expires,
      };
    },

    // Use (consume) a verification token
    async useVerificationToken({ identifier, token }) {
      const used = await storage.useVerificationToken(identifier, token);
      if (!used) return null;
      
      return {
        identifier: used.identifier,
        token: used.token,
        expires: used.expires,
      };
    },
  };
}
