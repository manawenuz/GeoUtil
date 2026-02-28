/**
 * Provider Registry
 * 
 * Central registry for managing utility provider adapters.
 * Provides registration, lookup, and listing functionality.
 */

import { ProviderAdapter } from './types';

/**
 * Metadata about a registered provider
 */
export interface ProviderMetadata {
  /** Unique name of the provider */
  providerName: string;
  /** Type of utility service */
  providerType: 'gas' | 'water' | 'electricity' | 'trash';
  /** Regions where this provider operates */
  supportedRegions: string[];
  /** Account number format description */
  accountNumberFormat: string;
}

/**
 * Registry for managing provider adapters
 * 
 * This class maintains a collection of provider adapters and provides
 * methods to register, retrieve, and list them.
 */
export class ProviderRegistry {
  private adapters: Map<string, ProviderAdapter>;

  constructor() {
    this.adapters = new Map();
  }

  /**
   * Registers a provider adapter
   * 
   * @param adapter - The provider adapter to register
   * @throws Error if a provider with the same name is already registered
   */
  registerAdapter(adapter: ProviderAdapter): void {
    if (this.adapters.has(adapter.providerName)) {
      throw new Error(
        `Provider adapter with name "${adapter.providerName}" is already registered`
      );
    }
    this.adapters.set(adapter.providerName, adapter);
  }

  /**
   * Retrieves a provider adapter by name
   * 
   * @param providerName - The name of the provider to retrieve
   * @returns The provider adapter, or null if not found
   */
  getAdapter(providerName: string): ProviderAdapter | null {
    return this.adapters.get(providerName) || null;
  }

  /**
   * Lists all registered providers
   * 
   * @returns Array of provider metadata for all registered providers
   */
  listProviders(): ProviderMetadata[] {
    return Array.from(this.adapters.values()).map((adapter) => ({
      providerName: adapter.providerName,
      providerType: adapter.providerType,
      supportedRegions: adapter.supportedRegions,
      accountNumberFormat: adapter.getAccountNumberFormat(),
    }));
  }

  /**
   * Lists providers filtered by type
   * 
   * @param type - The provider type to filter by
   * @returns Array of provider adapters matching the specified type
   */
  getProvidersByType(
    type: 'gas' | 'water' | 'electricity' | 'trash'
  ): ProviderAdapter[] {
    return Array.from(this.adapters.values()).filter(
      (adapter) => adapter.providerType === type
    );
  }

  /**
   * Checks if a provider is registered
   * 
   * @param providerName - The name of the provider to check
   * @returns true if the provider is registered
   */
  hasProvider(providerName: string): boolean {
    return this.adapters.has(providerName);
  }

  /**
   * Returns the number of registered providers
   * 
   * @returns The count of registered providers
   */
  getProviderCount(): number {
    return this.adapters.size;
  }

  /**
   * Clears all registered providers
   * 
   * Useful for testing or resetting the registry
   */
  clear(): void {
    this.adapters.clear();
  }
}
