/**
 * ConfigValidator - Validates provider configurations
 * 
 * Validates provider configurations at load time to ensure they meet
 * all structural and content requirements before creating adapters.
 * 
 * Performs comprehensive validation including:
 * - Required field presence
 * - Provider ID uniqueness (when validating multiple configs)
 * - Regex pattern validity
 * - Response type enum validation
 * - Parsing configuration consistency with response type
 * 
 * @example
 * ```typescript
 * const validator = new ConfigValidator();
 * 
 * // Validate a single configuration
 * const result = validator.validate(config);
 * if (!result.valid) {
 *   console.error('Validation errors:', result.errors);
 * }
 * 
 * // Validate multiple configurations with uniqueness checks
 * const results = validator.validateMultiple(configs);
 * for (const [id, result] of results) {
 *   if (!result.valid) {
 *     console.error(`Provider ${id} errors:`, result.errors);
 *   }
 * }
 * ```
 */

import type { ProviderConfiguration, ValidationResult } from './types';

/**
 * Validates provider configurations
 * 
 * Performs comprehensive validation of provider configurations including:
 * - Required field presence
 * - Provider ID uniqueness (when validating multiple configs)
 * - Regex pattern validity
 * - Response type enum validation
 * - Parsing configuration consistency with response type
 */
export class ConfigValidator {
  /**
   * Validates a single provider configuration
   * 
   * Checks for:
   * - Required fields: id, name, displayName, type, api.endpoint
   * - Valid type enum value (gas, water, electricity, trash)
   * - Valid regex pattern in accountValidation.pattern
   * - Valid responseType (html or json)
   * - Parsing configuration matches responseType:
   *   - HTML requires cssSelectors with balance selector
   *   - JSON requires jsonPath with balance path
   * 
   * @param config - The provider configuration to validate (can be any type for flexibility)
   * @returns ValidationResult with valid flag and array of error messages
   * 
   * @example
   * ```typescript
   * const validator = new ConfigValidator();
   * const result = validator.validate({
   *   id: 'example-provider',
   *   name: 'example',
   *   displayName: 'Example Provider',
   *   type: 'gas',
   *   api: { endpoint: 'https://api.example.com' },
   *   // ... other fields
   * });
   * 
   * if (result.valid) {
   *   console.log('Configuration is valid');
   * } else {
   *   console.error('Validation errors:', result.errors);
   * }
   * ```
   */
  validate(config: any): ValidationResult {
    const errors: string[] = [];

    // Validate required fields
    if (!config.id) {
      errors.push('Missing required field: id');
    }
    if (!config.name) {
      errors.push('Missing required field: name');
    }
    if (!config.displayName) {
      errors.push('Missing required field: displayName');
    }
    if (!config.type) {
      errors.push('Missing required field: type');
    }
    if (!config.api?.endpoint) {
      errors.push('Missing required field: api.endpoint');
    }

    // Validate type enum
    if (config.type && !['gas', 'water', 'electricity', 'trash'].includes(config.type)) {
      errors.push(`Invalid type: ${config.type}. Must be one of: gas, water, electricity, trash`);
    }

    // Validate regex pattern
    if (config.accountValidation?.pattern) {
      try {
        new RegExp(config.accountValidation.pattern);
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        errors.push(`Invalid regex pattern in accountValidation.pattern: ${config.accountValidation.pattern} (${errorMessage})`);
      }
    }

    // Validate responseType
    if (config.parsing?.responseType) {
      if (!['html', 'json'].includes(config.parsing.responseType)) {
        errors.push(`Invalid responseType: ${config.parsing.responseType}. Must be either "html" or "json"`);
      }
    }

    // Validate parsing configuration matches responseType
    if (config.parsing?.responseType === 'html') {
      if (!config.parsing.cssSelectors) {
        errors.push('HTML responseType requires cssSelectors configuration');
      } else if (!config.parsing.cssSelectors.balance) {
        errors.push('cssSelectors configuration requires balance selector');
      }
    }

    if (config.parsing?.responseType === 'json') {
      if (!config.parsing.jsonPath) {
        errors.push('JSON responseType requires jsonPath configuration');
      } else if (!config.parsing.jsonPath.balance) {
        errors.push('jsonPath configuration requires balance path');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validates multiple provider configurations and checks for ID uniqueness
   * 
   * Performs all single-configuration validations plus additional checks:
   * - Ensures no duplicate provider IDs across all configurations
   * - Returns a map of provider IDs to their validation results
   * 
   * This method is useful when loading a providers.json file with multiple
   * provider configurations, as it ensures each provider has a unique ID.
   * 
   * @param configs - Array of provider configurations to validate
   * @returns Map of provider IDs to their ValidationResult objects
   * 
   * @example
   * ```typescript
   * const validator = new ConfigValidator();
   * const configs = [
   *   { id: 'provider-1', name: 'Provider 1', ... },
   *   { id: 'provider-2', name: 'Provider 2', ... },
   *   { id: 'provider-1', name: 'Duplicate', ... } // Duplicate ID!
   * ];
   * 
   * const results = validator.validateMultiple(configs);
   * 
   * for (const [id, result] of results) {
   *   if (!result.valid) {
   *     console.error(`Provider ${id} has errors:`, result.errors);
   *   }
   * }
   * 
   * // Output:
   * // Provider provider-1 has errors: ["Duplicate provider id: provider-1"]
   * ```
   */
  validateMultiple(configs: any[]): Map<string, ValidationResult> {
    const results = new Map<string, ValidationResult>();
    const seenIds = new Set<string>();

    for (const config of configs) {
      const validation = this.validate(config);
      const errors = [...validation.errors];

      // Check for duplicate IDs
      if (config.id) {
        if (seenIds.has(config.id)) {
          errors.push(`Duplicate provider id: ${config.id}`);
        } else {
          seenIds.add(config.id);
        }
      }

      results.set(config.id || 'unknown', {
        valid: errors.length === 0,
        errors,
      });
    }

    return results;
  }
}
