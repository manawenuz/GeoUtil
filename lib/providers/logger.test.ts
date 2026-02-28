/**
 * Logger Utility Tests
 * 
 * Tests for production mode detection and sensitive data redaction.
 * 
 * Requirements: 11.7
 */

import {
  isProductionMode,
  redactAccountNumber,
  redactBalance,
  redactHeaders,
  truncateResponse,
} from './logger';

describe('Logger Utility', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('isProductionMode()', () => {
    it('should return true when NODE_ENV is production', () => {
      process.env.NODE_ENV = 'production';
      expect(isProductionMode()).toBe(true);
    });

    it('should return false when NODE_ENV is development', () => {
      process.env.NODE_ENV = 'development';
      expect(isProductionMode()).toBe(false);
    });

    it('should return false when NODE_ENV is test', () => {
      process.env.NODE_ENV = 'test';
      expect(isProductionMode()).toBe(false);
    });

    it('should return false when NODE_ENV is undefined', () => {
      delete process.env.NODE_ENV;
      expect(isProductionMode()).toBe(false);
    });
  });

  describe('redactAccountNumber()', () => {
    it('should return original account number in development mode', () => {
      process.env.NODE_ENV = 'development';
      expect(redactAccountNumber('123456789012')).toBe('123456789012');
    });

    it('should redact account number in production mode', () => {
      process.env.NODE_ENV = 'production';
      expect(redactAccountNumber('123456789012')).toBe('12********12');
    });

    it('should handle short account numbers in production mode', () => {
      process.env.NODE_ENV = 'production';
      expect(redactAccountNumber('1234')).toBe('****');
      expect(redactAccountNumber('123')).toBe('****');
    });

    it('should handle long account numbers in production mode', () => {
      process.env.NODE_ENV = 'production';
      expect(redactAccountNumber('12345678901234567890')).toBe('12****************90');
    });
  });

  describe('redactBalance()', () => {
    it('should return original balance in development mode', () => {
      process.env.NODE_ENV = 'development';
      expect(redactBalance(123.45)).toBe('123.45');
      expect(redactBalance(0)).toBe('0');
      expect(redactBalance(null)).toBe('null');
    });

    it('should redact balance in production mode', () => {
      process.env.NODE_ENV = 'production';
      expect(redactBalance(123.45)).toBe('[REDACTED]');
      expect(redactBalance(0)).toBe('[REDACTED]');
      expect(redactBalance(null)).toBe('[REDACTED]');
    });
  });

  describe('redactHeaders()', () => {
    it('should redact sensitive headers', () => {
      const headers = {
        'User-Agent': 'Test/1.0',
        'Authorization': 'Bearer secret-token',
        'API-Key': 'secret-key',
        'Content-Type': 'application/json',
        'X-API-Key': 'another-secret',
      };

      const redacted = redactHeaders(headers);

      expect(redacted['User-Agent']).toBe('Test/1.0');
      expect(redacted['Authorization']).toBe('[REDACTED]');
      expect(redacted['API-Key']).toBe('[REDACTED]');
      expect(redacted['Content-Type']).toBe('application/json');
      expect(redacted['X-API-Key']).toBe('[REDACTED]');
    });

    it('should handle case-insensitive header names', () => {
      const headers = {
        'authorization': 'Bearer secret',
        'AUTHORIZATION': 'Bearer secret2',
        'ApiKey': 'secret-key',
      };

      const redacted = redactHeaders(headers);

      expect(redacted['authorization']).toBe('[REDACTED]');
      expect(redacted['AUTHORIZATION']).toBe('[REDACTED]');
      expect(redacted['ApiKey']).toBe('[REDACTED]');
    });

    it('should handle empty headers object', () => {
      const redacted = redactHeaders({});
      expect(redacted).toEqual({});
    });
  });

  describe('truncateResponse()', () => {
    it('should not truncate short responses', () => {
      const response = 'Short response';
      expect(truncateResponse(response)).toBe(response);
    });

    it('should truncate long responses to default 200 characters', () => {
      const response = 'a'.repeat(300);
      const truncated = truncateResponse(response);
      expect(truncated.length).toBe(203); // 200 + '...'
      expect(truncated).toBe('a'.repeat(200) + '...');
    });

    it('should truncate to custom length', () => {
      const response = 'a'.repeat(300);
      const truncated = truncateResponse(response, 50);
      expect(truncated.length).toBe(53); // 50 + '...'
      expect(truncated).toBe('a'.repeat(50) + '...');
    });

    it('should handle responses exactly at max length', () => {
      const response = 'a'.repeat(200);
      expect(truncateResponse(response)).toBe(response);
    });
  });
});
