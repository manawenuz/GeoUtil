"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { Session } from "next-auth";

/**
 * Session provider wrapper component
 * 
 * This component wraps the NextAuth SessionProvider to provide
 * session context to client components throughout the app.
 * 
 * Requirements: 14.2, 14.13
 */
interface SessionProviderProps {
  children: React.ReactNode;
  session?: Session | null;
}

export default function SessionProvider({
  children,
  session,
}: SessionProviderProps) {
  return (
    <NextAuthSessionProvider session={session}>
      {children}
    </NextAuthSessionProvider>
  );
}
