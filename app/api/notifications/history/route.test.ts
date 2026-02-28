import { GET } from './route';
import { NextRequest } from 'next/server';
import { getStorageAdapter } from '@/lib/storage/factory';

// Mock dependencies
jest.mock('@/lib/auth-helpers', () => ({
  withAuth: (handler: any) => handler,
}));

jest.mock('@/lib/storage/factory');
jest.mock('@/lib/ensure-init');

describe('GET /api/notifications/history', () => {
  const mockSession = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should retrieve notification history successfully', async () => {
    // Mock notifications
    const mockNotifications = [
      {
        notificationId: 'notif-1',
        userId: 'user-123',
        accountId: 'account-1',
        sentAt: new Date('2024-01-15T10:00:00Z'),
        priority: 'default' as const,
        message: 'Test notification 1',
        deliverySuccess: true,
      },
      {
        notificationId: 'notif-2',
        userId: 'user-123',
        accountId: 'account-2',
        sentAt: new Date('2024-01-14T10:00:00Z'),
        priority: 'high' as const,
        message: 'Test notification 2',
        deliverySuccess: false,
        deliveryError: 'Connection timeout',
      },
    ];

    // Mock storage adapter
    const mockGetNotificationHistory = jest.fn().mockResolvedValue(mockNotifications);
    (getStorageAdapter as jest.Mock).mockReturnValue({
      getNotificationHistory: mockGetNotificationHistory,
    });

    // Create request
    const request = new NextRequest('http://localhost:3000/api/notifications/history');

    // Call handler
    const response = await GET(request, mockSession as any);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(200);
    expect(data.notifications).toHaveLength(2);
    expect(data.count).toBe(2);
    expect(data.limit).toBe(50);
    expect(data.notifications[0]).toEqual({
      notificationId: 'notif-1',
      accountId: 'account-1',
      sentAt: '2024-01-15T10:00:00.000Z',
      priority: 'default',
      message: 'Test notification 1',
      deliverySuccess: true,
      deliveryError: undefined,
    });
    expect(mockGetNotificationHistory).toHaveBeenCalledWith('user-123', 50);
  });

  it('should respect custom limit parameter', async () => {
    // Mock storage adapter
    const mockGetNotificationHistory = jest.fn().mockResolvedValue([]);
    (getStorageAdapter as jest.Mock).mockReturnValue({
      getNotificationHistory: mockGetNotificationHistory,
    });

    // Create request with limit
    const request = new NextRequest('http://localhost:3000/api/notifications/history?limit=10');

    // Call handler
    const response = await GET(request, mockSession as any);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(200);
    expect(data.limit).toBe(10);
    expect(mockGetNotificationHistory).toHaveBeenCalledWith('user-123', 10);
  });

  it('should cap limit at 100', async () => {
    // Mock storage adapter
    const mockGetNotificationHistory = jest.fn().mockResolvedValue([]);
    (getStorageAdapter as jest.Mock).mockReturnValue({
      getNotificationHistory: mockGetNotificationHistory,
    });

    // Create request with excessive limit
    const request = new NextRequest('http://localhost:3000/api/notifications/history?limit=500');

    // Call handler
    const response = await GET(request, mockSession as any);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(200);
    expect(data.limit).toBe(100);
    expect(mockGetNotificationHistory).toHaveBeenCalledWith('user-123', 100);
  });

  it('should return 400 for invalid limit parameter', async () => {
    // Create request with invalid limit
    const request = new NextRequest('http://localhost:3000/api/notifications/history?limit=invalid');

    // Call handler
    const response = await GET(request, mockSession as any);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation Error');
  });

  it('should return 400 for negative limit', async () => {
    // Create request with negative limit
    const request = new NextRequest('http://localhost:3000/api/notifications/history?limit=-5');

    // Call handler
    const response = await GET(request, mockSession as any);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation Error');
  });

  it('should return empty array when no notifications exist', async () => {
    // Mock storage adapter with empty result
    const mockGetNotificationHistory = jest.fn().mockResolvedValue([]);
    (getStorageAdapter as jest.Mock).mockReturnValue({
      getNotificationHistory: mockGetNotificationHistory,
    });

    // Create request
    const request = new NextRequest('http://localhost:3000/api/notifications/history');

    // Call handler
    const response = await GET(request, mockSession as any);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(200);
    expect(data.notifications).toEqual([]);
    expect(data.count).toBe(0);
  });

  it('should handle storage errors gracefully', async () => {
    // Mock storage adapter to throw error
    const mockGetNotificationHistory = jest.fn().mockRejectedValue(new Error('Database error'));
    (getStorageAdapter as jest.Mock).mockReturnValue({
      getNotificationHistory: mockGetNotificationHistory,
    });

    // Create request
    const request = new NextRequest('http://localhost:3000/api/notifications/history');

    // Call handler
    const response = await GET(request, mockSession as any);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(500);
    expect(data.error).toBe('Internal Server Error');
  });
});
