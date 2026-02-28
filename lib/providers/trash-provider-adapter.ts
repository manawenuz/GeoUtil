/**
 * Trash Provider Adapter (Stub)
 * 
 * Placeholder adapter for trash service providers in Georgia.
 * Returns placeholder data until real implementation is added.
 */

import { ProviderAdapter, BalanceResult, RetryConfig } from './types';

/**
 * Stub adapter for trash service providers
 * 
 * This is a placeholder implementation that returns mock data.
 * Replace with actual provider integration when API details are available.
 */
export class TrashProviderAdapter implements ProviderAdapter {
  readonly providerName = 'trash-provider-stub';
  readonly providerType = 'trash' as const;
  readonly supportedRegions = ['Tbilisi', 'Batumi', 'Kutaisi'];

  private readonly endpointUrl = 'https://example.com/trash-api';
  private readonly timeout = 30000; // 30 seconds
  private readonly retryConfig: RetryConfig = {
    maxRetries: 3,
    initialDelay: 1000, // 1 second
    maxDelay: 10000, // 10 seconds
    backoffMultiplier: 2,
  };

  /**
   * Validates trash provider account number format
   * Placeholder validation - accepts 6-12 alphanumeric characters
   */
  validateAccountNumber(accountNumber: string): boolean {
    const cleaned = accountNumber.replace(/\s/g, '');
    return /^[A-Za-z0-9]{6,12}$/.test(cleaned);
  }

  /**
   * Returns the account number format description
   */
  getAccountNumberFormat(): string {
    return '6-12 alphanumeric characters';
  }

  /**
   * Fetches the current balance for a trash service account
   * 
   * STUB IMPLEMENTATION: Returns placeholder data
   * 
   * @param accountNumber - The account number
   * @returns Promise resolving to placeholder balance result
   */
  async fetchBalance(accountNumber: string): Promise<BalanceResult> {
    // Validate account number
    if (!this.validateAccountNumber(accountNumber)) {
      return {
        balance: 0,
        currency: 'GEL',
        timestamp: new Date(),
        success: false,
        error: `Invalid account number format. Expected ${this.getAccountNumberFormat()}`,
      };
    }

    // Return placeholder data
    // TODO: Replace with actual API integration
    return {
      balance: 0,
      currency: 'GEL',
      timestamp: new Date(),
      success: true,
      rawResponse: 'STUB: No real provider integration yet',
    };
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
