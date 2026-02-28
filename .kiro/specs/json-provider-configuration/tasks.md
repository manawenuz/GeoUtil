# Implementation Plan: JSON Provider Configuration

## Overview

This implementation plan breaks down the JSON provider configuration feature into discrete, actionable coding tasks. The feature enables adding new utility providers through declarative JSON configuration files instead of implementing code-based adapters. The implementation maintains full backward compatibility with existing code-based adapters.

The tasks are organized to build incrementally, with early validation of core functionality through code. Testing tasks are marked as optional with `*` to allow for faster MVP delivery while maintaining comprehensive test coverage as a goal.

## Tasks

- [x] 1. Set up project dependencies and configuration schema
  - Install required npm packages: `cheerio`, `jsonpath-plus`, `ajv`
  - Create TypeScript interfaces for ProviderConfiguration in `lib/providers/types.ts`
  - Create JSON schema for configuration validation
  - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.7_

- [ ]* 1.1 Write property test for configuration schema completeness
  - **Property 2: Configuration Structure Completeness**
  - **Validates: Requirements 1.3, 1.4, 1.5, 1.6, 1.7**

- [x] 2. Implement ConfigValidator class
  - [x] 2.1 Create `lib/providers/config-validator.ts` with ConfigValidator class
    - Implement validate() method to check required fields
    - Validate provider id uniqueness
    - Validate regex patterns are valid
    - Validate responseType is "html" or "json"
    - Validate parsing config matches responseType
    - Return ValidationResult with errors array
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_
  
  - [ ]* 2.2 Write unit tests for ConfigValidator
    - Test validation of required fields
    - Test regex pattern validation
    - Test responseType validation
    - Test parsing configuration consistency
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_
  
  - [ ]* 2.3 Write property test for required field validation
    - **Property 28: Required Field Validation**
    - **Validates: Requirements 12.2**
  
  - [ ]* 2.4 Write property test for regex pattern validation
    - **Property 29: Regex Pattern Validation**
    - **Validates: Requirements 12.3**
  
  - [ ]* 2.5 Write property test for response type validation
    - **Property 30: Response Type Validation**
    - **Validates: Requirements 12.4**
  
  - [ ]* 2.6 Write property test for parsing configuration consistency
    - **Property 31: Parsing Configuration Consistency**
    - **Validates: Requirements 12.5**

- [x] 3. Implement BalanceParser class
  - [x] 3.1 Create `lib/providers/balance-parser.ts` with BalanceParser class
    - Implement constructor accepting parsing configuration
    - Implement parse() method that routes to parseHtml() or parseJson()
    - Implement parseHtml() using cheerio with CSS selectors
    - Implement parseJson() using jsonpath-plus with JSONPath expressions
    - Implement text-to-number conversion for balance values
    - Handle optional fields (currency, dueDate) returning null on failure
    - Return ParseResult with balance, currency, dueDate, and optional error
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 13.6_
  
  - [ ]* 3.2 Write unit tests for HTML parsing
    - Test CSS selector extraction
    - Test text-to-number conversion with various formats
    - Test selector failure handling
    - Test optional field handling
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  
  - [ ]* 3.3 Write unit tests for JSON parsing
    - Test JSONPath extraction
    - Test type conversion
    - Test JSONPath failure handling
    - Test optional field handling
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  
  - [ ]* 3.4 Write property test for HTML response parsing
    - **Property 9: HTML Response Parsing**
    - **Validates: Requirements 5.1, 5.2, 5.3**
  
  - [ ]* 3.5 Write property test for HTML text to number conversion
    - **Property 10: HTML Text to Number Conversion**
    - **Validates: Requirements 5.4**
  
  - [ ]* 3.6 Write property test for HTML selector failure handling
    - **Property 11: HTML Selector Failure Handling**
    - **Validates: Requirements 5.5**
  
  - [ ]* 3.7 Write property test for JSON response parsing
    - **Property 12: JSON Response Parsing**
    - **Validates: Requirements 6.1, 6.2, 6.3**
  
  - [ ]* 3.8 Write property test for JSON type conversion
    - **Property 13: JSON Type Conversion**
    - **Validates: Requirements 6.4**
  
  - [ ]* 3.9 Write property test for JSONPath failure handling
    - **Property 14: JSONPath Failure Handling**
    - **Validates: Requirements 6.5**
  
  - [ ]* 3.10 Write property test for optional field null handling
    - **Property 33: Optional Field Null Handling**
    - **Validates: Requirements 13.6**

- [x] 4. Implement JsonProviderAdapter class
  - [x] 4.1 Create `lib/providers/json-provider-adapter.ts` with JsonProviderAdapter class
    - Implement ProviderAdapter interface
    - Implement constructor accepting ProviderConfiguration
    - Implement providerName, providerType, supportedRegions getters
    - Implement validateAccountNumber() using regex from config
    - Implement getAccountNumberFormat() returning formatDescription
    - Implement getEndpointUrl(), getTimeout(), getRetryConfig() methods
    - Create BalanceParser instance in constructor
    - _Requirements: 8.1, 8.2, 8.5, 8.6, 8.7, 8.8, 3.2, 3.4_
  
  - [x] 4.2 Implement fetchBalance() method with API request logic
    - Replace {{accountNumber}} placeholders in endpoint URL
    - Include all configured headers in request
    - Support GET and POST methods
    - For POST, include request body with placeholder replacement
    - Use axios for HTTP requests with timeout
    - Call BalanceParser to extract data from response
    - Return BalanceResult with success/error status
    - _Requirements: 8.3, 4.3, 4.4, 4.5, 4.6_
  
  - [x] 4.3 Implement retry logic with exponential backoff
    - Retry on network errors and HTTP 5xx status codes
    - Do not retry on HTTP 4xx status codes
    - Implement exponential backoff when useExponentialBackoff is true
    - Use fixed delays from retryDelays when useExponentialBackoff is false
    - Retry up to maxRetries times
    - Return last error when all retries exhausted
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_
  
  - [ ]* 4.4 Write unit tests for JsonProviderAdapter
    - Test ProviderAdapter interface implementation
    - Test account number validation
    - Test URL placeholder replacement
    - Test header inclusion
    - Test POST request body inclusion
    - Test error handling
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_
  
  - [ ]* 4.5 Write property test for account number validation
    - **Property 5: Account Number Validation**
    - **Validates: Requirements 3.2, 3.3, 3.4**
  
  - [ ]* 4.6 Write property test for URL placeholder replacement
    - **Property 6: URL Placeholder Replacement**
    - **Validates: Requirements 4.3**
  
  - [ ]* 4.7 Write property test for header inclusion
    - **Property 7: Header Inclusion**
    - **Validates: Requirements 4.4**
  
  - [ ]* 4.8 Write property test for POST request body inclusion
    - **Property 8: POST Request Body Inclusion**
    - **Validates: Requirements 4.5**
  
  - [ ]* 4.9 Write property test for configuration getter methods
    - **Property 20: Configuration Getter Methods**
    - **Validates: Requirements 8.5, 8.6, 8.7, 8.8**

- [ ] 5. Implement retry logic property tests
  - [ ]* 5.1 Write property test for retry attempt count
    - **Property 15: Retry Attempt Count**
    - **Validates: Requirements 7.1, 7.2**
  
  - [ ]* 5.2 Write property test for exponential backoff behavior
    - **Property 16: Exponential Backoff Behavior**
    - **Validates: Requirements 7.3**
  
  - [ ]* 5.3 Write property test for fixed delay behavior
    - **Property 17: Fixed Delay Behavior**
    - **Validates: Requirements 7.4**
  
  - [ ]* 5.4 Write property test for retry exhaustion error
    - **Property 18: Retry Exhaustion Error**
    - **Validates: Requirements 7.5**
  
  - [ ]* 5.5 Write property test for retry condition on server errors
    - **Property 19: Retry Condition - Server Errors**
    - **Validates: Requirements 7.6, 7.7**

- [x] 6. Checkpoint - Ensure core components work correctly
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Update factory to load JSON configurations
  - [x] 7.1 Modify `lib/providers/factory.ts` to load providers.json
    - Import ConfigValidator and JsonProviderAdapter
    - Load providers.json from project root at initialization
    - Handle missing providers.json gracefully (continue with code-based adapters)
    - Parse JSON and validate each provider configuration
    - Log validation errors and skip invalid configurations
    - Create JsonProviderAdapter instances for valid configurations
    - Check if provider id already exists as code-based adapter
    - Register JSON-based adapters only if no code-based adapter exists
    - Log which providers are registered as JSON-based
    - Maintain backward compatibility with existing code-based adapter registration
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 1.8, 12.6_
  
  - [ ]* 7.2 Write unit tests for factory integration
    - Test loading valid providers.json
    - Test handling missing providers.json
    - Test handling malformed JSON
    - Test code-based adapter precedence
    - Test backward compatibility
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.6, 9.7_
  
  - [ ]* 7.3 Write property test for valid configuration parsing
    - **Property 1: Valid Configuration Parsing**
    - **Validates: Requirements 1.2**
  
  - [ ]* 7.4 Write property test for malformed configuration resilience
    - **Property 3: Malformed Configuration Resilience**
    - **Validates: Requirements 1.8**
  
  - [ ]* 7.5 Write property test for provider ID uniqueness
    - **Property 4: Provider ID Uniqueness**
    - **Validates: Requirements 2.1, 2.6**
  
  - [ ]* 7.6 Write property test for factory adapter creation
    - **Property 21: Factory Adapter Creation**
    - **Validates: Requirements 9.2, 9.3**
  
  - [ ]* 7.7 Write property test for code-based adapter precedence
    - **Property 22: Code-Based Adapter Precedence**
    - **Validates: Requirements 9.4**
  
  - [ ]* 7.8 Write property test for invalid configuration isolation
    - **Property 32: Invalid Configuration Isolation**
    - **Validates: Requirements 12.6**

- [ ] 8. Implement error handling and logging
  - [x] 8.1 Add comprehensive error logging to all components
    - Log configuration parse errors with line/column info
    - Log validation errors with missing fields
    - Log API request failures with provider id (redact account numbers in production)
    - Log parsing failures with response excerpt
    - Log CSS selector/JSONPath failures with expression
    - Log successful provider registration
    - Implement production mode sensitive data redaction
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_
  
  - [ ]* 8.2 Write unit tests for error logging
    - Test configuration error logging
    - Test API error logging
    - Test parsing error logging
    - Test sensitive data redaction in production mode
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_
  
  - [ ]* 8.3 Write property test for validation error reporting
    - **Property 25: Validation Error Reporting**
    - **Validates: Requirements 11.2**
  
  - [ ]* 8.4 Write property test for sensitive data protection
    - **Property 26: Sensitive Data Protection**
    - **Validates: Requirements 11.7**
  
  - [ ]* 8.5 Write property test for load-time validation
    - **Property 27: Load-Time Validation**
    - **Validates: Requirements 12.1**

- [ ] 9. Create sample providers.json configuration file
  - [x] 9.1 Create `providers.json` in project root
    - Include example provider with HTML responseType
    - Include example provider with JSON responseType
    - Include comprehensive comments explaining each field
    - Include sample account validation patterns
    - Include sample retry configurations
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_
  
  - [x] 9.2 Create `providers.json.example` as template
    - Provide template with placeholder values
    - Include documentation for each field
    - _Requirements: 1.1_

- [ ] 10. Implement backward compatibility tests
  - [ ]* 10.1 Write property test for adapter type coexistence
    - **Property 23: Adapter Type Coexistence**
    - **Validates: Requirements 10.1**
  
  - [ ]* 10.2 Write property test for code-based adapter compatibility
    - **Property 24: Code-Based Adapter Compatibility**
    - **Validates: Requirements 10.6**

- [x] 11. Checkpoint - Ensure integration works correctly
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Create test data and round-trip tests
  - [x] 12.1 Create sample HTML responses for testing
    - Create `test/fixtures/sample-html-responses.ts`
    - Include various HTML structures
    - Include edge cases (empty, malformed, missing fields)
    - _Requirements: 14.2, 14.4_
  
  - [x] 12.2 Create sample JSON responses for testing
    - Create `test/fixtures/sample-json-responses.ts`
    - Include various JSON structures
    - Include edge cases (empty, malformed, missing fields)
    - _Requirements: 14.3, 14.5_
  
  - [ ]* 12.3 Write property test for HTML parsing round-trip
    - **Property 34: HTML Parsing Round-Trip**
    - **Validates: Requirements 14.2**
  
  - [ ]* 12.4 Write property test for JSON parsing round-trip
    - **Property 35: JSON Parsing Round-Trip**
    - **Validates: Requirements 14.3**

- [ ] 13. Create integration tests
  - [ ]* 13.1 Write end-to-end integration test
    - Load providers.json with multiple providers
    - Create adapters and register with registry
    - Fetch balances using JSON-based adapters with mocked HTTP responses
    - Verify retry logic with simulated failures
    - Test backward compatibility with code-based adapters
    - _Requirements: 9.1, 9.2, 9.3, 10.1, 10.2_
  
  - [ ]* 13.2 Write mock API integration tests
    - Mock HTTP responses for different providers
    - Test HTML parsing with various structures
    - Test JSON parsing with various structures
    - Simulate network failures and verify retry behavior
    - Test timeout handling
    - _Requirements: 4.3, 4.4, 5.1, 5.2, 6.1, 6.2, 7.1, 7.2_

- [ ] 14. Update exports and documentation
  - [x] 14.1 Update `lib/providers/index.ts` to export new classes
    - Export JsonProviderAdapter
    - Export BalanceParser
    - Export ConfigValidator
    - Export ProviderConfiguration type
  
  - [x] 14.2 Add JSDoc comments to all public APIs
    - Document JsonProviderAdapter class and methods
    - Document BalanceParser class and methods
    - Document ConfigValidator class and methods
    - Document ProviderConfiguration interface
  
  - [x] 14.3 Create README.md for JSON provider configuration
    - Create `lib/providers/JSON-PROVIDER-CONFIG.md`
    - Document how to create provider configurations
    - Include examples for HTML and JSON providers
    - Document configuration validation rules
    - Document error handling and logging
    - Document migration path from code-based adapters

- [x] 15. Final checkpoint - Comprehensive validation
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation throughout implementation
- Property tests validate universal correctness properties (35 total properties)
- Unit tests validate specific examples and edge cases
- The implementation maintains full backward compatibility with existing code-based adapters
- All code examples and implementations use TypeScript
- Dependencies required: `cheerio`, `jsonpath-plus`, `ajv`, `fast-check` (dev)
