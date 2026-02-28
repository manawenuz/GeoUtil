import { NextRequest } from "next/server";

// Mock dependencies BEFORE importing the route
jest.mock("@/lib/auth-helpers");
jest.mock("@/lib/storage/factory");
jest.mock("@/lib/encryption");
jest.mock("@/lib/ensure-init");

import { withAuth } from "@/lib/auth-helpers";
import { getStorageAdapter } from "@/lib/storage/factory";
import { createEncryptionService } from "@/lib/encryption";
import { ensureInitialized } from "@/lib/ensure-init";

// Set up withAuth mock before importing route
(withAuth as jest.Mock).mockImplementation((handler) => {
  return handler;
});

// Mock ensureInitialized to resolve immediately
(ensureInitialized as jest.Mock).mockResolvedValue(undefined);

// Now import the route handlers
import { GET, POST } from "./route";

const mockGetStorageAdapter = getStorageAdapter as jest.MockedFunction<typeof getStorageAdapter>;
const mockCreateEncryptionService = createEncryptionService as jest.MockedFunction<typeof createEncryptionService>;

describe("/api/notifications/config", () => {
  let mockStorageAdapter: any;
  let mockEncryptionService: any;
  const mockSession = {
    user: {
      id: "user-123",
      email: "test@example.com",
      name: "Test User",
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock storage adapter
    mockStorageAdapter = {
      getUser: jest.fn(),
      updateUser: jest.fn(),
    };
    mockGetStorageAdapter.mockReturnValue(mockStorageAdapter);

    // Mock encryption service
    mockEncryptionService = {
      encrypt: jest.fn((text: string) => `encrypted:${text}`),
      decrypt: jest.fn((text: string) => text.replace("encrypted:", "")),
    };
    mockCreateEncryptionService.mockReturnValue(mockEncryptionService);
  });

  describe("GET /api/notifications/config", () => {
    it("should retrieve and decrypt notification configuration", async () => {
      // Arrange
      const mockUser = {
        userId: "user-123",
        email: "test@example.com",
        name: "Test User",
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ntfyFeedUrl: "encrypted:https://ntfy.sh/my-topic",
        ntfyServerUrl: "https://ntfy.sh",
        notificationEnabled: true,
      };
      mockStorageAdapter.getUser.mockResolvedValue(mockUser);

      const request = new NextRequest("http://localhost:3000/api/notifications/config");

      // Act
      const response = await GET(request, mockSession);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data).toEqual({
        ntfyFeedUrl: "https://ntfy.sh/my-topic",
        ntfyServerUrl: "https://ntfy.sh",
        notificationEnabled: true,
      });
      expect(mockStorageAdapter.getUser).toHaveBeenCalledWith("user-123");
      expect(mockEncryptionService.decrypt).toHaveBeenCalledWith("encrypted:https://ntfy.sh/my-topic");
    });

    it("should return empty string for feed URL if not configured", async () => {
      // Arrange
      const mockUser = {
        userId: "user-123",
        email: "test@example.com",
        name: "Test User",
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ntfyFeedUrl: "",
        ntfyServerUrl: "https://ntfy.sh",
        notificationEnabled: false,
      };
      mockStorageAdapter.getUser.mockResolvedValue(mockUser);

      const request = new NextRequest("http://localhost:3000/api/notifications/config");

      // Act
      const response = await GET(request, mockSession);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.ntfyFeedUrl).toBe("");
      expect(data.ntfyServerUrl).toBe("https://ntfy.sh");
    });

    it("should return 404 if user not found", async () => {
      // Arrange
      mockStorageAdapter.getUser.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/notifications/config");

      // Act
      const response = await GET(request, mockSession);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(data.error).toBe("User Not Found");
    });

    it("should handle decryption errors gracefully", async () => {
      // Arrange
      const mockUser = {
        userId: "user-123",
        email: "test@example.com",
        name: "Test User",
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ntfyFeedUrl: "invalid-encrypted-data",
        ntfyServerUrl: "https://ntfy.sh",
        notificationEnabled: true,
      };
      mockStorageAdapter.getUser.mockResolvedValue(mockUser);
      mockEncryptionService.decrypt.mockImplementation(() => {
        throw new Error("Invalid ciphertext");
      });

      const request = new NextRequest("http://localhost:3000/api/notifications/config");

      // Act
      const response = await GET(request, mockSession);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.ntfyFeedUrl).toBe(""); // Should return empty string on decryption error
    });
  });

  describe("POST /api/notifications/config", () => {
    it("should validate and save notification configuration", async () => {
      // Arrange
      const mockUser = {
        userId: "user-123",
        email: "test@example.com",
        name: "Test User",
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ntfyFeedUrl: "",
        ntfyServerUrl: "https://ntfy.sh",
        notificationEnabled: false,
      };
      mockStorageAdapter.getUser.mockResolvedValue(mockUser);
      mockStorageAdapter.updateUser.mockResolvedValue(undefined);

      const requestBody = {
        ntfyFeedUrl: "https://ntfy.sh/my-topic",
        ntfyServerUrl: "https://ntfy.sh",
        notificationEnabled: true,
      };

      const request = new NextRequest("http://localhost:3000/api/notifications/config", {
        method: "POST",
        body: JSON.stringify(requestBody),
      });

      // Act
      const response = await POST(request, mockSession);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith("https://ntfy.sh/my-topic");
      expect(mockStorageAdapter.updateUser).toHaveBeenCalledWith("user-123", {
        ntfyFeedUrl: "encrypted:https://ntfy.sh/my-topic",
        ntfyServerUrl: "https://ntfy.sh",
        notificationEnabled: true,
      });
    });

    it("should accept self-hosted ntfy.sh server URLs", async () => {
      // Arrange
      const mockUser = {
        userId: "user-123",
        email: "test@example.com",
        name: "Test User",
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ntfyFeedUrl: "",
        ntfyServerUrl: "https://ntfy.sh",
        notificationEnabled: false,
      };
      mockStorageAdapter.getUser.mockResolvedValue(mockUser);
      mockStorageAdapter.updateUser.mockResolvedValue(undefined);

      const requestBody = {
        ntfyFeedUrl: "https://my-ntfy.example.com/my-topic",
        ntfyServerUrl: "https://my-ntfy.example.com",
        notificationEnabled: true,
      };

      const request = new NextRequest("http://localhost:3000/api/notifications/config", {
        method: "POST",
        body: JSON.stringify(requestBody),
      });

      // Act
      const response = await POST(request, mockSession);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockStorageAdapter.updateUser).toHaveBeenCalledWith("user-123", {
        ntfyFeedUrl: "encrypted:https://my-ntfy.example.com/my-topic",
        ntfyServerUrl: "https://my-ntfy.example.com",
        notificationEnabled: true,
      });
    });

    it("should reject missing required fields", async () => {
      // Arrange
      const requestBody = {
        ntfyFeedUrl: "https://ntfy.sh/my-topic",
        // Missing ntfyServerUrl
      };

      const request = new NextRequest("http://localhost:3000/api/notifications/config", {
        method: "POST",
        body: JSON.stringify(requestBody),
      });

      // Act
      const response = await POST(request, mockSession);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation Error");
      expect(data.message).toContain("Missing required fields");
    });

    it("should reject invalid feed URL format", async () => {
      // Arrange
      const requestBody = {
        ntfyFeedUrl: "not-a-valid-url",
        ntfyServerUrl: "https://ntfy.sh",
      };

      const request = new NextRequest("http://localhost:3000/api/notifications/config", {
        method: "POST",
        body: JSON.stringify(requestBody),
      });

      // Act
      const response = await POST(request, mockSession);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation Error");
      expect(data.message).toContain("Invalid ntfy.sh feed URL");
    });

    it("should reject invalid server URL format", async () => {
      // Arrange
      const requestBody = {
        ntfyFeedUrl: "https://ntfy.sh/my-topic",
        ntfyServerUrl: "ftp://invalid-protocol.com",
      };

      const request = new NextRequest("http://localhost:3000/api/notifications/config", {
        method: "POST",
        body: JSON.stringify(requestBody),
      });

      // Act
      const response = await POST(request, mockSession);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation Error");
      expect(data.message).toContain("Invalid ntfy.sh server URL");
    });

    it("should reject javascript: protocol URLs", async () => {
      // Arrange
      const requestBody = {
        ntfyFeedUrl: "javascript:alert('xss')",
        ntfyServerUrl: "https://ntfy.sh",
      };

      const request = new NextRequest("http://localhost:3000/api/notifications/config", {
        method: "POST",
        body: JSON.stringify(requestBody),
      });

      // Act
      const response = await POST(request, mockSession);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation Error");
    });

    it("should return 404 if user not found", async () => {
      // Arrange
      mockStorageAdapter.getUser.mockResolvedValue(null);

      const requestBody = {
        ntfyFeedUrl: "https://ntfy.sh/my-topic",
        ntfyServerUrl: "https://ntfy.sh",
      };

      const request = new NextRequest("http://localhost:3000/api/notifications/config", {
        method: "POST",
        body: JSON.stringify(requestBody),
      });

      // Act
      const response = await POST(request, mockSession);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(data.error).toBe("User Not Found");
    });

    it("should handle encryption errors", async () => {
      // Arrange
      const mockUser = {
        userId: "user-123",
        email: "test@example.com",
        name: "Test User",
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ntfyFeedUrl: "",
        ntfyServerUrl: "https://ntfy.sh",
        notificationEnabled: false,
      };
      mockStorageAdapter.getUser.mockResolvedValue(mockUser);
      mockEncryptionService.encrypt.mockImplementation(() => {
        throw new Error("Encryption key not configured");
      });

      const requestBody = {
        ntfyFeedUrl: "https://ntfy.sh/my-topic",
        ntfyServerUrl: "https://ntfy.sh",
      };

      const request = new NextRequest("http://localhost:3000/api/notifications/config", {
        method: "POST",
        body: JSON.stringify(requestBody),
      });

      // Act
      const response = await POST(request, mockSession);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(data.error).toBe("Configuration Error");
    });

    it("should handle storage errors", async () => {
      // Arrange
      const mockUser = {
        userId: "user-123",
        email: "test@example.com",
        name: "Test User",
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ntfyFeedUrl: "",
        ntfyServerUrl: "https://ntfy.sh",
        notificationEnabled: false,
      };
      mockStorageAdapter.getUser.mockResolvedValue(mockUser);
      mockStorageAdapter.updateUser.mockRejectedValue(new Error("Database connection failed"));

      const requestBody = {
        ntfyFeedUrl: "https://ntfy.sh/my-topic",
        ntfyServerUrl: "https://ntfy.sh",
      };

      const request = new NextRequest("http://localhost:3000/api/notifications/config", {
        method: "POST",
        body: JSON.stringify(requestBody),
      });

      // Act
      const response = await POST(request, mockSession);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(data.error).toBe("Storage Error");
    });

    it("should default notificationEnabled to true if not provided", async () => {
      // Arrange
      const mockUser = {
        userId: "user-123",
        email: "test@example.com",
        name: "Test User",
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ntfyFeedUrl: "",
        ntfyServerUrl: "https://ntfy.sh",
        notificationEnabled: false,
      };
      mockStorageAdapter.getUser.mockResolvedValue(mockUser);
      mockStorageAdapter.updateUser.mockResolvedValue(undefined);

      const requestBody = {
        ntfyFeedUrl: "https://ntfy.sh/my-topic",
        ntfyServerUrl: "https://ntfy.sh",
        // notificationEnabled not provided
      };

      const request = new NextRequest("http://localhost:3000/api/notifications/config", {
        method: "POST",
        body: JSON.stringify(requestBody),
      });

      // Act
      const response = await POST(request, mockSession);

      // Assert
      expect(response.status).toBe(200);
      expect(mockStorageAdapter.updateUser).toHaveBeenCalledWith("user-123", {
        ntfyFeedUrl: "encrypted:https://ntfy.sh/my-topic",
        ntfyServerUrl: "https://ntfy.sh",
        notificationEnabled: true, // Should default to true
      });
    });
  });
});
