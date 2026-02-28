/**
 * Factory Tests
 * 
 * Tests for the provider registry factory, including JSON provider loading.
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 1.8, 12.6
 */

import * as fs from 'fs';
import * as path from 'path';
import { createProviderRegistry, resetProviderRegistry } from './factory';
import type { ProvidersConfig } from './types';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('Factory - JSON Provider Loading', () => {
  beforeEach(() => {
    // Reset the singleton before each test
    resetProviderRegistry();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Missing providers.json', () => {
    it('should handle missing providers.json gracefully and continue with code-based adapters', () => {
      // Requirement 9.6: Handle missing providers.json gracefully
      mockFs.existsSync.mockReturnValue(false);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const registry = createProviderRegistry();

      expect(mockFs.existsSync).toHaveBeenCalledWith(
        path.join(process.cwd(), 'providers.json')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        'No providers.json found, continuing with code-based adapters only'
      );
      expect(registry.getProviderCount()).toBeGreaterThan(0); // Code-based adapters still registered

      consoleSpy.mockRestore();
    });
  });

  describe('Valid providers.json', () => {
    it('should load and register valid JSON-based providers', () => {
      // Requirements 9.1, 9.2, 9.3: Load, create, and register JSON providers
      const validConfig: ProvidersConfig = {
        providers: [
          {
            id: 'test-water',
            name: 'test-water',
            displayName: 'Test Water Provider',
            type: 'water',
            regions: ['Tbilisi'],
            accountValidation: {
              pattern: '^\\d{10}$',
              formatDescription: '10 digits',
            },
            api: {
              endpoint: 'https://example.com/api?account={{accountNumber}}',
              method: 'GET',
              headers: {
                'User-Agent': 'Test/1.0',
              },
            },
            parsing: {
              responseType: 'html',
              cssSelectors: {
                balance: '.balance',
              },
            },
            retry: {
              maxRetries: 3,
              retryDelays: [1000, 2000, 4000],
              useExponentialBackoff: true,
            },
          },
        ],
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(validConfig));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const registry = createProviderRegistry();

      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        path.join(process.cwd(), 'providers.json'),
        'utf-8'
      );
      
      // Requirement 9.5: Log which providers are registered as JSON-based
      expect(consoleSpy).toHaveBeenCalledWith(
        'Registered JSON provider: test-water (type: water, id: test-water)'
      );

      // Verify the provider was registered
      expect(registry.hasProvider('test-water')).toBe(true);
      const adapter = registry.getAdapter('test-water');
      expect(adapter).not.toBeNull();
      expect(adapter?.providerType).toBe('water');

      consoleSpy.mockRestore();
    });
  });

  describe('Invalid configurations', () => {
    it('should skip invalid configurations and continue with valid ones', () => {
      // Requirements 1.8, 12.6: Skip invalid configurations and continue
      const mixedConfig: ProvidersConfig = {
        providers: [
          {
            id: 'invalid-provider',
            name: 'invalid-provider',
            displayName: 'Invalid Provider',
            type: 'invalid-type' as any, // Invalid type
            regions: ['Tbilisi'],
            accountValidation: {
              pattern: '^\\d{10}$',
              formatDescription: '10 digits',
            },
            api: {
              endpoint: 'https://example.com/api',
              method: 'GET',
              headers: {},
            },
            parsing: {
              responseType: 'html',
              cssSelectors: {
                balance: '.balance',
              },
            },
            retry: {
              maxRetries: 3,
              retryDelays: [1000],
              useExponentialBackoff: false,
            },
          },
          {
            id: 'valid-provider',
            name: 'valid-provider',
            displayName: 'Valid Provider',
            type: 'electricity',
            regions: ['Batumi'],
            accountValidation: {
              pattern: '^\\d{8}$',
              formatDescription: '8 digits',
            },
            api: {
              endpoint: 'https://example.com/api?account={{accountNumber}}',
              method: 'GET',
              headers: {},
            },
            parsing: {
              responseType: 'json',
              jsonPath: {
                balance: '$.balance',
              },
            },
            retry: {
              maxRetries: 2,
              retryDelays: [500, 1000],
              useExponentialBackoff: false,
            },
          },
        ],
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mixedConfig));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const registry = createProviderRegistry();

      // Should log error for invalid configuration
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Validation error for provider invalid-provider:',
        expect.stringContaining('Invalid type')
      );

      // Should log success for valid configuration
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Registered JSON provider: valid-provider (type: electricity, id: valid-provider)'
      );

      // Only valid provider should be registered
      expect(registry.hasProvider('invalid-provider')).toBe(false);
      expect(registry.hasProvider('valid-provider')).toBe(true);

      consoleErrorSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });
  });

  describe('Code-based adapter precedence', () => {
    it('should skip JSON provider if code-based adapter with same name exists', () => {
      // Requirement 9.4: Code-based adapters take precedence
      const config: ProvidersConfig = {
        providers: [
          {
            id: 'te-ge',
            name: 'te.ge', // Same name as TeGeGasAdapter
            displayName: 'TE.GE from JSON',
            type: 'gas',
            regions: ['Tbilisi'],
            accountValidation: {
              pattern: '^\\d{12}$',
              formatDescription: '12 digits',
            },
            api: {
              endpoint: 'https://example.com/api?account={{accountNumber}}',
              method: 'GET',
              headers: {},
            },
            parsing: {
              responseType: 'html',
              cssSelectors: {
                balance: '.balance',
              },
            },
            retry: {
              maxRetries: 3,
              retryDelays: [1000],
              useExponentialBackoff: false,
            },
          },
        ],
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(config));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const registry = createProviderRegistry();

      // Should log that JSON provider was skipped
      expect(consoleSpy).toHaveBeenCalledWith(
        'Skipping JSON provider te.ge (code-based adapter exists)'
      );

      // Code-based adapter should still be registered
      expect(registry.hasProvider('te.ge')).toBe(true);
      const adapter = registry.getAdapter('te.ge');
      expect(adapter).not.toBeNull();
      // Verify it's the code-based adapter (TeGeGasAdapter)
      expect(adapter?.constructor.name).toBe('TeGeGasAdapter');

      consoleSpy.mockRestore();
    });
  });

  describe('Malformed JSON', () => {
    it('should handle malformed JSON and continue with code-based adapters', () => {
      // Requirement 9.6: Handle errors gracefully
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{ invalid json }');

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const registry = createProviderRegistry();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Configuration parse error in providers.json')
      );
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        'Continuing with code-based adapters only'
      );

      // Code-based adapters should still be registered
      expect(registry.getProviderCount()).toBeGreaterThan(0);

      consoleErrorSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });
  });

  describe('Missing providers array', () => {
    it('should handle missing providers array in JSON', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{}'); // No providers array

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const registry = createProviderRegistry();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Invalid providers.json: missing or invalid "providers" array'
      );

      // Code-based adapters should still be registered
      expect(registry.getProviderCount()).toBeGreaterThan(0);

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Backward compatibility', () => {
    it('should maintain backward compatibility with existing code-based adapters', () => {
      // Requirement 9.7: Maintain backward compatibility
      mockFs.existsSync.mockReturnValue(false); // No providers.json

      const registry = createProviderRegistry();

      // Code-based adapters should be registered
      expect(registry.hasProvider('te.ge')).toBe(true);
      const adapter = registry.getAdapter('te.ge');
      expect(adapter).not.toBeNull();
      expect(adapter?.providerName).toBe('te.ge');
      expect(adapter?.providerType).toBe('gas');
    });
  });
});
