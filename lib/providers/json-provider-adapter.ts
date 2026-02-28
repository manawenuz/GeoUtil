/**
 * JsonProviderAdapter - Generic provider adapter driven by JSON configuration
 * 
 * This class implements the ProviderAdapter interface using configuration-driven
 * logic, enabling new utility providers to be added through declarative JSON
 * configuration files instead of implementing code-based adapters.
 * 
 * The adapter:
 * - Validates account numbers using regex patterns from configuration
 * - Constructs API requests with placeholder replacement
 * - Parses responses using BalanceParser (HTML or JSON)
 * - Implements retry logic with exponential backoff
 * - Returns all metadata from configuration
 * 
 * Requirements: 8.1, 8.2, 8.5, 8.6, 8.7, 8.8, 3.2, 3.4
 */

import type {
  ProviderAdapter,
  ProviderConfiguration,
  BalanceResult,
  RetryConfig,
} from './types';
import { BalanceParser } from './balance-parser';
import { redactAccountNumber, redactHeaders, truncateResponse } from './logger';

export class JsonProviderAdapter implements ProviderAdapter {
  private config: ProviderConfiguration;
  private parser: BalanceParser;
  private accountNumberRegex: RegExp;

  /**
   * Creates a new JsonProviderAdapter instance
   * 
   * Initializes the adapter with the provided configuration, creates a
   * BalanceParser instance for response parsing, and compiles the account
   * number validation regex pattern.
   * 
   * @param config - The provider configuration object
   * @throws {Error} If the regex pattern in config.accountValidation.pattern is invalid
   * 
   * @example
   * ```typescript
   * const config: ProviderConfiguration = {
   *   id: 'example-provider',
   *   name: 'example-provider',
   *   displayName: 'Example Provider',
   *   type: 'gas',
   *   regions: ['Tbilisi'],
   *   accountValidation: {
   *     pattern: '^\\d{12}$',
   *     formatDescription: '12 digits'
   *   },
   *   // ... other config fields
   * };
   * const adapter = new JsonProviderAdapter(config);
   * ```
   */
  constructor(config: ProviderConfiguration) {
    this.config = config;
    this.parser = new BalanceParser(config.parsing);
    this.accountNumberRegex = new RegExp(config.accountValidation.pattern);
  }

  // Provider metadata getters (Requirements 8.5, 8.6, 8.7, 8.8)

  /**
   * Gets the internal provider name
   * 
   * @returns The provider name from configuration (e.g., "te.ge")
   * 
   * @example
   * ```typescript
   * const name = adapter.providerName; // "te.ge"
   * ```
   */
  get providerName(): string {
    return this.config.name;
  }

  /**
   * Gets the type of utility service
   * 
   * @returns The provider type (gas, water, electricity, or trash)
   * 
   * @example
   * ```typescript
   * const type = adapter.providerType; // "gas"
   * ```
   */
  get providerType(): 'gas' | 'water' | 'electricity' | 'trash' {
    return this.config.type;
  }

  /**
   * Gets the list of supported geographic regions
   * 
   * @returns Array of region names where this provider operates
   * 
   * @example
   * ```typescript
   * const regions = adapter.supportedRegions; // ["Tbilisi", "Batumi"]
   * ```
   */
  get supportedRegions(): string[] {
    return this.config.regions;
  }

  // Account validation (Requirements 3.2, 3.4)

  /**
   * Validates an account number using the regex pattern from configuration
   * 
   * Removes all whitespace from the account number before validation to allow
   * for flexible input formats (e.g., "1234 5678 9012" or "123456789012").
   * 
   * @param accountNumber - The account number to validate
   * @returns true if the account number matches the configured pattern, false otherwise
   * 
   * @example
   * ```typescript
   * // With pattern "^\d{12}$"
   * adapter.validateAccountNumber("123456789012"); // true
   * adapter.validateAccountNumber("1234 5678 9012"); // true (whitespace removed)
   * adapter.validateAccountNumber("12345"); // false (too short)
   * adapter.validateAccountNumber("abc123456789"); // false (contains letters)
   * ```
   */
  validateAccountNumber(accountNumber: string): boolean {
    const cleaned = accountNumber.replace(/\s/g, '');
    return this.accountNumberRegex.test(cleaned);
  }

  /**
   * Gets the human-readable format description for account numbers
   * 
   * Returns a description that can be shown to users to help them understand
   * the expected account number format.
   * 
   * @returns Format description (e.g., "12 digits", "Starts with 7 followed by 11 digits")
   * 
   * @example
   * ```typescript
   * const format = adapter.getAccountNumberFormat(); // "12 digits"
   * console.log(`Please enter your account number (${format})`);
   * ```
   */
  getAccountNumberFormat(): string {
    return this.config.accountValidation.formatDescription;
  }

  // Configuration getters

  /**
   * Gets the API endpoint URL from configuration
   * 
   * The URL may contain placeholders like {{accountNumber}} that will be
   * replaced when making actual requests.
   * 
   * @returns The endpoint URL template
   * 
   * @example
   * ```typescript
   * const url = adapter.getEndpointUrl();
   * // "https://example.com/api/balance?account={{accountNumber}}"
   * ```
   */
  getEndpointUrl(): string {
    return this.config.api.endpoint;
  }

  /**
   * Gets the request timeout in milliseconds
   * 
   * @returns Timeout in milliseconds (default: 30000 = 30 seconds)
   * 
   * @example
   * ```typescript
   * const timeout = adapter.getTimeout(); // 30000
   * ```
   */
  getTimeout(): number {
    return 30000; // Default 30 seconds
  }

  /**
   * Gets the retry configuration for failed requests
   * 
   * Constructs a RetryConfig object from the provider configuration,
   * including maximum retry attempts and delay settings.
   * 
   * @returns Retry configuration object with maxRetries, delays, and backoff settings
   * 
   * @example
   * ```typescript
   * const retryConfig = adapter.getRetryConfig();
   * // {
   * //   maxRetries: 3,
   * //   initialDelay: 1000,
   * //   maxDelay: 4000,
   * //   backoffMultiplier: 2
   * // }
   * ```
   */
  getRetryConfig(): RetryConfig {
    const delays = this.config.retry.retryDelays;
    return {
      maxRetries: this.config.retry.maxRetries,
      initialDelay: delays[0] || 1000,
      maxDelay: delays[delays.length - 1] || 10000,
      backoffMultiplier: 2,
    };
  }

  // Balance fetching (Requirements 8.3, 4.3, 4.4, 4.5, 4.6)

  /**
   * Fetches the current balance for an account
   * 
   * This method performs the following operations:
   * 1. Constructs API request with {{accountNumber}} placeholder replacement
   * 2. Includes all configured headers in the request
   * 3. Supports both GET and POST HTTP methods
   * 4. For POST requests, includes the configured request body
   * 5. Calls BalanceParser to extract data from the response
   * 6. Implements retry logic with exponential backoff or fixed delays
   * 7. Retries on network errors and HTTP 5xx status codes
   * 8. Does NOT retry on HTTP 4xx status codes (client errors)
   * 9. Returns the last error when all retry attempts are exhausted
   * 
   * @param accountNumber - The account number to check balance for
   * @returns Promise resolving to BalanceResult with balance data or error
   * 
   * @example
   * ```typescript
   * const result = await adapter.fetchBalance("123456789012");
   * if (result.success) {
   *   console.log(`Balance: ${result.balance} ${result.currency}`);
   * } else {
   *   console.error(`Error: ${result.error}`);
   * }
   * ```
   * 
   * @remarks
   * - Network errors and HTTP 5xx errors trigger retry attempts (Requirements 7.6)
   * - HTTP 4xx errors do NOT trigger retries (Requirement 7.7)
   * - Retry delays follow exponential backoff if configured (Requirement 7.3)
   * - Retry delays use fixed values if exponential backoff is disabled (Requirement 7.4)
   * - Maximum retry attempts are controlled by config.retry.maxRetries (Requirement 7.2)
   * - After exhausting retries, returns the last error encountered (Requirement 7.5)
   */
  async fetchBalance(accountNumber: string): Promise<BalanceResult> {
    let lastError: any = null;
    const maxRetries = this.config.retry.maxRetries;

    // Attempt the request with retries (Requirement 7.2)
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Replace {{accountNumber}} placeholders in endpoint URL (Requirement 4.3)
        const url = this.replacePlaceholders(this.config.api.endpoint, accountNumber);

        // Prepare request configuration
        const requestConfig: any = {
          method: this.config.api.method,
          url,
          headers: { ...this.config.api.headers }, // Include all configured headers (Requirement 4.4)
          timeout: this.getTimeout(),
          validateStatus: (status: number) => status < 600, // Don't throw on any status code
        };

        // For POST requests, include request body with placeholder replacement (Requirements 4.5, 4.6)
        if (this.config.api.method === 'POST' && this.config.api.request) {
          requestConfig.headers['Content-Type'] = this.config.api.request.contentType;
          requestConfig.data = this.replacePlaceholdersInObject(
            this.config.api.request.body,
            accountNumber
          );
        }

        // Make HTTP request using axios
        const axios = (await import('axios')).default;
        const response = await axios(requestConfig);

        // Check for HTTP 4xx errors - do NOT retry (Requirement 7.7)
        if (response.status >= 400 && response.status < 500) {
          // Log API request failures with provider id - Requirement 11.3
          console.error(
            `API request failed for provider ${this.config.id} (account: ${redactAccountNumber(accountNumber)}): HTTP ${response.status}`
          );
          return {
            balance: 0,
            currency: 'GEL',
            timestamp: new Date(),
            success: false,
            error: `Client error: HTTP ${response.status}`,
          };
        }

        // Check for HTTP 5xx errors - should retry (Requirement 7.6)
        if (response.status >= 500) {
          lastError = new Error(`Server error: HTTP ${response.status}`);
          // Log API request failures with provider id - Requirement 11.3
          console.error(
            `API request failed for provider ${this.config.id} (account: ${redactAccountNumber(accountNumber)}): HTTP ${response.status}, attempt ${attempt + 1}/${maxRetries + 1}`
          );
          if (attempt < maxRetries) {
            await this.delay(this.calculateDelay(attempt));
            continue;
          }
          // All retries exhausted, return last error (Requirement 7.5)
          return {
            balance: 0,
            currency: 'GEL',
            timestamp: new Date(),
            success: false,
            error: `API request failed after ${maxRetries} retries: ${lastError.message}`,
          };
        }

        // Parse response using BalanceParser
        const parseResult = this.parser.parse(
          typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
        );

        // Check if parsing was successful
        if (parseResult.error || parseResult.balance === null) {
          // Log parsing failures with response excerpt - Requirement 11.4
          const responseExcerpt = truncateResponse(
            typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
          );
          console.error(
            `Parsing failed for provider ${this.config.id} (account: ${redactAccountNumber(accountNumber)}): ${parseResult.error || 'Failed to extract balance'}. Response excerpt: ${responseExcerpt}`
          );
          return {
            balance: 0,
            currency: 'GEL',
            timestamp: new Date(),
            success: false,
            error: parseResult.error || 'Failed to extract balance from response',
            rawResponse: typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
          };
        }

        // Return successful result
        return {
          balance: parseResult.balance,
          currency: parseResult.currency || 'GEL',
          timestamp: new Date(),
          success: true,
          rawResponse: typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
        };
      } catch (error) {
        // Network errors should trigger retry (Requirement 7.6)
        lastError = error;
        
        // Log API request failures with provider id - Requirement 11.3
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(
          `API request failed for provider ${this.config.id} (account: ${redactAccountNumber(accountNumber)}): ${errorMessage}, attempt ${attempt + 1}/${maxRetries + 1}`
        );
        
        // If this was the last attempt, return the error (Requirement 7.5)
        if (attempt >= maxRetries) {
          return {
            balance: 0,
            currency: 'GEL',
            timestamp: new Date(),
            success: false,
            error: `API request failed after ${maxRetries} retries: ${errorMessage}`,
          };
        }

        // Wait before retrying (Requirements 7.3, 7.4)
        await this.delay(this.calculateDelay(attempt));
      }
    }

    // Fallback: return last error if we somehow exit the loop (Requirement 7.5)
    const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);
    return {
      balance: 0,
      currency: 'GEL',
      timestamp: new Date(),
      success: false,
      error: `API request failed after ${maxRetries} retries: ${errorMessage}`,
    };
  }

  /**
   * Calculates the delay before the next retry attempt
   * 
   * Uses exponential backoff when useExponentialBackoff is true (Requirement 7.3):
   * - delay = initialDelay * (2 ^ attempt)
   * - Example: 1000ms, 2000ms, 4000ms, 8000ms...
   * 
   * Uses fixed delays from retryDelays array when useExponentialBackoff is false (Requirement 7.4):
   * - Uses the delay value at the attempt index
   * - If attempt exceeds array length, uses the last delay value
   * - Example with [1000, 2000, 4000]: 1000ms, 2000ms, 4000ms, 4000ms...
   * 
   * @param attempt - The current attempt number (0-indexed)
   * @returns Delay in milliseconds before the next retry
   * 
   * @example
   * ```typescript
   * // With exponential backoff enabled and initialDelay=1000
   * calculateDelay(0); // 1000ms
   * calculateDelay(1); // 2000ms
   * calculateDelay(2); // 4000ms
   * 
   * // With fixed delays [1000, 2000, 4000]
   * calculateDelay(0); // 1000ms
   * calculateDelay(1); // 2000ms
   * calculateDelay(2); // 4000ms
   * calculateDelay(3); // 4000ms (uses last value)
   * ```
   */
  private calculateDelay(attempt: number): number {
    if (this.config.retry.useExponentialBackoff) {
      // Exponential backoff: delay = initialDelay * (2 ^ attempt)
      const initialDelay = this.config.retry.retryDelays[0] || 1000;
      return initialDelay * Math.pow(2, attempt);
    } else {
      // Fixed delays from retryDelays array
      // If attempt exceeds array length, use the last delay value
      const delays = this.config.retry.retryDelays;
      return delays[Math.min(attempt, delays.length - 1)] || 1000;
    }
  }

  /**
   * Delays execution for the specified number of milliseconds
   * 
   * Used internally to implement retry delays between failed request attempts.
   * 
   * @param ms - Milliseconds to delay
   * @returns Promise that resolves after the delay completes
   * 
   * @example
   * ```typescript
   * await this.delay(1000); // Wait 1 second
   * ```
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Replaces {{accountNumber}} placeholders in a string
   * 
   * Used to substitute account numbers into URL templates and other string values.
   * All occurrences of {{accountNumber}} are replaced with the actual account number.
   * 
   * @param template - The template string containing {{accountNumber}} placeholders
   * @param accountNumber - The account number to substitute
   * @returns The string with all placeholders replaced
   * 
   * @example
   * ```typescript
   * const url = replacePlaceholders(
   *   "https://api.example.com/balance?account={{accountNumber}}",
   *   "123456789012"
   * );
   * // Result: "https://api.example.com/balance?account=123456789012"
   * ```
   */
  private replacePlaceholders(template: string, accountNumber: string): string {
    return template.replace(/\{\{accountNumber\}\}/g, accountNumber);
  }

  /**
   * Replaces {{accountNumber}} placeholders in an object (for request body)
   * 
   * Recursively traverses the object structure and replaces all {{accountNumber}}
   * placeholders in string values. Handles nested objects and arrays.
   * 
   * @param obj - The object with potential placeholders (can be string, array, or object)
   * @param accountNumber - The account number to substitute
   * @returns The object with all placeholders replaced
   * 
   * @example
   * ```typescript
   * const body = replacePlaceholdersInObject(
   *   {
   *     user: "{{accountNumber}}",
   *     data: {
   *       account: "{{accountNumber}}",
   *       items: ["{{accountNumber}}", "other"]
   *     }
   *   },
   *   "123456789012"
   * );
   * // Result: {
   * //   user: "123456789012",
   * //   data: {
   * //     account: "123456789012",
   * //     items: ["123456789012", "other"]
   * //   }
   * // }
   * ```
   */
  private replacePlaceholdersInObject(obj: any, accountNumber: string): any {
    if (typeof obj === 'string') {
      return this.replacePlaceholders(obj, accountNumber);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.replacePlaceholdersInObject(item, accountNumber));
    }

    if (obj !== null && typeof obj === 'object') {
      const result: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          result[key] = this.replacePlaceholdersInObject(obj[key], accountNumber);
        }
      }
      return result;
    }

    return obj;
  }
}
