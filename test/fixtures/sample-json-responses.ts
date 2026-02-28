/**
 * Sample JSON Responses for Testing
 * 
 * This file contains various JSON response structures for testing the
 * BalanceParser with JSON responseType. It includes:
 * - Valid responses with different JSON structures
 * - Edge cases (empty, malformed, missing fields)
 * - Various number formats and data representations
 * 
 * Requirements: 14.3, 14.5
 */

/**
 * Valid JSON response with balance, currency, and due date
 * Standard flat structure with clear field names
 */
export const validJsonResponse = JSON.stringify({
  balance: 125.50,
  currency: 'GEL',
  dueDate: '2024-12-31',
});

/**
 * Valid JSON with nested structure
 * Tests JSONPath extraction from nested objects
 */
export const jsonWithNestedStructure = JSON.stringify({
  account: {
    details: {
      balance: 250.75,
      currency: 'GEL',
      dueDate: '2024-06-15',
    },
  },
});

/**
 * Valid JSON with array structure
 * Tests JSONPath extraction from arrays
 */
export const jsonWithArrayStructure = JSON.stringify({
  accounts: [
    {
      balance: 300.00,
      currency: 'GEL',
      dueDate: '2024-12-31',
    },
    {
      balance: 400.00,
      currency: 'USD',
      dueDate: '2024-11-30',
    },
  ],
});

/**
 * Valid JSON with balance as string
 * Tests type conversion from string to number
 */
export const jsonWithStringBalance = JSON.stringify({
  balance: '175.25',
  currency: 'GEL',
  dueDate: '2024-12-31',
});

/**
 * Valid JSON with balance containing currency symbol
 * Tests extraction and cleaning of balance values
 */
export const jsonWithCurrencyInBalance = JSON.stringify({
  balance: '₾500.00',
  currency: 'GEL',
});

/**
 * Valid JSON with European number format as string
 * Tests handling of different decimal separators
 */
export const jsonWithEuropeanFormat = JSON.stringify({
  balance: '1.234,56',
  currency: 'EUR',
});

/**
 * Valid JSON with only required field (balance)
 * Tests that optional fields can be missing
 */
export const jsonWithOnlyBalance = JSON.stringify({
  balance: 88.88,
});

/**
 * Valid JSON with zero balance
 * Tests handling of zero values
 */
export const jsonWithZeroBalance = JSON.stringify({
  balance: 0.00,
  currency: 'GEL',
});

/**
 * Valid JSON with negative balance
 * Tests handling of negative values
 */
export const jsonWithNegativeBalance = JSON.stringify({
  balance: -50.00,
  currency: 'GEL',
});

/**
 * Valid JSON with large balance
 * Tests handling of large numbers
 */
export const jsonWithLargeBalance = JSON.stringify({
  balance: 9999999.99,
  currency: 'GEL',
});

/**
 * Valid JSON with decimal-only balance
 * Tests handling of values less than 1
 */
export const jsonWithDecimalOnly = JSON.stringify({
  balance: 0.99,
  currency: 'GEL',
});

/**
 * Valid JSON with ISO date format
 * Tests ISO 8601 date parsing
 */
export const jsonWithIsoDate = JSON.stringify({
  balance: 150.00,
  currency: 'GEL',
  dueDate: '2024-06-15T00:00:00Z',
});

/**
 * Valid JSON with Unix timestamp
 * Tests timestamp to date conversion
 */
export const jsonWithUnixTimestamp = JSON.stringify({
  balance: 200.00,
  currency: 'GEL',
  dueDate: 1735689600000, // 2025-01-01
});

/**
 * Valid JSON with different date format
 * Tests date parsing with various formats
 */
export const jsonWithDifferentDateFormat = JSON.stringify({
  balance: 200.00,
  currency: 'GEL',
  dueDate: '15/06/2024',
});

/**
 * Valid JSON with deeply nested structure
 * Tests JSONPath with deep nesting
 */
export const jsonWithDeeplyNested = JSON.stringify({
  data: {
    response: {
      account: {
        financial: {
          balance: 350.00,
          currency: 'GEL',
          payment: {
            dueDate: '2024-12-31',
          },
        },
      },
    },
  },
});

/**
 * Valid JSON with multiple balance fields (should use first match)
 * Tests that parser selects the first matching field
 */
export const jsonWithMultipleBalances = JSON.stringify({
  currentBalance: 300.00,
  previousBalance: 400.00,
  projectedBalance: 500.00,
  currency: 'GEL',
});

/**
 * Valid JSON with balance in scientific notation
 * Tests handling of scientific notation
 */
export const jsonWithScientificNotation = JSON.stringify({
  balance: 1.5e2, // 150.00
  currency: 'GEL',
});

/**
 * Valid JSON with additional fields
 * Tests that parser ignores extra fields
 */
export const jsonWithExtraFields = JSON.stringify({
  accountNumber: '123456789012',
  accountHolder: 'John Doe',
  balance: 275.50,
  currency: 'GEL',
  dueDate: '2024-12-31',
  lastPayment: '2024-11-30',
  status: 'active',
});

/**
 * Valid JSON with null optional fields
 * Tests handling of explicit null values
 */
export const jsonWithNullFields = JSON.stringify({
  balance: 100.00,
  currency: null,
  dueDate: null,
});

/**
 * Valid JSON with empty string values
 * Tests handling of empty strings
 */
export const jsonWithEmptyStrings = JSON.stringify({
  balance: 100.00,
  currency: '',
  dueDate: '',
});

/**
 * Valid JSON with boolean and other types
 * Tests type handling for non-standard fields
 */
export const jsonWithMixedTypes = JSON.stringify({
  balance: 125.50,
  currency: 'GEL',
  isPaid: false,
  accountActive: true,
});

/**
 * Valid JSON with balance in wrapper object
 * Tests extraction from value wrappers
 */
export const jsonWithValueWrapper = JSON.stringify({
  balance: {
    value: 450.00,
    formatted: '450.00 GEL',
  },
  currency: 'GEL',
});

/**
 * Valid JSON with balance as integer
 * Tests handling of integer balance values
 */
export const jsonWithIntegerBalance = JSON.stringify({
  balance: 100,
  currency: 'GEL',
});

/**
 * Empty JSON object
 * Tests handling of empty responses
 */
export const emptyJsonResponse = JSON.stringify({});

/**
 * Empty JSON array
 * Tests handling of empty array responses
 */
export const emptyJsonArray = JSON.stringify([]);

/**
 * JSON with missing balance field
 * Tests error handling when required field is missing
 */
export const jsonMissingBalance = JSON.stringify({
  currency: 'GEL',
  dueDate: '2024-12-31',
});

/**
 * JSON with wrong field names
 * Tests error handling when fields don't match JSONPath
 */
export const jsonWithWrongFields = JSON.stringify({
  amount: 125.50,
  currencyCode: 'GEL',
  paymentDue: '2024-12-31',
});

/**
 * JSON with non-numeric balance
 * Tests error handling for invalid balance values
 */
export const jsonWithNonNumericBalance = JSON.stringify({
  balance: 'Not a number',
  currency: 'GEL',
});

/**
 * JSON with balance as null
 * Tests error handling for null balance
 */
export const jsonWithNullBalance = JSON.stringify({
  balance: null,
  currency: 'GEL',
});

/**
 * JSON with balance as empty string
 * Tests error handling for empty balance
 */
export const jsonWithEmptyBalance = JSON.stringify({
  balance: '',
  currency: 'GEL',
});

/**
 * JSON with balance as boolean
 * Tests error handling for wrong type
 */
export const jsonWithBooleanBalance = JSON.stringify({
  balance: true,
  currency: 'GEL',
});

/**
 * JSON with balance as array
 * Tests error handling for array balance
 */
export const jsonWithArrayBalance = JSON.stringify({
  balance: [100, 200, 300],
  currency: 'GEL',
});

/**
 * JSON with balance as object
 * Tests error handling for object balance (without proper JSONPath)
 */
export const jsonWithObjectBalance = JSON.stringify({
  balance: { amount: 100 },
  currency: 'GEL',
});

/**
 * JSON with invalid date format
 * Tests handling of unparseable dates
 */
export const jsonWithInvalidDate = JSON.stringify({
  balance: 200.00,
  currency: 'GEL',
  dueDate: 'not-a-date',
});

/**
 * Malformed JSON (invalid syntax)
 * Tests error handling for JSON parse errors
 */
export const malformedJson = '{balance: 125.50, currency: "GEL"'; // Missing closing brace and quotes

/**
 * JSON with Unicode characters
 * Tests handling of Unicode in values
 */
export const jsonWithUnicode = JSON.stringify({
  balance: 125.50,
  currency: 'GEL',
  accountHolder: 'გიორგი თბილისელი',
});

/**
 * JSON with very long balance number
 * Tests handling of very large numbers
 */
export const jsonWithVeryLargeBalance = JSON.stringify({
  balance: 999999999999.99,
  currency: 'GEL',
});

/**
 * JSON with balance having many decimal places
 * Tests rounding and precision handling
 */
export const jsonWithManyDecimals = JSON.stringify({
  balance: 125.123456789,
  currency: 'GEL',
});

/**
 * JSON with whitespace in string balance
 * Tests trimming and whitespace handling
 */
export const jsonWithWhitespaceBalance = JSON.stringify({
  balance: '  175.25  ',
  currency: '  GEL  ',
});

/**
 * Configuration for testing with standard JSONPath
 */
export const standardJsonPath = {
  balance: '$.balance',
  currency: '$.currency',
  dueDate: '$.dueDate',
};

/**
 * Configuration for testing with nested JSONPath
 */
export const nestedJsonPath = {
  balance: '$.account.details.balance',
  currency: '$.account.details.currency',
  dueDate: '$.account.details.dueDate',
};

/**
 * Configuration for testing with array JSONPath (first element)
 */
export const arrayJsonPath = {
  balance: '$.accounts[0].balance',
  currency: '$.accounts[0].currency',
  dueDate: '$.accounts[0].dueDate',
};

/**
 * Configuration for testing with deeply nested JSONPath
 */
export const deeplyNestedJsonPath = {
  balance: '$.data.response.account.financial.balance',
  currency: '$.data.response.account.financial.currency',
  dueDate: '$.data.response.account.financial.payment.dueDate',
};

/**
 * Configuration for testing with value wrapper JSONPath
 */
export const valueWrapperJsonPath = {
  balance: '$.balance.value',
  currency: '$.currency',
  dueDate: '$.dueDate',
};

/**
 * Configuration for testing with only required field
 */
export const minimalJsonPath = {
  balance: '$.balance',
};

/**
 * Configuration for testing with non-existent paths
 */
export const nonExistentJsonPath = {
  balance: '$.nonExistent.balance',
  currency: '$.nonExistent.currency',
  dueDate: '$.nonExistent.dueDate',
};

/**
 * Configuration for testing with wrong field names
 */
export const wrongFieldJsonPath = {
  balance: '$.amount',
  currency: '$.currencyCode',
  dueDate: '$.paymentDue',
};

/**
 * Test cases mapping responses to expected results
 */
export const jsonTestCases = [
  {
    name: 'Valid JSON response',
    json: validJsonResponse,
    jsonPath: standardJsonPath,
    expected: {
      balance: 125.50,
      currency: 'GEL',
      dueDate: new Date('2024-12-31'),
    },
  },
  {
    name: 'JSON with nested structure',
    json: jsonWithNestedStructure,
    jsonPath: nestedJsonPath,
    expected: {
      balance: 250.75,
      currency: 'GEL',
      dueDate: new Date('2024-06-15'),
    },
  },
  {
    name: 'JSON with array structure',
    json: jsonWithArrayStructure,
    jsonPath: arrayJsonPath,
    expected: {
      balance: 300.00,
      currency: 'GEL',
      dueDate: new Date('2024-12-31'),
    },
  },
  {
    name: 'JSON with string balance',
    json: jsonWithStringBalance,
    jsonPath: standardJsonPath,
    expected: {
      balance: 175.25,
      currency: 'GEL',
      dueDate: new Date('2024-12-31'),
    },
  },
  {
    name: 'JSON with only balance',
    json: jsonWithOnlyBalance,
    jsonPath: minimalJsonPath,
    expected: {
      balance: 88.88,
      currency: null,
      dueDate: null,
    },
  },
  {
    name: 'JSON with zero balance',
    json: jsonWithZeroBalance,
    jsonPath: standardJsonPath,
    expected: {
      balance: 0.00,
      currency: 'GEL',
      dueDate: null,
    },
  },
  {
    name: 'JSON with negative balance',
    json: jsonWithNegativeBalance,
    jsonPath: standardJsonPath,
    expected: {
      balance: -50.00,
      currency: 'GEL',
      dueDate: null,
    },
  },
  {
    name: 'JSON with large balance',
    json: jsonWithLargeBalance,
    jsonPath: standardJsonPath,
    expected: {
      balance: 9999999.99,
      currency: 'GEL',
      dueDate: null,
    },
  },
  {
    name: 'JSON with decimal only',
    json: jsonWithDecimalOnly,
    jsonPath: standardJsonPath,
    expected: {
      balance: 0.99,
      currency: 'GEL',
      dueDate: null,
    },
  },
  {
    name: 'JSON with ISO date',
    json: jsonWithIsoDate,
    jsonPath: standardJsonPath,
    expected: {
      balance: 150.00,
      currency: 'GEL',
      dueDate: new Date('2024-06-15T00:00:00Z'),
    },
  },
  {
    name: 'JSON with deeply nested structure',
    json: jsonWithDeeplyNested,
    jsonPath: deeplyNestedJsonPath,
    expected: {
      balance: 350.00,
      currency: 'GEL',
      dueDate: new Date('2024-12-31'),
    },
  },
  {
    name: 'JSON with scientific notation',
    json: jsonWithScientificNotation,
    jsonPath: standardJsonPath,
    expected: {
      balance: 150.00,
      currency: 'GEL',
      dueDate: null,
    },
  },
  {
    name: 'JSON with extra fields',
    json: jsonWithExtraFields,
    jsonPath: standardJsonPath,
    expected: {
      balance: 275.50,
      currency: 'GEL',
      dueDate: new Date('2024-12-31'),
    },
  },
  {
    name: 'JSON with null fields',
    json: jsonWithNullFields,
    jsonPath: standardJsonPath,
    expected: {
      balance: 100.00,
      currency: null,
      dueDate: null,
    },
  },
  {
    name: 'JSON with value wrapper',
    json: jsonWithValueWrapper,
    jsonPath: valueWrapperJsonPath,
    expected: {
      balance: 450.00,
      currency: 'GEL',
      dueDate: null,
    },
  },
  {
    name: 'JSON with integer balance',
    json: jsonWithIntegerBalance,
    jsonPath: standardJsonPath,
    expected: {
      balance: 100,
      currency: 'GEL',
      dueDate: null,
    },
  },
  {
    name: 'JSON with Unicode characters',
    json: jsonWithUnicode,
    jsonPath: standardJsonPath,
    expected: {
      balance: 125.50,
      currency: 'GEL',
      dueDate: null,
    },
  },
  {
    name: 'JSON with many decimals',
    json: jsonWithManyDecimals,
    jsonPath: standardJsonPath,
    expected: {
      balance: 125.123456789,
      currency: 'GEL',
      dueDate: null,
    },
  },
];

/**
 * Error test cases - responses that should produce errors
 */
export const jsonErrorTestCases = [
  {
    name: 'Empty JSON object',
    json: emptyJsonResponse,
    jsonPath: standardJsonPath,
    expectedError: 'matched no data',
  },
  {
    name: 'Empty JSON array',
    json: emptyJsonArray,
    jsonPath: arrayJsonPath,
    expectedError: 'matched no data',
  },
  {
    name: 'JSON missing balance',
    json: jsonMissingBalance,
    jsonPath: standardJsonPath,
    expectedError: 'matched no data',
  },
  {
    name: 'JSON with wrong fields',
    json: jsonWithWrongFields,
    jsonPath: standardJsonPath,
    expectedError: 'matched no data',
  },
  {
    name: 'JSON with non-numeric balance',
    json: jsonWithNonNumericBalance,
    jsonPath: standardJsonPath,
    expectedError: 'Failed to convert balance',
  },
  {
    name: 'JSON with null balance',
    json: jsonWithNullBalance,
    jsonPath: standardJsonPath,
    expectedError: 'Failed to convert balance',
  },
  {
    name: 'JSON with empty balance',
    json: jsonWithEmptyBalance,
    jsonPath: standardJsonPath,
    expectedError: 'Failed to convert balance',
  },
  {
    name: 'JSON with boolean balance',
    json: jsonWithBooleanBalance,
    jsonPath: standardJsonPath,
    expectedError: 'Failed to convert balance',
  },
  {
    name: 'JSON with array balance',
    json: jsonWithArrayBalance,
    jsonPath: standardJsonPath,
    expectedError: 'Failed to convert balance',
  },
  {
    name: 'JSON with object balance',
    json: jsonWithObjectBalance,
    jsonPath: standardJsonPath,
    expectedError: 'Failed to convert balance',
  },
  {
    name: 'Malformed JSON',
    json: malformedJson,
    jsonPath: standardJsonPath,
    expectedError: 'Failed to parse JSON',
  },
  {
    name: 'Non-existent JSONPath',
    json: validJsonResponse,
    jsonPath: nonExistentJsonPath,
    expectedError: 'matched no data',
  },
];

/**
 * Edge case test cases - unusual but valid scenarios
 */
export const jsonEdgeCases = [
  {
    name: 'JSON with currency in balance (should extract number)',
    json: jsonWithCurrencyInBalance,
    jsonPath: standardJsonPath,
    expected: {
      balance: 500.00,
      currency: 'GEL',
      dueDate: null,
    },
  },
  {
    name: 'JSON with European format (should handle)',
    json: jsonWithEuropeanFormat,
    jsonPath: standardJsonPath,
    expected: {
      balance: 1234.56,
      currency: 'EUR',
      dueDate: null,
    },
  },
  {
    name: 'JSON with empty strings (should return null for optional fields)',
    json: jsonWithEmptyStrings,
    jsonPath: standardJsonPath,
    expected: {
      balance: 100.00,
      currency: null,
      dueDate: null,
    },
  },
  {
    name: 'JSON with invalid date (should return null for dueDate)',
    json: jsonWithInvalidDate,
    jsonPath: standardJsonPath,
    expected: {
      balance: 200.00,
      currency: 'GEL',
      dueDate: null, // Invalid date should be null, not error
    },
  },
  {
    name: 'JSON with Unix timestamp',
    json: jsonWithUnixTimestamp,
    jsonPath: standardJsonPath,
    expected: {
      balance: 200.00,
      currency: 'GEL',
      dueDate: new Date(1735689600000),
    },
  },
  {
    name: 'JSON with very large balance',
    json: jsonWithVeryLargeBalance,
    jsonPath: standardJsonPath,
    expected: {
      balance: 999999999999.99,
      currency: 'GEL',
      dueDate: null,
    },
  },
  {
    name: 'JSON with whitespace in balance',
    json: jsonWithWhitespaceBalance,
    jsonPath: standardJsonPath,
    expected: {
      balance: 175.25,
      currency: 'GEL',
      dueDate: null,
    },
  },
];
