import { NextRequest } from "next/server";
import { POST } from "./route";
import { getStorageAdapter } from "@/lib/storage/factory";
import { getProviderRegistry } from "@/lib/providers/factory";
import { NotificationService } from "@/lib/notification-service";
import { createEncryptionService } from "@/lib/encryption";
import { ensureInitialized } from "@/lib/ensure-init";
import { ProviderAdapter, BalanceResult } from "@/lib/providers/types";

// Mock dependencies
jest.mock("@/lib/storage/factory");
jest.mock("@/lib/providers/factory");
jest.mock("@/lib/notification-service");
jest.mock("@/lib/encryption");
jest.mock("@/lib/ensure-init");
jest.mock("@/lib/auth-helpers", () => ({
  withAuth: (handler: any) => handler,
}));

// Mock ensureInitialized to resolve immediately
(ensureInitialized as jest.Mock).mockResolvedValue(undefined);

describe("POST /api/balances/check", () => {
  let mockStorageAdapter: any;
  let mockProviderRegistry: any;
  let mockProviderAdapter: any;
  let mockNotificationService: any;
  let mockEncryptionService: any;

  const mockSession = {
    user: {
      id: "user-123",
      email: "test@example.com",
      name: "Test User",
    },
  };

  const mockAccount = {
    accountId: "account-123",
    userId: "user-123",
    providerType: "gas" as const,
    providerName: "te.ge",
    accountNumber: "encrypted-account-number",
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUser = {
    userId: "user-123",
    email: "test@example.com",
    name: "Test User",
    emailVerified: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ntfyFeedUrl: "encrypted-feed-url",
    ntfyServerUrl: "https://ntfy.sh",
    notificationEnabled: true,
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup storage adapter mock
    mockStorageAdapter = {
      getAccount: jest.fn(),
      getUser: jest.fn(),
      recordBalance: jest.fn(),
      recordCheckAttempt: jest.fn(),
      recordNotification: jest.fn(),
      incrementOverdueDays: jest.fn(),
      resetOverdueDays: jest.fn(),
    };
    (getStorageAdapter as jest.Mock).mockReturnValue(mockStorageAdapter);

    // Setup provider adapter mock
    mockProviderAdapter = {
      providerName: "te.ge",
      providerType: "gas",
      fetchBalance: jest.fn(),
    };
    mockProviderRegistry = {
      getAdapter: jest.fn().mockReturnValue(mockProviderAdapter),
    };
    (getProviderRegistry as jest.Mock).mockReturnValue(mockProviderRegistry);

    // Setup encryption service mock
    mockEncryptionService = {
      decrypt: jest.fn((value: string) => {
        if (value === "encrypted-account-number") return "123456789012";
        if (value === "encrypted-feed-url") return "https://ntfy.sh/test-topic";
        return value;
      }),
    };
    (createEncryptionService as jest.Mock).mockReturnValue(mockEncryptionService);

    // Setup notification service mock
    mockNotificationService = {
      sendNotification: jest.fn().mockResolvedValue(true),
      determinePriority: jest.fn().mockReturnValue("default"),
      formatBalanceMessage: jest.fn().mockReturnValue("Test message"),
    };
    (NotificationService as jest.Mock).mockImplementation(() => mockNotificationService);
  });

  describe("Request Validation", () => {
    it("should return 400 if accountId is missing", async () => {
      const request = new NextRequest("http://localhost:3000/api/balances/check", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const response = await POST(request, mockSession);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation Error");
      expect(data.message).toContain("accountId");
    });

    it("should return 404 if account does not exist", async () => {
      mockStorageAdapter.getAccount.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/balances/check", {
        method: "POST",
        body: JSON.stringify({ accountId: "nonexistent" }),
      });

      const response = await POST(request, mockSession);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Not Found");
    });

    it("should return 403 if account belongs to different user", async () => {
      mockStorageAdapter.getAccount.mockResolvedValue({
        ...mockAccount,
        userId: "different-user",
      });

      const request = new NextRequest("http://localhost:3000/api/balances/check", {
        method: "POST",
        body: JSON.stringify({ accountId: "account-123" }),
      });

      const response = await POST(request, mockSession);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Forbidden");
    });

    it("should return 400 if account is disabled", async () => {
      mockStorageAdapter.getAccount.mockResolvedValue({
        ...mockAccount,
        enabled: false,
      });

      const request = new NextRequest("http://localhost:3000/api/balances/check", {
        method: "POST",
        body: JSON.stringify({ accountId: "account-123" }),
      });

      const response = await POST(request, mockSession);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Account Disabled");
    });
  });

  describe("Provider Integration", () => {
    it("should return 500 if provider adapter is not found", async () => {
      mockStorageAdapter.getAccount.mockResolvedValue(mockAccount);
      mockProviderRegistry.getAdapter.mockReturnValue(null);

      const request = new NextRequest("http://localhost:3000/api/balances/check", {
        method: "POST",
        body: JSON.stringify({ accountId: "account-123" }),
      });

      const response = await POST(request, mockSession);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Provider Not Found");
    });

    it("should decrypt account number before calling provider", async () => {
      mockStorageAdapter.getAccount.mockResolvedValue(mockAccount);
      mockProviderAdapter.fetchBalance.mockResolvedValue({
        balance: 50.0,
        currency: "GEL",
        timestamp: new Date(),
        success: true,
      });

      const request = new NextRequest("http://localhost:3000/api/balances/check", {
        method: "POST",
        body: JSON.stringify({ accountId: "account-123" }),
      });

      await POST(request, mockSession);

      expect(mockEncryptionService.decrypt).toHaveBeenCalledWith("encrypted-account-number");
      expect(mockProviderAdapter.fetchBalance).toHaveBeenCalledWith("123456789012");
    });

    it("should record check attempt with success status", async () => {
      mockStorageAdapter.getAccount.mockResolvedValue(mockAccount);
      mockProviderAdapter.fetchBalance.mockResolvedValue({
        balance: 50.0,
        currency: "GEL",
        timestamp: new Date(),
        success: true,
      });

      const request = new NextRequest("http://localhost:3000/api/balances/check", {
        method: "POST",
        body: JSON.stringify({ accountId: "account-123" }),
      });

      await POST(request, mockSession);

      expect(mockStorageAdapter.recordCheckAttempt).toHaveBeenCalledWith(
        "account-123",
        true,
        undefined
      );
    });

    it("should record check attempt with failure status", async () => {
      mockStorageAdapter.getAccount.mockResolvedValue(mockAccount);
      mockStorageAdapter.getUser.mockResolvedValue(mockUser);
      mockProviderAdapter.fetchBalance.mockResolvedValue({
        balance: 0,
        currency: "GEL",
        timestamp: new Date(),
        success: false,
        error: "Connection timeout",
      });

      const request = new NextRequest("http://localhost:3000/api/balances/check", {
        method: "POST",
        body: JSON.stringify({ accountId: "account-123" }),
      });

      await POST(request, mockSession);

      expect(mockStorageAdapter.recordCheckAttempt).toHaveBeenCalledWith(
        "account-123",
        false,
        "Connection timeout"
      );
    });
  });

  describe("Balance Storage", () => {
    it("should store balance result in storage adapter", async () => {
      const timestamp = new Date();
      mockStorageAdapter.getAccount.mockResolvedValue(mockAccount);
      mockProviderAdapter.fetchBalance.mockResolvedValue({
        balance: 75.5,
        currency: "GEL",
        timestamp,
        success: true,
      });

      const request = new NextRequest("http://localhost:3000/api/balances/check", {
        method: "POST",
        body: JSON.stringify({ accountId: "account-123" }),
      });

      await POST(request, mockSession);

      expect(mockStorageAdapter.recordBalance).toHaveBeenCalledWith({
        accountId: "account-123",
        balance: 75.5,
        currency: "GEL",
        checkedAt: timestamp,
        success: true,
        error: undefined,
        rawResponse: undefined,
      });
    });

    it("should store failed balance check with error", async () => {
      const timestamp = new Date();
      mockStorageAdapter.getAccount.mockResolvedValue(mockAccount);
      mockStorageAdapter.getUser.mockResolvedValue(mockUser);
      mockProviderAdapter.fetchBalance.mockResolvedValue({
        balance: 0,
        currency: "GEL",
        timestamp,
        success: false,
        error: "Provider unavailable",
        rawResponse: "<html>Error</html>",
      });

      const request = new NextRequest("http://localhost:3000/api/balances/check", {
        method: "POST",
        body: JSON.stringify({ accountId: "account-123" }),
      });

      await POST(request, mockSession);

      expect(mockStorageAdapter.recordBalance).toHaveBeenCalledWith({
        accountId: "account-123",
        balance: 0,
        currency: "GEL",
        checkedAt: timestamp,
        success: false,
        error: "Provider unavailable",
        rawResponse: "<html>Error</html>",
      });
    });
  });

  describe("Overdue Counter Management", () => {
    it("should increment overdue counter for non-zero balance", async () => {
      mockStorageAdapter.getAccount.mockResolvedValue(mockAccount);
      mockStorageAdapter.getUser.mockResolvedValue(mockUser);
      mockStorageAdapter.incrementOverdueDays.mockResolvedValue(3);
      mockProviderAdapter.fetchBalance.mockResolvedValue({
        balance: 100.0,
        currency: "GEL",
        timestamp: new Date(),
        success: true,
      });

      const request = new NextRequest("http://localhost:3000/api/balances/check", {
        method: "POST",
        body: JSON.stringify({ accountId: "account-123" }),
      });

      const response = await POST(request, mockSession);
      const data = await response.json();

      expect(mockStorageAdapter.incrementOverdueDays).toHaveBeenCalledWith("account-123");
      expect(data.overdueDays).toBe(3);
    });

    it("should reset overdue counter for zero balance", async () => {
      mockStorageAdapter.getAccount.mockResolvedValue(mockAccount);
      mockProviderAdapter.fetchBalance.mockResolvedValue({
        balance: 0,
        currency: "GEL",
        timestamp: new Date(),
        success: true,
      });

      const request = new NextRequest("http://localhost:3000/api/balances/check", {
        method: "POST",
        body: JSON.stringify({ accountId: "account-123" }),
      });

      const response = await POST(request, mockSession);
      const data = await response.json();

      expect(mockStorageAdapter.resetOverdueDays).toHaveBeenCalledWith("account-123");
      expect(data.overdueDays).toBe(0);
    });
  });

  describe("Notification Handling", () => {
    it("should send notification for non-zero balance", async () => {
      mockStorageAdapter.getAccount.mockResolvedValue(mockAccount);
      mockStorageAdapter.getUser.mockResolvedValue(mockUser);
      mockStorageAdapter.incrementOverdueDays.mockResolvedValue(5);
      mockProviderAdapter.fetchBalance.mockResolvedValue({
        balance: 150.0,
        currency: "GEL",
        timestamp: new Date(),
        success: true,
      });

      const request = new NextRequest("http://localhost:3000/api/balances/check", {
        method: "POST",
        body: JSON.stringify({ accountId: "account-123" }),
      });

      await POST(request, mockSession);

      expect(mockNotificationService.determinePriority).toHaveBeenCalledWith(5);
      expect(mockNotificationService.formatBalanceMessage).toHaveBeenCalledWith(
        "te.ge",
        "123456789012",
        150.0,
        5
      );
      expect(mockNotificationService.sendNotification).toHaveBeenCalled();
    });

    it("should not send notification for zero balance", async () => {
      mockStorageAdapter.getAccount.mockResolvedValue(mockAccount);
      mockProviderAdapter.fetchBalance.mockResolvedValue({
        balance: 0,
        currency: "GEL",
        timestamp: new Date(),
        success: true,
      });

      const request = new NextRequest("http://localhost:3000/api/balances/check", {
        method: "POST",
        body: JSON.stringify({ accountId: "account-123" }),
      });

      await POST(request, mockSession);

      expect(mockNotificationService.sendNotification).not.toHaveBeenCalled();
    });

    it("should send failure notification when balance check fails", async () => {
      mockStorageAdapter.getAccount.mockResolvedValue(mockAccount);
      mockStorageAdapter.getUser.mockResolvedValue(mockUser);
      mockProviderAdapter.fetchBalance.mockResolvedValue({
        balance: 0,
        currency: "GEL",
        timestamp: new Date(),
        success: false,
        error: "Network error",
      });

      const request = new NextRequest("http://localhost:3000/api/balances/check", {
        method: "POST",
        body: JSON.stringify({ accountId: "account-123" }),
      });

      await POST(request, mockSession);

      expect(mockNotificationService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Balance Check Failed",
          priority: "default",
        })
      );
    });

    it("should record notification delivery", async () => {
      mockStorageAdapter.getAccount.mockResolvedValue(mockAccount);
      mockStorageAdapter.getUser.mockResolvedValue(mockUser);
      mockStorageAdapter.incrementOverdueDays.mockResolvedValue(2);
      mockProviderAdapter.fetchBalance.mockResolvedValue({
        balance: 50.0,
        currency: "GEL",
        timestamp: new Date(),
        success: true,
      });

      const request = new NextRequest("http://localhost:3000/api/balances/check", {
        method: "POST",
        body: JSON.stringify({ accountId: "account-123" }),
      });

      await POST(request, mockSession);

      expect(mockStorageAdapter.recordNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-123",
          accountId: "account-123",
          priority: "default",
          deliverySuccess: true,
        })
      );
    });

    it("should not send notification if user has notifications disabled", async () => {
      mockStorageAdapter.getAccount.mockResolvedValue(mockAccount);
      mockStorageAdapter.getUser.mockResolvedValue({
        ...mockUser,
        notificationEnabled: false,
      });
      mockStorageAdapter.incrementOverdueDays.mockResolvedValue(1);
      mockProviderAdapter.fetchBalance.mockResolvedValue({
        balance: 50.0,
        currency: "GEL",
        timestamp: new Date(),
        success: true,
      });

      const request = new NextRequest("http://localhost:3000/api/balances/check", {
        method: "POST",
        body: JSON.stringify({ accountId: "account-123" }),
      });

      await POST(request, mockSession);

      expect(mockNotificationService.sendNotification).not.toHaveBeenCalled();
    });
  });

  describe("Success Response", () => {
    it("should return success response with balance data", async () => {
      const timestamp = new Date();
      mockStorageAdapter.getAccount.mockResolvedValue(mockAccount);
      mockStorageAdapter.getUser.mockResolvedValue(mockUser);
      mockStorageAdapter.incrementOverdueDays.mockResolvedValue(7);
      mockProviderAdapter.fetchBalance.mockResolvedValue({
        balance: 200.0,
        currency: "GEL",
        timestamp,
        success: true,
      });

      const request = new NextRequest("http://localhost:3000/api/balances/check", {
        method: "POST",
        body: JSON.stringify({ accountId: "account-123" }),
      });

      const response = await POST(request, mockSession);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        balance: 200.0,
        currency: "GEL",
        timestamp: timestamp.toISOString(),
        overdueDays: 7,
        responseTime: expect.any(Number),
      });
    });

    it("should return failure response when provider check fails", async () => {
      const timestamp = new Date();
      mockStorageAdapter.getAccount.mockResolvedValue(mockAccount);
      mockStorageAdapter.getUser.mockResolvedValue(mockUser);
      mockProviderAdapter.fetchBalance.mockResolvedValue({
        balance: 0,
        currency: "GEL",
        timestamp,
        success: false,
        error: "Timeout",
      });

      const request = new NextRequest("http://localhost:3000/api/balances/check", {
        method: "POST",
        body: JSON.stringify({ accountId: "account-123" }),
      });

      const response = await POST(request, mockSession);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: false,
        balance: null,
        timestamp: timestamp.toISOString(),
        error: "Timeout",
        responseTime: expect.any(Number),
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle encryption errors", async () => {
      mockStorageAdapter.getAccount.mockResolvedValue(mockAccount);
      mockEncryptionService.decrypt.mockImplementation(() => {
        throw new Error("Encryption key is invalid");
      });

      const request = new NextRequest("http://localhost:3000/api/balances/check", {
        method: "POST",
        body: JSON.stringify({ accountId: "account-123" }),
      });

      const response = await POST(request, mockSession);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Configuration Error");
    });

    it("should handle storage errors", async () => {
      mockStorageAdapter.getAccount.mockRejectedValue(new Error("Database connection failed"));

      const request = new NextRequest("http://localhost:3000/api/balances/check", {
        method: "POST",
        body: JSON.stringify({ accountId: "account-123" }),
      });

      const response = await POST(request, mockSession);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Storage Error");
    });

    it("should handle timeout errors", async () => {
      mockStorageAdapter.getAccount.mockResolvedValue(mockAccount);
      mockProviderAdapter.fetchBalance.mockRejectedValue(new Error("Request timeout"));

      const request = new NextRequest("http://localhost:3000/api/balances/check", {
        method: "POST",
        body: JSON.stringify({ accountId: "account-123" }),
      });

      const response = await POST(request, mockSession);
      const data = await response.json();

      expect(response.status).toBe(504);
      expect(data.error).toBe("Timeout Error");
    });

    it("should handle unexpected errors", async () => {
      mockStorageAdapter.getAccount.mockRejectedValue(new Error("Unexpected error"));

      const request = new NextRequest("http://localhost:3000/api/balances/check", {
        method: "POST",
        body: JSON.stringify({ accountId: "account-123" }),
      });

      const response = await POST(request, mockSession);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal Server Error");
    });
  });
});
