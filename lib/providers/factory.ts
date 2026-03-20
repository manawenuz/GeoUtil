/**
 * Provider Registry Factory
 * 
 * Creates and initializes the provider registry with all available adapters.
 * Loads JSON-based providers from providers.json and registers code-based adapters.
 * Code-based adapters take precedence over JSON-based adapters.
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 1.8, 12.6
 */

import * as fs from 'fs';
import * as path from 'path';
import { ProviderRegistry } from './registry';
import { TeGeGasAdapter } from './te-ge-gas-adapter';
import { TelmicoElectricityAdapter } from './telmico-electricity-adapter';
import { ConfigValidator } from './config-validator';
import { JsonProviderAdapter } from './json-provider-adapter';
import type { ProvidersConfig } from './types';

/**
 * Creates and initializes the provider registry with all available adapters
 * 
 * Loads providers.json from project root and creates JsonProviderAdapter instances
 * for valid configurations. Code-based adapters are registered first and take
 * precedence over JSON-based adapters with the same provider name.
 * 
 * @returns Initialized ProviderRegistry instance
 */
export function createProviderRegistry(): ProviderRegistry {
  const registry = new ProviderRegistry();

  // Register code-based adapters first (they take precedence) - Requirement 9.4
  registry.registerAdapter(new TeGeGasAdapter());
  registry.registerAdapter(new TelmicoElectricityAdapter());

  // Load and register JSON-based adapters - Requirements 9.1, 9.2, 9.3
  loadJsonProviders(registry);

  return registry;
}

/**
 * Loads provider configurations from providers.json and registers them
 * 
 * Handles missing providers.json gracefully (Requirement 9.6)
 * Validates each configuration and skips invalid ones (Requirements 1.8, 12.6)
 * Checks for existing code-based adapters before registering (Requirement 9.4)
 * Logs which providers are registered as JSON-based (Requirement 9.5)
 * 
 * @param registry - The provider registry to register adapters with
 */
function loadJsonProviders(registry: ProviderRegistry): void {
  try {
    // Load providers.json from project root - Requirement 9.1
    const configPath = path.join(process.cwd(), 'providers.json');
    
    // Handle missing providers.json gracefully - Requirement 9.6
    if (!fs.existsSync(configPath)) {
      console.log('No providers.json found, continuing with code-based adapters only');
      return;
    }

    // Read and parse the configuration file
    const configData = fs.readFileSync(configPath, 'utf-8');
    let config: ProvidersConfig;
    
    try {
      config = JSON.parse(configData);
    } catch (parseError) {
      // Log configuration parse errors with line/column info - Requirement 11.1
      if (parseError instanceof SyntaxError) {
        const match = parseError.message.match(/position (\d+)/);
        if (match) {
          const position = parseInt(match[1], 10);
          const lines = configData.substring(0, position).split('\n');
          const line = lines.length;
          const column = lines[lines.length - 1].length + 1;
          console.error(
            `Configuration parse error in providers.json at line ${line}, column ${column}: ${parseError.message}`
          );
        } else {
          console.error(`Configuration parse error in providers.json: ${parseError.message}`);
        }
      } else {
        console.error(`Configuration parse error in providers.json: ${parseError}`);
      }
      return;
    }

    // Validate that we have a providers array
    if (!config.providers || !Array.isArray(config.providers)) {
      console.error('Invalid providers.json: missing or invalid "providers" array');
      return;
    }

    // Create validator instance
    const validator = new ConfigValidator();

    // Process each provider configuration
    for (const providerConfig of config.providers) {
      try {
        // Validate the configuration - Requirement 12.6
        const validation = validator.validate(providerConfig);

        // Log validation errors with missing fields - Requirement 11.2
        if (!validation.valid) {
          console.error(
            `Validation error for provider ${providerConfig.id || 'unknown'}:`,
            validation.errors.join(', ')
          );
          continue;
        }

        // Check if code-based adapter already exists - Requirement 9.4
        if (registry.hasProvider(providerConfig.name)) {
          console.log(
            `Skipping JSON provider ${providerConfig.name} (code-based adapter exists)`
          );
          continue;
        }

        // Create JsonProviderAdapter instance - Requirement 9.2
        const adapter = new JsonProviderAdapter(providerConfig);

        // Register with the provider registry - Requirement 9.3
        registry.registerAdapter(adapter);

        // Log successful provider registration - Requirement 11.6
        console.log(
          `Registered JSON provider: ${providerConfig.name} (type: ${providerConfig.type}, id: ${providerConfig.id})`
        );
      } catch (error) {
        // Log errors for individual provider configurations and continue - Requirement 1.8
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(
          `Error processing provider ${providerConfig.id || 'unknown'}: ${errorMessage}`
        );
      }
    }
  } catch (error) {
    // Handle errors loading or parsing providers.json - Requirement 9.6
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error loading providers.json: ${errorMessage}`);
    console.log('Continuing with code-based adapters only');
  }
}

/**
 * Singleton instance of the provider registry
 * Initialized on first access
 */
let providerRegistryInstance: ProviderRegistry | null = null;

/**
 * Gets the singleton provider registry instance
 * Creates it on first access
 * 
 * @returns ProviderRegistry instance
 */
export function getProviderRegistry(): ProviderRegistry {
  if (!providerRegistryInstance) {
    providerRegistryInstance = createProviderRegistry();
  }
  return providerRegistryInstance;
}

/**
 * Resets the singleton instance (useful for testing)
 */
export function resetProviderRegistry(): void {
  providerRegistryInstance = null;
}
