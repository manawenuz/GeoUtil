/**
 * Unit tests for ProviderRegistry
 */

import { ProviderRegistry } from './registry';
import { ProviderAdapter, BalanceResult, RetryConfig } from './types';

// Mock provider adapter for testing
class MockProviderAdapter implements ProviderAdapter {
  constructor(
    public readonly providerName: string,
    public readonly providerType: 'gas' | 'water' | 'electricity' | 'trash',
    public readonly supportedRegions: string[] = ['Tbilisi']
  ) {}

  validateAccountNumber(accountNumber: string): boolean {
    return /^\d{12}$/.test(accountNumber);
  }

  getAccountNumberFormat(): string {
    return '12 digits';
  }

  async fetchBalance(_accountNumber: string): Promise<BalanceResult> {
    return {
      balance: 100,
      currency: 'GEL',
      timestamp: new Date(),
      success: true,
    };
  }

  getEndpointUrl(): string {
    return 'https://example.com/api';
  }

  getTimeout(): number {
    return 30000;
  }

  getRetryConfig(): RetryConfig {
    return {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
    };
  }
}

describe('ProviderRegistry', () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
  });

  describe('registerAdapter', () => {
    it('should register a new provider adapter', () => {
      const adapter = new MockProviderAdapter('test-provider', 'gas');
      registry.registerAdapter(adapter);

      expect(registry.hasProvider('test-provider')).toBe(true);
      expect(registry.getProviderCount()).toBe(1);
    });

    it('should throw error when registering duplicate provider', () => {
      const adapter1 = new MockProviderAdapter('test-provider', 'gas');
      const adapter2 = new MockProviderAdapter('test-provider', 'water');

      registry.registerAdapter(adapter1);

      expect(() => registry.registerAdapter(adapter2)).toThrow(
        'Provider adapter with name "test-provider" is already registered'
      );
    });

    it('should allow registering multiple different providers', () => {
      const adapter1 = new MockProviderAdapter('provider-1', 'gas');
      const adapter2 = new MockProviderAdapter('provider-2', 'water');
      const adapter3 = new MockProviderAdapter('provider-3', 'electricity');

      registry.registerAdapter(adapter1);
      registry.registerAdapter(adapter2);
      registry.registerAdapter(adapter3);

      expect(registry.getProviderCount()).toBe(3);
    });
  });

  describe('getAdapter', () => {
    it('should retrieve a registered adapter by name', () => {
      const adapter = new MockProviderAdapter('test-provider', 'gas');
      registry.registerAdapter(adapter);

      const retrieved = registry.getAdapter('test-provider');

      expect(retrieved).toBe(adapter);
      expect(retrieved?.providerName).toBe('test-provider');
    });

    it('should return null for non-existent provider', () => {
      const retrieved = registry.getAdapter('non-existent');

      expect(retrieved).toBeNull();
    });
  });

  describe('listProviders', () => {
    it('should return empty array when no providers registered', () => {
      const providers = registry.listProviders();

      expect(providers).toEqual([]);
    });

    it('should return metadata for all registered providers', () => {
      const adapter1 = new MockProviderAdapter('provider-1', 'gas', [
        'Tbilisi',
        'Batumi',
      ]);
      const adapter2 = new MockProviderAdapter('provider-2', 'water', [
        'Tbilisi',
      ]);

      registry.registerAdapter(adapter1);
      registry.registerAdapter(adapter2);

      const providers = registry.listProviders();

      expect(providers).toHaveLength(2);
      expect(providers).toContainEqual({
        providerName: 'provider-1',
        providerType: 'gas',
        supportedRegions: ['Tbilisi', 'Batumi'],
        accountNumberFormat: '12 digits',
      });
      expect(providers).toContainEqual({
        providerName: 'provider-2',
        providerType: 'water',
        supportedRegions: ['Tbilisi'],
        accountNumberFormat: '12 digits',
      });
    });
  });

  describe('getProvidersByType', () => {
    beforeEach(() => {
      registry.registerAdapter(new MockProviderAdapter('gas-1', 'gas'));
      registry.registerAdapter(new MockProviderAdapter('gas-2', 'gas'));
      registry.registerAdapter(new MockProviderAdapter('water-1', 'water'));
      registry.registerAdapter(
        new MockProviderAdapter('electricity-1', 'electricity')
      );
    });

    it('should return only gas providers', () => {
      const gasProviders = registry.getProvidersByType('gas');

      expect(gasProviders).toHaveLength(2);
      expect(gasProviders.every((p) => p.providerType === 'gas')).toBe(true);
    });

    it('should return only water providers', () => {
      const waterProviders = registry.getProvidersByType('water');

      expect(waterProviders).toHaveLength(1);
      expect(waterProviders[0].providerName).toBe('water-1');
    });

    it('should return empty array for type with no providers', () => {
      const trashProviders = registry.getProvidersByType('trash');

      expect(trashProviders).toEqual([]);
    });
  });

  describe('hasProvider', () => {
    it('should return true for registered provider', () => {
      const adapter = new MockProviderAdapter('test-provider', 'gas');
      registry.registerAdapter(adapter);

      expect(registry.hasProvider('test-provider')).toBe(true);
    });

    it('should return false for non-registered provider', () => {
      expect(registry.hasProvider('non-existent')).toBe(false);
    });
  });

  describe('getProviderCount', () => {
    it('should return 0 for empty registry', () => {
      expect(registry.getProviderCount()).toBe(0);
    });

    it('should return correct count after registrations', () => {
      registry.registerAdapter(new MockProviderAdapter('provider-1', 'gas'));
      expect(registry.getProviderCount()).toBe(1);

      registry.registerAdapter(new MockProviderAdapter('provider-2', 'water'));
      expect(registry.getProviderCount()).toBe(2);
    });
  });

  describe('clear', () => {
    it('should remove all registered providers', () => {
      registry.registerAdapter(new MockProviderAdapter('provider-1', 'gas'));
      registry.registerAdapter(new MockProviderAdapter('provider-2', 'water'));

      expect(registry.getProviderCount()).toBe(2);

      registry.clear();

      expect(registry.getProviderCount()).toBe(0);
      expect(registry.listProviders()).toEqual([]);
    });
  });
});
