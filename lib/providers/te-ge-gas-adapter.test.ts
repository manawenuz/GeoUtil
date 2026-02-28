/**
 * Tests for TeGeGasAdapter
 */

import axios from 'axios';
import { TeGeGasAdapter } from './te-ge-gas-adapter';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('TeGeGasAdapter', () => {
  let adapter: TeGeGasAdapter;

  beforeEach(() => {
    adapter = new TeGeGasAdapter();
    jest.clearAllMocks();
  });

  describe('Provider Metadata', () => {
    it('should have correct provider name', () => {
      expect(adapter.providerName).toBe('te.ge');
    });

    it('should have correct provider type', () => {
      expect(adapter.providerType).toBe('gas');
    });

    it('should have supported regions', () => {
      expect(adapter.supportedRegions).toEqual(['Tbilisi', 'Rustavi', 'Mtskheta']);
      expect(adapter.supportedRegions.length).toBeGreaterThan(0);
    });

    it('should return correct account number format', () => {
      expect(adapter.getAccountNumberFormat()).toBe('12 digits');
    });

    it('should return HTTPS endpoint URL', () => {
      const url = adapter.getEndpointUrl();
      expect(url).toMatch(/^https:\/\//);
    });

    it('should return 30 second timeout', () => {
      expect(adapter.getTimeout()).toBe(30000);
    });

    it('should return retry config with 3 attempts and exponential backoff', () => {
      const config = adapter.getRetryConfig();
      expect(config.maxRetries).toBe(3);
      expect(config.initialDelay).toBe(1000);
      expect(config.maxDelay).toBe(10000);
      expect(config.backoffMultiplier).toBe(2);
    });
  });

  describe('Account Number Validation', () => {
    it('should accept valid 12-digit account number', () => {
      expect(adapter.validateAccountNumber('123456789012')).toBe(true);
    });

    it('should accept 12-digit account number with spaces', () => {
      expect(adapter.validateAccountNumber('1234 5678 9012')).toBe(true);
    });

    it('should reject account number with less than 12 digits', () => {
      expect(adapter.validateAccountNumber('12345678901')).toBe(false);
    });

    it('should reject account number with more than 12 digits', () => {
      expect(adapter.validateAccountNumber('1234567890123')).toBe(false);
    });

    it('should reject account number with letters', () => {
      expect(adapter.validateAccountNumber('12345678901A')).toBe(false);
    });

    it('should reject empty account number', () => {
      expect(adapter.validateAccountNumber('')).toBe(false);
    });

    it('should reject account number with special characters', () => {
      expect(adapter.validateAccountNumber('123456-78901')).toBe(false);
    });
  });

  describe('Balance Fetching', () => {
    it('should successfully fetch and parse balance', async () => {
      const mockResponse = {
        data: '<html><body><div class="balance">123.45 ₾</div></body></html>',
      };
      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await adapter.fetchBalance('123456789012');

      expect(result.success).toBe(true);
      expect(result.balance).toBe(123.45);
      expect(result.currency).toBe('GEL');
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.error).toBeUndefined();
    });

    it('should parse balance without currency symbol', async () => {
      const mockResponse = {
        data: '<html><body><div class="balance">50.00</div></body></html>',
      };
      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await adapter.fetchBalance('123456789012');

      expect(result.success).toBe(true);
      expect(result.balance).toBe(50.00);
    });

    it('should parse balance with comma decimal separator', async () => {
      const mockResponse = {
        data: '<html><body><div class="balance">75,50 ₾</div></body></html>',
      };
      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await adapter.fetchBalance('123456789012');

      expect(result.success).toBe(true);
      expect(result.balance).toBe(75.50);
    });

    it('should parse zero balance', async () => {
      const mockResponse = {
        data: '<html><body><div class="balance">0.00 ₾</div></body></html>',
      };
      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await adapter.fetchBalance('123456789012');

      expect(result.success).toBe(true);
      expect(result.balance).toBe(0);
    });

    it('should handle balance with GEL text', async () => {
      const mockResponse = {
        data: '<html><body><div class="balance">100.00 GEL</div></body></html>',
      };
      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await adapter.fetchBalance('123456789012');

      expect(result.success).toBe(true);
      expect(result.balance).toBe(100.00);
    });

    it('should reject invalid account number immediately', async () => {
      const result = await adapter.fetchBalance('invalid');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid account number format');
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('should handle missing balance element', async () => {
      const mockResponse = {
        data: '<html><body><div class="other">No balance here</div></body></html>',
      };
      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await adapter.fetchBalance('123456789012');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Balance element not found');
      expect(result.rawResponse).toBeDefined();
    });

    it('should handle unparseable balance text', async () => {
      const mockResponse = {
        data: '<html><body><div class="balance">Not a number</div></body></html>',
      };
      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await adapter.fetchBalance('123456789012');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to parse balance');
      expect(result.rawResponse).toBeDefined();
    });

    it('should reject negative balance', async () => {
      const mockResponse = {
        data: '<html><body><div class="balance">-50.00 ₾</div></body></html>',
      };
      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await adapter.fetchBalance('123456789012');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid negative balance');
    });

    it('should make POST request with correct parameters', async () => {
      const mockResponse = {
        data: '<html><body><div class="balance">100.00 ₾</div></body></html>',
      };
      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      await adapter.fetchBalance('123456789012');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        adapter.getEndpointUrl(),
        { accountNumber: '123456789012' },
        expect.objectContaining({
          timeout: 30000,
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should clean account number spaces before request', async () => {
      const mockResponse = {
        data: '<html><body><div class="balance">100.00 ₾</div></body></html>',
      };
      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      await adapter.fetchBalance('1234 5678 9012');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        { accountNumber: '123456789012' },
        expect.any(Object)
      );
    });
  });

  describe('Error Handling and Retry Logic', () => {
    it('should retry on network error', async () => {
      const networkError = new Error('Network error');
      (networkError as any).code = 'ENOTFOUND';
      
      mockedAxios.post
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce({
          data: '<html><body><div class="balance">100.00 ₾</div></body></html>',
        });

      const result = await adapter.fetchBalance('123456789012');

      expect(result.success).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledTimes(3);
    });

    it('should retry on timeout', async () => {
      const timeoutError = new Error('Timeout');
      (timeoutError as any).code = 'ECONNABORTED';
      
      mockedAxios.post
        .mockRejectedValueOnce(timeoutError)
        .mockResolvedValueOnce({
          data: '<html><body><div class="balance">100.00 ₾</div></body></html>',
        });

      const result = await adapter.fetchBalance('123456789012');

      expect(result.success).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      const networkError = new Error('Network error');
      (networkError as any).code = 'ENOTFOUND';
      
      mockedAxios.post.mockRejectedValue(networkError);

      const result = await adapter.fetchBalance('123456789012');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed after 3 retries');
      expect(mockedAxios.post).toHaveBeenCalledTimes(4); // Initial + 3 retries
    }, 10000); // 10 second timeout for retry test

    it('should handle HTTP error responses', async () => {
      const httpError = {
        isAxiosError: true,
        response: {
          status: 500,
          statusText: 'Internal Server Error',
        },
        message: 'Request failed',
      };
      
      mockedAxios.post.mockRejectedValue(httpError);
      (mockedAxios.isAxiosError as any) = jest.fn().mockReturnValue(true);

      const result = await adapter.fetchBalance('123456789012');

      expect(result.success).toBe(false);
      expect(result.error).toContain('HTTP 500');
    }, 10000); // 10 second timeout for retry test

    it('should handle connection refused', async () => {
      const connError = new Error('Connection refused');
      (connError as any).code = 'ECONNREFUSED';
      
      mockedAxios.post.mockRejectedValue(connError);
      (mockedAxios.isAxiosError as any) = jest.fn().mockReturnValue(true);

      const result = await adapter.fetchBalance('123456789012');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Provider endpoint unreachable');
    }, 10000); // 10 second timeout for retry test

    it('should use exponential backoff for retries', async () => {
      const networkError = new Error('Network error');
      
      mockedAxios.post.mockRejectedValue(networkError);

      const startTime = Date.now();
      await adapter.fetchBalance('123456789012');
      const duration = Date.now() - startTime;

      // Should wait: 1000ms + 2000ms + 4000ms = 7000ms minimum
      // Allow some tolerance for execution time
      expect(duration).toBeGreaterThanOrEqual(6500);
    }, 10000); // 10 second timeout for retry test
  });

  describe('Configuration Methods', () => {
    it('should return consistent endpoint URL', () => {
      const url1 = adapter.getEndpointUrl();
      const url2 = adapter.getEndpointUrl();
      expect(url1).toBe(url2);
    });

    it('should return consistent timeout', () => {
      const timeout1 = adapter.getTimeout();
      const timeout2 = adapter.getTimeout();
      expect(timeout1).toBe(timeout2);
    });

    it('should return consistent retry config', () => {
      const config1 = adapter.getRetryConfig();
      const config2 = adapter.getRetryConfig();
      expect(config1).toEqual(config2);
    });
  });
});
