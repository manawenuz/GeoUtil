/**
 * Type definitions for the JSON Provider Configuration system
 * 
 * This module defines all interfaces and types used by the JSON-based provider
 * configuration system, which enables adding new utility providers through
 * declarative JSON configuration files instead of implementing code-based adapters.
 * 
 * Key interfaces:
 * - ProviderAdapter: Contract for all provider implementations
 * - ProviderConfiguration: Complete JSON configuration structure
 * - BalanceResult: Result of balance fetch operations
 * - ParseResult: Result of response parsing operations
 * - ValidationResult: Result of configuration validation
 */

/**
 * Result of a balance fetch operation
 * 
 * Contains the balance information retrieved from a provider's API,
 * along with metadata about the request and any errors that occurred.
 */
export interface BalanceResult {
  /** 
   * Balance amount in Georgian Lari
   * Set to 0 if the fetch failed
   */
  balance: number;
  
  /** 
   * Currency code (typically "GEL" for Georgian Lari)
   * May be extracted from provider response or defaulted to "GEL"
   */
  currency: string;
  
  /** 
   * Timestamp when the balance was retrieved
   * Always set, even for failed requests
   */
  timestamp: Date;
  
  /** 
   * Whether the balance fetch was successful
   * false indicates an error occurred (see error field)
   */
  success: boolean;
  
  /** 
   * Error message if the fetch failed
   * Only present when success is false
   */
  error?: string;
  
  /** 
   * Raw response from provider for debugging purposes
   * May contain HTML or JSON depending on provider
   */
  rawResponse?: string;
  
  /**
   * HTTP status code from the provider response
   * Only present when an HTTP request was made
   */
  httpStatus?: number;
  
  /**
   * Message from the provider API
   * Only present when the provider returns a message field
   */
  apiMessage?: string;
}

/**
 * Retry configuration for provider requests
 * 
 * Defines how failed API requests should be retried, including
 * the number of attempts and delay strategy.
 */
export interface RetryConfig {
  /** 
   * Maximum number of retry attempts
   * 0 means no retries, only the initial attempt
   */
  maxRetries: number;
  
  /** 
   * Initial delay in milliseconds before first retry
   * Used as the base delay for exponential backoff
   */
  initialDelay: number;
  
  /** 
   * Maximum delay in milliseconds between retries
   * Prevents exponential backoff from growing too large
   */
  maxDelay: number;
  
  /** 
   * Multiplier for exponential backoff (e.g., 2 for doubling)
   * Each retry delay = previous delay * backoffMultiplier
   */
  backoffMultiplier: number;
}

/**
 * Provider adapter interface
 * 
 * All utility provider integrations must implement this interface
 * to enable consistent balance checking across different providers.
 * 
 * This interface is implemented by:
 * - Code-based adapters (e.g., TeGeGasAdapter)
 * - JsonProviderAdapter (configuration-driven)
 * 
 * @example
 * ```typescript
 * class MyProviderAdapter implements ProviderAdapter {
 *   get providerName() { return 'my-provider'; }
 *   get providerType() { return 'gas'; }
 *   get supportedRegions() { return ['Tbilisi']; }
 *   
 *   validateAccountNumber(accountNumber: string): boolean {
 *     return /^\d{12}$/.test(accountNumber);
 *   }
 *   
 *   getAccountNumberFormat(): string {
 *     return '12 digits';
 *   }
 *   
 *   async fetchBalance(accountNumber: string): Promise<BalanceResult> {
 *     // Implementation
 *   }
 *   
 *   // ... other methods
 * }
 * ```
 */
export interface ProviderAdapter {
  // Provider metadata
  
  /** 
   * Unique name of the provider (e.g., "te.ge")
   * Used internally to identify the provider
   */
  readonly providerName: string;
  
  /** 
   * Type of utility service
   * Determines how the provider is categorized in the UI
   */
  readonly providerType: 'gas' | 'water' | 'electricity' | 'trash';
  
  /** 
   * Regions where this provider operates (e.g., ['Tbilisi', 'Batumi'])
   * Used to filter providers by geographic location
   */
  readonly supportedRegions: string[];
  
  // Account validation
  
  /**
   * Validates an account number format
   * 
   * Should check if the account number matches the expected format
   * for this provider (e.g., correct length, character types).
   * 
   * @param accountNumber - The account number to validate
   * @returns true if the account number format is valid, false otherwise
   * 
   * @example
   * ```typescript
   * adapter.validateAccountNumber("123456789012"); // true
   * adapter.validateAccountNumber("12345"); // false (too short)
   * ```
   */
  validateAccountNumber(accountNumber: string): boolean;
  
  /**
   * Returns a human-readable description of the account number format
   * 
   * This description is shown to users to help them understand what
   * format their account number should be in.
   * 
   * @returns Format description (e.g., "12 digits", "Starts with 7")
   * 
   * @example
   * ```typescript
   * const format = adapter.getAccountNumberFormat();
   * console.log(`Please enter ${format}`); // "Please enter 12 digits"
   * ```
   */
  getAccountNumberFormat(): string;
  
  // Balance retrieval
  
  /**
   * Fetches the current balance for an account
   * 
   * Makes an API request to the provider to retrieve the current balance
   * for the specified account number. Implements retry logic for failed
   * requests and returns a BalanceResult with the balance data or error.
   * 
   * @param accountNumber - The account number to check
   * @returns Promise resolving to the balance result
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
   */
  fetchBalance(accountNumber: string): Promise<BalanceResult>;
  
  // Configuration
  
  /**
   * Returns the provider's API endpoint URL
   * 
   * The URL must use HTTPS for security. May contain placeholders
   * like {{accountNumber}} that are replaced when making requests.
   * 
   * @returns The endpoint URL (must be HTTPS)
   * 
   * @example
   * ```typescript
   * const url = adapter.getEndpointUrl();
   * // "https://api.provider.com/balance?account={{accountNumber}}"
   * ```
   */
  getEndpointUrl(): string;
  
  /**
   * Returns the request timeout in milliseconds
   * 
   * Specifies how long to wait for a response before timing out.
   * 
   * @returns Timeout in milliseconds (default: 30000 = 30 seconds)
   * 
   * @example
   * ```typescript
   * const timeout = adapter.getTimeout(); // 30000
   * ```
   */
  getTimeout(): number;
  
  /**
   * Returns the retry configuration for failed requests
   * 
   * Defines how many times to retry failed requests and what
   * delay strategy to use between attempts.
   * 
   * @returns Retry configuration object
   * 
   * @example
   * ```typescript
   * const config = adapter.getRetryConfig();
   * // {
   * //   maxRetries: 3,
   * //   initialDelay: 1000,
   * //   maxDelay: 10000,
   * //   backoffMultiplier: 2
   * // }
   * ```
   */
  getRetryConfig(): RetryConfig;
}

/**
 * Provider Configuration Interface
 * 
 * Defines the structure for JSON-based provider configurations.
 * This enables adding new providers through declarative JSON files
 * instead of implementing code-based adapters.
 * 
 * A complete provider configuration includes:
 * - Metadata (id, name, display name, type, regions)
 * - Account validation rules (regex pattern, format description)
 * - API configuration (endpoint, method, headers, request body)
 * - Response parsing rules (HTML selectors or JSON paths)
 * - Retry logic (max attempts, delays, backoff strategy)
 */

/**
 * Complete provider configuration loaded from providers.json
 * 
 * @example
 * ```typescript
 * const config: ProviderConfiguration = {
 *   id: 'example-gas',
 *   name: 'example.ge',
 *   displayName: 'Example Gas Company',
 *   type: 'gas',
 *   regions: ['Tbilisi', 'Batumi'],
 *   accountValidation: {
 *     pattern: '^\\d{12}$',
 *     formatDescription: '12 digits'
 *   },
 *   api: {
 *     endpoint: 'https://api.example.ge/balance?account={{accountNumber}}',
 *     method: 'GET',
 *     headers: {
 *       'User-Agent': 'GeorgiaUtilityMonitor/1.0'
 *     }
 *   },
 *   parsing: {
 *     responseType: 'html',
 *     cssSelectors: {
 *       balance: '.balance-amount',
 *       currency: '.currency-code'
 *     }
 *   },
 *   retry: {
 *     maxRetries: 3,
 *     retryDelays: [1000, 2000, 4000],
 *     useExponentialBackoff: true
 *   }
 * };
 * ```
 */
export interface ProviderConfiguration {
  /** 
   * Unique provider identifier in kebab-case (e.g., "te-ge-gas")
   * Must be unique across all providers
   */
  id: string;
  
  /** 
   * Internal provider name (e.g., "te.ge")
   * Used for internal identification and logging
   */
  name: string;
  
  /** 
   * User-facing display name (e.g., "Tbilisi Energy Gas")
   * Shown in the UI to end users
   */
  displayName: string;
  
  /** 
   * Type of utility service
   * Determines categorization and icon in the UI
   */
  type: 'gas' | 'water' | 'electricity' | 'trash';
  
  /** 
   * Supported geographic regions
   * Used to filter providers by location
   */
  regions: string[];
  
  /** 
   * Account number validation configuration
   * Defines how to validate account numbers for this provider
   */
  accountValidation: AccountValidationConfig;
  
  /** 
   * API request configuration
   * Defines how to make requests to the provider's API
   */
  api: ApiConfig;
  
  /** 
   * Response parsing configuration
   * Defines how to extract balance data from API responses
   */
  parsing: ParsingConfig;
  
  /** 
   * Retry logic configuration
   * Defines how to handle failed requests
   */
  retry: RetryConfiguration;
}

/**
 * Account number validation configuration
 * 
 * Defines how to validate account numbers for a provider.
 */
export interface AccountValidationConfig {
  /** 
   * Regex pattern for validating account numbers
   * Must be a valid JavaScript regular expression
   * 
   * @example "^\\d{12}$" for 12 digits
   * @example "^7\\d{11}$" for 12 digits starting with 7
   */
  pattern: string;
  
  /** 
   * Human-readable description of the expected format
   * Shown to users when validation fails
   * 
   * @example "12 digits"
   * @example "Starts with 7 followed by 11 digits"
   */
  formatDescription: string;
}

/**
 * API request configuration
 * 
 * Defines how to construct and send requests to the provider's API.
 */
export interface ApiConfig {
  /** 
   * API endpoint URL with {{accountNumber}} placeholder
   * Must use HTTPS for security
   * 
   * @example "https://api.provider.com/balance?account={{accountNumber}}"
   */
  endpoint: string;
  
  /** 
   * HTTP method
   * GET for simple requests, POST for requests with body
   */
  method: 'GET' | 'POST';
  
  /** 
   * HTTP headers to include in requests
   * Common headers: User-Agent, Accept, Content-Type
   * 
   * @example { "User-Agent": "GeorgiaUtilityMonitor/1.0" }
   */
  headers: Record<string, string>;
  
  /** 
   * Request body configuration (for POST requests)
   * Only used when method is POST
   */
  request?: RequestConfig;
}

/**
 * Request body configuration for POST requests
 * 
 * Defines the body content and content type for POST requests.
 */
export interface RequestConfig {
  /** 
   * Request body template with placeholders
   * Placeholders like {{accountNumber}} are replaced with actual values
   * 
   * @example { "accountNumber": "{{accountNumber}}", "type": "balance" }
   */
  body: Record<string, any>;
  
  /** 
   * Content-Type header value
   * Common values: "application/json", "application/x-www-form-urlencoded"
   * 
   * @example "application/json"
   */
  contentType: string;
}

/**
 * Response parsing configuration
 * 
 * Defines how to extract balance data from API responses.
 * Must include either cssSelectors (for HTML) or jsonPath (for JSON).
 */
export interface ParsingConfig {
  /** 
   * Response format type
   * Determines which parsing method to use
   */
  responseType: 'html' | 'json';
  
  /** 
   * CSS selectors for HTML parsing
   * Required when responseType is 'html'
   */
  cssSelectors?: CssSelectorConfig;
  
  /** 
   * JSONPath expressions for JSON parsing
   * Required when responseType is 'json'
   */
  jsonPath?: JsonPathConfig;
}

/**
 * CSS selector configuration for HTML parsing
 * 
 * Defines CSS selectors to extract data from HTML responses.
 */
export interface CssSelectorConfig {
  /** 
   * CSS selector for balance amount (required)
   * Must match an element containing the numeric balance
   * 
   * @example ".balance-amount"
   * @example "#account-balance"
   */
  balance: string;
  
  /** 
   * CSS selector for currency code (optional)
   * If not provided, defaults to "GEL"
   * 
   * @example ".currency-code"
   */
  currency?: string;
  
  /** 
   * CSS selector for due date (optional)
   * If not provided, dueDate will be null
   * 
   * @example ".due-date"
   */
  dueDate?: string;
}

/**
 * JSONPath configuration for JSON parsing
 * 
 * Defines JSONPath expressions to extract data from JSON responses.
 */
export interface JsonPathConfig {
  /** 
   * JSONPath expression for balance amount (required)
   * Must match a numeric value in the JSON response
   * 
   * @example "$.data.balance"
   * @example "$.account.currentBalance"
   */
  balance: string;
  
  /** 
   * JSONPath expression for currency code (optional)
   * If not provided, defaults to "GEL"
   * 
   * @example "$.data.currency"
   */
  currency?: string;
  
  /** 
   * JSONPath expression for due date (optional)
   * If not provided, dueDate will be null
   * 
   * @example "$.data.dueDate"
   */
  dueDate?: string;
}

/**
 * Retry configuration for failed requests
 * 
 * Defines how to retry failed API requests.
 */
export interface RetryConfiguration {
  /** 
   * Maximum number of retry attempts
   * 0 means no retries, only the initial attempt
   * 
   * @example 3 for up to 3 retries (4 total attempts)
   */
  maxRetries: number;
  
  /** 
   * Delay in milliseconds for each retry attempt
   * Used when useExponentialBackoff is false
   * 
   * @example [1000, 2000, 4000] for 1s, 2s, 4s delays
   */
  retryDelays: number[];
  
  /** 
   * Whether to use exponential backoff
   * - true: delay doubles each attempt (1s, 2s, 4s, 8s...)
   * - false: uses delays from retryDelays array
   */
  useExponentialBackoff: boolean;
}

/**
 * Result of parsing a provider response
 * 
 * Contains the extracted balance data or an error if parsing failed.
 */
export interface ParseResult {
  /** 
   * Extracted balance amount (null if extraction failed)
   * Numeric value representing the account balance
   */
  balance: number | null;
  
  /** 
   * Extracted currency code (null if not found or extraction failed)
   * Typically "GEL" for Georgian providers
   */
  currency: string | null;
  
  /** 
   * Extracted due date (null if not found or extraction failed)
   * Date when payment is due
   */
  dueDate: Date | null;
  
  /** 
   * Error message if parsing failed
   * Only present when parsing encountered an error
   */
  error?: string;
}

/**
 * Result of configuration validation
 * 
 * Contains validation status and any errors found.
 */
export interface ValidationResult {
  /** 
   * Whether the configuration is valid
   * true if no errors were found
   */
  valid: boolean;
  
  /** 
   * List of validation errors (empty if valid)
   * Each error is a human-readable description of what's wrong
   */
  errors: string[];
}

/**
 * Container for provider configurations loaded from JSON
 * 
 * Root structure of the providers.json file.
 * 
 * @example
 * ```json
 * {
 *   "providers": [
 *     {
 *       "id": "provider-1",
 *       "name": "provider-1",
 *       ...
 *     },
 *     {
 *       "id": "provider-2",
 *       "name": "provider-2",
 *       ...
 *     }
 *   ]
 * }
 * ```
 */
export interface ProvidersConfig {
  /** 
   * Array of provider configurations
   * Each configuration defines a complete provider setup
   */
  providers: ProviderConfiguration[];
}
