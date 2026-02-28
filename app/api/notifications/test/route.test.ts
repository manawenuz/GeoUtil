import { POST } from './route';
import { NextRequest } from 'next/server';
import { getStorageAdapter } from '@/lib/storage/factory';
import { createEncryptionService } from '@/lib/encryption';
import { NotificationService } from '@/lib/notification-service';

// Mock dependencies
jest.mock('@/lib/auth-helpers', () => ({
  withAuth: (handler: any) => handler,
}));

jest.mock('@/lib/storage/factory');
jest.mock('@/lib/encryption');
jest.mock('@/lib/notification-service');

describe('POST /api/notifications/test', () => {
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

  it('should send test notification successfully', async () => {
    // Mock user data
    const mockUser = {
      userId: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      emailVerified: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ntfyFeedUrl: 'encrypted-feed-url',
      ntfyServerUrl: 'https://ntfy.sh',
      notificationEnabled: true,
    };

    // Mock storage adapter
    const mockGetUser = jest.fn().mockResolvedValue(mockUser);
    (getStorageAdapter as jest.Mock).mockReturnValue({
      getUser: mockGetUser,
    });

    // Mock encryption service
    const mockDecrypt = jest.fn().mockReturnValue('https://ntfy.sh/test-topic');
    (createEncryptionService as jest.Mock).mockReturnValue({
      decrypt: mockDecrypt,
    });

    // Mock notification service
    const mockSendNotification = jest.fn().mockResolvedValue(true);
    (NotificationService as jest.Mock).mockImplementation(() => ({
      sendNotification: mockSendNotification,
    }));

    // Create request
    const request = new NextRequest('http://localhost:3000/api/notifications/test', {
      method: 'POST',
    });

    // Call handler
    const response = await POST(request, mockSession as any);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.deliveryTimestamp).toBeDefined();
    expect(mockGetUser).toHaveBeenCalledWith('user-123');
    expect(mockDecrypt).toHaveBeenCalledWith('encrypted-feed-url');
    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'test-topic',
        title: 'Test Notification',
        priority: 'default',
        tags: ['test', 'utility-monitor'],
      })
    );
  });

  it('should return 404 if user not found', async () => {
    // Mock storage adapter
    const mockGetUser = jest.fn().mockResolvedValue(null);
    (getStorageAdapter as jest.Mock).mockReturnValue({
      getUser: mockGetUser,
    });

    // Create request
    const request = new NextRequest('http://localhost:3000/api/notifications/test', {
      method: 'POST',
    });

    // Call handler
    const response = await POST(request, mockSession as any);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(404);
    expect(data.error).toBe('User Not Found');
  });

  it('should return 400 if notification configuration missing', async () => {
    // Mock user without notification config
    const mockUser = {
      userId: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      emailVerified: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ntfyFeedUrl: '',
      ntfyServerUrl: '',
      notificationEnabled: true,
    };

    // Mock storage adapter
    const mockGetUser = jest.fn().mockResolvedValue(mockUser);
    (getStorageAdapter as jest.Mock).mockReturnValue({
      getUser: mockGetUser,
    });

    // Create request
    const request = new NextRequest('http://localhost:3000/api/notifications/test', {
      method: 'POST',
    });

    // Call handler
    const response = await POST(request, mockSession as any);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(400);
    expect(data.error).toBe('Configuration Missing');
  });

  it('should return 500 if notification delivery fails', async () => {
    // Mock user data
    const mockUser = {
      userId: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      emailVerified: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ntfyFeedUrl: 'encrypted-feed-url',
      ntfyServerUrl: 'https://ntfy.sh',
      notificationEnabled: true,
    };

    // Mock storage adapter
    const mockGetUser = jest.fn().mockResolvedValue(mockUser);
    (getStorageAdapter as jest.Mock).mockReturnValue({
      getUser: mockGetUser,
    });

    // Mock encryption service
    const mockDecrypt = jest.fn().mockReturnValue('https://ntfy.sh/test-topic');
    (createEncryptionService as jest.Mock).mockReturnValue({
      decrypt: mockDecrypt,
    });

    // Mock notification service to fail
    const mockSendNotification = jest.fn().mockResolvedValue(false);
    (NotificationService as jest.Mock).mockImplementation(() => ({
      sendNotification: mockSendNotification,
    }));

    // Create request
    const request = new NextRequest('http://localhost:3000/api/notifications/test', {
      method: 'POST',
    });

    // Call handler
    const response = await POST(request, mockSession as any);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(500);
    expect(data.error).toBe('Delivery Failed');
    expect(data.success).toBe(false);
  });
});
