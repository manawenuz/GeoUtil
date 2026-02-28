import { NextRequest } from "next/server";

// Mock dependencies BEFORE importing the route
jest.mock("@/lib/storage/factory");
jest.mock("@/lib/auth-helpers");
jest.mock("@/lib/ensure-init");

import { withAuth } from "@/lib/auth-helpers";
import { getStorageAdapter } from "@/lib/storage/factory";
import { ensureInitialized } from "@/lib/ensure-init";

// Set up withAuth mock before importing route
(withAuth as jest.Mock).mockImplementation((handler) => {
  return handler;
});

// Mock ensureInitialized to resolve immediately
(ensureInitialized as jest.Mock).mockResolvedValue(undefined);

// Now import the route handlers
import { GET } from "./route";

describe("GET /api/balances/history", () => {
  let mockStorageAdapter: any;

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

  const mockBalanceHistory = [
    {
      balanceId: "balance-1",
      accountId: "account-123",
      balance: 100.0,
      currency: "GEL",
      checkedAt: new Date("2024-01-15T10:00:00Z"),
      success: true,
    },
    {
      balanceId: "balance-2",
      accountId: "account-123",
      balance: 75.5,
      currency: "GEL",
      checkedAt: new Date("2024-01-10T10:00:00Z"),
      success: true,
    },
    {
      balanceId: "balance-3",
      accountId: "account-123",
      balance: 50.0,
      currency: "GEL",
      checkedAt: new Date("2024-01-05T10:00:00Z"),
      success: true,
    },
  ];

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup storage adapter mock
    mockStorageAdapter = {
      getAccount: jest.fn(),
      getBalanceHistory: jest.fn(),
    };
    (getStorageAdapter as jest.Mock).mockReturnValue(mockStorageAdapter);
  });

  describe("Request Validation", () => {
    it("should return 400 if accountId is missing", async () => {
      const request = new NextRequest("http://localhost:3000/api/balances/history");

      const response = await GET(request, mockSession);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation Error");
      expect(data.message).toContain("accountId");
    });

    it("should return 400 if days parameter is invalid (non-numeric)", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/balances/history?accountId=account-123&days=invalid"
      );

      const response = await GET(request, mockSession);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation Error");
      expect(data.message).toContain("Invalid days parameter");
    });

    it("should return 400 if days parameter is negative", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/balances/history?accountId=account-123&days=-5"
      );

      const response = await GET(request, mockSession);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation Error");
      expect(data.message).toContain("Invalid days parameter");
    });

    it("should return 400 if days parameter is zero", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/balances/history?accountId=account-123&days=0"
      );

      const response = await GET(request, mockSession);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation Error");
      expect(data.message).toContain("Invalid days parameter");
    });

    it("should use default of 30 days if days parameter is not provided", async () => {
      mockStorageAdapter.getAccount.mockResolvedValue(mockAccount);
      mockStorageAdapter.getBalanceHistory.mockResolvedValue([]);

      const request = new NextRequest(
        "http://localhost:3000/api/balances/history?accountId=account-123"
      );

      await GET(request, mockSession);

      expect(mockStorageAdapter.getBalanceHistory).toHaveBeenCalledWith("account-123", 30);
    });

    it("should accept valid days parameter", async () => {
      mockStorageAdapter.getAccount.mockResolvedValue(mockAccount);
      mockStorageAdapter.getBalanceHistory.mockResolvedValue([]);

      const request = new NextRequest(
        "http://localhost:3000/api/balances/history?accountId=account-123&days=7"
      );

      await GET(request, mockSession);

      expect(mockStorageAdapter.getBalanceHistory).toHaveBeenCalledWith("account-123", 7);
    });
  });

  describe("Account Authorization", () => {
    it("should return 404 if account does not exist", async () => {
      mockStorageAdapter.getAccount.mockResolvedValue(null);

      const request = new NextRequest(
        "http://localhost:3000/api/balances/history?accountId=nonexistent"
      );

      const response = await GET(request, mockSession);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Not Found");
      expect(data.message).toBe("Account not found");
    });

    it("should return 403 if account belongs to different user", async () => {
      mockStorageAdapter.getAccount.mockResolvedValue({
        ...mockAccount,
        userId: "different-user",
      });

      const request = new NextRequest(
        "http://localhost:3000/api/balances/history?accountId=account-123"
      );

      const response = await GET(request, mockSession);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Forbidden");
      expect(data.message).toContain("permission");
    });

    it("should allow access if account belongs to authenticated user", async () => {
      mockStorageAdapter.getAccount.mockResolvedValue(mockAccount);
      mockStorageAdapter.getBalanceHistory.mockResolvedValue([]);

      const request = new NextRequest(
        "http://localhost:3000/api/balances/history?accountId=account-123"
      );

      const response = await GET(request, mockSession);

      expect(response.status).toBe(200);
    });
  });

  describe("Balance History Retrieval", () => {
    it("should retrieve balance history for the specified account", async () => {
      mockStorageAdapter.getAccount.mockResolvedValue(mockAccount);
      mockStorageAdapter.getBalanceHistory.mockResolvedValue(mockBalanceHistory);

      const request = new NextRequest(
        "http://localhost:3000/api/balances/history?accountId=account-123&days=30"
      );

      await GET(request, mockSession);

      expect(mockStorageAdapter.getBalanceHistory).toHaveBeenCalledWith("account-123", 30);
    });

    it("should return formatted balance history", async () => {
      mockStorageAdapter.getAccount.mockResolvedValue(mockAccount);
      mockStorageAdapter.getBalanceHistory.mockResolvedValue(mockBalanceHistory);

      const request = new NextRequest(
        "http://localhost:3000/api/balances/history?accountId=account-123&days=30"
      );

      const response = await GET(request, mockSession);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        accountId: "account-123",
        days: 30,
        count: 3,
        history: [
          {
            balanceId: "balance-1",
            balance: 100.0,
            currency: "GEL",
            timestamp: "2024-01-15T10:00:00.000Z",
            success: true,
            error: undefined,
          },
          {
            balanceId: "balance-2",
            balance: 75.5,
            currency: "GEL",
            timestamp: "2024-01-10T10:00:00.000Z",
            success: true,
            error: undefined,
          },
          {
            balanceId: "balance-3",
            balance: 50.0,
            currency: "GEL",
            timestamp: "2024-01-05T10:00:00.000Z",
            success: true,
            error: undefined,
          },
        ],
      });
    });

    it("should return empty history if no balances exist", async () => {
      mockStorageAdapter.getAccount.mockResolvedValue(mockAccount);
      mockStorageAdapter.getBalanceHistory.mockResolvedValue([]);

      const request = new NextRequest(
        "http://localhost:3000/api/balances/history?accountId=account-123&days=30"
      );

      const response = await GET(request, mockSession);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        accountId: "account-123",
        days: 30,
        count: 0,
        history: [],
      });
    });

    it("should include error information for failed balance checks", async () => {
      const historyWithErrors = [
        {
          balanceId: "balance-1",
          accountId: "account-123",
          balance: 100.0,
          currency: "GEL",
          checkedAt: new Date("2024-01-15T10:00:00Z"),
          success: true,
        },
        {
          balanceId: "balance-2",
          accountId: "account-123",
          balance: 0,
          currency: "GEL",
          checkedAt: new Date("2024-01-10T10:00:00Z"),
          success: false,
          error: "Provider timeout",
        },
      ];

      mockStorageAdapter.getAccount.mockResolvedValue(mockAccount);
      mockStorageAdapter.getBalanceHistory.mockResolvedValue(historyWithErrors);

      const request = new NextRequest(
        "http://localhost:3000/api/balances/history?accountId=account-123&days=30"
      );

      const response = await GET(request, mockSession);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.history).toHaveLength(2);
      expect(data.history[0].success).toBe(true);
      expect(data.history[0].error).toBeUndefined();
      expect(data.history[1].success).toBe(false);
      expect(data.history[1].error).toBe("Provider timeout");
    });

    it("should handle large date ranges", async () => {
      mockStorageAdapter.getAccount.mockResolvedValue(mockAccount);
      mockStorageAdapter.getBalanceHistory.mockResolvedValue(mockBalanceHistory);

      const request = new NextRequest(
        "http://localhost:3000/api/balances/history?accountId=account-123&days=365"
      );

      const response = await GET(request, mockSession);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.days).toBe(365);
      expect(mockStorageAdapter.getBalanceHistory).toHaveBeenCalledWith("account-123", 365);
    });

    it("should handle small date ranges", async () => {
      mockStorageAdapter.getAccount.mockResolvedValue(mockAccount);
      mockStorageAdapter.getBalanceHistory.mockResolvedValue([mockBalanceHistory[0]]);

      const request = new NextRequest(
        "http://localhost:3000/api/balances/history?accountId=account-123&days=1"
      );

      const response = await GET(request, mockSession);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.days).toBe(1);
      expect(data.count).toBe(1);
      expect(mockStorageAdapter.getBalanceHistory).toHaveBeenCalledWith("account-123", 1);
    });
  });

  describe("Error Handling", () => {
    it("should handle storage errors", async () => {
      mockStorageAdapter.getAccount.mockRejectedValue(new Error("Database connection failed"));

      const request = new NextRequest(
        "http://localhost:3000/api/balances/history?accountId=account-123"
      );

      const response = await GET(request, mockSession);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Storage Error");
      expect(data.message).toContain("Failed to access storage");
    });

    it("should handle storage errors during history retrieval", async () => {
      mockStorageAdapter.getAccount.mockResolvedValue(mockAccount);
      mockStorageAdapter.getBalanceHistory.mockRejectedValue(
        new Error("storage query failed")
      );

      const request = new NextRequest(
        "http://localhost:3000/api/balances/history?accountId=account-123"
      );

      const response = await GET(request, mockSession);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Storage Error");
    });

    it("should handle unexpected errors", async () => {
      mockStorageAdapter.getAccount.mockRejectedValue(new Error("Unexpected error"));

      const request = new NextRequest(
        "http://localhost:3000/api/balances/history?accountId=account-123"
      );

      const response = await GET(request, mockSession);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal Server Error");
      expect(data.message).toContain("unexpected error");
    });

    it("should handle errors during history formatting", async () => {
      const invalidHistory = [
        {
          balanceId: "balance-1",
          accountId: "account-123",
          balance: 100.0,
          currency: "GEL",
          checkedAt: null, // Invalid date that will cause toISOString to fail
          success: true,
        },
      ];

      mockStorageAdapter.getAccount.mockResolvedValue(mockAccount);
      mockStorageAdapter.getBalanceHistory.mockResolvedValue(invalidHistory as any);

      const request = new NextRequest(
        "http://localhost:3000/api/balances/history?accountId=account-123"
      );

      const response = await GET(request, mockSession);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal Server Error");
    });
  });

  describe("Response Format", () => {
    it("should include all required fields in response", async () => {
      mockStorageAdapter.getAccount.mockResolvedValue(mockAccount);
      mockStorageAdapter.getBalanceHistory.mockResolvedValue(mockBalanceHistory);

      const request = new NextRequest(
        "http://localhost:3000/api/balances/history?accountId=account-123&days=15"
      );

      const response = await GET(request, mockSession);
      const data = await response.json();

      expect(data).toHaveProperty("accountId");
      expect(data).toHaveProperty("days");
      expect(data).toHaveProperty("count");
      expect(data).toHaveProperty("history");
      expect(Array.isArray(data.history)).toBe(true);
    });

    it("should format timestamps as ISO strings", async () => {
      mockStorageAdapter.getAccount.mockResolvedValue(mockAccount);
      mockStorageAdapter.getBalanceHistory.mockResolvedValue([mockBalanceHistory[0]]);

      const request = new NextRequest(
        "http://localhost:3000/api/balances/history?accountId=account-123"
      );

      const response = await GET(request, mockSession);
      const data = await response.json();

      expect(data.history[0].timestamp).toBe("2024-01-15T10:00:00.000Z");
      expect(typeof data.history[0].timestamp).toBe("string");
    });

    it("should include balance metadata in each history entry", async () => {
      mockStorageAdapter.getAccount.mockResolvedValue(mockAccount);
      mockStorageAdapter.getBalanceHistory.mockResolvedValue([mockBalanceHistory[0]]);

      const request = new NextRequest(
        "http://localhost:3000/api/balances/history?accountId=account-123"
      );

      const response = await GET(request, mockSession);
      const data = await response.json();

      const historyEntry = data.history[0];
      expect(historyEntry).toHaveProperty("balanceId");
      expect(historyEntry).toHaveProperty("balance");
      expect(historyEntry).toHaveProperty("currency");
      expect(historyEntry).toHaveProperty("timestamp");
      expect(historyEntry).toHaveProperty("success");
    });

    it("should return correct count matching history length", async () => {
      mockStorageAdapter.getAccount.mockResolvedValue(mockAccount);
      mockStorageAdapter.getBalanceHistory.mockResolvedValue(mockBalanceHistory);

      const request = new NextRequest(
        "http://localhost:3000/api/balances/history?accountId=account-123"
      );

      const response = await GET(request, mockSession);
      const data = await response.json();

      expect(data.count).toBe(data.history.length);
      expect(data.count).toBe(3);
    });
  });
});
