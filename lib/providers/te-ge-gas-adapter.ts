/**
 * Te.ge Gas Provider Adapter
 * 
 * Adapter for te.ge gas utility provider in Georgia.
 * Implements balance checking via HTML parsing.
 */

import axios, { AxiosError } from 'axios';
import * as cheerio from 'cheerio';
import { ProviderAdapter, BalanceResult, RetryConfig } from './types';

/**
 * Adapter for te.ge gas provider
 * 
 * This adapter implements balance checking for te.ge gas accounts
 * using HTTP POST requests and HTML parsing with Cheerio.
 */
export class TeGeGasAdapter implements ProviderAdapter {
  readonly providerName = 'te.ge';
  readonly providerType = 'gas' as const;
  readonly supportedRegions = ['Tbilisi', 'Rustavi', 'Mtskheta'];

  private readonly endpointUrl = 'https://te.ge/api/check-balance';
  private readonly timeout = 30000; // 30 seconds
  private readonly retryConfig: RetryConfig = {
    maxRetries: 3,
    initialDelay: 1000, // 1 second
    maxDelay: 10000, // 10 seconds
    backoffMultiplier: 2,
  };

  /**
   * Validates te.ge account number format
   * Account numbers must be exactly 12 digits
   */
  validateAccountNumber(accountNumber: string): boolean {
    const cleaned = accountNumber.replace(/\s/g, '');
    return /^\d{12}$/.test(cleaned);
  }

  /**
   * Returns the account number format description
   */
  getAccountNumberFormat(): string {
    return '12 digits';
  }

  /**
   * Fetches the current balance for a te.ge gas account
   * 
   * @param accountNumber - The 12-digit account number
   * @returns Promise resolving to the balance result
   */
  async fetchBalance(accountNumber: string): Promise<BalanceResult> {
    // Validate account number before making request
    if (!this.validateAccountNumber(accountNumber)) {
      return {
        balance: 0,
        currency: 'GEL',
        timestamp: new Date(),
        success: false,
        error: `Invalid account number format. Expected ${this.getAccountNumberFormat()}`,
      };
    }

    // Clean account number (remove spaces)
    const cleanedAccountNumber = accountNumber.replace(/\s/g, '');

    // Attempt to fetch balance with retry logic
    let lastError: string | undefined;
    let attempt = 0;

    while (attempt <= this.retryConfig.maxRetries) {
      try {
        const result = await this.attemptFetchBalance(cleanedAccountNumber);
        return result;
      } catch (error) {
        attempt++;
        lastError = this.formatError(error);

        // If we've exhausted retries, return failure
        if (attempt > this.retryConfig.maxRetries) {
          return {
            balance: 0,
            currency: 'GEL',
            timestamp: new Date(),
            success: false,
            error: `Failed after ${this.retryConfig.maxRetries} retries: ${lastError}`,
          };
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1),
          this.retryConfig.maxDelay
        );

        // Wait before retrying
        await this.sleep(delay);
      }
    }

    // This should never be reached, but TypeScript needs it
    return {
      balance: 0,
      currency: 'GEL',
      timestamp: new Date(),
      success: false,
      error: lastError || 'Unknown error',
    };
  }

  /**
   * Attempts to fetch balance once (without retry logic)
   */
  private async attemptFetchBalance(accountNumber: string): Promise<BalanceResult> {
    const timestamp = new Date();

    try {
      // Make POST request to te.ge endpoint
      const response = await axios.post(
        this.endpointUrl,
        { accountNumber },
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'GeorgiaUtilityMonitor/1.0',
          },
        }
      );

      // Parse HTML response with Cheerio
      const $ = cheerio.load(response.data);

      // Extract balance from HTML
      // Expected format: <div class="balance">123.45 ₾</div>
      const balanceText = $('.balance').text().trim();

      if (!balanceText) {
        return {
          balance: 0,
          currency: 'GEL',
          timestamp,
          success: false,
          error: 'Balance element not found in response',
          rawResponse: response.data,
        };
      }

      // Parse balance value
      const balance = this.parseBalance(balanceText);

      if (balance === null) {
        return {
          balance: 0,
          currency: 'GEL',
          timestamp,
          success: false,
          error: `Failed to parse balance from: "${balanceText}"`,
          rawResponse: response.data,
        };
      }

      // Validate balance is non-negative
      if (balance < 0) {
        return {
          balance: 0,
          currency: 'GEL',
          timestamp,
          success: false,
          error: `Invalid negative balance: ${balance}`,
          rawResponse: response.data,
        };
      }

      return {
        balance,
        currency: 'GEL',
        timestamp,
        success: true,
      };
    } catch (error) {
      throw error; // Let retry logic handle it
    }
  }

  /**
   * Parses balance text to extract numeric value
   * Handles various formats: "123.45 ₾", "123.45", "123,45", etc.
   */
  private parseBalance(balanceText: string): number | null {
    // Remove currency symbols and whitespace
    let cleaned = balanceText
      .replace(/₾/g, '')
      .replace(/GEL/gi, '')
      .replace(/\s/g, '')
      .trim();

    // Replace comma with period for decimal separator
    cleaned = cleaned.replace(',', '.');

    // Parse as float
    const value = parseFloat(cleaned);

    // Return null if parsing failed
    if (isNaN(value)) {
      return null;
    }

    // Round to 2 decimal places
    return Math.round(value * 100) / 100;
  }

  /**
   * Formats error for user-friendly display
   */
  private formatError(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      
      if (axiosError.code === 'ECONNABORTED') {
        return 'Request timeout';
      }
      
      if (axiosError.code === 'ENOTFOUND' || axiosError.code === 'ECONNREFUSED') {
        return 'Provider endpoint unreachable';
      }
      
      if (axiosError.response) {
        return `HTTP ${axiosError.response.status}: ${axiosError.response.statusText}`;
      }
      
      return axiosError.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown error';
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Returns the provider's endpoint URL
   */
  getEndpointUrl(): string {
    return this.endpointUrl;
  }

  /**
   * Returns the request timeout in milliseconds
   */
  getTimeout(): number {
    return this.timeout;
  }

  /**
   * Returns the retry configuration
   */
  getRetryConfig(): RetryConfig {
    return this.retryConfig;
  }
}
