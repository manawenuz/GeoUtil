/**
 * Tests for TeGeGasAdapter
 */

import axios from 'axios';
import { TeGeGasAdapter } from './te-ge-gas-adapter';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

/** Build HTML response matching the real te.ge webpay page structure */
function makeTeGeHtml(balance: string, accountNumber = '473307-780'): string {
  return `<html><body>
    <div class="row MainFontRegular"><div class="col-md-4"><h3>აბონენტი:</h3></div><div class="col-md-8"><h3>Test User</h3></div></div>
    <div class="row MainFontRegular"><div class="col-md-4"><h3>მისამართი:</h3></div><div class="col-md-8"><h3>Test Address</h3></div></div>
    <div class="row MainFontRegular"><div class="col-md-4"><h3>დავალიანება:</h3></div><div class="col-md-8"><h3>${balance}</h3></div></div>
    <div class="row MainFontRegular"><div class="col-md-4"><h3>ბოლო ვადა:</h3></div><div class="col-md-8"><h3>2026-04-03</h3></div></div>
    <input value="${balance.replace(/[^\d.]/g, '')}" type="text" name="o.amount" id="amount">
    <input type="hidden" name="o.order_id" value="${accountNumber}">
  </body></html>`;
}

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
    });

    it('should return correct account number format', () => {
      expect(adapter.getAccountNumberFormat()).toBe('9 digits (XXXXXX-XXX) or 12 digits');
    });

    it('should return HTTPS endpoint URL', () => {
      expect(adapter.getEndpointUrl()).toMatch(/^https:\/\//);
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

    it('should accept valid 9-digit account number', () => {
      expect(adapter.validateAccountNumber('473307780')).toBe(true);
    });

    it('should accept 9-digit with dash', () => {
      expect(adapter.validateAccountNumber('473307-780')).toBe(true);
    });

    it('should accept account number with spaces', () => {
      expect(adapter.validateAccountNumber('473 307 780')).toBe(true);
    });

    it('should reject too short account number', () => {
      expect(adapter.validateAccountNumber('12345')).toBe(false);
    });

    it('should reject too long account number', () => {
      expect(adapter.validateAccountNumber('1234567890123')).toBe(false);
    });

    it('should reject non-numeric account number', () => {
      expect(adapter.validateAccountNumber('abcdefghi')).toBe(false);
    });

    it('should reject empty account number', () => {
      expect(adapter.validateAccountNumber('')).toBe(false);
    });
  });

  describe('Account Number Formatting', () => {
    it('should format 9-digit number with dash', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: makeTeGeHtml('100.00 ₾') });
      await adapter.fetchBalance('473307780');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        'abonentID=473307-780',
        expect.any(Object)
      );
    });

    it('should preserve dash in already formatted 9-digit number', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: makeTeGeHtml('100.00 ₾') });
      await adapter.fetchBalance('473307-780');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        'abonentID=473307-780',
        expect.any(Object)
      );
    });

    it('should not add dash to 12-digit numbers', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: makeTeGeHtml('100.00 ₾') });
      await adapter.fetchBalance('123456789012');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        'abonentID=123456789012',
        expect.any(Object)
      );
    });

    it('should remove spaces when formatting', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: makeTeGeHtml('100.00 ₾') });
      await adapter.fetchBalance('473 307 780');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        'abonentID=473307-780',
        expect.any(Object)
      );
    });
  });

  describe('Balance Fetching', () => {
    it('should successfully fetch and parse balance', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: makeTeGeHtml('123.45 ₾') });
      const result = await adapter.fetchBalance('123456789012');

      expect(result.success).toBe(true);
      expect(result.balance).toBe(123.45);
      expect(result.currency).toBe('GEL');
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should parse balance without currency symbol', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: makeTeGeHtml('50.00') });
      const result = await adapter.fetchBalance('123456789012');

      expect(result.success).toBe(true);
      expect(result.balance).toBe(50.00);
    });

    it('should parse balance with comma decimal separator', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: makeTeGeHtml('75,50 ₾') });
      const result = await adapter.fetchBalance('123456789012');

      expect(result.success).toBe(true);
      expect(result.balance).toBe(75.50);
    });

    it('should parse zero balance', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: makeTeGeHtml('0.00 ₾') });
      const result = await adapter.fetchBalance('123456789012');

      expect(result.success).toBe(true);
      expect(result.balance).toBe(0);
    });

    it('should handle balance with GEL text', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: makeTeGeHtml('100.00 GEL') });
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
      mockedAxios.post.mockResolvedValueOnce({
        data: '<html><body><div>No balance here</div></body></html>',
      });
      const result = await adapter.fetchBalance('123456789012');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Balance element not found');
    });

    it('should handle unparseable balance text', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: makeTeGeHtml('Not a number') });
      const result = await adapter.fetchBalance('123456789012');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to parse balance');
    });

    it('should reject negative balance', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: makeTeGeHtml('-50.00 ₾') });
      const result = await adapter.fetchBalance('123456789012');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid negative balance');
    });

    it('should make POST request with form-urlencoded content type', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: makeTeGeHtml('100.00 ₾') });
      await adapter.fetchBalance('123456789012');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        adapter.getEndpointUrl(),
        'abonentID=123456789012',
        expect.objectContaining({
          timeout: 30000,
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        })
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
        .mockResolvedValueOnce({ data: makeTeGeHtml('100.00 ₾') });

      const result = await adapter.fetchBalance('123456789012');

      expect(result.success).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      const networkError = new Error('Network error');
      (networkError as any).code = 'ENOTFOUND';

      mockedAxios.post.mockRejectedValue(networkError);

      const result = await adapter.fetchBalance('123456789012');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed after 3 retries');
      expect(mockedAxios.post).toHaveBeenCalledTimes(4);
    }, 15000);

    it('should handle HTTP error responses', async () => {
      const httpError = {
        isAxiosError: true,
        response: { status: 500, statusText: 'Internal Server Error' },
        message: 'Request failed',
      };
      mockedAxios.post.mockRejectedValue(httpError);
      (mockedAxios.isAxiosError as any) = jest.fn().mockReturnValue(true);

      const result = await adapter.fetchBalance('123456789012');

      expect(result.success).toBe(false);
      expect(result.error).toContain('HTTP 500');
    }, 15000);
  });
});
