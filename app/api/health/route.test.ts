import { GET } from './route';
import { NextRequest } from 'next/server';
import { getStorageAdapter } from '@/lib/storage/factory';
import { getProviderRegistry } from '@/lib/providers/factory';

// Mock dependencies
jest.mock('@/lib/storage/factory');
jest.mock('@/lib/providers/factory');
jest.mock('@/lib/ensure-init');

import { ensureInitialized } from '@/lib/ensure-init';

// Mock ensureInitialized to resolve immediately
(ensureInitialized as jest.Mock).mockResolvedValue(undefined);

describe('GET /api/health', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STORAGE_BACKEND = 'postgres';
    process.env.NODE_ENV = 'test';
  });

  it('should return healthy status when all systems are operational', async () => {
    // Mock storage adapter
    const mockGetMigrationStatus = jest.fn().mockResolvedValue({
      appliedMigrations: ['001_initial'],
      pendingMigrations: [],
    });
    const mockGetProviderSuccessRate = jest.fn().mockResolvedValue(0.95);
    
    (getStorageAdapter as jest.Mock).mockReturnValue({
      getMigrationStatus: mockGetMigrationStatus,
      getProviderSuccessRate: mockGetProviderSuccessRate,
    });

    // Mock provider registry
    const mockListProviders = jest.fn().mockReturnValue([
      {
        name: 'te.ge',
        providerName: 'te.ge',
        providerType: 'gas',
        supportedRegions: ['Tbilisi'],
        accountNumberFormat: '12 digits',
      },
    ]);
    
    (getProviderRegistry as jest.Mock).mockReturnValue({
      listProviders: mockListProviders,
    });

    // Create request
    const request = new NextRequest('http://localhost:3000/api/health');

    // Call handler
    const response = await GET(request);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(200);
    expect(data.status).toBe('healthy');
    expect(data.storage.status).toBe('healthy');
    expect(data.storage.backend).toBe('postgres');
    expect(data.providers['te.ge']).toEqual({
      successRate: 0.95,
      status: 'healthy',
    });
    expect(data.timestamp).toBeDefined();
  });

  it('should return degraded status when provider success rate is between 50-80%', async () => {
    // Mock storage adapter
    const mockGetMigrationStatus = jest.fn().mockResolvedValue({
      appliedMigrations: ['001_initial'],
      pendingMigrations: [],
    });
    const mockGetProviderSuccessRate = jest.fn().mockResolvedValue(0.65);
    
    (getStorageAdapter as jest.Mock).mockReturnValue({
      getMigrationStatus: mockGetMigrationStatus,
      getProviderSuccessRate: mockGetProviderSuccessRate,
    });

    // Mock provider registry
    const mockListProviders = jest.fn().mockReturnValue([
      {
        name: 'te.ge',
        providerName: 'te.ge',
        providerType: 'gas',
        supportedRegions: ['Tbilisi'],
        accountNumberFormat: '12 digits',
      },
    ]);
    
    (getProviderRegistry as jest.Mock).mockReturnValue({
      listProviders: mockListProviders,
    });

    // Create request
    const request = new NextRequest('http://localhost:3000/api/health');

    // Call handler
    const response = await GET(request);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(200);
    expect(data.status).toBe('degraded');
    expect(data.providers['te.ge'].status).toBe('degraded');
  });

  it('should return unhealthy status when provider success rate is below 50%', async () => {
    // Mock storage adapter
    const mockGetMigrationStatus = jest.fn().mockResolvedValue({
      appliedMigrations: ['001_initial'],
      pendingMigrations: [],
    });
    const mockGetProviderSuccessRate = jest.fn().mockResolvedValue(0.35);
    
    (getStorageAdapter as jest.Mock).mockReturnValue({
      getMigrationStatus: mockGetMigrationStatus,
      getProviderSuccessRate: mockGetProviderSuccessRate,
    });

    // Mock provider registry
    const mockListProviders = jest.fn().mockReturnValue([
      {
        name: 'te.ge',
        providerName: 'te.ge',
        providerType: 'gas',
        supportedRegions: ['Tbilisi'],
        accountNumberFormat: '12 digits',
      },
    ]);
    
    (getProviderRegistry as jest.Mock).mockReturnValue({
      listProviders: mockListProviders,
    });

    // Create request
    const request = new NextRequest('http://localhost:3000/api/health');

    // Call handler
    const response = await GET(request);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(503);
    expect(data.status).toBe('unhealthy');
    expect(data.providers['te.ge'].status).toBe('unhealthy');
  });

  it('should return unhealthy status when storage backend fails', async () => {
    // Mock storage adapter to throw error
    const mockGetMigrationStatus = jest.fn().mockRejectedValue(new Error('Database connection failed'));
    const mockGetProviderSuccessRate = jest.fn().mockResolvedValue(0.95);
    
    (getStorageAdapter as jest.Mock).mockReturnValue({
      getMigrationStatus: mockGetMigrationStatus,
      getProviderSuccessRate: mockGetProviderSuccessRate,
    });

    // Mock provider registry
    const mockListProviders = jest.fn().mockReturnValue([
      {
        name: 'te.ge',
        providerName: 'te.ge',
        providerType: 'gas',
        supportedRegions: ['Tbilisi'],
        accountNumberFormat: '12 digits',
      },
    ]);
    
    (getProviderRegistry as jest.Mock).mockReturnValue({
      listProviders: mockListProviders,
    });

    // Create request
    const request = new NextRequest('http://localhost:3000/api/health');

    // Call handler
    const response = await GET(request);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(503);
    expect(data.status).toBe('unhealthy');
    expect(data.storage.status).toBe('unhealthy');
    expect(data.storage.error).toBe('Database connection failed');
  });

  it('should handle multiple providers', async () => {
    // Mock storage adapter
    const mockGetMigrationStatus = jest.fn().mockResolvedValue({
      appliedMigrations: ['001_initial'],
      pendingMigrations: [],
    });
    const mockGetProviderSuccessRate = jest.fn()
      .mockResolvedValueOnce(0.95) // te.ge
      .mockResolvedValueOnce(0.88); // water provider
    
    (getStorageAdapter as jest.Mock).mockReturnValue({
      getMigrationStatus: mockGetMigrationStatus,
      getProviderSuccessRate: mockGetProviderSuccessRate,
    });

    // Mock provider registry with multiple providers
    const mockListProviders = jest.fn().mockReturnValue([
      {
        name: 'te.ge',
        providerName: 'te.ge',
        providerType: 'gas',
        supportedRegions: ['Tbilisi'],
        accountNumberFormat: '12 digits',
      },
      {
        name: 'water-provider',
        providerName: 'water-provider',
        providerType: 'water',
        supportedRegions: ['Tbilisi'],
        accountNumberFormat: '10 digits',
      },
    ]);
    
    (getProviderRegistry as jest.Mock).mockReturnValue({
      listProviders: mockListProviders,
    });

    // Create request
    const request = new NextRequest('http://localhost:3000/api/health');

    // Call handler
    const response = await GET(request);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(200);
    expect(data.status).toBe('healthy');
    expect(data.providers['te.ge']).toEqual({
      successRate: 0.95,
      status: 'healthy',
    });
    expect(data.providers['water-provider']).toEqual({
      successRate: 0.88,
      status: 'healthy',
    });
  });

  it('should handle complete system failure gracefully', async () => {
    // Mock storage adapter to throw error
    (getStorageAdapter as jest.Mock).mockImplementation(() => {
      throw new Error('Storage adapter initialization failed');
    });

    // Create request
    const request = new NextRequest('http://localhost:3000/api/health');

    // Call handler
    const response = await GET(request);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(503);
    expect(data.status).toBe('unhealthy');
    expect(data.error).toBe('Health check failed');
  });

  it('should include environment information', async () => {
    process.env.VERCEL = '1';
    
    // Mock storage adapter
    const mockGetMigrationStatus = jest.fn().mockResolvedValue({
      appliedMigrations: ['001_initial'],
      pendingMigrations: [],
    });
    
    (getStorageAdapter as jest.Mock).mockReturnValue({
      getMigrationStatus: mockGetMigrationStatus,
      getProviderSuccessRate: jest.fn().mockResolvedValue(0.95),
    });

    // Mock provider registry
    (getProviderRegistry as jest.Mock).mockReturnValue({
      listProviders: jest.fn().mockReturnValue([]),
    });

    // Create request
    const request = new NextRequest('http://localhost:3000/api/health');

    // Call handler
    const response = await GET(request);
    const data = await response.json();

    // Assertions
    expect(data.environment.isVercel).toBe(true);
    expect(data.environment.nodeEnv).toBe('test');
    
    delete process.env.VERCEL;
  });
});
