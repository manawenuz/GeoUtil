/**
 * TELMICO Electricity Provider Adapter
 *
 * Adapter for TELMICO electricity utility provider in Tbilisi, Georgia.
 *
 * NO CONFIGURATION REQUIRED - the adapter automatically obtains a fresh
 * session cookie and CSRF token from the public payment page before each
 * balance check.
 */

import axios, { AxiosError } from 'axios';
import { ProviderAdapter, BalanceResult, RetryConfig } from './types';

export class TelmicoElectricityAdapter implements ProviderAdapter {
  readonly providerName = 'telmico';
  readonly providerType = 'electricity' as const;
  readonly supportedRegions = ['Tbilisi'];

  private readonly payPageUrl = 'https://my.telmico.ge/pay?locale=en';
  private readonly endpointUrl = 'https://my.telmico.ge/pay/prepare';
  private readonly timeout = 30000;
  private readonly retryConfig: RetryConfig = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
  };

  validateAccountNumber(accountNumber: string): boolean {
    const cleaned = accountNumber.replace(/[\s-]/g, '');
    return /^\d{7}$/.test(cleaned);
  }

  getAccountNumberFormat(): string {
    return '7 digits (e.g., 4823463)';
  }

  /**
   * Fetches a fresh session cookie and CSRF token from the public pay page.
   */
  private async obtainSession(): Promise<{ sessionCookie: string; csrfToken: string }> {
    const response = await axios.get(this.payPageUrl, {
      timeout: this.timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
        'Accept': 'text/html',
      },
      // axios doesn't handle cookies natively, extract from set-cookie header
      maxRedirects: 5,
    });

    // Extract session cookie from set-cookie header
    const setCookieHeaders: string[] = response.headers['set-cookie'] || [];
    let sessionCookie = '';
    for (const cookie of setCookieHeaders) {
      const match = cookie.match(/_tpcabinet_app_u_=([^;]+)/);
      if (match) {
        sessionCookie = match[1];
        break;
      }
    }

    if (!sessionCookie) {
      throw new Error('Failed to obtain session cookie from TELMICO pay page');
    }

    // Extract CSRF token from <meta name="_csrf" content="..."/>
    const csrfMatch = (response.data as string).match(/<meta\s+name="_csrf"\s+content="([^"]+)"/);
    if (!csrfMatch) {
      throw new Error('Failed to extract CSRF token from TELMICO pay page');
    }

    return { sessionCookie, csrfToken: csrfMatch[1] };
  }

  async fetchBalance(accountNumber: string): Promise<BalanceResult> {
    if (!this.validateAccountNumber(accountNumber)) {
      return {
        balance: 0,
        currency: 'GEL',
        timestamp: new Date(),
        success: false,
        error: `Invalid account number format. Expected ${this.getAccountNumberFormat()}`,
      };
    }

    const cleaned = accountNumber.replace(/[\s-]/g, '');

    let lastError: string | undefined;
    let attempt = 0;

    while (attempt <= this.retryConfig.maxRetries) {
      try {
        // Get fresh session + CSRF for each attempt
        const { sessionCookie, csrfToken } = await this.obtainSession();
        const result = await this.attemptFetchBalance(cleaned, sessionCookie, csrfToken);
        return result;
      } catch (error) {
        attempt++;
        lastError = this.formatError(error);

        if (attempt > this.retryConfig.maxRetries) {
          const result: BalanceResult = {
            balance: 0,
            currency: 'GEL',
            timestamp: new Date(),
            success: false,
            error: `Failed after ${this.retryConfig.maxRetries} retries: ${lastError}`,
          };

          if (axios.isAxiosError(error) && error.response) {
            result.httpStatus = error.response.status;
            result.rawResponse = JSON.stringify(error.response.data);
          }

          return result;
        }

        const delay = Math.min(
          this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1),
          this.retryConfig.maxDelay
        );
        await this.sleep(delay);
      }
    }

    return {
      balance: 0,
      currency: 'GEL',
      timestamp: new Date(),
      success: false,
      error: lastError || 'Unknown error',
    };
  }

  private async attemptFetchBalance(
    accountNumber: string,
    sessionCookie: string,
    csrfToken: string
  ): Promise<BalanceResult> {
    const timestamp = new Date();

    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const formData = `--${boundary}\r\nContent-Disposition: form-data; name="account"\r\n\r\n${accountNumber}\r\n--${boundary}--\r\n`;

    const response = await axios.post(
      this.endpointUrl,
      formData,
      {
        timeout: this.timeout,
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Cookie': `_tpcabinet_app_u_=${sessionCookie}; org.springframework.web.servlet.i18n.CookieLocaleResolver.LOCALE=en`,
          'X-CSRF-TOKEN': csrfToken,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
          'Origin': 'https://my.telmico.ge',
          'Referer': 'https://my.telmico.ge/pay?locale=en',
        },
      }
    );

    const data = response.data;

    if (!data.success) {
      return {
        balance: 0,
        currency: 'GEL',
        timestamp,
        success: false,
        error: data.message || 'TELMICO API returned success=false',
        rawResponse: JSON.stringify(data),
        httpStatus: response.status,
      };
    }

    const balance = parseFloat(data.data.sum);

    if (isNaN(balance)) {
      return {
        balance: 0,
        currency: 'GEL',
        timestamp,
        success: false,
        error: `Failed to parse balance from: "${data.data.sum}"`,
        rawResponse: JSON.stringify(data),
        httpStatus: response.status,
      };
    }

    return {
      balance,
      currency: 'GEL',
      timestamp,
      success: true,
    };
  }

  private formatError(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.code === 'ECONNABORTED') return 'Request timeout';
      if (axiosError.code === 'ENOTFOUND' || axiosError.code === 'ECONNREFUSED') return 'Provider endpoint unreachable';
      if (axiosError.response) return `HTTP ${axiosError.response.status}: ${axiosError.response.statusText}`;
      return axiosError.message;
    }
    if (error instanceof Error) return error.message;
    return 'Unknown error';
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getEndpointUrl(): string {
    return this.endpointUrl;
  }

  getTimeout(): number {
    return this.timeout;
  }

  getRetryConfig(): RetryConfig {
    return this.retryConfig;
  }
}
