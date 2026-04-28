import type { GenerationConfig, APIProvider } from '@mytypes/index.ts';

export interface AppConfig {
  providerUrl: string;
  apiFormat: APIProvider;
  apiKey: string;
  model: string;
  temp: number;
  maxTokens: number;
  topP: number;
  streaming: boolean;
  thinking: boolean;
  jllmMode: boolean;
  reasoningEnabled: boolean;
  multimodalConfirmed: boolean;
  scenario: string;
  friction: string;
  loop: string;
  visibility: string;
}

const DEFAULT_CONFIG: AppConfig = {
  providerUrl: '',
  apiFormat: 'gemini',
  apiKey: '',
  model: '',
  temp: 0.7,
  maxTokens: 8192,
  topP: 0.95,
  streaming: true,
  thinking: true,
  jllmMode: false,
  reasoningEnabled: false,
  multimodalConfirmed: false,
  scenario: 'none',
  friction: '',
  loop: '',
  visibility: '',
};

const STORAGE_KEY = 'ccos_config_v2';

type ConfigListener = (config: AppConfig, changedKey?: keyof AppConfig) => void;

export class ConfigStore {
  private config: AppConfig;
  private listeners: Set<ConfigListener> = new Set();
  private storageKey: string;

  constructor(storageKey: string = STORAGE_KEY) {
    this.storageKey = storageKey;
    this.config = this.loadFromStorage();
  }

  private loadFromStorage(): AppConfig {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_CONFIG, ...parsed };
      }
    } catch {
    }
    return { ...DEFAULT_CONFIG };
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.config));
    } catch (e) {
      console.error('Failed to save config:', e);
    }
  }

  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  getAll(): AppConfig {
    return { ...this.config };
  }

  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    const oldValue = this.config[key];
    if (oldValue !== value) {
      this.config[key] = value;
      this.saveToStorage();
      this.notifyListeners(key);
    }
  }

  setMultiple(updates: Partial<AppConfig>): void {
    let changed = false;
    for (const [key, value] of Object.entries(updates)) {
      if (this.config[key as keyof AppConfig] !== value) {
        this.config[key as keyof AppConfig] = value as never;
        changed = true;
      }
    }
    if (changed) {
      this.saveToStorage();
      this.notifyListeners();
    }
  }

  reset(): void {
    this.config = { ...DEFAULT_CONFIG };
    this.saveToStorage();
    this.notifyListeners();
  }

  subscribe(listener: ConfigListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(changedKey?: keyof AppConfig): void {
    const config = this.getAll();
    this.listeners.forEach(listener => {
      try {
        listener(config, changedKey);
      } catch (e) {
        console.error('Config listener error:', e);
      }
    });
  }

  toGenerationConfig(): GenerationConfig {
    return {
      model: this.config.model,
      apiFormat: this.config.apiFormat,
      providerUrl: this.config.providerUrl,
      apiKey: this.config.apiKey,
      temperature: this.config.temp,
      topP: this.config.topP,
      maxTokens: this.config.jllmMode ? 2000 : this.config.maxTokens,
    };
  }
}

let globalStore: ConfigStore | null = null;

export function useConfig(): ConfigStore {
  if (!globalStore) {
    globalStore = new ConfigStore();
  }
  return globalStore;
}

export function initConfig(store: ConfigStore): void {
  globalStore = store;
}
