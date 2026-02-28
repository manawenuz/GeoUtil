/**
 * Sample HTML Responses for Testing
 * 
 * This file contains various HTML response structures for testing the
 * BalanceParser with HTML responseType. It includes:
 * - Valid responses with different HTML structures
 * - Edge cases (empty, malformed, missing fields)
 * - Various number formats and currency representations
 * 
 * Requirements: 14.2, 14.4
 */

/**
 * Valid HTML response with balance, currency, and due date
 * Standard structure with clear CSS classes
 */
export const validHtmlResponse = `
<!DOCTYPE html>
<html>
<head><title>Account Balance</title></head>
<body>
  <div class="account-info">
    <div class="balance-amount">125.50</div>
    <div class="currency-code">GEL</div>
    <div class="due-date">2024-12-31</div>
  </div>
</body>
</html>
`;

/**
 * Valid HTML with balance containing currency symbol
 * Tests text-to-number conversion with currency symbols
 */
export const htmlWithCurrencySymbol = `
<!DOCTYPE html>
<html>
<body>
  <div class="balance-amount">₾250.75</div>
  <div class="currency-code">GEL</div>
</body>
</html>
`;

/**
 * Valid HTML with European number format (comma as decimal separator)
 * Tests handling of different decimal separators
 */
export const htmlWithEuropeanFormat = `
<!DOCTYPE html>
<html>
<body>
  <div class="balance-amount">1.234,56</div>
  <div class="currency-code">EUR</div>
</body>
</html>
`;

/**
 * Valid HTML with balance and currency code in same element
 * Tests extraction when currency is part of balance text
 */
export const htmlWithInlineCurrency = `
<!DOCTYPE html>
<html>
<body>
  <div class="balance-amount">$99.99 USD</div>
</body>
</html>
`;

/**
 * Valid HTML with nested structure
 * Tests CSS selector matching in complex DOM
 */
export const htmlWithNestedStructure = `
<!DOCTYPE html>
<html>
<body>
  <div class="container">
    <div class="account-section">
      <div class="balance-wrapper">
        <span class="label">Balance:</span>
        <span class="balance-amount">500.00</span>
      </div>
      <div class="currency-wrapper">
        <span class="currency-code">GEL</span>
      </div>
      <div class="date-wrapper">
        <span class="due-date">2024-06-15</span>
      </div>
    </div>
  </div>
</body>
</html>
`;

/**
 * Valid HTML with multiple balance elements (should use first)
 * Tests that parser selects the first matching element
 */
export const htmlWithMultipleBalances = `
<!DOCTYPE html>
<html>
<body>
  <div class="balance-amount">300.00</div>
  <div class="balance-amount">400.00</div>
  <div class="balance-amount">500.00</div>
  <div class="currency-code">GEL</div>
</body>
</html>
`;

/**
 * Valid HTML with whitespace in balance text
 * Tests trimming and whitespace handling
 */
export const htmlWithWhitespace = `
<!DOCTYPE html>
<html>
<body>
  <div class="balance-amount">
    
    175.25
    
  </div>
  <div class="currency-code">  GEL  </div>
</body>
</html>
`;

/**
 * Valid HTML with zero balance
 * Tests handling of zero values
 */
export const htmlWithZeroBalance = `
<!DOCTYPE html>
<html>
<body>
  <div class="balance-amount">0.00</div>
  <div class="currency-code">GEL</div>
</body>
</html>
`;

/**
 * Valid HTML with large balance
 * Tests handling of large numbers with thousands separators
 */
export const htmlWithLargeBalance = `
<!DOCTYPE html>
<html>
<body>
  <div class="balance-amount">12,345.67</div>
  <div class="currency-code">GEL</div>
</body>
</html>
`;

/**
 * Valid HTML with only required field (balance)
 * Tests that optional fields can be missing
 */
export const htmlWithOnlyBalance = `
<!DOCTYPE html>
<html>
<body>
  <div class="balance-amount">88.88</div>
</body>
</html>
`;

/**
 * Valid HTML with different date format
 * Tests date parsing with various formats
 */
export const htmlWithDifferentDateFormat = `
<!DOCTYPE html>
<html>
<body>
  <div class="balance-amount">200.00</div>
  <div class="currency-code">GEL</div>
  <div class="due-date">15/06/2024</div>
</body>
</html>
`;

/**
 * Valid HTML with ISO date format
 * Tests ISO 8601 date parsing
 */
export const htmlWithIsoDate = `
<!DOCTYPE html>
<html>
<body>
  <div class="balance-amount">150.00</div>
  <div class="currency-code">GEL</div>
  <div class="due-date">2024-06-15T00:00:00Z</div>
</body>
</html>
`;

/**
 * Empty HTML response
 * Tests handling of empty responses
 */
export const emptyHtmlResponse = `
<!DOCTYPE html>
<html>
<body>
</body>
</html>
`;

/**
 * HTML with missing balance element
 * Tests error handling when required field is missing
 */
export const htmlMissingBalance = `
<!DOCTYPE html>
<html>
<body>
  <div class="currency-code">GEL</div>
  <div class="due-date">2024-12-31</div>
</body>
</html>
`;

/**
 * HTML with wrong CSS class for balance
 * Tests error handling when selector doesn't match
 */
export const htmlWithWrongClass = `
<!DOCTYPE html>
<html>
<body>
  <div class="wrong-class">125.50</div>
  <div class="currency-code">GEL</div>
</body>
</html>
`;

/**
 * HTML with non-numeric balance text
 * Tests error handling for invalid balance values
 */
export const htmlWithNonNumericBalance = `
<!DOCTYPE html>
<html>
<body>
  <div class="balance-amount">Not a number</div>
  <div class="currency-code">GEL</div>
</body>
</html>
`;

/**
 * HTML with empty balance element
 * Tests handling of empty balance text
 */
export const htmlWithEmptyBalance = `
<!DOCTYPE html>
<html>
<body>
  <div class="balance-amount"></div>
  <div class="currency-code">GEL</div>
</body>
</html>
`;

/**
 * Malformed HTML (unclosed tags)
 * Tests parser resilience to malformed HTML
 */
export const malformedHtml = `
<!DOCTYPE html>
<html>
<body>
  <div class="balance-amount">125.50
  <div class="currency-code">GEL
</body>
`;

/**
 * HTML with special characters in balance
 * Tests handling of special characters
 */
export const htmlWithSpecialCharacters = `
<!DOCTYPE html>
<html>
<body>
  <div class="balance-amount">₾ 1,234.56 GEL</div>
  <div class="currency-code">GEL</div>
</body>
</html>
`;

/**
 * HTML with negative balance
 * Tests handling of negative values
 */
export const htmlWithNegativeBalance = `
<!DOCTYPE html>
<html>
<body>
  <div class="balance-amount">-50.00</div>
  <div class="currency-code">GEL</div>
</body>
</html>
`;

/**
 * HTML with balance in different element types
 * Tests selector matching across different HTML elements
 */
export const htmlWithDifferentElements = `
<!DOCTYPE html>
<html>
<body>
  <span class="balance-amount">300.00</span>
  <p class="currency-code">GEL</p>
  <time class="due-date">2024-12-31</time>
</body>
</html>
`;

/**
 * HTML with ID selectors instead of classes
 * Tests that parser works with different selector types
 */
export const htmlWithIdSelectors = `
<!DOCTYPE html>
<html>
<body>
  <div id="balance">450.00</div>
  <div id="currency">GEL</div>
  <div id="dueDate">2024-12-31</div>
</body>
</html>
`;

/**
 * HTML with data attributes
 * Tests extraction from data attributes
 */
export const htmlWithDataAttributes = `
<!DOCTYPE html>
<html>
<body>
  <div class="balance-amount" data-value="275.50">Balance: 275.50</div>
  <div class="currency-code" data-code="GEL">GEL</div>
</body>
</html>
`;

/**
 * Minimal valid HTML
 * Tests minimal valid structure
 */
export const minimalValidHtml = `
<div class="balance-amount">100.00</div>
`;

/**
 * HTML with balance in table structure
 * Tests extraction from table elements
 */
export const htmlWithTableStructure = `
<!DOCTYPE html>
<html>
<body>
  <table>
    <tr>
      <td>Balance:</td>
      <td class="balance-amount">600.00</td>
    </tr>
    <tr>
      <td>Currency:</td>
      <td class="currency-code">GEL</td>
    </tr>
    <tr>
      <td>Due Date:</td>
      <td class="due-date">2024-12-31</td>
    </tr>
  </table>
</body>
</html>
`;

/**
 * HTML with balance in list structure
 * Tests extraction from list elements
 */
export const htmlWithListStructure = `
<!DOCTYPE html>
<html>
<body>
  <ul class="account-details">
    <li class="balance-amount">350.00</li>
    <li class="currency-code">GEL</li>
    <li class="due-date">2024-12-31</li>
  </ul>
</body>
</html>
`;

/**
 * HTML with very long balance number
 * Tests handling of very large numbers
 */
export const htmlWithVeryLargeBalance = `
<!DOCTYPE html>
<html>
<body>
  <div class="balance-amount">9,999,999.99</div>
  <div class="currency-code">GEL</div>
</body>
</html>
`;

/**
 * HTML with decimal-only balance
 * Tests handling of values less than 1
 */
export const htmlWithDecimalOnly = `
<!DOCTYPE html>
<html>
<body>
  <div class="balance-amount">0.99</div>
  <div class="currency-code">GEL</div>
</body>
</html>
`;

/**
 * HTML with invalid date format
 * Tests handling of unparseable dates
 */
export const htmlWithInvalidDate = `
<!DOCTYPE html>
<html>
<body>
  <div class="balance-amount">200.00</div>
  <div class="currency-code">GEL</div>
  <div class="due-date">not-a-date</div>
</body>
</html>
`;

/**
 * Configuration for testing with standard CSS selectors
 */
export const standardCssSelectors = {
  balance: '.balance-amount',
  currency: '.currency-code',
  dueDate: '.due-date',
};

/**
 * Configuration for testing with ID selectors
 */
export const idCssSelectors = {
  balance: '#balance',
  currency: '#currency',
  dueDate: '#dueDate',
};

/**
 * Configuration for testing with only required field
 */
export const minimalCssSelectors = {
  balance: '.balance-amount',
};

/**
 * Configuration for testing with non-existent selectors
 */
export const nonExistentSelectors = {
  balance: '.non-existent-class',
  currency: '.also-non-existent',
  dueDate: '.still-non-existent',
};

/**
 * Test cases mapping responses to expected results
 */
export const htmlTestCases = [
  {
    name: 'Valid HTML response',
    html: validHtmlResponse,
    selectors: standardCssSelectors,
    expected: {
      balance: 125.50,
      currency: 'GEL',
      dueDate: new Date('2024-12-31'),
    },
  },
  {
    name: 'HTML with currency symbol',
    html: htmlWithCurrencySymbol,
    selectors: standardCssSelectors,
    expected: {
      balance: 250.75,
      currency: 'GEL',
      dueDate: null,
    },
  },
  {
    name: 'HTML with European format',
    html: htmlWithEuropeanFormat,
    selectors: standardCssSelectors,
    expected: {
      balance: 1234.56,
      currency: 'EUR',
      dueDate: null,
    },
  },
  {
    name: 'HTML with inline currency',
    html: htmlWithInlineCurrency,
    selectors: standardCssSelectors,
    expected: {
      balance: 99.99,
      currency: null,
      dueDate: null,
    },
  },
  {
    name: 'HTML with nested structure',
    html: htmlWithNestedStructure,
    selectors: standardCssSelectors,
    expected: {
      balance: 500.00,
      currency: 'GEL',
      dueDate: new Date('2024-06-15'),
    },
  },
  {
    name: 'HTML with multiple balances (uses first)',
    html: htmlWithMultipleBalances,
    selectors: standardCssSelectors,
    expected: {
      balance: 300.00,
      currency: 'GEL',
      dueDate: null,
    },
  },
  {
    name: 'HTML with whitespace',
    html: htmlWithWhitespace,
    selectors: standardCssSelectors,
    expected: {
      balance: 175.25,
      currency: 'GEL',
      dueDate: null,
    },
  },
  {
    name: 'HTML with zero balance',
    html: htmlWithZeroBalance,
    selectors: standardCssSelectors,
    expected: {
      balance: 0.00,
      currency: 'GEL',
      dueDate: null,
    },
  },
  {
    name: 'HTML with large balance',
    html: htmlWithLargeBalance,
    selectors: standardCssSelectors,
    expected: {
      balance: 12345.67,
      currency: 'GEL',
      dueDate: null,
    },
  },
  {
    name: 'HTML with only balance',
    html: htmlWithOnlyBalance,
    selectors: minimalCssSelectors,
    expected: {
      balance: 88.88,
      currency: null,
      dueDate: null,
    },
  },
  {
    name: 'HTML with negative balance',
    html: htmlWithNegativeBalance,
    selectors: standardCssSelectors,
    expected: {
      balance: -50.00,
      currency: 'GEL',
      dueDate: null,
    },
  },
  {
    name: 'HTML with different elements',
    html: htmlWithDifferentElements,
    selectors: standardCssSelectors,
    expected: {
      balance: 300.00,
      currency: 'GEL',
      dueDate: new Date('2024-12-31'),
    },
  },
  {
    name: 'HTML with ID selectors',
    html: htmlWithIdSelectors,
    selectors: idCssSelectors,
    expected: {
      balance: 450.00,
      currency: 'GEL',
      dueDate: new Date('2024-12-31'),
    },
  },
  {
    name: 'Minimal valid HTML',
    html: minimalValidHtml,
    selectors: minimalCssSelectors,
    expected: {
      balance: 100.00,
      currency: null,
      dueDate: null,
    },
  },
  {
    name: 'HTML with table structure',
    html: htmlWithTableStructure,
    selectors: standardCssSelectors,
    expected: {
      balance: 600.00,
      currency: 'GEL',
      dueDate: new Date('2024-12-31'),
    },
  },
  {
    name: 'HTML with list structure',
    html: htmlWithListStructure,
    selectors: standardCssSelectors,
    expected: {
      balance: 350.00,
      currency: 'GEL',
      dueDate: new Date('2024-12-31'),
    },
  },
  {
    name: 'HTML with very large balance',
    html: htmlWithVeryLargeBalance,
    selectors: standardCssSelectors,
    expected: {
      balance: 9999999.99,
      currency: 'GEL',
      dueDate: null,
    },
  },
  {
    name: 'HTML with decimal only',
    html: htmlWithDecimalOnly,
    selectors: standardCssSelectors,
    expected: {
      balance: 0.99,
      currency: 'GEL',
      dueDate: null,
    },
  },
];

/**
 * Error test cases - responses that should produce errors
 */
export const htmlErrorTestCases = [
  {
    name: 'Empty HTML response',
    html: emptyHtmlResponse,
    selectors: standardCssSelectors,
    expectedError: 'matched no elements',
  },
  {
    name: 'HTML missing balance',
    html: htmlMissingBalance,
    selectors: standardCssSelectors,
    expectedError: 'matched no elements',
  },
  {
    name: 'HTML with wrong class',
    html: htmlWithWrongClass,
    selectors: standardCssSelectors,
    expectedError: 'matched no elements',
  },
  {
    name: 'HTML with non-numeric balance',
    html: htmlWithNonNumericBalance,
    selectors: standardCssSelectors,
    expectedError: 'Failed to convert balance text',
  },
  {
    name: 'HTML with empty balance',
    html: htmlWithEmptyBalance,
    selectors: standardCssSelectors,
    expectedError: 'Failed to convert balance text',
  },
  {
    name: 'Non-existent selectors',
    html: validHtmlResponse,
    selectors: nonExistentSelectors,
    expectedError: 'matched no elements',
  },
];

/**
 * Edge case test cases - unusual but valid scenarios
 */
export const htmlEdgeCases = [
  {
    name: 'Malformed HTML (parser should handle)',
    html: malformedHtml,
    selectors: standardCssSelectors,
    expected: {
      balance: 125.50,
      currency: 'GEL',
      dueDate: null,
    },
  },
  {
    name: 'HTML with special characters',
    html: htmlWithSpecialCharacters,
    selectors: standardCssSelectors,
    expected: {
      balance: 1234.56,
      currency: 'GEL',
      dueDate: null,
    },
  },
  {
    name: 'HTML with invalid date (should return null for dueDate)',
    html: htmlWithInvalidDate,
    selectors: standardCssSelectors,
    expected: {
      balance: 200.00,
      currency: 'GEL',
      dueDate: null, // Invalid date should be null, not error
    },
  },
];
