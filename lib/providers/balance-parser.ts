/**
 * BalanceParser - Extracts balance data from API responses
 * 
 * This class handles parsing of both HTML and JSON responses from utility
 * provider APIs. It uses CSS selectors for HTML parsing (via cheerio) and
 * JSONPath expressions for JSON parsing (via jsonpath-plus).
 * 
 * The parser supports extracting:
 * - balance (required): The account balance amount
 * - currency (optional): The currency code (e.g., "GEL", "USD")
 * - dueDate (optional): The payment due date
 * 
 * Optional fields return null on failure, while required field failures
 * result in an error being returned in the ParseResult.
 * 
 * @example
 * ```typescript
 * const parser = new BalanceParser({
 *   responseType: 'html',
 *   cssSelectors: {
 *     balance: '.balance-amount',
 *     currency: '.currency-code',
 *     dueDate: '.due-date'
 *   }
 * });
 * 
 * const result = parser.parse(htmlResponse);
 * if (result.error) {
 *   console.error('Parsing failed:', result.error);
 * } else {
 *   console.log(`Balance: ${result.balance} ${result.currency}`);
 * }
 * ```
 */

import * as cheerio from 'cheerio';
import { JSONPath } from 'jsonpath-plus';
import type { ParsingConfig, ParseResult } from './types';
import { truncateResponse } from './logger';

export class BalanceParser {
  private config: ParsingConfig;

  /**
   * Creates a new BalanceParser instance
   * 
   * @param config - The parsing configuration specifying response type and extraction rules
   * 
   * @example
   * ```typescript
   * // HTML parsing configuration
   * const htmlParser = new BalanceParser({
   *   responseType: 'html',
   *   cssSelectors: {
   *     balance: '.balance-amount',
   *     currency: '.currency-code'
   *   }
   * });
   * 
   * // JSON parsing configuration
   * const jsonParser = new BalanceParser({
   *   responseType: 'json',
   *   jsonPath: {
   *     balance: '$.data.balance',
   *     currency: '$.data.currency'
   *   }
   * });
   * ```
   */
  constructor(config: ParsingConfig) {
    this.config = config;
  }

  /**
   * Parses a response string and extracts balance data
   * 
   * Routes to parseHtml() or parseJson() based on the configured responseType.
   * Returns a ParseResult containing the extracted balance, currency, and dueDate,
   * or an error if parsing fails.
   * 
   * @param response - The raw response string from the API
   * @returns ParseResult with extracted data or error message
   * 
   * @example
   * ```typescript
   * const result = parser.parse('<div class="balance">123.45</div>');
   * if (result.error) {
   *   console.error('Failed to parse:', result.error);
   * } else {
   *   console.log(`Balance: ${result.balance}`);
   * }
   * ```
   */
  parse(response: string): ParseResult {
    if (this.config.responseType === 'html') {
      return this.parseHtml(response);
    } else {
      return this.parseJson(response);
    }
  }

  /**
   * Parses HTML response using CSS selectors
   * 
   * Uses cheerio to load the HTML and extract data using the configured CSS selectors.
   * The balance field is required and must be successfully extracted. Currency and
   * dueDate are optional and return null if not found or extraction fails.
   * 
   * @param html - The HTML response string
   * @returns ParseResult with extracted data or error message
   * 
   * @example
   * ```typescript
   * const html = `
   *   <div class="balance">123.45 GEL</div>
   *   <div class="currency">GEL</div>
   *   <div class="due-date">2024-12-31</div>
   * `;
   * const result = parser.parseHtml(html);
   * // { balance: 123.45, currency: "GEL", dueDate: Date(...) }
   * ```
   * 
   * @remarks
   * - Returns error if CSS selectors configuration is missing (Requirement 5.5)
   * - Returns error if balance selector matches no elements (Requirement 5.5)
   * - Returns error if balance text cannot be converted to number (Requirement 5.4)
   * - Optional fields (currency, dueDate) return null on failure (Requirement 13.6)
   */
  private parseHtml(html: string): ParseResult {
    try {
      const $ = cheerio.load(html);
      const selectors = this.config.cssSelectors;

      if (!selectors) {
        return {
          balance: null,
          currency: null,
          dueDate: null,
          error: 'CSS selectors configuration is missing',
        };
      }

      // Extract balance (required)
      const balanceElement = $(selectors.balance);
      if (balanceElement.length === 0) {
        // Log CSS selector failures with expression - Requirement 11.5
        const responseExcerpt = truncateResponse(html);
        console.error(
          `CSS selector "${selectors.balance}" matched no elements. Response excerpt: ${responseExcerpt}`
        );
        return {
          balance: null,
          currency: null,
          dueDate: null,
          error: `CSS selector "${selectors.balance}" matched no elements`,
        };
      }

      const balanceText = balanceElement.first().text().trim();
      const balance = this.textToNumber(balanceText);

      if (balance === null) {
        return {
          balance: null,
          currency: null,
          dueDate: null,
          error: `Failed to convert balance text "${balanceText}" to number`,
        };
      }

      // Extract currency (optional)
      let currency: string | null = null;
      if (selectors.currency) {
        const currencyElement = $(selectors.currency);
        if (currencyElement.length > 0) {
          currency = currencyElement.first().text().trim();
        }
      }

      // Extract dueDate (optional)
      let dueDate: Date | null = null;
      if (selectors.dueDate) {
        const dueDateElement = $(selectors.dueDate);
        if (dueDateElement.length > 0) {
          const dueDateText = dueDateElement.first().text().trim();
          dueDate = this.textToDate(dueDateText);
        }
      }

      return {
        balance,
        currency,
        dueDate,
      };
    } catch (error) {
      return {
        balance: null,
        currency: null,
        dueDate: null,
        error: `HTML parsing error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Parses JSON response using JSONPath expressions
   * 
   * Parses the JSON string and extracts data using the configured JSONPath expressions.
   * The balance field is required and must be successfully extracted. Currency and
   * dueDate are optional and return null if not found or extraction fails.
   * 
   * @param jsonString - The JSON response string
   * @returns ParseResult with extracted data or error message
   * 
   * @example
   * ```typescript
   * const json = JSON.stringify({
   *   data: {
   *     balance: 123.45,
   *     currency: "GEL",
   *     dueDate: "2024-12-31"
   *   }
   * });
   * const result = parser.parseJson(json);
   * // { balance: 123.45, currency: "GEL", dueDate: Date(...) }
   * ```
   * 
   * @remarks
   * - Returns error if JSONPath configuration is missing (Requirement 6.5)
   * - Returns error if balance path matches no data (Requirement 6.5)
   * - Returns error if balance value cannot be converted to number (Requirement 6.4)
   * - Optional fields (currency, dueDate) return null on failure (Requirement 13.6)
   */
  private parseJson(jsonString: string): ParseResult {
    try {
      const jsonData = JSON.parse(jsonString);
      const paths = this.config.jsonPath;

      if (!paths) {
        return {
          balance: null,
          currency: null,
          dueDate: null,
          error: 'JSONPath configuration is missing',
        };
      }

      // Extract balance (required)
      const balanceResults = JSONPath({
        path: paths.balance,
        json: jsonData,
      });

      if (!balanceResults || balanceResults.length === 0) {
        // Log JSONPath failures with expression - Requirement 11.5
        const responseExcerpt = truncateResponse(jsonString);
        console.error(
          `JSONPath expression "${paths.balance}" matched no data. Response excerpt: ${responseExcerpt}`
        );
        return {
          balance: null,
          currency: null,
          dueDate: null,
          error: `JSONPath expression "${paths.balance}" matched no data`,
        };
      }

      const balanceValue = balanceResults[0];
      const balance = this.valueToNumber(balanceValue);

      if (balance === null) {
        return {
          balance: null,
          currency: null,
          dueDate: null,
          error: `Failed to convert balance value "${balanceValue}" to number`,
        };
      }

      // Extract currency (optional)
      let currency: string | null = null;
      if (paths.currency) {
        const currencyResults = JSONPath({
          path: paths.currency,
          json: jsonData,
        });
        if (currencyResults && currencyResults.length > 0) {
          currency = String(currencyResults[0]);
        }
      }

      // Extract dueDate (optional)
      let dueDate: Date | null = null;
      if (paths.dueDate) {
        const dueDateResults = JSONPath({
          path: paths.dueDate,
          json: jsonData,
        });
        if (dueDateResults && dueDateResults.length > 0) {
          dueDate = this.valueToDate(dueDateResults[0]);
        }
      }

      return {
        balance,
        currency,
        dueDate,
      };
    } catch (error) {
      return {
        balance: null,
        currency: null,
        dueDate: null,
        error: `JSON parsing error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Converts text string to number
   * 
   * Handles various balance text formats commonly found in utility provider responses:
   * - Plain numbers: "123.45"
   * - With currency symbols: "₾123.45", "$123.45", "€123.45"
   * - With currency codes: "123.45 GEL", "123.45 USD"
   * - European format (comma as decimal): "123,45"
   * - With thousands separators: "1,234.56" or "1.234,56"
   * - Mixed formats: "₾ 1,234.56 GEL"
   * 
   * @param text - The text string to convert
   * @returns The numeric value or null if conversion fails
   * 
   * @example
   * ```typescript
   * textToNumber("123.45");        // 123.45
   * textToNumber("₾123.45");       // 123.45
   * textToNumber("123,45");        // 123.45
   * textToNumber("1,234.56");      // 1234.56
   * textToNumber("123.45 GEL");    // 123.45
   * textToNumber("invalid");       // null
   * ```
   */
  private textToNumber(text: string): number | null {
    if (!text) {
      return null;
    }

    // Remove common currency symbols and whitespace
    let cleaned = text
      .replace(/[₾$€£¥]/g, '')
      .replace(/\s+/g, '')
      .trim();

    // Remove currency codes (e.g., "GEL", "USD")
    cleaned = cleaned.replace(/[A-Z]{3}$/i, '').trim();

    // Handle comma as decimal separator (European format)
    // If there's both comma and dot, assume dot is thousands separator
    if (cleaned.includes(',') && cleaned.includes('.')) {
      // Format like "1.234,56" (European)
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (cleaned.includes(',')) {
      // Check if comma is likely a decimal separator
      const parts = cleaned.split(',');
      if (parts.length === 2 && parts[1].length <= 2) {
        // Likely decimal separator: "123,45"
        cleaned = cleaned.replace(',', '.');
      } else {
        // Likely thousands separator: "1,234"
        cleaned = cleaned.replace(/,/g, '');
      }
    }

    const number = parseFloat(cleaned);
    return isNaN(number) ? null : number;
  }

  /**
   * Converts a value to number
   * 
   * Handles multiple value types:
   * - Numbers: returned as-is (if valid)
   * - Strings: parsed using textToNumber()
   * - Other types: converted using Number() constructor
   * 
   * @param value - The value to convert (any type)
   * @returns The numeric value or null if conversion fails
   * 
   * @example
   * ```typescript
   * valueToNumber(123.45);         // 123.45
   * valueToNumber("123.45");       // 123.45
   * valueToNumber("₾123.45");      // 123.45
   * valueToNumber(true);           // 1
   * valueToNumber(null);           // null
   * valueToNumber("invalid");      // null
   * ```
   */
  private valueToNumber(value: any): number | null {
    if (typeof value === 'number') {
      return isNaN(value) ? null : value;
    }

    if (typeof value === 'string') {
      return this.textToNumber(value);
    }

    // Try to convert other types
    const number = Number(value);
    return isNaN(number) ? null : number;
  }

  /**
   * Converts text string to Date
   * 
   * Attempts to parse the text as a date using JavaScript's Date constructor.
   * Handles various date formats that the Date constructor can parse, including:
   * - ISO 8601: "2024-12-31", "2024-12-31T23:59:59Z"
   * - US format: "12/31/2024"
   * - Long format: "December 31, 2024"
   * 
   * @param text - The text string to convert
   * @returns The Date object or null if conversion fails
   * 
   * @example
   * ```typescript
   * textToDate("2024-12-31");           // Date(2024-12-31)
   * textToDate("12/31/2024");           // Date(2024-12-31)
   * textToDate("December 31, 2024");    // Date(2024-12-31)
   * textToDate("invalid");              // null
   * ```
   */
  private textToDate(text: string): Date | null {
    if (!text) {
      return null;
    }

    const date = new Date(text);
    return isNaN(date.getTime()) ? null : date;
  }

  /**
   * Converts a value to Date
   * 
   * Handles multiple value types:
   * - Date objects: returned as-is (if valid)
   * - Strings: parsed using textToDate()
   * - Numbers: treated as Unix timestamps (milliseconds since epoch)
   * - Other types: converted using Date constructor
   * 
   * @param value - The value to convert (any type)
   * @returns The Date object or null if conversion fails
   * 
   * @example
   * ```typescript
   * valueToDate(new Date());           // Date object (if valid)
   * valueToDate("2024-12-31");         // Date(2024-12-31)
   * valueToDate(1704067199000);        // Date from timestamp
   * valueToDate("invalid");            // null
   * ```
   */
  private valueToDate(value: any): Date | null {
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : value;
    }

    if (typeof value === 'string') {
      return this.textToDate(value);
    }

    if (typeof value === 'number') {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date;
    }

    // Try to convert other types
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }
}
