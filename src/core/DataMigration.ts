import { useConfig } from './ConfigStore';

interface LegacyConfig {
  providerUrl?: string;
  apiFormat?: string;
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  streaming?: boolean;
  thinking?: boolean;
  jllmMode?: boolean;
  reasoningEnabled?: boolean;
  multimodalConfirmed?: boolean;
  scenario?: string;
  friction?: string;
  loop?: string;
  visibility?: string;
}

export interface MigrationResult {
  success: boolean;
  migratedKeys: string[];
  errors: string[];
}

const LEGACY_STORAGE_KEY = 'ccos_config';
const CURRENT_STORAGE_KEY = 'ccos_config_v2';

export class DataMigration {
  private sourceKey: string;
  private targetKey: string;

  constructor(sourceKey: string = LEGACY_STORAGE_KEY, targetKey: string = CURRENT_STORAGE_KEY) {
    this.sourceKey = sourceKey;
    this.targetKey = targetKey;
  }

  needsMigration(): boolean {
    try {
      const legacy = localStorage.getItem(this.sourceKey);
      const current = localStorage.getItem(this.targetKey);
      
      return legacy !== null && current === null;
    } catch {
      return false;
    }
  }

  migrate(): MigrationResult {
    const result: MigrationResult = {
      success: false,
      migratedKeys: [],
      errors: [],
    };

    try {
      const legacyData = localStorage.getItem(this.sourceKey);
      if (!legacyData) {
        result.errors.push('No legacy data found');
        return result;
      }

      const legacy: LegacyConfig = JSON.parse(legacyData);
      const config = useConfig();

      const migrations: Record<keyof LegacyConfig, () => void> = {
        providerUrl: () => { 
          if (legacy.providerUrl) {
            config.set('providerUrl', legacy.providerUrl);
            result.migratedKeys.push('providerUrl');
          }
        },
        apiFormat: () => { 
          if (legacy.apiFormat) {
            config.set('apiFormat', legacy.apiFormat);
            result.migratedKeys.push('apiFormat');
          }
        },
        apiKey: () => { 
          if (legacy.apiKey) {
            config.set('apiKey', legacy.apiKey);
            result.migratedKeys.push('apiKey');
          }
        },
        model: () => { 
          if (legacy.model) {
            config.set('model', legacy.model);
            result.migratedKeys.push('model');
          }
        },
        temperature: () => { 
          if (legacy.temperature !== undefined) {
            config.set('temp', legacy.temperature);
            result.migratedKeys.push('temperature -> temp');
          }
        },
        maxTokens: () => { 
          if (legacy.maxTokens) {
            config.set('maxTokens', legacy.maxTokens);
            result.migratedKeys.push('maxTokens');
          }
        },
        topP: () => { 
          if (legacy.topP !== undefined) {
            config.set('topP', legacy.topP);
            result.migratedKeys.push('topP');
          }
        },
        streaming: () => { 
          if (legacy.streaming !== undefined) {
            config.set('streaming', legacy.streaming);
            result.migratedKeys.push('streaming');
          }
        },
        thinking: () => { 
          if (legacy.thinking !== undefined) {
            config.set('thinking', legacy.thinking);
            result.migratedKeys.push('thinking');
          }
        },
        jllmMode: () => { 
          if (legacy.jllmMode !== undefined) {
            config.set('jllmMode', legacy.jllmMode);
            result.migratedKeys.push('jllmMode');
          }
        },
        reasoningEnabled: () => { 
          if (legacy.reasoningEnabled !== undefined) {
            config.set('reasoningEnabled', legacy.reasoningEnabled);
            result.migratedKeys.push('reasoningEnabled');
          }
        },
        multimodalConfirmed: () => { 
          if (legacy.multimodalConfirmed !== undefined) {
            config.set('multimodalConfirmed', legacy.multimodalConfirmed);
            result.migratedKeys.push('multimodalConfirmed');
          }
        },
        scenario: () => { 
          if (legacy.scenario) {
            config.set('scenario', legacy.scenario);
            result.migratedKeys.push('scenario');
          }
        },
        friction: () => { 
          if (legacy.friction) {
            config.set('friction', legacy.friction);
            result.migratedKeys.push('friction');
          }
        },
        loop: () => { 
          if (legacy.loop) {
            config.set('loop', legacy.loop);
            result.migratedKeys.push('loop');
          }
        },
        visibility: () => { 
          if (legacy.visibility) {
            config.set('visibility', legacy.visibility);
            result.migratedKeys.push('visibility');
          }
        },
      };

      for (const migrate of Object.values(migrations)) {
        try {
          migrate();
        } catch (error) {
          result.errors.push(`Migration failed for field: ${error}`);
        }
      }

      result.success = result.migratedKeys.length > 0;

    } catch (error) {
      result.errors.push(`Migration error: ${error}`);
    }

    return result;
  }

  rollback(): boolean {
    try {
      const legacy = localStorage.getItem(this.sourceKey);
      if (!legacy) {
        return false;
      }

      localStorage.setItem(this.targetKey, legacy);
      return true;
    } catch {
      return false;
    }
  }

  getStatus(): {
    legacyExists: boolean;
    currentExists: boolean;
    needsMigration: boolean;
  } {
    try {
      const legacy = localStorage.getItem(this.sourceKey);
      const current = localStorage.getItem(this.targetKey);

      return {
        legacyExists: legacy !== null,
        currentExists: current !== null,
        needsMigration: legacy !== null && current === null,
      };
    } catch {
      return {
        legacyExists: false,
        currentExists: false,
        needsMigration: false,
      };
    }
  }
}

export function createMigration(): DataMigration {
  return new DataMigration();
}
