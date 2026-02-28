# JSON Provider Configuration System

## Overview

The JSON Provider Configuration System enables adding new utility providers through declarative JSON configuration files instead of implementing code-based adapters. This system maintains full backward compatibility with existing code-based adapters while providing a flexible, configuration-driven approach for new providers.

### Key Features

- **Declarative Configuration**: Define provider behavior through JSON rather than TypeScript code
- **Backward Compatible**: Existing code-based adapters continue working unchanged
- **Flexible Parsing**: Support both HTML (CSS selectors) and JSON (JSONPath) response formats
- **Robust Error Handling**: Graceful degradation with comprehensive logging
- **Configuration Validation**: Detect errors at startup before affecting users
- **Retry Logic**: Built-in exponential backoff and fixed delay retry mechanisms

### Architecture Components

The system consists of five primary components:

1. **providers.json**: Configuration file containing provider definitions
2. **ConfigValidator**: Validates configuration structure and content at load time
3. **JsonProviderAdapter**: Generic adapter implementing ProviderAdapter interface using configuration
4. **BalanceParser**: Extracts balance data from HTML or JSON responses
5. **Factory**: Loads configurations and registers adapters with the registry

## How It Works

### Initialization Flow

1. **Factory Initialization**: `createProviderRegistry()` is called at application startup
2. **Code-Based Registration**: Existing code-based adapters are registered first (they take precedence)
3. **Configuration Loading**: `providers.json` is loaded from the project root
4. **Validation**: Each provider configuration is validated using ConfigValidator
5. **Adapter Creation**: Valid configurations create JsonProviderAdapter instances
6. **Registry Registration**: Adapters are registered with the ProviderRegistry
7. **Logging**: Success and error messages are logged for monitoring

### Balance Check Flow

1. **Request Initiation**: Application calls `adapter.fetchBalance(accountNumber)`
2. **Account Validation**: Account number is validated using the configured regex pattern
3. **URL Construction**: Endpoint URL is constructed with {{accountNumber}} placeholder replacement
4. **HTTP Request**: Request is made with configured method, headers, and body (if POST)
5. **Response Parsing**: BalanceParser extracts data using CSS selectors or JSONPath
6. **Retry Logic**: Failed requests are retried with exponential backoff or fixed delays
7. **Result Return**: BalanceResult is returned with success/error status


## Creating Provider Configurations

### Basic Structure

Every provider configuration must include these sections:

```json
{
  "id": "unique-provider-id",
  "name": "provider-name",
  "displayName": "User-Facing Provider Name",
  "type": "gas|water|electricity|trash",
  "regions": ["Region1", "Region2"],
  "accountValidation": { /* validation rules */ },
  "api": { /* API configuration */ },
  "parsing": { /* response parsing rules */ },
  "retry": { /* retry configuration */ }
}
```

### Provider Metadata

**id** (required, string, pattern: `^[a-z0-9-]+$`)
- Unique identifier in kebab-case format
- Used internally for provider identification
- Must be unique across all providers (code-based and JSON-based)
- Example: `"tbilisi-water-company"`

**name** (required, string)
- Internal name used for provider lookup
- Should match the id for consistency
- Example: `"tbilisi-water-company"`

**displayName** (required, string)
- User-facing name shown in the UI
- Can include spaces, capitals, and special characters
- Example: `"Tbilisi Water Company (თბილისის წყალი)"`

**type** (required, enum)
- Utility service category
- Allowed values: `"gas"`, `"water"`, `"electricity"`, `"trash"`
- Used for filtering and categorization in the UI

**regions** (required, array of strings)
- Geographic regions where the provider operates
- Used for location-based filtering
- Example: `["Tbilisi", "Batumi", "Kutaisi"]`

### Account Validation Configuration

The `accountValidation` object defines how account numbers are validated before making API requests.

```json
{
  "accountValidation": {
    "pattern": "^\\d{12}$",
    "formatDescription": "12 digits (e.g., 123456789012)"
  }
}
```

**pattern** (required, string)
- Regular expression pattern for validation
- Must be a valid JavaScript regex
- Remember to escape backslashes in JSON: `\\d` not `\d`
- Whitespace is automatically stripped before validation
- Examples:
  - `"^\\d{10}$"` - Exactly 10 digits
  - `"^[A-Z]{2}\\d{8}$"` - 2 uppercase letters + 8 digits
  - `"^\\d{4}-\\d{4}-\\d{4}$"` - 12 digits with dashes

**formatDescription** (required, string)
- Human-readable description of the expected format
- Shown to users when validation fails
- Should include an example
- Example: `"12 digits (e.g., 123456789012)"`

### API Configuration

The `api` object defines how to make HTTP requests to the provider's API.

#### GET Request Example

```json
{
  "api": {
    "endpoint": "https://api.provider.ge/balance?account={{accountNumber}}",
    "method": "GET",
    "headers": {
      "User-Agent": "GeorgiaUtilityMonitor/1.0",
      "Accept": "application/json",
      "Accept-Language": "ka,en"
    }
  }
}
```

#### POST Request Example

```json
{
  "api": {
    "endpoint": "https://api.provider.ge/balance/check",
    "method": "POST",
    "headers": {
      "User-Agent": "GeorgiaUtilityMonitor/1.0",
      "Accept": "application/json"
    },
    "request": {
      "body": {
        "accountNumber": "{{accountNumber}}",
        "includeHistory": false
      },
      "contentType": "application/json"
    }
  }
}
```

**endpoint** (required, string, URL format)
- API endpoint URL
- Use `{{accountNumber}}` placeholder for account number substitution
- Placeholder is replaced at runtime with the actual account number
- Example: `"https://api.provider.ge/balance?account={{accountNumber}}"`

**method** (required, enum)
- HTTP method for the request
- Allowed values: `"GET"`, `"POST"`
- Use GET for simple queries, POST for complex requests

**headers** (required, object)
- HTTP headers to include in the request
- Key-value pairs of header names and values
- Common headers:
  - `User-Agent`: Identifies the application
  - `Accept`: Specifies expected response format
  - `Accept-Language`: Specifies preferred language
  - `Authorization`: For API authentication (if required)

**request** (optional, required for POST)
- Request body configuration for POST requests
- Contains two fields:
  - `body`: Object with request body template (supports `{{accountNumber}}` placeholder)
  - `contentType`: Content-Type header value (e.g., `"application/json"`)

### Response Parsing Configuration

The `parsing` object defines how to extract balance data from API responses. The system supports two response types: HTML and JSON.

#### HTML Response Parsing

For providers that return HTML responses, use CSS selectors to extract data:

```json
{
  "parsing": {
    "responseType": "html",
    "cssSelectors": {
      "balance": ".account-balance .amount",
      "currency": ".account-balance .currency",
      "dueDate": ".payment-info .due-date"
    }
  }
}
```

**responseType** (required, enum)
- Must be `"html"` for HTML responses
- Triggers HTML parsing using cheerio library

**cssSelectors** (required for HTML, object)
- CSS selectors for extracting data from HTML
- **balance** (required): Selector for balance amount
- **currency** (optional): Selector for currency code
- **dueDate** (optional): Selector for payment due date

**CSS Selector Tips:**
- Use specific selectors to avoid ambiguity
- Test selectors in browser DevTools: `document.querySelector('.balance')`
- The first matching element is used
- Text content is extracted and trimmed automatically
- Balance text is converted to number (handles currency symbols, separators)

#### JSON Response Parsing

For providers that return JSON responses, use JSONPath expressions to extract data:

```json
{
  "parsing": {
    "responseType": "json",
    "jsonPath": {
      "balance": "$.data.balance.amount",
      "currency": "$.data.balance.currency",
      "dueDate": "$.data.payment.dueDate"
    }
  }
}
```

**responseType** (required, enum)
- Must be `"json"` for JSON responses
- Triggers JSON parsing using jsonpath-plus library

**jsonPath** (required for JSON, object)
- JSONPath expressions for extracting data from JSON
- **balance** (required): Path to balance amount
- **currency** (optional): Path to currency code
- **dueDate** (optional): Path to payment due date

**JSONPath Expression Tips:**
- Start with `$` to reference the root object
- Use `.` for object property access: `$.data.balance`
- Use `[]` for array access: `$.items[0]`
- Test expressions online: https://jsonpath.com/
- The first matching value is used
- Values are automatically converted to appropriate types

### Retry Configuration

The `retry` object defines how failed API requests are retried.

#### Exponential Backoff Example

```json
{
  "retry": {
    "maxRetries": 3,
    "retryDelays": [1000, 2000, 4000],
    "useExponentialBackoff": true
  }
}
```

With exponential backoff enabled:
- Attempt 1: Wait 1000ms (1s)
- Attempt 2: Wait 2000ms (2s)
- Attempt 3: Wait 4000ms (4s)
- Attempt 4: Wait 8000ms (8s)

#### Fixed Delay Example

```json
{
  "retry": {
    "maxRetries": 2,
    "retryDelays": [1500, 3000],
    "useExponentialBackoff": false
  }
}
```

With fixed delays:
- Attempt 1: Wait 1500ms
- Attempt 2: Wait 3000ms
- Attempt 3: Wait 3000ms (uses last value)

**maxRetries** (required, integer, 0-10)
- Maximum number of retry attempts
- 0 means no retries (fail immediately)
- Recommended: 2-3 for most providers

**retryDelays** (required, array of integers)
- Delay in milliseconds for each retry attempt
- Used as initial delay when exponential backoff is enabled
- Used as exact delays when exponential backoff is disabled
- Example: `[1000, 2000, 4000]`

**useExponentialBackoff** (required, boolean)
- `true`: Delays increase exponentially (delay = initialDelay * 2^attempt)
- `false`: Uses exact delays from retryDelays array
- Exponential backoff is recommended for most providers

**Retry Behavior:**
- Retries are triggered on:
  - Network errors (connection failures, timeouts)
  - HTTP 5xx status codes (server errors)
- Retries are NOT triggered on:
  - HTTP 4xx status codes (client errors - invalid account, etc.)
- After exhausting all retries, the last error is returned

## Configuration Validation Rules

The system validates all configurations at startup using the ConfigValidator class. Invalid configurations are logged and skipped, allowing valid configurations to load successfully.

### Required Fields Validation

All configurations must include these required fields:
- `id` (string, kebab-case pattern)
- `name` (string)
- `displayName` (string)
- `type` (enum: gas, water, electricity, trash)
- `regions` (array, minimum 1 item)
- `accountValidation.pattern` (string, valid regex)
- `accountValidation.formatDescription` (string)
- `api.endpoint` (string, URL format)
- `api.method` (enum: GET, POST)
- `api.headers` (object)
- `parsing.responseType` (enum: html, json)
- `retry.maxRetries` (integer, 0-10)
- `retry.retryDelays` (array)
- `retry.useExponentialBackoff` (boolean)

### Conditional Field Validation

**For HTML responses** (`responseType: "html"`):
- `parsing.cssSelectors` object is required
- `parsing.cssSelectors.balance` is required
- `parsing.cssSelectors.currency` is optional
- `parsing.cssSelectors.dueDate` is optional

**For JSON responses** (`responseType: "json"`):
- `parsing.jsonPath` object is required
- `parsing.jsonPath.balance` is required
- `parsing.jsonPath.currency` is optional
- `parsing.jsonPath.dueDate` is optional

**For POST requests** (`method: "POST"`):
- `api.request` object is required
- `api.request.body` is required
- `api.request.contentType` is required

### Pattern Validation

**ID Pattern**: `^[a-z0-9-]+$`
- Only lowercase letters, numbers, and hyphens
- No spaces, underscores, or special characters
- Examples: `"te-ge-gas"`, `"tbilisi-water"`, `"electric-company-1"`

**Regex Pattern Validation**:
- The `accountValidation.pattern` must be a valid JavaScript regular expression
- Invalid patterns cause the configuration to be rejected
- Test patterns before deployment: `new RegExp(pattern)`

### Uniqueness Validation

**Provider ID Uniqueness**:
- Each provider `id` must be unique across all configurations
- Duplicate IDs cause the second configuration to be rejected
- Check existing providers before adding new ones

**Provider Name Precedence**:
- Code-based adapters take precedence over JSON-based adapters
- If a code-based adapter exists with the same `name`, the JSON configuration is skipped
- This ensures backward compatibility with existing adapters

## Error Handling and Logging

The system implements comprehensive error handling and logging at every stage of the configuration and execution lifecycle.

### Configuration Errors

**JSON Syntax Errors**:
```
Configuration parse error in providers.json at line 15, column 23: Unexpected token }
```
- Logged when providers.json contains invalid JSON syntax
- Includes line and column information when available
- System continues with code-based adapters only

**Validation Errors**:
```
Validation error for provider example-provider: Missing required field: api.endpoint, Invalid regex pattern: ^[
```
- Logged when a configuration is missing required fields or has invalid values
- Lists all validation errors for the configuration
- Configuration is skipped, other valid configurations continue loading

**Registration Errors**:
```
Error processing provider example-provider: Invalid configuration structure
```
- Logged when an error occurs during adapter creation or registration
- Configuration is skipped, other valid configurations continue loading

### Runtime Errors

**API Request Failures**:
```
API request failed for provider te-ge-gas (account: ****7890): HTTP 503, attempt 2/4
```
- Logged for each failed API request attempt
- Account numbers are redacted in production (shows last 4 digits only)
- Includes provider ID, HTTP status code, and attempt number
- Retries are attempted automatically based on configuration

**Parsing Failures**:
```
Parsing failed for provider te-ge-gas (account: ****7890): CSS selector ".balance" matched no elements. Response excerpt: <html><body>...
```
- Logged when balance data cannot be extracted from response
- Includes provider ID, error description, and response excerpt
- Response is truncated to prevent log flooding
- Account numbers are redacted in production

**Selector/Path Failures**:
```
CSS selector ".balance-amount" matched no elements. Response excerpt: <html><body>...
JSONPath expression "$.data.balance" matched no data. Response excerpt: {"error":"..."}
```
- Logged when CSS selectors or JSONPath expressions fail to match
- Includes the selector/expression that failed
- Includes response excerpt for debugging
- Helps identify when provider API structure changes

### Logging Levels

**Production Mode** (NODE_ENV=production):
- Account numbers are redacted (shows last 4 digits: `****7890`)
- Balance amounts are redacted
- Authentication headers are redacted
- Response excerpts are truncated to 200 characters
- Only error and warning messages are logged

**Development Mode** (NODE_ENV=development):
- Full account numbers are logged
- Full balance amounts are logged
- Full headers are logged (except sensitive ones)
- Full response bodies are logged
- Debug messages are included

### Success Logging

**Provider Registration**:
```
Registered JSON provider: te-ge-gas (type: gas, id: te-ge-gas)
```
- Logged when a JSON-based provider is successfully registered
- Includes provider name, type, and ID
- Helps verify configuration is loaded correctly

**Skipped Providers**:
```
Skipping JSON provider te-ge-gas (code-based adapter exists)
```
- Logged when a JSON configuration is skipped due to existing code-based adapter
- Confirms backward compatibility behavior

## Migration Path from Code-Based Adapters

The system is designed to support gradual migration from code-based adapters to JSON-based configurations. This section outlines the recommended migration strategy.

### Phase 1: Preparation

1. **Analyze Existing Adapter**
   - Review the code-based adapter implementation
   - Document the API endpoint, request format, and response structure
   - Identify account number validation rules
   - Note any special handling or edge cases

2. **Create JSON Configuration**
   - Create a new provider configuration in `providers.json`
   - Use a different `name` than the existing code-based adapter (e.g., `te-ge-gas-json`)
   - Configure all fields based on the existing adapter
   - Test the configuration thoroughly

3. **Validate Configuration**
   - Ensure the configuration passes validation
   - Test with real account numbers
   - Verify balance extraction works correctly
   - Compare results with code-based adapter

### Phase 2: Testing

1. **Parallel Testing**
   - Deploy with both code-based and JSON-based adapters
   - Code-based adapter continues serving production traffic
   - JSON-based adapter is available for testing
   - Monitor logs for any errors or discrepancies

2. **Comparison Testing**
   - Fetch balances using both adapters
   - Compare results for accuracy
   - Verify parsing handles all response variations
   - Test error handling and retry logic

3. **Load Testing**
   - Test with high volume of requests
   - Verify retry logic doesn't overwhelm provider API
   - Monitor performance and response times
   - Ensure no memory leaks or resource issues

### Phase 3: Migration

1. **Update Configuration**
   - Change the JSON configuration `name` to match the code-based adapter
   - This will cause the JSON configuration to be skipped (code-based takes precedence)
   - Deploy and verify code-based adapter still works

2. **Remove Code-Based Adapter**
   - Comment out or remove the code-based adapter registration in `factory.ts`
   - Deploy the change
   - JSON-based adapter will now be used (no longer skipped)
   - Monitor logs for successful registration

3. **Verify Production**
   - Monitor balance checks for errors
   - Verify all functionality works as expected
   - Check logs for any parsing or API errors
   - Be prepared to rollback if issues occur

### Phase 4: Cleanup

1. **Remove Code-Based Adapter Code**
   - Delete the code-based adapter file (e.g., `te-ge-gas-adapter.ts`)
   - Remove imports and references
   - Update tests to use JSON configuration
   - Clean up any adapter-specific utilities

2. **Update Documentation**
   - Document the provider in `providers.json`
   - Update any provider-specific documentation
   - Note any special considerations or limitations

### Rollback Strategy

If issues occur during migration, you can quickly rollback:

1. **Immediate Rollback**
   - Re-enable code-based adapter registration in `factory.ts`
   - Deploy the change
   - Code-based adapter takes precedence immediately
   - No configuration changes needed

2. **Investigate Issues**
   - Review logs for error messages
   - Compare JSON configuration with code-based adapter
   - Test configuration with sample responses
   - Fix issues in JSON configuration

3. **Retry Migration**
   - Once issues are resolved, repeat Phase 3
   - Monitor closely during initial deployment
   - Have rollback plan ready

### Example Migration: TeGeGasAdapter

Here's a concrete example of migrating the existing TeGeGasAdapter to JSON configuration:

**Original Code-Based Adapter** (`te-ge-gas-adapter.ts`):
```typescript
export class TeGeGasAdapter implements ProviderAdapter {
  get providerName(): string { return 'te.ge'; }
  get providerType(): 'gas' { return 'gas'; }
  get supportedRegions(): string[] { return ['Tbilisi', 'Batumi']; }
  
  validateAccountNumber(accountNumber: string): boolean {
    return /^\d{12}$/.test(accountNumber.replace(/\s/g, ''));
  }
  
  async fetchBalance(accountNumber: string): Promise<BalanceResult> {
    const response = await axios.get(
      `https://te.ge/api/balance?account=${accountNumber}`,
      { headers: { 'User-Agent': 'GeorgiaUtilityMonitor/1.0' } }
    );
    // Parse HTML response...
  }
}
```

**Equivalent JSON Configuration**:
```json
{
  "id": "te-ge-gas",
  "name": "te.ge",
  "displayName": "თიბისი გაზი (Tibisi Gas)",
  "type": "gas",
  "regions": ["Tbilisi", "Batumi"],
  
  "accountValidation": {
    "pattern": "^\\d{12}$",
    "formatDescription": "12 digits"
  },
  
  "api": {
    "endpoint": "https://te.ge/api/balance?account={{accountNumber}}",
    "method": "GET",
    "headers": {
      "User-Agent": "GeorgiaUtilityMonitor/1.0"
    }
  },
  
  "parsing": {
    "responseType": "html",
    "cssSelectors": {
      "balance": ".balance-amount",
      "currency": ".currency-code"
    }
  },
  
  "retry": {
    "maxRetries": 3,
    "retryDelays": [1000, 2000, 4000],
    "useExponentialBackoff": true
  }
}
```

**Migration Steps**:

1. Add JSON configuration to `providers.json` with `name: "te.ge-json"` (different name)
2. Test thoroughly with real account numbers
3. Once validated, change `name` to `"te.ge"` in JSON configuration
4. Comment out `registry.registerAdapter(new TeGeGasAdapter())` in `factory.ts`
5. Deploy and monitor
6. After successful deployment, delete `te-ge-gas-adapter.ts`

### Benefits of JSON Configuration

**For Developers**:
- No TypeScript code to write or maintain
- Faster development cycle (no compilation needed)
- Easier to test and validate
- Configuration can be updated without code deployment
- Reduced code complexity and maintenance burden

**For Operations**:
- Configuration changes don't require code review
- Can be updated via configuration management tools
- Easier to version control and track changes
- Validation happens at startup (fail fast)
- Clear error messages for troubleshooting

**For the System**:
- Consistent behavior across all JSON-based providers
- Centralized error handling and logging
- Standardized retry logic
- Easier to add new providers
- Reduced code duplication

## Complete Examples

### Example 1: HTML Provider with GET Request

This example shows a water company that returns HTML responses with balance information embedded in the page.

```json
{
  "id": "tbilisi-water",
  "name": "tbilisi-water",
  "displayName": "Tbilisi Water Company (თბილისის წყალი)",
  "type": "water",
  "regions": ["Tbilisi", "Mtskheta"],
  
  "accountValidation": {
    "pattern": "^\\d{10}$",
    "formatDescription": "10 digits (e.g., 1234567890)"
  },
  
  "api": {
    "endpoint": "https://water.tbilisi.ge/check-balance?account={{accountNumber}}",
    "method": "GET",
    "headers": {
      "User-Agent": "GeorgiaUtilityMonitor/1.0",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "ka,en"
    }
  },
  
  "parsing": {
    "responseType": "html",
    "cssSelectors": {
      "balance": ".account-info .balance-amount",
      "currency": ".account-info .currency",
      "dueDate": ".payment-section .due-date"
    }
  },
  
  "retry": {
    "maxRetries": 3,
    "retryDelays": [1000, 2000, 4000],
    "useExponentialBackoff": true
  }
}
```

**Expected HTML Response**:
```html
<div class="account-info">
  <span class="balance-amount">₾ 45.50</span>
  <span class="currency">GEL</span>
</div>
<div class="payment-section">
  <span class="due-date">2024-12-31</span>
</div>
```

### Example 2: JSON Provider with GET Request

This example shows an electricity company with a modern JSON API.

```json
{
  "id": "telasi-electric",
  "name": "telasi-electric",
  "displayName": "Telasi (თელასი)",
  "type": "electricity",
  "regions": ["Tbilisi"],
  
  "accountValidation": {
    "pattern": "^[A-Z]{2}\\d{8}$",
    "formatDescription": "2 uppercase letters followed by 8 digits (e.g., AB12345678)"
  },
  
  "api": {
    "endpoint": "https://api.telasi.ge/v1/accounts/{{accountNumber}}/balance",
    "method": "GET",
    "headers": {
      "User-Agent": "GeorgiaUtilityMonitor/1.0",
      "Accept": "application/json",
      "Authorization": "Bearer public-api-key"
    }
  },
  
  "parsing": {
    "responseType": "json",
    "jsonPath": {
      "balance": "$.data.balance.amount",
      "currency": "$.data.balance.currency",
      "dueDate": "$.data.payment.dueDate"
    }
  },
  
  "retry": {
    "maxRetries": 2,
    "retryDelays": [1500, 3000],
    "useExponentialBackoff": false
  }
}
```

**Expected JSON Response**:
```json
{
  "status": "success",
  "data": {
    "accountNumber": "AB12345678",
    "balance": {
      "amount": 123.45,
      "currency": "GEL"
    },
    "payment": {
      "dueDate": "2024-12-31T23:59:59Z"
    }
  }
}
```

### Example 3: JSON Provider with POST Request

This example shows a gas company that requires POST requests with a request body.

```json
{
  "id": "socar-gas",
  "name": "socar-gas",
  "displayName": "SOCAR Gas",
  "type": "gas",
  "regions": ["Tbilisi", "Rustavi", "Batumi"],
  
  "accountValidation": {
    "pattern": "^\\d{12}$",
    "formatDescription": "12 digits"
  },
  
  "api": {
    "endpoint": "https://api.socar.ge/balance/check",
    "method": "POST",
    "headers": {
      "User-Agent": "GeorgiaUtilityMonitor/1.0",
      "Accept": "application/json"
    },
    "request": {
      "body": {
        "accountNumber": "{{accountNumber}}",
        "includeHistory": false,
        "language": "ka"
      },
      "contentType": "application/json"
    }
  },
  
  "parsing": {
    "responseType": "json",
    "jsonPath": {
      "balance": "$.result.balance",
      "currency": "$.result.currency"
    }
  },
  
  "retry": {
    "maxRetries": 3,
    "retryDelays": [1000, 2000, 4000],
    "useExponentialBackoff": true
  }
}
```

**Expected Request Body**:
```json
{
  "accountNumber": "123456789012",
  "includeHistory": false,
  "language": "ka"
}
```

**Expected JSON Response**:
```json
{
  "status": "ok",
  "result": {
    "balance": 67.89,
    "currency": "GEL",
    "accountStatus": "active"
  }
}
```

## Advanced Configuration Patterns

### Complex JSONPath Expressions

For nested or complex JSON structures, use advanced JSONPath expressions:

```json
{
  "parsing": {
    "responseType": "json",
    "jsonPath": {
      "balance": "$.accounts[0].balances.current.amount",
      "currency": "$.accounts[0].balances.current.currency",
      "dueDate": "$.accounts[0].payments[?(@.type=='next')].date"
    }
  }
}
```

**Supported JSONPath Features**:
- Dot notation: `$.data.balance`
- Bracket notation: `$['data']['balance']`
- Array indexing: `$.items[0]`
- Array slicing: `$.items[0:3]`
- Wildcard: `$.items[*].price`
- Filter expressions: `$.items[?(@.active)]`
- Recursive descent: `$..balance` (finds all balance fields)

### Multiple CSS Selectors

For HTML responses with multiple possible locations for data:

```json
{
  "parsing": {
    "responseType": "html",
    "cssSelectors": {
      "balance": ".balance-primary, .balance-secondary, #account-balance",
      "currency": ".currency, .curr-code",
      "dueDate": ".due-date, .payment-deadline"
    }
  }
}
```

The parser will try each selector in order and use the first match.

### Handling Different Response Formats

Some providers may return different formats based on account status or other factors. Use flexible selectors/paths:

**For HTML**:
```json
{
  "cssSelectors": {
    "balance": ".balance, .account-balance, #balance-amount"
  }
}
```

**For JSON**:
```json
{
  "jsonPath": {
    "balance": "$.balance || $.data.balance || $.account.balance"
  }
}
```

Note: The `||` operator is not standard JSONPath, but you can use multiple configurations or handle in code.

### Authentication Headers

For providers requiring authentication:

```json
{
  "api": {
    "headers": {
      "Authorization": "Bearer YOUR_API_KEY",
      "X-API-Key": "YOUR_API_KEY",
      "X-Client-ID": "georgia-utility-monitor"
    }
  }
}
```

**Security Note**: Sensitive headers (Authorization, X-API-Key) are automatically redacted in logs.

### Custom User Agents

Some providers may require specific User-Agent strings:

```json
{
  "api": {
    "headers": {
      "User-Agent": "Mozilla/5.0 (compatible; GeorgiaUtilityMonitor/1.0)"
    }
  }
}
```

### Rate Limiting Considerations

For providers with strict rate limiting, use conservative retry settings:

```json
{
  "retry": {
    "maxRetries": 1,
    "retryDelays": [5000],
    "useExponentialBackoff": false
  }
}
```

This configuration:
- Only retries once
- Waits 5 seconds before retry
- Doesn't increase delay exponentially
- Reduces load on provider API

## Troubleshooting Guide

### Configuration Not Loading

**Symptom**: Provider doesn't appear in the system after adding to `providers.json`

**Diagnostic Steps**:
1. Check application logs for validation errors
2. Verify JSON syntax is valid (use a JSON validator)
3. Ensure all required fields are present
4. Check that `id` is unique across all providers
5. Verify `name` doesn't conflict with existing code-based adapter

**Common Causes**:
- Missing comma between provider objects
- Missing required field (e.g., `api.endpoint`)
- Invalid regex pattern in `accountValidation.pattern`
- Duplicate provider `id`
- Code-based adapter with same `name` exists

### Account Number Validation Failing

**Symptom**: Valid account numbers are rejected with "Invalid account number format"

**Diagnostic Steps**:
1. Test regex pattern in JavaScript console: `new RegExp(pattern).test(accountNumber)`
2. Check if pattern includes whitespace handling (system strips whitespace automatically)
3. Verify pattern is properly escaped in JSON (`\\d` not `\d`)
4. Test with multiple account number formats

**Common Causes**:
- Regex pattern not escaped properly in JSON
- Pattern too strict (doesn't account for variations)
- Pattern includes whitespace requirements (whitespace is stripped)

**Example Fix**:
```json
// Wrong: Pattern requires exact format with spaces
"pattern": "^\\d{4} \\d{4} \\d{4}$"

// Right: Pattern matches digits only (spaces stripped automatically)
"pattern": "^\\d{12}$"
```

### Balance Parsing Failing

**Symptom**: "Unable to retrieve balance" or "Failed to extract balance from response"

**Diagnostic Steps**:
1. Check logs for parsing error details
2. Verify CSS selector or JSONPath expression with actual API response
3. Test selector/path in browser DevTools or online tool
4. Check if API response structure has changed
5. Verify `responseType` matches actual response format

**For HTML Responses**:
```javascript
// Test in browser console
document.querySelector('.balance-amount').textContent
```

**For JSON Responses**:
```javascript
// Test with jsonpath-plus library
const jp = require('jsonpath-plus');
jp.JSONPath({ path: '$.data.balance', json: response });
```

**Common Causes**:
- CSS selector or JSONPath expression is incorrect
- API response structure has changed
- Response type mismatch (configured as JSON but returns HTML)
- Balance element is dynamically loaded (not in initial HTML)
- Balance text format not recognized by parser

### API Request Failing

**Symptom**: "API request failed" errors in logs

**Diagnostic Steps**:
1. Check HTTP status code in error message
2. Test API endpoint manually with curl or Postman
3. Verify endpoint URL is correct
4. Check if API requires authentication
5. Verify headers are correct
6. Check if provider API is down or rate limiting

**Test with curl**:
```bash
# GET request
curl -v "https://api.provider.ge/balance?account=123456789012" \
  -H "User-Agent: GeorgiaUtilityMonitor/1.0" \
  -H "Accept: application/json"

# POST request
curl -v -X POST "https://api.provider.ge/balance" \
  -H "Content-Type: application/json" \
  -H "User-Agent: GeorgiaUtilityMonitor/1.0" \
  -d '{"accountNumber":"123456789012"}'
```

**Common Causes**:
- Incorrect endpoint URL
- Missing or incorrect authentication headers
- API requires specific User-Agent
- Provider API is down or rate limiting
- Network connectivity issues
- CORS issues (if testing from browser)

### Retry Logic Not Working

**Symptom**: Requests fail immediately without retries, or retry too many times

**Diagnostic Steps**:
1. Check `maxRetries` value in configuration
2. Verify HTTP status code (4xx errors don't trigger retries)
3. Check logs for retry attempt messages
4. Verify `retryDelays` array is not empty
5. Check if `useExponentialBackoff` is set correctly

**Retry Behavior**:
- HTTP 4xx: No retries (client error)
- HTTP 5xx: Retries enabled (server error)
- Network errors: Retries enabled
- Timeout errors: Retries enabled

**Example Fix**:
```json
// Wrong: No retries configured
"retry": {
  "maxRetries": 0,
  "retryDelays": [],
  "useExponentialBackoff": false
}

// Right: Reasonable retry configuration
"retry": {
  "maxRetries": 3,
  "retryDelays": [1000, 2000, 4000],
  "useExponentialBackoff": true
}
```

### Performance Issues

**Symptom**: Slow response times, high memory usage, or API rate limiting

**Diagnostic Steps**:
1. Check retry configuration (too many retries?)
2. Monitor API response times
3. Check if provider API has rate limits
4. Verify timeout settings are reasonable
5. Check for memory leaks in logs

**Optimization Tips**:
- Reduce `maxRetries` for unreliable providers
- Increase `retryDelays` to avoid overwhelming provider
- Use exponential backoff for better rate limiting
- Set reasonable timeout values (30 seconds default)
- Monitor provider API status and adjust configuration

**Example Optimized Configuration**:
```json
{
  "retry": {
    "maxRetries": 2,
    "retryDelays": [2000, 5000],
    "useExponentialBackoff": true
  }
}
```

## Testing Your Configuration

### Step 1: Validate JSON Syntax

Before deploying, ensure your JSON is valid:

**Using Node.js**:
```javascript
const fs = require('fs');
try {
  const config = JSON.parse(fs.readFileSync('providers.json', 'utf-8'));
  console.log('✓ JSON syntax is valid');
} catch (error) {
  console.error('✗ JSON syntax error:', error.message);
}
```

**Using Online Tools**:
- https://jsonlint.com/
- https://jsonformatter.org/

### Step 2: Validate Against Schema

The configuration is validated against the JSON schema at `lib/providers/provider-config.schema.json`:

```bash
# Install ajv-cli if not already installed
npm install -g ajv-cli

# Validate configuration
ajv validate -s lib/providers/provider-config.schema.json -d providers.json
```

### Step 3: Test Account Number Validation

Test your regex pattern with sample account numbers:

```javascript
const pattern = /^\d{12}$/;

// Valid account numbers
console.log(pattern.test('123456789012')); // true
console.log(pattern.test('1234 5678 9012'.replace(/\s/g, ''))); // true

// Invalid account numbers
console.log(pattern.test('12345')); // false (too short)
console.log(pattern.test('abc123456789')); // false (contains letters)
```

### Step 4: Test API Endpoint

Test the API endpoint manually to verify it works:

**Using curl**:
```bash
# GET request
curl "https://api.provider.ge/balance?account=123456789012" \
  -H "User-Agent: GeorgiaUtilityMonitor/1.0" \
  -H "Accept: application/json"

# POST request
curl -X POST "https://api.provider.ge/balance" \
  -H "Content-Type: application/json" \
  -H "User-Agent: GeorgiaUtilityMonitor/1.0" \
  -d '{"accountNumber":"123456789012"}'
```

**Using Node.js**:
```javascript
const axios = require('axios');

async function testEndpoint() {
  try {
    const response = await axios.get(
      'https://api.provider.ge/balance?account=123456789012',
      {
        headers: {
          'User-Agent': 'GeorgiaUtilityMonitor/1.0',
          'Accept': 'application/json'
        }
      }
    );
    console.log('✓ API endpoint works');
    console.log('Response:', response.data);
  } catch (error) {
    console.error('✗ API endpoint failed:', error.message);
  }
}

testEndpoint();
```

### Step 5: Test CSS Selectors or JSONPath

**For HTML Responses** (using browser DevTools):
```javascript
// Load the HTML response in browser
// Open DevTools console and test selectors
document.querySelector('.balance-amount').textContent; // "₾ 45.50"
document.querySelector('.currency').textContent; // "GEL"
```

**For JSON Responses** (using Node.js):
```javascript
const jp = require('jsonpath-plus');

const response = {
  data: {
    balance: { amount: 123.45, currency: 'GEL' },
    payment: { dueDate: '2024-12-31' }
  }
};

// Test JSONPath expressions
console.log(jp.JSONPath({ path: '$.data.balance.amount', json: response })); // [123.45]
console.log(jp.JSONPath({ path: '$.data.balance.currency', json: response })); // ["GEL"]
console.log(jp.JSONPath({ path: '$.data.payment.dueDate', json: response })); // ["2024-12-31"]
```

### Step 6: Integration Testing

Create a test script to verify the complete flow:

```javascript
const { JsonProviderAdapter } = require('./lib/providers/json-provider-adapter');
const config = require('./providers.json');

async function testProvider(providerConfig) {
  console.log(`Testing provider: ${providerConfig.displayName}`);
  
  // Create adapter
  const adapter = new JsonProviderAdapter(providerConfig);
  
  // Test account validation
  const validAccount = '123456789012';
  const invalidAccount = '12345';
  
  console.log(`Valid account (${validAccount}):`, adapter.validateAccountNumber(validAccount));
  console.log(`Invalid account (${invalidAccount}):`, adapter.validateAccountNumber(invalidAccount));
  
  // Test balance fetch (use a real test account)
  try {
    const result = await adapter.fetchBalance(validAccount);
    if (result.success) {
      console.log('✓ Balance fetch successful');
      console.log(`  Balance: ${result.balance} ${result.currency}`);
    } else {
      console.error('✗ Balance fetch failed:', result.error);
    }
  } catch (error) {
    console.error('✗ Error:', error.message);
  }
}

// Test all providers
config.providers.forEach(testProvider);
```

### Step 7: Monitor Logs

After deploying, monitor application logs for:

**Success Messages**:
```
Registered JSON provider: example-provider (type: gas, id: example-provider)
```

**Validation Errors**:
```
Validation error for provider example-provider: Missing required field: api.endpoint
```

**Runtime Errors**:
```
API request failed for provider example-provider (account: ****7890): HTTP 503
Parsing failed for provider example-provider (account: ****7890): CSS selector ".balance" matched no elements
```

### Automated Testing

Create automated tests for your configuration:

```typescript
import { describe, it, expect } from 'vitest';
import { JsonProviderAdapter } from './json-provider-adapter';
import config from '../../providers.json';

describe('Provider Configurations', () => {
  config.providers.forEach(providerConfig => {
    describe(providerConfig.displayName, () => {
      let adapter: JsonProviderAdapter;
      
      beforeEach(() => {
        adapter = new JsonProviderAdapter(providerConfig);
      });
      
      it('should validate correct account numbers', () => {
        // Add test account numbers for this provider
        const validAccounts = ['123456789012'];
        validAccounts.forEach(account => {
          expect(adapter.validateAccountNumber(account)).toBe(true);
        });
      });
      
      it('should reject invalid account numbers', () => {
        const invalidAccounts = ['12345', 'abc123', ''];
        invalidAccounts.forEach(account => {
          expect(adapter.validateAccountNumber(account)).toBe(false);
        });
      });
      
      it('should have correct metadata', () => {
        expect(adapter.providerName).toBe(providerConfig.name);
        expect(adapter.providerType).toBe(providerConfig.type);
        expect(adapter.supportedRegions).toEqual(providerConfig.regions);
      });
    });
  });
});
```

## API Reference

### JsonProviderAdapter Class

The main class that implements the ProviderAdapter interface using JSON configuration.

**Constructor**:
```typescript
constructor(config: ProviderConfiguration)
```

**Properties**:
- `providerName: string` - Internal provider name
- `providerType: 'gas' | 'water' | 'electricity' | 'trash'` - Utility service type
- `supportedRegions: string[]` - List of supported regions

**Methods**:
- `validateAccountNumber(accountNumber: string): boolean` - Validates account number format
- `getAccountNumberFormat(): string` - Returns format description for users
- `fetchBalance(accountNumber: string): Promise<BalanceResult>` - Fetches current balance
- `getEndpointUrl(): string` - Returns API endpoint URL template
- `getTimeout(): number` - Returns request timeout in milliseconds
- `getRetryConfig(): RetryConfig` - Returns retry configuration

### BalanceParser Class

Extracts balance data from HTML or JSON responses.

**Constructor**:
```typescript
constructor(config: ParsingConfig)
```

**Methods**:
- `parse(response: string): ParseResult` - Parses response and extracts balance data

**ParseResult Interface**:
```typescript
interface ParseResult {
  balance: number | null;
  currency: string | null;
  dueDate: Date | null;
  error?: string;
}
```

### ConfigValidator Class

Validates provider configurations at load time.

**Methods**:
- `validate(config: any): ValidationResult` - Validates configuration structure and content

**ValidationResult Interface**:
```typescript
interface ValidationResult {
  valid: boolean;
  errors: string[];
}
```

### Factory Functions

**createProviderRegistry()**:
```typescript
function createProviderRegistry(): ProviderRegistry
```
Creates and initializes the provider registry with all available adapters.

**getProviderRegistry()**:
```typescript
function getProviderRegistry(): ProviderRegistry
```
Gets the singleton provider registry instance.

**resetProviderRegistry()**:
```typescript
function resetProviderRegistry(): void
```
Resets the singleton instance (useful for testing).

## Configuration Schema Reference

### ProviderConfiguration Interface

```typescript
interface ProviderConfiguration {
  id: string;
  name: string;
  displayName: string;
  type: 'gas' | 'water' | 'electricity' | 'trash';
  regions: string[];
  accountValidation: AccountValidation;
  api: ApiConfiguration;
  parsing: ParsingConfig;
  retry: RetryConfig;
}
```

### AccountValidation Interface

```typescript
interface AccountValidation {
  pattern: string;
  formatDescription: string;
}
```

### ApiConfiguration Interface

```typescript
interface ApiConfiguration {
  endpoint: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  request?: {
    body: Record<string, any>;
    contentType: string;
  };
}
```

### ParsingConfig Interface

```typescript
interface ParsingConfig {
  responseType: 'html' | 'json';
  cssSelectors?: {
    balance: string;
    currency?: string;
    dueDate?: string;
  };
  jsonPath?: {
    balance: string;
    currency?: string;
    dueDate?: string;
  };
}
```

### RetryConfig Interface

```typescript
interface RetryConfig {
  maxRetries: number;
  retryDelays: number[];
  useExponentialBackoff: boolean;
}
```

### BalanceResult Interface

```typescript
interface BalanceResult {
  balance: number;
  currency: string;
  timestamp: Date;
  success: boolean;
  error?: string;
  rawResponse?: string;
}
```

## Best Practices

### Configuration Management

1. **Version Control**
   - Keep `providers.json` in version control (git)
   - Document changes in commit messages
   - Use pull requests for configuration changes
   - Tag releases when deploying configuration changes

2. **Configuration Validation**
   - Validate JSON syntax before committing
   - Test configurations in staging environment first
   - Use JSON schema validation in CI/CD pipeline
   - Run automated tests for all configurations

3. **Documentation**
   - Document provider-specific requirements
   - Note any special handling or edge cases
   - Keep track of API changes and updates
   - Document account number format examples

### Security Considerations

1. **API Keys and Secrets**
   - Never commit API keys or secrets to version control
   - Use environment variables for sensitive data
   - Rotate API keys regularly
   - Monitor for unauthorized access

2. **Data Privacy**
   - Account numbers are automatically redacted in production logs
   - Balance amounts are redacted in production logs
   - Authentication headers are redacted in all logs
   - Ensure compliance with data protection regulations

3. **HTTPS Only**
   - Always use HTTPS endpoints (never HTTP)
   - Validate SSL certificates
   - Use secure headers (User-Agent, etc.)
   - Monitor for security vulnerabilities

### Performance Optimization

1. **Retry Configuration**
   - Start with conservative retry settings (2-3 retries)
   - Use exponential backoff for most providers
   - Adjust based on provider API reliability
   - Monitor retry rates and adjust accordingly

2. **Timeout Settings**
   - Default timeout is 30 seconds (reasonable for most providers)
   - Reduce timeout for fast APIs
   - Increase timeout for slow APIs
   - Monitor timeout rates and adjust

3. **Rate Limiting**
   - Respect provider API rate limits
   - Use appropriate retry delays
   - Implement request throttling if needed
   - Monitor API usage and adjust

### Error Handling

1. **Graceful Degradation**
   - Invalid configurations are skipped, not fatal
   - Missing providers.json doesn't break the system
   - Code-based adapters continue working
   - Clear error messages for troubleshooting

2. **Monitoring and Alerting**
   - Monitor logs for configuration errors
   - Alert on high error rates
   - Track API response times
   - Monitor retry rates

3. **User Communication**
   - Show user-friendly error messages
   - Provide clear guidance on account number format
   - Indicate when provider is temporarily unavailable
   - Offer manual retry options

### Testing Strategy

1. **Unit Testing**
   - Test account number validation patterns
   - Test URL placeholder replacement
   - Test header inclusion
   - Test parsing logic with sample responses

2. **Integration Testing**
   - Test complete balance fetch flow
   - Test retry logic with simulated failures
   - Test error handling
   - Test with real provider APIs (in staging)

3. **Regression Testing**
   - Test after configuration changes
   - Test after provider API changes
   - Test backward compatibility
   - Test migration from code-based adapters

### Maintenance

1. **Regular Reviews**
   - Review configurations quarterly
   - Check for API changes
   - Update selectors/paths if needed
   - Remove deprecated providers

2. **Monitoring**
   - Monitor error rates
   - Track API response times
   - Monitor retry rates
   - Alert on anomalies

3. **Updates**
   - Keep dependencies up to date (cheerio, jsonpath-plus, axios)
   - Update configurations when provider APIs change
   - Test thoroughly after updates
   - Document changes

## Additional Resources

### Documentation
- **User Guide**: `PROVIDERS-CONFIG-GUIDE.md` - User-facing configuration guide
- **Design Document**: `.kiro/specs/json-provider-configuration/design.md` - System design and architecture
- **Requirements**: `.kiro/specs/json-provider-configuration/requirements.md` - Detailed requirements
- **JSON Schema**: `lib/providers/provider-config.schema.json` - Configuration validation schema

### External Resources
- **CSS Selectors**: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors
- **JSONPath**: https://goessner.net/articles/JsonPath/
- **JSONPath Plus**: https://github.com/JSONPath-Plus/JSONPath
- **Cheerio**: https://cheerio.js.org/
- **Axios**: https://axios-http.com/
- **Regex Testing**: https://regex101.com/
- **JSON Validation**: https://jsonlint.com/

### Code Examples
- **Example Configurations**: `providers.json` - Working examples for HTML and JSON providers
- **Example Template**: `providers.json.example` - Template for new providers
- **Test Fixtures**: `test/fixtures/sample-html-responses.ts`, `test/fixtures/sample-json-responses.ts`

### Support

For questions, issues, or contributions:

1. **Check Documentation**: Review this guide and the design document
2. **Check Logs**: Look for detailed error messages in application logs
3. **Test Components**: Test regex, API, selectors/paths separately
4. **Review Examples**: Compare with working examples in `providers.json`
5. **Ask for Help**: Create an issue or contact the development team

## Changelog

### Version 1.0.0 (Initial Release)
- JSON-based provider configuration system
- Support for HTML and JSON response parsing
- Retry logic with exponential backoff
- Configuration validation at load time
- Comprehensive error handling and logging
- Full backward compatibility with code-based adapters
- Migration path from code-based to JSON-based providers

---

**Last Updated**: 2024
**Version**: 1.0.0
**Maintainer**: Georgia Utility Monitor Development Team
