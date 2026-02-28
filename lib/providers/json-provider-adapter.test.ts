/**
 * Tests for JsonProviderAdapter
 * 
 * This file contains unit tests for the JsonProviderAdapter class,
 * focusing on the fetchBalance() method implementation.
 */

import { JsonProviderAdapter } from './json-provider-adapter';
import type { ProviderConfiguration } from './types';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.MockedFunction<typeof axios>;

describe('JsonProviderAdapter', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('fetchBalance() with GET request', () => {
    const config: ProviderConfiguration = {
      id: 'test-provider',
      name: 'test-provider',
      displayName: 'Test Provider',
      type: 'gas',
      regions: ['Tbilisi'],
      accountValidation: {
        pattern: '^\\d{12}$',
        formatDescription: '12 digits',
      },
      api: {
        endpoint: 'https://example.com/api/balance?account={{accountNumber}}',
        method: 'GET',
        headers: {
          'User-Agent': 'TestAgent/1.0',
          'Accept': 'application/json',
        },
      },
      parsing: {
        responseType: 'json',
        jsonPath: {
          balance: '$.balance',
          currency: '$.currency',
        },
      },
      retry: {
        maxRetries: 3,
        retryDelays: [1000, 2000, 4000],
        useExponentialBackoff: true,
      },
    };

    it('should replace {{accountNumber}} placeholder in URL', async () => {
      const adapter = new JsonProviderAdapter(config);
      const accountNumber = '123456789012';

      mockedAxios.mockResolvedValueOnce({
        data: { balance: 100.50, currency: 'GEL' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      await adapter.fetchBalance(accountNumber);

      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://example.com/api/balance?account=123456789012',
        })
      );
    });

    it('should include all configured headers', async () => {
      const adapter = new JsonProviderAdapter(config);
      const accountNumber = '123456789012';

      mockedAxios.mockResolvedValueOnce({
        data: { balance: 100.50, currency: 'GEL' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      await adapter.fetchBalance(accountNumber);

      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {
            'User-Agent': 'TestAgent/1.0',
            'Accept': 'application/json',
          },
        })
      );
    });

    it('should use GET method', async () => {
      const adapter = new JsonProviderAdapter(config);
      const accountNumber = '123456789012';

      mockedAxios.mockResolvedValueOnce({
        data: { balance: 100.50, currency: 'GEL' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      await adapter.fetchBalance(accountNumber);

      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should parse JSON response and return balance', async () => {
      const adapter = new JsonProviderAdapter(config);
      const accountNumber = '123456789012';

      mockedAxios.mockResolvedValueOnce({
        data: { balance: 100.50, currency: 'GEL' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await adapter.fetchBalance(accountNumber);

      expect(result.success).toBe(true);
      expect(result.balance).toBe(100.50);
      expect(result.currency).toBe('GEL');
    });

    it('should return error when parsing fails', async () => {
      const adapter = new JsonProviderAdapter(config);
      const accountNumber = '123456789012';

      mockedAxios.mockResolvedValueOnce({
        data: { wrongField: 'no balance here' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await adapter.fetchBalance(accountNumber);

      expect(result.success).toBe(false);
      expect(result.error).toContain('matched no data');
    });

    it('should return error when request fails', async () => {
      const adapter = new JsonProviderAdapter(config);
      const accountNumber = '123456789012';

      // Mock all retry attempts (initial + 3 retries = 4 total)
      const networkError = new Error('Network error');
      mockedAxios.mockRejectedValue(networkError);

      const result = await adapter.fetchBalance(accountNumber);

      expect(result.success).toBe(false);
      expect(result.error).toContain('API request failed after 3 retries');
      expect(result.error).toContain('Network error');
      
      // Verify it retried the correct number of times (initial + 3 retries = 4 total)
      expect(mockedAxios).toHaveBeenCalledTimes(4);
    }, 10000); // Increase timeout to account for retry delays
  });

  describe('fetchBalance() with POST request', () => {
    const config: ProviderConfiguration = {
      id: 'test-provider-post',
      name: 'test-provider-post',
      displayName: 'Test Provider POST',
      type: 'water',
      regions: ['Batumi'],
      accountValidation: {
        pattern: '^\\d{10}$',
        formatDescription: '10 digits',
      },
      api: {
        endpoint: 'https://example.com/api/check',
        method: 'POST',
        headers: {
          'User-Agent': 'TestAgent/1.0',
        },
        request: {
          contentType: 'application/json',
          body: {
            accountNumber: '{{accountNumber}}',
            action: 'getBalance',
          },
        },
      },
      parsing: {
        responseType: 'json',
        jsonPath: {
          balance: '$.data.balance',
        },
      },
      retry: {
        maxRetries: 2,
        retryDelays: [500, 1000],
        useExponentialBackoff: false,
      },
    };

    it('should use POST method with request body', async () => {
      const adapter = new JsonProviderAdapter(config);
      const accountNumber = '1234567890';

      mockedAxios.mockResolvedValueOnce({
        data: { data: { balance: 50.25 } },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      await adapter.fetchBalance(accountNumber);

      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          data: {
            accountNumber: '1234567890',
            action: 'getBalance',
          },
        })
      );
    });

    it('should include Content-Type header for POST', async () => {
      const adapter = new JsonProviderAdapter(config);
      const accountNumber = '1234567890';

      mockedAxios.mockResolvedValueOnce({
        data: { data: { balance: 50.25 } },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      await adapter.fetchBalance(accountNumber);

      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should replace placeholders in nested request body', async () => {
      const configWithNested: ProviderConfiguration = {
        ...config,
        api: {
          ...config.api,
          request: {
            contentType: 'application/json',
            body: {
              user: {
                account: '{{accountNumber}}',
                type: 'residential',
              },
              query: {
                fields: ['balance', 'dueDate'],
                accountId: '{{accountNumber}}',
              },
            },
          },
        },
      };

      const adapter = new JsonProviderAdapter(configWithNested);
      const accountNumber = '1234567890';

      mockedAxios.mockResolvedValueOnce({
        data: { data: { balance: 50.25 } },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      await adapter.fetchBalance(accountNumber);

      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            user: {
              account: '1234567890',
              type: 'residential',
            },
            query: {
              fields: ['balance', 'dueDate'],
              accountId: '1234567890',
            },
          },
        })
      );
    });
  });

  describe('fetchBalance() with HTML response', () => {
    const config: ProviderConfiguration = {
      id: 'test-provider-html',
      name: 'test-provider-html',
      displayName: 'Test Provider HTML',
      type: 'electricity',
      regions: ['Tbilisi'],
      accountValidation: {
        pattern: '^\\d{8}$',
        formatDescription: '8 digits',
      },
      api: {
        endpoint: 'https://example.com/balance/{{accountNumber}}',
        method: 'GET',
        headers: {
          'User-Agent': 'TestAgent/1.0',
        },
      },
      parsing: {
        responseType: 'html',
        cssSelectors: {
          balance: '.balance-amount',
          currency: '.currency',
        },
      },
      retry: {
        maxRetries: 3,
        retryDelays: [1000, 2000, 4000],
        useExponentialBackoff: true,
      },
    };

    it('should parse HTML response and return balance', async () => {
      const adapter = new JsonProviderAdapter(config);
      const accountNumber = '12345678';

      const htmlResponse = `
        <html>
          <body>
            <div class="balance-amount">75.50</div>
            <div class="currency">GEL</div>
          </body>
        </html>
      `;

      mockedAxios.mockResolvedValueOnce({
        data: htmlResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await adapter.fetchBalance(accountNumber);

      expect(result.success).toBe(true);
      expect(result.balance).toBe(75.50);
      expect(result.currency).toBe('GEL');
    });

    it('should handle HTML parsing errors', async () => {
      const adapter = new JsonProviderAdapter(config);
      const accountNumber = '12345678';

      const htmlResponse = `
        <html>
          <body>
            <div class="wrong-class">No balance here</div>
          </body>
        </html>
      `;

      mockedAxios.mockResolvedValueOnce({
        data: htmlResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await adapter.fetchBalance(accountNumber);

      expect(result.success).toBe(false);
      expect(result.error).toContain('matched no elements');
    });
  });

  describe('Retry logic', () => {
    const config: ProviderConfiguration = {
      id: 'test-retry',
      name: 'test-retry',
      displayName: 'Test Retry',
      type: 'gas',
      regions: ['Tbilisi'],
      accountValidation: {
        pattern: '^\\d{12}$',
        formatDescription: '12 digits',
      },
      api: {
        endpoint: 'https://example.com/api/balance?account={{accountNumber}}',
        method: 'GET',
        headers: {},
      },
      parsing: {
        responseType: 'json',
        jsonPath: {
          balance: '$.balance',
        },
      },
      retry: {
        maxRetries: 2,
        retryDelays: [100, 200], // Short delays for testing
        useExponentialBackoff: false,
      },
    };

    it('should NOT retry on HTTP 4xx errors', async () => {
      const adapter = new JsonProviderAdapter(config);
      const accountNumber = '123456789012';

      mockedAxios.mockResolvedValueOnce({
        data: 'Not Found',
        status: 404,
        statusText: 'Not Found',
        headers: {},
        config: {} as any,
      });

      const result = await adapter.fetchBalance(accountNumber);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Client error: HTTP 404');
      // Should only be called once (no retries)
      expect(mockedAxios).toHaveBeenCalledTimes(1);
    });

    it('should retry on HTTP 5xx errors', async () => {
      const adapter = new JsonProviderAdapter(config);
      const accountNumber = '123456789012';

      // Mock 3 failures (initial + 2 retries)
      mockedAxios.mockResolvedValue({
        data: 'Internal Server Error',
        status: 500,
        statusText: 'Internal Server Error',
        headers: {},
        config: {} as any,
      });

      const result = await adapter.fetchBalance(accountNumber);

      expect(result.success).toBe(false);
      expect(result.error).toContain('API request failed after 2 retries');
      expect(result.error).toContain('Server error: HTTP 500');
      // Should be called 3 times (initial + 2 retries)
      expect(mockedAxios).toHaveBeenCalledTimes(3);
    }, 5000);

    it('should use fixed delays when useExponentialBackoff is false', async () => {
      const adapter = new JsonProviderAdapter(config);
      const accountNumber = '123456789012';

      const startTime = Date.now();

      // Mock network errors for all attempts
      mockedAxios.mockRejectedValue(new Error('Network error'));

      await adapter.fetchBalance(accountNumber);

      const elapsed = Date.now() - startTime;

      // Should wait 100ms + 200ms = 300ms total (plus some overhead)
      // Allow for some timing variance
      expect(elapsed).toBeGreaterThanOrEqual(250);
      expect(elapsed).toBeLessThan(500);
    }, 5000);

    it('should use exponential backoff when useExponentialBackoff is true', async () => {
      const exponentialConfig: ProviderConfiguration = {
        ...config,
        retry: {
          maxRetries: 2,
          retryDelays: [100, 200, 400], // Initial delay is 100ms
          useExponentialBackoff: true,
        },
      };

      const adapter = new JsonProviderAdapter(exponentialConfig);
      const accountNumber = '123456789012';

      const startTime = Date.now();

      // Mock network errors for all attempts
      mockedAxios.mockRejectedValue(new Error('Network error'));

      await adapter.fetchBalance(accountNumber);

      const elapsed = Date.now() - startTime;

      // With exponential backoff: 100ms * 2^0 + 100ms * 2^1 = 100ms + 200ms = 300ms
      // Allow for some timing variance
      expect(elapsed).toBeGreaterThanOrEqual(250);
      expect(elapsed).toBeLessThan(500);
    }, 5000);

    it('should succeed on retry after initial failure', async () => {
      const adapter = new JsonProviderAdapter(config);
      const accountNumber = '123456789012';

      // First call fails with 500, second call succeeds
      mockedAxios
        .mockResolvedValueOnce({
          data: 'Internal Server Error',
          status: 500,
          statusText: 'Internal Server Error',
          headers: {},
          config: {} as any,
        })
        .mockResolvedValueOnce({
          data: { balance: 100.50 },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        });

      const result = await adapter.fetchBalance(accountNumber);

      expect(result.success).toBe(true);
      expect(result.balance).toBe(100.50);
      // Should be called twice (initial failure + 1 retry success)
      expect(mockedAxios).toHaveBeenCalledTimes(2);
    }, 5000);

    it('should retry on network errors', async () => {
      const adapter = new JsonProviderAdapter(config);
      const accountNumber = '123456789012';

      // Mock network errors for all attempts
      mockedAxios.mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await adapter.fetchBalance(accountNumber);

      expect(result.success).toBe(false);
      expect(result.error).toContain('API request failed after 2 retries');
      expect(result.error).toContain('ECONNREFUSED');
      // Should be called 3 times (initial + 2 retries)
      expect(mockedAxios).toHaveBeenCalledTimes(3);
    }, 5000);
  });
});
