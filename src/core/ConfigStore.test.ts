import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigStore } from './ConfigStore';

describe('ConfigStore', () => {
  let store: ConfigStore;

  beforeEach(() => {
    store = new ConfigStore('test-config');
    store.reset();
  });

  it('should initialize with defaults', () => {
    expect(store.get('temp')).toBe(0.7);
    expect(store.get('maxTokens')).toBe(8192);
    expect(store.get('reasoningEnabled')).toBe(false);
  });

  it('should set and get values', () => {
    store.set('temp', 0.9);
    expect(store.get('temp')).toBe(0.9);
  });

  it('should notify listeners on change', () => {
    const listener = vi.fn();
    store.subscribe(listener);
    
    store.set('temp', 0.5);
    
    expect(listener).toHaveBeenCalled();
  });

  it('should generate config for API calls', () => {
    store.set('model', 'gemini-pro');
    store.set('apiKey', 'test-key');
    
    const config = store.toGenerationConfig();
    
    expect(config.model).toBe('gemini-pro');
    expect(config.apiKey).toBe('test-key');
  });
});
