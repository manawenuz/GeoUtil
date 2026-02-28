/**
 * Logger Utility for Provider System
 * 
 * Provides logging functions with production mode sensitive data redaction.
 * In production mode (NODE_ENV === 'production'), sensitive data such as
 * account numbers, balances, and credentials are redacted from logs.
 * 
 * Requirements: 11.7
 */

/**
 * Checks if the application is running in production mode
 * 
 * @returns true if NODE_ENV is 'production'
 */
export function isProductionMode(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Redacts an account number for logging in production mode
 * Shows only the first 2 and last 2 characters
 * 
 * @param accountNumber - The account number to redact
 * @returns Redacted account number in production, original in development
 */
export function redactAccountNumber(accountNumber: string): string {
  if (!isProductionMode()) {
    return accountNumber;
  }

  if (accountNumber.length <= 4) {
    return '****';
  }

  const first = accountNumber.substring(0, 2);
  const last = accountNumber.substring(accountNumber.length - 2);
  const middle = '*'.repeat(Math.max(4, accountNumber.length - 4));
  
  return `${first}${middle}${last}`;
}

/**
 * Redacts a balance amount for logging in production mode
 * 
 * @param balance - The balance amount to redact
 * @returns '[REDACTED]' in production, original value in development
 */
export function redactBalance(balance: number | null): string {
  if (!isProductionMode()) {
    return balance !== null ? balance.toString() : 'null';
  }

  return '[REDACTED]';
}

/**
 * Redacts sensitive headers (Authorization, API-Key, etc.) for logging
 * 
 * @param headers - The headers object to redact
 * @returns Headers with sensitive values redacted
 */
export function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const sensitiveHeaders = ['authorization', 'api-key', 'apikey', 'x-api-key', 'token'];
  const redacted: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (sensitiveHeaders.includes(key.toLowerCase())) {
      redacted[key] = '[REDACTED]';
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

/**
 * Truncates a response excerpt for logging
 * 
 * @param response - The response string to truncate
 * @param maxLength - Maximum length (default: 200)
 * @returns Truncated response with ellipsis if needed
 */
export function truncateResponse(response: string, maxLength: number = 200): string {
  if (response.length <= maxLength) {
    return response;
  }

  return response.substring(0, maxLength) + '...';
}
