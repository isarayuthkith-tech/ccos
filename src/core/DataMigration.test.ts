import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DataMigration, createMigration } from './DataMigration';

const mockLocalStorage = {
  data: {} as Record<string, string>,
  getItem(key: string): string | null {
    return this.data[key] || null;
  },
  setItem(key: string, value: string): void {
    this.data[key] = value;
  },
  removeItem(key: string): void {
    delete this.data[key];
  },
};

describe('DataMigration', () => {
  let migration: DataMigration;

  beforeEach(() => {
    // Setup mock localStorage
    vi.stubGlobal('localStorage', mockLocalStorage);
    mockLocalStorage.data = {};
    migration = new DataMigration('legacy_key', 'current_key');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should detect when migration is needed', () => {
    mockLocalStorage.setItem('legacy_key', JSON.stringify({ apiKey: 'test' }));
    
    expect(migration.needsMigration()).toBe(true);
  });

  it('should not need migration when no legacy data exists', () => {
    expect(migration.needsMigration()).toBe(false);
  });

  it('should not need migration when current data already exists', () => {
    mockLocalStorage.setItem('legacy_key', JSON.stringify({ apiKey: 'test' }));
    mockLocalStorage.setItem('current_key', JSON.stringify({ apiKey: 'new' }));
    
    expect(migration.needsMigration()).toBe(false);
  });

  it('should migrate legacy config successfully', () => {
    const legacy = {
      providerUrl: 'https://api.example.com',
      apiFormat: 'openai',
      apiKey: 'sk-test',
      model: 'gpt-4',
      temperature: 0.8,
      maxTokens: 4096,
    };
    
    mockLocalStorage.setItem('legacy_key', JSON.stringify(legacy));
    
    const result = migration.migrate();
    
    expect(result.success).toBe(true);
    expect(result.migratedKeys).toContain('providerUrl');
    expect(result.migratedKeys).toContain('apiKey');
    expect(result.migratedKeys).toContain('temperature -> temp');
  });

  it('should handle migration with no legacy data', () => {
    const result = migration.migrate();
    
    expect(result.success).toBe(false);
    expect(result.errors).toContain('No legacy data found');
  });

  it('should provide migration status', () => {
    mockLocalStorage.setItem('legacy_key', JSON.stringify({ apiKey: 'test' }));
    
    const status = migration.getStatus();
    
    expect(status.legacyExists).toBe(true);
    expect(status.currentExists).toBe(false);
    expect(status.needsMigration).toBe(true);
  });

  it('should create migration via factory', () => {
    const m = createMigration();
    expect(m).toBeInstanceOf(DataMigration);
  });
});
