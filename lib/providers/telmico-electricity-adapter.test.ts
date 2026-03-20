/**
 * Tests for TelmicoElectricityAdapter
 */

import axios from 'axios';
import { TelmicoElectricityAdapter } from './telmico-electricity-adapter';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

/** Mock the GET /pay page response that returns session cookie + CSRF token */
function mockPayPage(sessionCookie = 'TEST_SESSION', csrfToken = 'test-csrf-token') {
  return {
    data: `<html><head><meta name="_csrf" content="${csrfToken}"/></head><body>PAY ONLINE</body></html>`,
    headers: {
      'set-cookie': [`_tpcabinet_app_u_=${sessionCookie}; Path=/; HttpOnly`],
    },
  };
}

/** Mock the POST /pay/prepare JSON response */
function mockPrepareResponse(name: string, sum: number, success = true) {
  return {
    data: { success, message: success ? null : 'Error', data: { name, sum } },
    status: 200,
  };
}

describe('TelmicoElectricityAdapter', () => {
  let adapter: TelmicoElectricityAdapter;

  beforeEach(() => {
    adapter = new TelmicoElectricityAdapter();
    jest.clearAllMocks();
  });

  describe('Provider Metadata', () => {
    it('should have correct provider name', () => {
      expect(adapter.providerName).toBe('telmico');
    });

    it('should have correct provider type', () => {
      expect(adapter.providerType).toBe('electricity');
    });

    it('should have Tbilisi as supported region', () => {
      expect(adapter.supportedRegions).toContain('Tbilisi');
    });

    it('should return correct account number format', () => {
      expect(adapter.getAccountNumberFormat()).toBe('7 digits (e.g., 4823463)');
    });
  });

  describe('Account Number Validation', () => {
    it('should accept valid 7-digit account number', () => {
      expect(adapter.validateAccountNumber('4823463')).toBe(true);
    });

    it('should accept 7-digit with spaces', () => {
      expect(adapter.validateAccountNumber('482 3463')).toBe(true);
    });

    it('should accept 7-digit with dash', () => {
      expect(adapter.validateAccountNumber('482-3463')).toBe(true);
    });

    it('should reject 6-digit number', () => {
      expect(adapter.validateAccountNumber('482346')).toBe(false);
    });

    it('should reject 8-digit number', () => {
      expect(adapter.validateAccountNumber('48234630')).toBe(false);
    });

    it('should reject non-numeric', () => {
      expect(adapter.validateAccountNumber('abcdefg')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(adapter.validateAccountNumber('')).toBe(false);
    });
  });

  describe('Balance Fetching', () => {
    it('should auto-obtain session and fetch balance successfully', async () => {
      mockedAxios.get.mockResolvedValueOnce(mockPayPage());
      mockedAxios.post.mockResolvedValueOnce(mockPrepareResponse('ვ. ს.', 73.94));

      const result = await adapter.fetchBalance('4823463');

      expect(result.success).toBe(true);
      expect(result.balance).toBe(73.94);
      expect(result.currency).toBe('GEL');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/pay'),
        expect.any(Object)
      );

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/pay/prepare'),
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-CSRF-TOKEN': 'test-csrf-token',
            'Cookie': expect.stringContaining('TEST_SESSION'),
          }),
        })
      );
    });

    it('should handle zero balance', async () => {
      mockedAxios.get.mockResolvedValueOnce(mockPayPage());
      mockedAxios.post.mockResolvedValueOnce(mockPrepareResponse('ვ. ს.', 0.0));

      const result = await adapter.fetchBalance('4823463');

      expect(result.success).toBe(true);
      expect(result.balance).toBe(0);
    });

    it('should reject invalid account number immediately', async () => {
      const result = await adapter.fetchBalance('invalid');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid account number format');
      expect(mockedAxios.get).not.toHaveBeenCalled();
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('should handle API returning success=false', async () => {
      mockedAxios.get.mockResolvedValueOnce(mockPayPage());
      mockedAxios.post.mockResolvedValueOnce({
        data: { success: false, message: 'Account not found', data: null },
        status: 200,
      });

      const result = await adapter.fetchBalance('4823463');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Account not found');
    });

    it('should clean dashes/spaces from account number', async () => {
      mockedAxios.get.mockResolvedValueOnce(mockPayPage());
      mockedAxios.post.mockResolvedValueOnce(mockPrepareResponse('ვ. ს.', 10.0));

      await adapter.fetchBalance('482-3463');

      const postCall = mockedAxios.post.mock.calls[0];
      expect(postCall[1]).toContain('4823463');
    });
  });

  describe('Session Obtainment', () => {
    it('should fail if pay page returns no session cookie', async () => {
      mockedAxios.get.mockResolvedValue({
        data: '<html><head><meta name="_csrf" content="token"/></head></html>',
        headers: { 'set-cookie': [] },
      });

      const result = await adapter.fetchBalance('4823463');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed');
    }, 15000);

    it('should fail if pay page returns no CSRF token', async () => {
      mockedAxios.get.mockResolvedValue({
        data: '<html><head></head></html>',
        headers: { 'set-cookie': ['_tpcabinet_app_u_=ABC; Path=/'] },
      });

      const result = await adapter.fetchBalance('4823463');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed');
    }, 15000);
  });

  describe('Error Handling and Retry Logic', () => {
    it('should retry on network error with fresh session each time', async () => {
      const networkError = new Error('Network error');
      (networkError as any).code = 'ENOTFOUND';

      mockedAxios.get.mockResolvedValueOnce(mockPayPage('SESSION1'));
      mockedAxios.post.mockRejectedValueOnce(networkError);
      mockedAxios.get.mockResolvedValueOnce(mockPayPage('SESSION2'));
      mockedAxios.post.mockResolvedValueOnce(mockPrepareResponse('ვ. ს.', 50.0));

      const result = await adapter.fetchBalance('4823463');

      expect(result.success).toBe(true);
      expect(result.balance).toBe(50.0);
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      const networkError = new Error('Network error');
      (networkError as any).code = 'ENOTFOUND';

      mockedAxios.get.mockResolvedValue(mockPayPage());
      mockedAxios.post.mockRejectedValue(networkError);

      const result = await adapter.fetchBalance('4823463');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed after 3 retries');
    }, 15000);
  });
});
