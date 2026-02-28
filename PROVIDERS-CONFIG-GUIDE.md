# Provider Configuration Guide

This guide explains how to configure utility providers using the `providers.json` file. The JSON-based configuration system allows you to add new utility providers without writing code.

## Table of Contents

1. [Overview](#overview)
2. [Configuration Structure](#configuration-structure)
3. [Field Reference](#field-reference)
4. [Examples](#examples)
5. [Account Validation Patterns](#account-validation-patterns)
6. [Retry Configurations](#retry-configurations)
7. [Testing Your Configuration](#testing-your-configuration)

## Overview

The `providers.json` file contains an array of provider configurations. Each provider configuration defines:

- **Metadata**: Provider identification and display information
- **Account Validation**: Rules for validating account numbers
- **API Configuration**: How to make requests to the provider's API
- **Response Parsing**: How to extract balance data from responses
- **Retry Logic**: How to handle failed requests

## Configuration Structure

```json
{
  "$schema": "./lib/providers/provider-config.schema.json",
  "providers": [
    {
      "id": "provider-id",
      "name": "provider-name",
      "displayName": "Provider Display Name",
      "type": "gas|water|electricity|trash",
      "regions": ["Region1", "Region2"],
      "accountValidation": { ... },
      "api": { ... },
      "parsing": { ... },
      "retry": { ... }
    }
  ]
}
```

## Field Reference

### Top-Level Fields

#### `id` (required)
- **Type**: string
- **Pattern**: `^[a-z0-9-]+$` (lowercase letters, numbers, and hyphens only)
- **Description**: Unique identifier for the provider in kebab-case format
- **Example**: `"tbilisi-water-company"`

#### `name` (required)
- **Type**: string
- **Description**: Internal name used for identification in code
- **Example**: `"tbilisi-water-company"`

#### `displayName` (required)
- **Type**: string
- **Description**: User-facing name shown in the UI
- **Example**: `"Tbilisi Water Company"`

#### `type` (required)
- **Type**: string
- **Allowed Values**: `"gas"`, `"water"`, `"electricity"`, `"trash"`
- **Description**: The type of utility service provided
- **Example**: `"water"`

#### `regions` (required)
- **Type**: array of strings
- **Description**: List of geographic regions where this provider operates
- **Example**: `["Tbilisi", "Batumi", "Kutaisi"]`

### Account Validation

The `accountValidation` object defines how to validate account numbers.

#### `accountValidation.pattern` (required)
- **Type**: string (regex pattern)
- **Description**: Regular expression pattern for validating account numbers
- **Example**: `"^\\d{10}$"` (exactly 10 digits)
- **Note**: Remember to escape backslashes in JSON (`\\d` not `\d`)

#### `accountValidation.formatDescription` (required)
- **Type**: string
- **Description**: Human-readable description of the expected format
- **Example**: `"10 digits (e.g., 1234567890)"`

### API Configuration

The `api` object defines how to make HTTP requests to the provider's API.

#### `api.endpoint` (required)
- **Type**: string (URL)
- **Description**: API endpoint URL with `{{accountNumber}}` placeholder
- **Example**: `"https://example.com/api/balance?account={{accountNumber}}"`
- **Note**: The `{{accountNumber}}` placeholder will be replaced with the actual account number

#### `api.method` (required)
- **Type**: string
- **Allowed Values**: `"GET"`, `"POST"`
- **Description**: HTTP method to use for the request
- **Example**: `"GET"`

#### `api.headers` (required)
- **Type**: object (key-value pairs)
- **Description**: HTTP headers to include in the request
- **Example**:
  ```json
  {
    "User-Agent": "GeorgiaUtilityMonitor/1.0",
    "Accept": "application/json",
    "Accept-Language": "ka,en"
  }
  ```

#### `api.request` (optional, required for POST)
- **Type**: object
- **Description**: Request body configuration for POST requests
- **Fields**:
  - `body`: Object containing the request body template (supports `{{accountNumber}}` placeholder)
  - `contentType`: Content-Type header value (e.g., `"application/json"`)
- **Example**:
  ```json
  {
    "body": {
      "accountNumber": "{{accountNumber}}",
      "includeHistory": false
    },
    "contentType": "application/json"
  }
  ```

### Response Parsing

The `parsing` object defines how to extract balance data from API responses.

#### `parsing.responseType` (required)
- **Type**: string
- **Allowed Values**: `"html"`, `"json"`
- **Description**: Format of the API response
- **Example**: `"json"`

#### `parsing.cssSelectors` (required for HTML responses)
- **Type**: object
- **Description**: CSS selectors for extracting data from HTML responses
- **Fields**:
  - `balance` (required): CSS selector for the balance amount
  - `currency` (optional): CSS selector for the currency code
  - `dueDate` (optional): CSS selector for the payment due date
- **Example**:
  ```json
  {
    "balance": ".account-balance .amount",
    "currency": ".account-balance .currency",
    "dueDate": ".payment-info .due-date"
  }
  ```

#### `parsing.jsonPath` (required for JSON responses)
- **Type**: object
- **Description**: JSONPath expressions for extracting data from JSON responses
- **Fields**:
  - `balance` (required): JSONPath expression for the balance amount
  - `currency` (optional): JSONPath expression for the currency code
  - `dueDate` (optional): JSONPath expression for the payment due date
- **Example**:
  ```json
  {
    "balance": "$.data.balance.amount",
    "currency": "$.data.balance.currency",
    "dueDate": "$.data.payment.dueDate"
  }
  ```

### Retry Configuration

The `retry` object defines how to handle failed API requests.

#### `retry.maxRetries` (required)
- **Type**: integer (0-10)
- **Description**: Maximum number of retry attempts
- **Example**: `3`

#### `retry.retryDelays` (required)
- **Type**: array of integers (milliseconds)
- **Description**: Delay in milliseconds for each retry attempt
- **Example**: `[1000, 2000, 4000]` (1s, 2s, 4s)

#### `retry.useExponentialBackoff` (required)
- **Type**: boolean
- **Description**: Whether to use exponential backoff for retries
- **Example**: `true`
- **Note**: 
  - If `true`, delays increase exponentially (ignoring `retryDelays` array)
  - If `false`, uses the exact delays from `retryDelays` array

## Examples

### Example 1: HTML Provider with GET Request

This example shows a water company that returns HTML responses:

```json
{
  "id": "example-water",
  "name": "example-water",
  "displayName": "Example Water Company",
  "type": "water",
  "regions": ["Tbilisi", "Batumi"],
  "accountValidation": {
    "pattern": "^\\d{10}$",
    "formatDescription": "10 digits (e.g., 1234567890)"
  },
  "api": {
    "endpoint": "https://water.example.ge/balance?account={{accountNumber}}",
    "method": "GET",
    "headers": {
      "User-Agent": "GeorgiaUtilityMonitor/1.0",
      "Accept": "text/html"
    }
  },
  "parsing": {
    "responseType": "html",
    "cssSelectors": {
      "balance": ".balance-amount",
      "currency": ".currency-code",
      "dueDate": ".due-date"
    }
  },
  "retry": {
    "maxRetries": 3,
    "retryDelays": [1000, 2000, 4000],
    "useExponentialBackoff": true
  }
}
```

### Example 2: JSON Provider with GET Request

This example shows an electricity company with a JSON API:

```json
{
  "id": "example-electric",
  "name": "example-electric",
  "displayName": "Example Electric Company",
  "type": "electricity",
  "regions": ["Tbilisi"],
  "accountValidation": {
    "pattern": "^[A-Z]{2}\\d{8}$",
    "formatDescription": "2 uppercase letters followed by 8 digits (e.g., AB12345678)"
  },
  "api": {
    "endpoint": "https://api.electric.ge/v1/accounts/{{accountNumber}}/balance",
    "method": "GET",
    "headers": {
      "User-Agent": "GeorgiaUtilityMonitor/1.0",
      "Accept": "application/json"
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

### Example 3: JSON Provider with POST Request

This example shows a gas company that requires POST requests:

```json
{
  "id": "example-gas",
  "name": "example-gas",
  "displayName": "Example Gas Company",
  "type": "gas",
  "regions": ["Tbilisi", "Rustavi"],
  "accountValidation": {
    "pattern": "^\\d{12}$",
    "formatDescription": "12 digits"
  },
  "api": {
    "endpoint": "https://api.gas.ge/balance/check",
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
  },
  "parsing": {
    "responseType": "json",
    "jsonPath": {
      "balance": "$.balance",
      "currency": "$.currency"
    }
  },
  "retry": {
    "maxRetries": 3,
    "retryDelays": [1000, 2000, 4000],
    "useExponentialBackoff": true
  }
}
```

## Account Validation Patterns

Here are common regex patterns for account number validation:

### Numeric Patterns

```json
{
  "pattern": "^\\d{10}$",
  "formatDescription": "Exactly 10 digits"
}
```

```json
{
  "pattern": "^\\d{8,12}$",
  "formatDescription": "8 to 12 digits"
}
```

### Alphanumeric Patterns

```json
{
  "pattern": "^[A-Z]{2}\\d{8}$",
  "formatDescription": "2 uppercase letters followed by 8 digits (e.g., AB12345678)"
}
```

```json
{
  "pattern": "^[A-Z0-9]{10}$",
  "formatDescription": "10 uppercase letters or digits"
}
```

### Patterns with Separators

```json
{
  "pattern": "^\\d{4}-\\d{4}-\\d{4}$",
  "formatDescription": "12 digits with dashes (e.g., 1234-5678-9012)"
}
```

```json
{
  "pattern": "^\\d{3}\\.\\d{3}\\.\\d{4}$",
  "formatDescription": "10 digits with dots (e.g., 123.456.7890)"
}
```

### Flexible Patterns (with optional separators)

```json
{
  "pattern": "^\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}$",
  "formatDescription": "12 digits with optional spaces or dashes"
}
```

## Retry Configurations

### Aggressive Retry (for reliable APIs)

```json
{
  "maxRetries": 5,
  "retryDelays": [500, 1000, 2000, 4000, 8000],
  "useExponentialBackoff": true
}
```

### Conservative Retry (for rate-limited APIs)

```json
{
  "maxRetries": 2,
  "retryDelays": [3000, 6000],
  "useExponentialBackoff": false
}
```

### Balanced Retry (recommended default)

```json
{
  "maxRetries": 3,
  "retryDelays": [1000, 2000, 4000],
  "useExponentialBackoff": true
}
```

### No Retry (for testing or unreliable APIs)

```json
{
  "maxRetries": 0,
  "retryDelays": [],
  "useExponentialBackoff": false
}
```

## Testing Your Configuration

### Step 1: Validate JSON Syntax

Ensure your `providers.json` file is valid JSON. You can use online validators or your IDE's JSON validation.

### Step 2: Check Against Schema

The configuration is validated against the JSON schema at `lib/providers/provider-config.schema.json`. The system will log validation errors at startup.

### Step 3: Test Account Number Validation

Test your regex pattern with sample account numbers:

```javascript
const pattern = /^\d{10}$/;
console.log(pattern.test("1234567890")); // true
console.log(pattern.test("123456789"));  // false
console.log(pattern.test("12345678901")); // false
```

### Step 4: Test API Endpoint

Test the API endpoint manually using curl or Postman:

```bash
# For GET requests
curl "https://example.com/api/balance?account=1234567890"

# For POST requests
curl -X POST "https://example.com/api/balance" \
  -H "Content-Type: application/json" \
  -d '{"accountNumber": "1234567890"}'
```

### Step 5: Test CSS Selectors or JSONPath

For HTML responses, test CSS selectors using browser DevTools:
```javascript
document.querySelector('.balance-amount').textContent
```

For JSON responses, test JSONPath expressions using online tools or:
```javascript
const jp = require('jsonpath-plus');
jp.JSONPath({ path: '$.data.balance.amount', json: response });
```

### Step 6: Monitor Logs

After deploying your configuration, monitor the application logs for:
- Configuration validation errors
- API request failures
- Parsing errors
- Retry attempts

## Common Issues and Solutions

### Issue: Configuration Not Loading

**Symptoms**: Provider doesn't appear in the system

**Solutions**:
- Check JSON syntax (missing commas, quotes, brackets)
- Verify all required fields are present
- Check logs for validation errors
- Ensure `id` is unique across all providers

### Issue: Account Number Validation Failing

**Symptoms**: Valid account numbers are rejected

**Solutions**:
- Test regex pattern with sample account numbers
- Remember to escape backslashes in JSON (`\\d` not `\d`)
- Check for whitespace in account numbers (pattern should handle or strip)

### Issue: Balance Parsing Failing

**Symptoms**: "Unable to retrieve balance" errors

**Solutions**:
- Verify CSS selectors or JSONPath expressions with actual API responses
- Check if API response structure has changed
- Ensure `responseType` matches actual response format
- Test selectors/paths with sample responses

### Issue: Too Many Retries

**Symptoms**: Slow response times, API rate limiting

**Solutions**:
- Reduce `maxRetries`
- Increase `retryDelays`
- Set `useExponentialBackoff` to `true`
- Check if API has rate limiting

### Issue: API Authentication Failing

**Symptoms**: 401 or 403 errors

**Solutions**:
- Add required authentication headers
- Check if API requires API keys or tokens
- Verify headers are correctly formatted
- Contact provider for API access requirements

## Best Practices

1. **Start Simple**: Begin with minimal configuration and add optional fields as needed
2. **Test Thoroughly**: Test with real account numbers and API responses before deployment
3. **Use Descriptive Names**: Make `displayName` clear and user-friendly
4. **Document Patterns**: Provide clear `formatDescription` for account validation
5. **Be Conservative with Retries**: Start with fewer retries and adjust based on API reliability
6. **Monitor Logs**: Regularly check logs for errors and adjust configuration as needed
7. **Version Control**: Keep `providers.json` in version control and document changes
8. **Backup Configurations**: Keep backups before making significant changes

## Additional Resources

- JSON Schema: `lib/providers/provider-config.schema.json`
- Example Configuration: `providers.json.example`
- CSS Selectors Reference: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors
- JSONPath Reference: https://goessner.net/articles/JsonPath/
- Regex Testing: https://regex101.com/

## Support

If you encounter issues or need help with configuration:

1. Check the logs for detailed error messages
2. Verify your configuration against the schema
3. Test individual components (regex, API, selectors) separately
4. Consult the examples in this guide
5. Review the design document at `.kiro/specs/json-provider-configuration/design.md`
