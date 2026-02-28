# Requirements Document

## Introduction

This document specifies requirements for a JSON-based provider configuration system for the Georgia Utility Monitor application. The system enables adding new utility providers (gas, water, electricity, internet, etc.) through declarative JSON configuration files instead of implementing code-based adapters for each provider. The system maintains backward compatibility with existing code-based adapters while providing a flexible, declarative approach for new providers.

## Glossary

- **Provider**: A utility company (gas, water, electricity, internet) that provides services and maintains customer account balances
- **Provider_Adapter**: A component that implements the ProviderAdapter interface to interact with a specific provider's API
- **Code_Based_Adapter**: A Provider_Adapter implemented as TypeScript/JavaScript code (e.g., TeGeGasAdapter)
- **JSON_Based_Adapter**: A Provider_Adapter configured through JSON configuration and implemented by JsonProviderAdapter
- **Provider_Configuration**: A JSON object defining provider metadata, API details, validation rules, and parsing logic
- **Provider_Registry**: The system component that manages and provides access to all registered Provider_Adapters
- **Account_Number**: A unique identifier for a customer account with a specific Provider
- **Balance_Parser**: Logic that extracts balance information from API responses (HTML or JSON)
- **CSS_Selector**: A pattern used to locate elements in HTML responses
- **JSONPath**: A query language for extracting data from JSON responses
- **Retry_Logic**: Mechanism for retrying failed API requests with exponential backoff
- **Factory**: The component responsible for loading configurations and registering providers

## Requirements

### Requirement 1: JSON Provider Configuration File

**User Story:** As a system administrator, I want to define provider configurations in a JSON file, so that I can add new providers without writing code.

#### Acceptance Criteria

1. THE System SHALL load provider configurations from a file named "providers.json"
2. WHEN providers.json contains valid provider definitions, THE System SHALL parse all provider configurations
3. THE Provider_Configuration SHALL include provider metadata fields: id, name, displayName, type, and regions
4. THE Provider_Configuration SHALL include account validation fields: regex pattern and format description
5. THE Provider_Configuration SHALL include API configuration fields: endpoint, method, headers, and request format
6. THE Provider_Configuration SHALL include response parsing configuration: response type and extraction rules
7. THE Provider_Configuration SHALL include retry configuration: maxRetries, retryDelays, and useExponentialBackoff
8. WHEN providers.json is malformed or invalid, THE System SHALL log a descriptive error and continue with valid configurations

### Requirement 2: Provider Metadata Management

**User Story:** As a developer, I want provider metadata clearly defined, so that the UI can display provider information correctly.

#### Acceptance Criteria

1. THE Provider_Configuration SHALL specify a unique provider id in kebab-case format
2. THE Provider_Configuration SHALL specify a name field for internal identification
3. THE Provider_Configuration SHALL specify a displayName field for user-facing display
4. THE Provider_Configuration SHALL specify a type field indicating the utility category (gas, water, electricity, internet)
5. THE Provider_Configuration SHALL specify a regions array listing supported geographic regions
6. FOR ALL Provider_Configurations, the id field SHALL be unique across all providers

### Requirement 3: Account Number Validation

**User Story:** As a user, I want my account number validated before submission, so that I receive immediate feedback on format errors.

#### Acceptance Criteria

1. THE Provider_Configuration SHALL include an accountValidation object with pattern and formatDescription fields
2. THE JSON_Based_Adapter SHALL validate Account_Numbers using the regex pattern from Provider_Configuration
3. WHEN an Account_Number matches the validation pattern, THE JSON_Based_Adapter SHALL accept the account number
4. WHEN an Account_Number does not match the validation pattern, THE JSON_Based_Adapter SHALL return an error with the formatDescription
5. THE formatDescription SHALL provide human-readable guidance on the expected account number format

### Requirement 4: API Configuration

**User Story:** As a system administrator, I want to configure API endpoints and request formats, so that the system can communicate with different provider APIs.

#### Acceptance Criteria

1. THE Provider_Configuration SHALL specify an api object containing endpoint, method, headers, and request configuration
2. THE JSON_Based_Adapter SHALL support GET and POST HTTP methods
3. THE JSON_Based_Adapter SHALL construct API requests using the endpoint URL template with accountNumber placeholder
4. THE JSON_Based_Adapter SHALL include all headers specified in the Provider_Configuration
5. WHERE the method is POST, THE JSON_Based_Adapter SHALL include the request body configuration
6. THE JSON_Based_Adapter SHALL replace placeholders in request templates with actual Account_Number values

### Requirement 5: HTML Response Parsing

**User Story:** As a developer, I want to extract balance data from HTML responses, so that providers with HTML-based APIs can be supported.

#### Acceptance Criteria

1. WHERE responseType is "html", THE JSON_Based_Adapter SHALL parse responses as HTML documents
2. THE Balance_Parser SHALL use CSS_Selectors specified in the parsing configuration to locate balance elements
3. THE Balance_Parser SHALL extract text content from elements matched by CSS_Selectors
4. THE Balance_Parser SHALL convert extracted text to numeric balance values
5. WHEN a CSS_Selector matches no elements, THE Balance_Parser SHALL return an error indicating parsing failure
6. THE Balance_Parser SHALL support extracting balance, currency, and dueDate fields using separate CSS_Selectors

### Requirement 6: JSON Response Parsing

**User Story:** As a developer, I want to extract balance data from JSON responses, so that providers with JSON-based APIs can be supported.

#### Acceptance Criteria

1. WHERE responseType is "json", THE JSON_Based_Adapter SHALL parse responses as JSON objects
2. THE Balance_Parser SHALL use JSONPath expressions specified in the parsing configuration to locate balance data
3. THE Balance_Parser SHALL extract values from JSON responses using JSONPath queries
4. THE Balance_Parser SHALL convert extracted values to appropriate data types (number, string, date)
5. WHEN a JSONPath expression matches no data, THE Balance_Parser SHALL return an error indicating parsing failure
6. THE Balance_Parser SHALL support extracting balance, currency, and dueDate fields using separate JSONPath expressions

### Requirement 7: Retry Logic with Exponential Backoff

**User Story:** As a system operator, I want failed API requests to be retried automatically, so that transient network issues do not cause permanent failures.

#### Acceptance Criteria

1. THE JSON_Based_Adapter SHALL implement retry logic for failed API requests
2. THE JSON_Based_Adapter SHALL retry requests up to maxRetries times as specified in Provider_Configuration
3. WHERE useExponentialBackoff is true, THE JSON_Based_Adapter SHALL increase delay between retries exponentially
4. WHERE useExponentialBackoff is false, THE JSON_Based_Adapter SHALL use fixed delays from retryDelays array
5. WHEN all retry attempts are exhausted, THE JSON_Based_Adapter SHALL return the last error encountered
6. THE JSON_Based_Adapter SHALL retry on network errors and HTTP 5xx status codes
7. THE JSON_Based_Adapter SHALL NOT retry on HTTP 4xx status codes (client errors)

### Requirement 8: Generic JSON Provider Adapter

**User Story:** As a developer, I want a single adapter class that works for all JSON-configured providers, so that I don't need to write adapter code for each provider.

#### Acceptance Criteria

1. THE System SHALL implement a JsonProviderAdapter class that implements the ProviderAdapter interface
2. THE JsonProviderAdapter SHALL accept Provider_Configuration in its constructor
3. THE JsonProviderAdapter SHALL implement the checkBalance method using configuration-driven logic
4. THE JsonProviderAdapter SHALL implement the validateAccountNumber method using the regex pattern from configuration
5. THE JsonProviderAdapter SHALL implement the getName method returning the provider name from configuration
6. THE JsonProviderAdapter SHALL implement the getDisplayName method returning the displayName from configuration
7. THE JsonProviderAdapter SHALL implement the getType method returning the type from configuration
8. THE JsonProviderAdapter SHALL implement the getSupportedRegions method returning the regions from configuration

### Requirement 9: Provider Factory Integration

**User Story:** As a developer, I want the factory to automatically load and register JSON-based providers, so that they are available alongside code-based providers.

#### Acceptance Criteria

1. THE Factory SHALL load providers.json at initialization
2. THE Factory SHALL create JsonProviderAdapter instances for each valid Provider_Configuration
3. THE Factory SHALL register JSON_Based_Adapters with the Provider_Registry
4. WHERE a provider id exists as both Code_Based_Adapter and JSON_Based_Adapter, THE Factory SHALL register only the Code_Based_Adapter
5. THE Factory SHALL log which providers are registered as JSON_Based_Adapters
6. WHEN providers.json does not exist, THE Factory SHALL continue initialization with only Code_Based_Adapters
7. THE Factory SHALL maintain backward compatibility with existing Code_Based_Adapter registration

### Requirement 10: Backward Compatibility

**User Story:** As a developer, I want existing code-based adapters to continue working, so that the migration to JSON configuration is non-breaking.

#### Acceptance Criteria

1. THE System SHALL support both Code_Based_Adapters and JSON_Based_Adapters simultaneously
2. THE Provider_Registry SHALL accept both Code_Based_Adapters and JSON_Based_Adapters
3. WHERE a provider exists as a Code_Based_Adapter, THE System SHALL use the Code_Based_Adapter implementation
4. THE ProviderAdapter interface SHALL remain unchanged
5. THE System SHALL allow gradual migration from Code_Based_Adapters to JSON_Based_Adapters
6. FOR ALL existing functionality, behavior SHALL remain identical when using Code_Based_Adapters

### Requirement 11: Error Handling and Logging

**User Story:** As a system operator, I want clear error messages and logging, so that I can diagnose configuration and runtime issues.

#### Acceptance Criteria

1. WHEN providers.json contains invalid JSON syntax, THE System SHALL log a parse error with line and column information
2. WHEN a Provider_Configuration is missing required fields, THE System SHALL log a validation error listing missing fields
3. WHEN an API request fails, THE JSON_Based_Adapter SHALL log the error with provider id and account number
4. WHEN balance parsing fails, THE JSON_Based_Adapter SHALL log the parsing error with response excerpt
5. WHEN a CSS_Selector or JSONPath expression fails, THE System SHALL log the expression and response structure
6. THE System SHALL log successful provider registration with provider id and type
7. THE System SHALL NOT log sensitive data (account numbers, balances, credentials) in production logs

### Requirement 12: Configuration Validation

**User Story:** As a system administrator, I want configuration errors detected at startup, so that I can fix issues before they affect users.

#### Acceptance Criteria

1. THE System SHALL validate Provider_Configuration structure at load time
2. THE System SHALL verify that required fields (id, name, displayName, type, api.endpoint) are present
3. THE System SHALL verify that regex patterns in accountValidation are valid regular expressions
4. THE System SHALL verify that responseType is either "html" or "json"
5. THE System SHALL verify that parsing configuration matches the responseType (cssSelectors for html, jsonPath for json)
6. WHEN validation fails for a Provider_Configuration, THE System SHALL log the error and skip that provider
7. THE System SHALL continue loading valid providers even when some configurations are invalid

### Requirement 13: Parser Configuration Format

**User Story:** As a system administrator, I want to configure data extraction rules declaratively, so that I can adapt to different API response formats.

#### Acceptance Criteria

1. WHERE responseType is "html", THE Provider_Configuration SHALL include a parsing.cssSelectors object
2. WHERE responseType is "json", THE Provider_Configuration SHALL include a parsing.jsonPath object
3. THE parsing configuration SHALL support extracting balance as a required field
4. THE parsing configuration SHALL support extracting currency as an optional field
5. THE parsing configuration SHALL support extracting dueDate as an optional field
6. THE Balance_Parser SHALL return null for optional fields when extraction fails
7. THE Balance_Parser SHALL return an error when required field extraction fails

### Requirement 14: Round-Trip Configuration Testing

**User Story:** As a developer, I want to verify that provider configurations work correctly, so that I can catch configuration errors before deployment.

#### Acceptance Criteria

1. THE System SHALL provide a mechanism to test Provider_Configurations with sample responses
2. FOR ALL Provider_Configurations with sample HTML responses, parsing then formatting then parsing SHALL produce equivalent balance data
3. FOR ALL Provider_Configurations with sample JSON responses, parsing then formatting then parsing SHALL produce equivalent balance data
4. THE test mechanism SHALL validate that CSS_Selectors correctly extract data from sample HTML
5. THE test mechanism SHALL validate that JSONPath expressions correctly extract data from sample JSON
6. THE test mechanism SHALL verify that account number validation patterns accept valid account numbers
7. THE test mechanism SHALL verify that account number validation patterns reject invalid account numbers

