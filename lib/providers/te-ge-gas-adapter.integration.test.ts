/**
 * Integration tests for TeGeGasAdapter with ProviderRegistry
 */

import { ProviderRegistry } from './registry';
import { TeGeGasAdapter } from './te-ge-gas-adapter';

describe('TeGeGasAdapter Integration', () => {
  let registry: ProviderRegistry;
  let adapter: TeGeGasAdapter;

  beforeEach(() => {
    registry = new ProviderRegistry();
    adapter = new TeGeGasAdapter();
  });

  it('should register successfully with ProviderRegistry', () => {
    expect(() => registry.registerAdapter(adapter)).not.toThrow();
    expect(registry.hasProvider('te.ge')).toBe(true);
  });

  it('should be retrievable from registry', () => {
    registry.registerAdapter(adapter);
    const retrieved = registry.getAdapter('te.ge');
    
    expect(retrieved).toBe(adapter);
    expect(retrieved?.providerName).toBe('te.ge');
  });

  it('should appear in provider list', () => {
    registry.registerAdapter(adapter);
    const providers = registry.listProviders();
    
    expect(providers).toHaveLength(1);
    expect(providers[0]).toEqual({
      providerName: 'te.ge',
      providerType: 'gas',
      supportedRegions: ['Tbilisi', 'Rustavi', 'Mtskheta'],
      accountNumberFormat: '12 digits',
    });
  });

  it('should be found when filtering by gas type', () => {
    registry.registerAdapter(adapter);
    const gasProviders = registry.getProvidersByType('gas');
    
    expect(gasProviders).toHaveLength(1);
    expect(gasProviders[0].providerName).toBe('te.ge');
  });

  it('should not be found when filtering by other types', () => {
    registry.registerAdapter(adapter);
    
    expect(registry.getProvidersByType('water')).toHaveLength(0);
    expect(registry.getProvidersByType('electricity')).toHaveLength(0);
    expect(registry.getProvidersByType('trash')).toHaveLength(0);
  });

  it('should implement all required ProviderAdapter methods', () => {
    expect(typeof adapter.validateAccountNumber).toBe('function');
    expect(typeof adapter.getAccountNumberFormat).toBe('function');
    expect(typeof adapter.fetchBalance).toBe('function');
    expect(typeof adapter.getEndpointUrl).toBe('function');
    expect(typeof adapter.getTimeout).toBe('function');
    expect(typeof adapter.getRetryConfig).toBe('function');
  });

  it('should have correct metadata properties', () => {
    expect(adapter.providerName).toBe('te.ge');
    expect(adapter.providerType).toBe('gas');
    expect(Array.isArray(adapter.supportedRegions)).toBe(true);
    expect(adapter.supportedRegions.length).toBeGreaterThan(0);
  });
});
