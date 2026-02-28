import { NotificationService, NotificationPayload } from './notification-service';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    service = new NotificationService('https://ntfy.sh');
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should use provided server URL', () => {
      const customService = new NotificationService('https://custom.ntfy.sh');
      expect(customService.getDefaultServerUrl()).toBe('https://custom.ntfy.sh');
    });

    it('should use environment variable if no URL provided', () => {
      process.env.NTFY_SERVER_URL = 'https://env.ntfy.sh';
      const envService = new NotificationService();
      expect(envService.getDefaultServerUrl()).toBe('https://env.ntfy.sh');
      delete process.env.NTFY_SERVER_URL;
    });

    it('should default to https://ntfy.sh if no URL provided', () => {
      delete process.env.NTFY_SERVER_URL;
      const defaultService = new NotificationService();
      expect(defaultService.getDefaultServerUrl()).toBe('https://ntfy.sh');
    });
  });

  describe('sendNotification', () => {
    it('should send notification successfully', async () => {
      mockedAxios.post.mockResolvedValue({ status: 200 });

      const notification: NotificationPayload = {
        topic: 'test-topic',
        title: 'Test Notification',
        message: 'Test message',
        priority: 'default',
        tags: ['test'],
        serverUrl: 'https://ntfy.sh',
      };

      const result = await service.sendNotification(notification);

      expect(result).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://ntfy.sh/test-topic',
        'Test message',
        {
          headers: {
            'Title': 'Test Notification',
            'Priority': 'default',
            'Tags': 'test',
          },
          timeout: 10000,
        }
      );
    });

    it('should handle multiple tags', async () => {
      mockedAxios.post.mockResolvedValue({ status: 200 });

      const notification: NotificationPayload = {
        topic: 'test-topic',
        title: 'Test',
        message: 'Test',
        priority: 'high',
        tags: ['utility', 'bill', 'overdue'],
        serverUrl: 'https://ntfy.sh',
      };

      await service.sendNotification(notification);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Tags': 'utility,bill,overdue',
          }),
        })
      );
    });

    it('should return false on error', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Network error'));

      const notification: NotificationPayload = {
        topic: 'test-topic',
        title: 'Test',
        message: 'Test',
        priority: 'default',
        tags: [],
        serverUrl: 'https://ntfy.sh',
      };

      const result = await service.sendNotification(notification);

      expect(result).toBe(false);
    });

    it('should use custom server URL from notification', async () => {
      mockedAxios.post.mockResolvedValue({ status: 200 });

      const notification: NotificationPayload = {
        topic: 'my-topic',
        title: 'Test',
        message: 'Test',
        priority: 'default',
        tags: [],
        serverUrl: 'https://custom.server.com',
      };

      await service.sendNotification(notification);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://custom.server.com/my-topic',
        expect.any(String),
        expect.any(Object)
      );
    });
  });

  describe('determinePriority', () => {
    it('should return default priority for 0-7 days', () => {
      expect(service.determinePriority(0)).toBe('default');
      expect(service.determinePriority(1)).toBe('default');
      expect(service.determinePriority(7)).toBe('default');
    });

    it('should return high priority for 8-14 days', () => {
      expect(service.determinePriority(8)).toBe('high');
      expect(service.determinePriority(10)).toBe('high');
      expect(service.determinePriority(14)).toBe('high');
    });

    it('should return urgent priority for 15+ days', () => {
      expect(service.determinePriority(15)).toBe('urgent');
      expect(service.determinePriority(20)).toBe('urgent');
      expect(service.determinePriority(100)).toBe('urgent');
    });
  });

  describe('formatBalanceMessage', () => {
    it('should format message with provider, masked account, and balance', () => {
      const message = service.formatBalanceMessage(
        'te.ge Gas',
        '123456789012',
        45.50
      );

      expect(message).toContain('te.ge Gas');
      expect(message).toContain('********9012'); // Masked account
      expect(message).toContain('45.50 ₾');
    });

    it('should include overdue days when provided', () => {
      const message = service.formatBalanceMessage(
        'te.ge Gas',
        '123456789012',
        45.50,
        10
      );

      expect(message).toContain('Overdue: 10 days');
    });

    it('should use singular "day" for 1 day overdue', () => {
      const message = service.formatBalanceMessage(
        'te.ge Gas',
        '123456789012',
        45.50,
        1
      );

      expect(message).toContain('Overdue: 1 day');
      expect(message).not.toContain('days');
    });

    it('should not include overdue info when overdueDays is 0', () => {
      const message = service.formatBalanceMessage(
        'te.ge Gas',
        '123456789012',
        45.50,
        0
      );

      expect(message).not.toContain('Overdue');
    });

    it('should not include overdue info when overdueDays is undefined', () => {
      const message = service.formatBalanceMessage(
        'te.ge Gas',
        '123456789012',
        45.50
      );

      expect(message).not.toContain('Overdue');
    });

    it('should format balance with 2 decimal places', () => {
      const message1 = service.formatBalanceMessage('Provider', '12345678', 10);
      expect(message1).toContain('10.00 ₾');

      const message2 = service.formatBalanceMessage('Provider', '12345678', 10.5);
      expect(message2).toContain('10.50 ₾');

      const message3 = service.formatBalanceMessage('Provider', '12345678', 10.123);
      expect(message3).toContain('10.12 ₾');
    });

    it('should mask account numbers correctly', () => {
      // Long account number
      const message1 = service.formatBalanceMessage('Provider', '123456789012', 10);
      expect(message1).toContain('********9012');

      // Short account number (8 chars)
      const message2 = service.formatBalanceMessage('Provider', '12345678', 10);
      expect(message2).toContain('****5678');

      // Very short account number (4 chars or less)
      const message3 = service.formatBalanceMessage('Provider', '1234', 10);
      expect(message3).toContain('1234');
      expect(message3).not.toContain('*');
    });

    it('should handle special characters in provider name', () => {
      const message = service.formatBalanceMessage(
        'T.E. & Co. (Gas)',
        '123456789012',
        45.50
      );

      expect(message).toContain('T.E. & Co. (Gas)');
    });

    it('should handle large balance amounts', () => {
      const message = service.formatBalanceMessage(
        'Provider',
        '123456789012',
        1234567.89
      );

      expect(message).toContain('1234567.89 ₾');
    });

    it('should handle zero balance', () => {
      const message = service.formatBalanceMessage(
        'Provider',
        '123456789012',
        0
      );

      expect(message).toContain('0.00 ₾');
    });
  });

  describe('integration scenarios', () => {
    it('should create complete notification for new balance', async () => {
      mockedAxios.post.mockResolvedValue({ status: 200 });

      const message = service.formatBalanceMessage('te.ge Gas', '123456789012', 45.50);
      const priority = service.determinePriority(0);

      const notification: NotificationPayload = {
        topic: 'user-topic',
        title: 'Utility Bill Due',
        message,
        priority,
        tags: ['utility', 'bill'],
        serverUrl: 'https://ntfy.sh',
      };

      const result = await service.sendNotification(notification);

      expect(result).toBe(true);
      expect(priority).toBe('default');
      expect(message).toContain('te.ge Gas');
      expect(message).toContain('45.50 ₾');
    });

    it('should create escalated notification for overdue balance', async () => {
      mockedAxios.post.mockResolvedValue({ status: 200 });

      const overdueDays = 10;
      const message = service.formatBalanceMessage(
        'te.ge Gas',
        '123456789012',
        45.50,
        overdueDays
      );
      const priority = service.determinePriority(overdueDays);

      const notification: NotificationPayload = {
        topic: 'user-topic',
        title: 'Overdue Utility Bill',
        message,
        priority,
        tags: ['utility', 'bill', 'overdue'],
        serverUrl: 'https://ntfy.sh',
      };

      const result = await service.sendNotification(notification);

      expect(result).toBe(true);
      expect(priority).toBe('high');
      expect(message).toContain('Overdue: 10 days');
    });

    it('should create urgent notification for severely overdue balance', async () => {
      mockedAxios.post.mockResolvedValue({ status: 200 });

      const overdueDays = 20;
      const message = service.formatBalanceMessage(
        'te.ge Gas',
        '123456789012',
        45.50,
        overdueDays
      );
      const priority = service.determinePriority(overdueDays);

      expect(priority).toBe('urgent');
      expect(message).toContain('Overdue: 20 days');
    });
  });
});
