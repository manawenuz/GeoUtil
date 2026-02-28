import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextRequest, NextResponse } from "next/server";
import {
  getSession,
  requireAuth,
  getUserId,
  withAuth,
  validateSession,
  AuthenticationError,
} from "./auth-helpers";
import type { Session } from "next-auth";

// Mock next-auth
jest.mock("next-auth", () => ({
  default: jest.fn(),
}));

jest.mock("./auth", () => ({
  authOptions: {},
}));

// Mock getServerSession
const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => {
  return {
    default: jest.fn(),
    getServerSession: () => mockGetServerSession(),
  };
});

describe("Auth Helpers", () => {
  const mockSession: Session = {
    user: {
      id: "user-123",
      email: "test@example.com",
      name: "Test User",
      image: "https://example.com/avatar.jpg",
    },
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getSession", () => {
    it("should return session when authenticated", async () => {
      mockGetServerSession.mockResolvedValue(mockSession);

      const session = await getSession();

      expect(session).toEqual(mockSession);
    });

    it("should return null when not authenticated", async () => {
      mockGetServerSession.mockResolvedValue(null);

      const session = await getSession();

      expect(session).toBeNull();
    });
  });

  describe("requireAuth", () => {
    it("should return session when authenticated", async () => {
      mockGetServerSession.mockResolvedValue(mockSession);

      const session = await requireAuth();

      expect(session).toEqual(mockSession);
    });

    it("should throw error when not authenticated", async () => {
      mockGetServerSession.mockResolvedValue(null);

      await expect(requireAuth()).rejects.toThrow("Unauthorized");
    });
  });

  describe("getUserId", () => {
    it("should return user ID when authenticated", async () => {
      mockGetServerSession.mockResolvedValue(mockSession);

      const userId = await getUserId();

      expect(userId).toBe("user-123");
    });

    it("should throw error when not authenticated", async () => {
      mockGetServerSession.mockResolvedValue(null);

      await expect(getUserId()).rejects.toThrow("Unauthorized");
    });
  });

  describe("validateSession", () => {
    it("should return user ID for valid session", async () => {
      mockGetServerSession.mockResolvedValue(mockSession);

      const userId = await validateSession();

      expect(userId).toBe("user-123");
    });

    it("should throw AuthenticationError when session is null", async () => {
      mockGetServerSession.mockResolvedValue(null);

      await expect(validateSession()).rejects.toThrow(AuthenticationError);
      await expect(validateSession()).rejects.toThrow(
        "Authentication required. Please sign in."
      );
    });

    it("should throw AuthenticationError when user is missing", async () => {
      mockGetServerSession.mockResolvedValue({ expires: "2024-12-31" });

      await expect(validateSession()).rejects.toThrow(AuthenticationError);
    });

    it("should throw AuthenticationError when user ID is missing", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { email: "test@example.com" },
        expires: "2024-12-31",
      });

      await expect(validateSession()).rejects.toThrow(AuthenticationError);
      await expect(validateSession()).rejects.toThrow(
        "Session is missing user ID."
      );
    });

    it("should throw AuthenticationError when email is missing", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user-123" },
        expires: "2024-12-31",
      });

      await expect(validateSession()).rejects.toThrow(AuthenticationError);
      await expect(validateSession()).rejects.toThrow(
        "Session is missing user email."
      );
    });
  });

  describe("withAuth middleware", () => {
    it("should call handler with session when authenticated", async () => {
      mockGetServerSession.mockResolvedValue(mockSession);

      const mockHandler = jest.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      );

      const wrappedHandler = withAuth(mockHandler);
      const mockRequest = new NextRequest("http://localhost:3000/api/test");

      const response = await wrappedHandler(mockRequest);

      expect(mockHandler).toHaveBeenCalledWith(mockRequest, mockSession);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ success: true });
    });

    it("should return 401 when session is null", async () => {
      mockGetServerSession.mockResolvedValue(null);

      const mockHandler = jest.fn();
      const wrappedHandler = withAuth(mockHandler);
      const mockRequest = new NextRequest("http://localhost:3000/api/test");

      const response = await wrappedHandler(mockRequest);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toEqual({
        error: "Unauthorized",
        message: "Authentication required. Please sign in.",
      });
    });

    it("should return 401 when user is missing from session", async () => {
      mockGetServerSession.mockResolvedValue({
        expires: "2024-12-31",
      });

      const mockHandler = jest.fn();
      const wrappedHandler = withAuth(mockHandler);
      const mockRequest = new NextRequest("http://localhost:3000/api/test");

      const response = await wrappedHandler(mockRequest);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(response.status).toBe(401);
    });

    it("should return 401 when user ID is missing", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { email: "test@example.com" },
        expires: "2024-12-31",
      });

      const mockHandler = jest.fn();
      const wrappedHandler = withAuth(mockHandler);
      const mockRequest = new NextRequest("http://localhost:3000/api/test");

      const response = await wrappedHandler(mockRequest);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toEqual({
        error: "Invalid Session",
        message: "Session is missing required user information.",
      });
    });

    it("should return 401 when user email is missing", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user-123" },
        expires: "2024-12-31",
      });

      const mockHandler = jest.fn();
      const wrappedHandler = withAuth(mockHandler);
      const mockRequest = new NextRequest("http://localhost:3000/api/test");

      const response = await wrappedHandler(mockRequest);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(response.status).toBe(401);
    });

    it("should handle AuthenticationError from handler", async () => {
      mockGetServerSession.mockResolvedValue(mockSession);

      const mockHandler = jest.fn().mockRejectedValue(
        new AuthenticationError("Custom auth error")
      );

      const wrappedHandler = withAuth(mockHandler);
      const mockRequest = new NextRequest("http://localhost:3000/api/test");

      const response = await wrappedHandler(mockRequest);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toEqual({
        error: "Authentication Error",
        message: "Custom auth error",
      });
    });

    it("should handle generic errors from handler", async () => {
      mockGetServerSession.mockResolvedValue(mockSession);

      const mockHandler = jest.fn().mockRejectedValue(new Error("Database error"));

      const wrappedHandler = withAuth(mockHandler);
      const mockRequest = new NextRequest("http://localhost:3000/api/test");

      // Mock console.error to avoid test output noise
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const response = await wrappedHandler(mockRequest);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data).toEqual({
        error: "Internal Server Error",
        message: "An unexpected error occurred.",
      });
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe("AuthenticationError", () => {
    it("should create error with default message", () => {
      const error = new AuthenticationError();

      expect(error.message).toBe("Unauthorized");
      expect(error.name).toBe("AuthenticationError");
      expect(error).toBeInstanceOf(Error);
    });

    it("should create error with custom message", () => {
      const error = new AuthenticationError("Custom message");

      expect(error.message).toBe("Custom message");
      expect(error.name).toBe("AuthenticationError");
    });
  });
});
