import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-helpers";

/**
 * Example protected API route demonstrating the withAuth middleware
 * 
 * This route is protected and requires authentication.
 * The middleware automatically validates the session and provides
 * the authenticated user's session to the handler.
 */
export const GET = withAuth(async (request: NextRequest, session) => {
  // Session is guaranteed to be valid here
  // You can access user information directly
  const userId = session.user.id;
  const userEmail = session.user.email;
  const userName = session.user.name;

  return NextResponse.json({
    message: "This is a protected route",
    user: {
      id: userId,
      email: userEmail,
      name: userName,
    },
  });
});

/**
 * Example POST endpoint showing how to handle request body
 * with authentication
 */
export const POST = withAuth(async (request: NextRequest, session) => {
  const userId = session.user.id;
  
  // Parse request body
  const body = await request.json();
  
  // Your business logic here
  // For example, creating a resource for the authenticated user
  
  return NextResponse.json({
    message: "Resource created successfully",
    userId,
    data: body,
  }, { status: 201 });
});
