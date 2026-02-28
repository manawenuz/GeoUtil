import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

/**
 * NextAuth configuration for Google OAuth authentication
 * 
 * This configuration uses JWT-based sessions for simplicity in Task 14.1.
 * Task 14.2 will implement a custom adapter for database-backed sessions
 * using the StorageAdapter interface.
 * 
 * Session Management (Task 14.6):
 * - 30-day session expiration with automatic renewal
 * - HTTP-only cookies prevent XSS attacks
 * - Secure flag ensures HTTPS-only transmission in production
 * - SameSite=lax provides CSRF protection
 * - updateAge triggers session renewal on activity
 * - CSRF protection is built into NextAuth by default
 */
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days (Requirement 14.5)
    updateAge: 24 * 60 * 60, // Refresh session every 24 hours of activity
  },
  callbacks: {
    async jwt({ token, user }) {
      // Initial sign in - add user info to token
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image || "";
      }
      return token;
    },
    async session({ session, token }) {
      // Add user ID and other info to session
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.image = token.picture as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true, // Prevents JavaScript access (XSS protection)
        sameSite: "lax", // CSRF protection while allowing normal navigation
        path: "/",
        secure: process.env.NODE_ENV === "production", // HTTPS only in production
      },
    },
    // CSRF token cookie configuration (NextAuth handles CSRF automatically)
    csrfToken: {
      name: `next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    // Callback URL cookie (used during OAuth flow)
    callbackUrl: {
      name: `next-auth.callback-url`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
};
