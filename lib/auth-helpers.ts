import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import type { Session } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { getStorageAdapter } from "./storage/factory";

/**
 * Get the current session from NextAuth
 * Use this in API routes and server components to check authentication
 * 
 * @returns Session object if authenticated, null otherwise
 */
export async function getSession(): Promise<Session | null> {
  return await getServerSession(authOptions);
}

/**
 * Require authentication for an API route
 * Throws an error if the user is not authenticated
 * 
 * @returns Session object
 * @throws Error if not authenticated
 */
export async function requireAuth(): Promise<Session> {
  const session = await getSession();
  
  if (!session) {
    throw new Error("Unauthorized");
  }
  
  return session;
}

/**
 * Get the authenticated user ID
 * 
 * @returns User ID string
 * @throws Error if not authenticated
 */
export async function getUserId(): Promise<string> {
  const session = await requireAuth();
  return session.user.id;
}

/**
 * Authentication error class for proper error handling
 */
export class AuthenticationError extends Error {
  constructor(message: string = "Unauthorized") {
    super(message);
    this.name = "AuthenticationError";
  }
}

/**
 * Middleware wrapper for protected API routes
 * Validates session and provides authenticated user context
 * 
 * @param handler - The API route handler function that receives session
 * @returns NextResponse with proper error handling
 * 
 * @example
 * ```typescript
 * export const GET = withAuth(async (request, session) => {
 *   const userId = session.user.id;
 *   // Your protected route logic here
 *   return NextResponse.json({ data: "protected data" });
 * });
 * ```
 */
export function withAuth(
  handler: (request: NextRequest, session: Session) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const session = await getSession();
      
      if (!session || !session.user) {
        return NextResponse.json(
          {
            error: "Unauthorized",
            message: "Authentication required. Please sign in.",
          },
          { status: 401 }
        );
      }

      // Validate session has required user fields
      if (!session.user.id || !session.user.email) {
        return NextResponse.json(
          {
            error: "Invalid Session",
            message: "Session is missing required user information.",
          },
          { status: 401 }
        );
      }

      // Ensure user exists in DB (JWT strategy doesn't auto-create users)
      try {
        const storage = getStorageAdapter();
        const existingUser = await storage.getUser(session.user.id);
        if (!existingUser) {
          await storage.createUser({
            userId: session.user.id,
            email: session.user.email || "",
            name: session.user.name || "",
            image: session.user.image,
            emailVerified: null,
            ntfyFeedUrl: "",
            ntfyServerUrl: process.env.NTFY_SERVER_URL || "https://ntfy.sh",
            notificationEnabled: true,
          });
        }
      } catch (dbError) {
        console.error("Failed to ensure user exists:", dbError);
      }

      return await handler(request, session);
    } catch (error) {
      // Handle authentication errors
      if (error instanceof AuthenticationError) {
        return NextResponse.json(
          {
            error: "Authentication Error",
            message: error.message,
          },
          { status: 401 }
        );
      }

      // Handle other errors
      console.error("API route error:", error);
      return NextResponse.json(
        {
          error: "Internal Server Error",
          message: "An unexpected error occurred.",
        },
        { status: 500 }
      );
    }
  };
}

/**
 * Validate session and return user ID
 * Throws AuthenticationError if session is invalid
 * 
 * @returns User ID string
 * @throws AuthenticationError if not authenticated or session invalid
 */
export async function validateSession(): Promise<string> {
  const session = await getSession();
  
  if (!session || !session.user) {
    throw new AuthenticationError("Authentication required. Please sign in.");
  }

  if (!session.user.id) {
    throw new AuthenticationError("Session is missing user ID.");
  }

  if (!session.user.email) {
    throw new AuthenticationError("Session is missing user email.");
  }

  return session.user.id;
}
