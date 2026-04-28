import { GeminiProvider } from '@api/providers/GeminiProvider';
import { ClaudeProvider } from '@api/providers/ClaudeProvider';
import { OpenAIProvider } from '@api/providers/OpenAIProvider';
import type { BaseProvider } from '@api/types';
import type { GenerationConfig, APIProvider } from '@mytypes/index.ts';

export * from '@api/types';
export { GeminiProvider, ClaudeProvider, OpenAIProvider };

export function createProvider(config: GenerationConfig): BaseProvider {
  switch (config.apiFormat) {
    case 'gemini':
      return new GeminiProvider(config);
    case 'claude':
      return new ClaudeProvider(config);
    case 'openai':
      return new OpenAIProvider(config);
    default:
      throw new Error(`Unsupported provider: ${config.apiFormat}`);
  }
}

export function getProviderName(provider: APIProvider): string {
  const names: Record<APIProvider, string> = {
    gemini: 'Google Gemini',
    claude: 'Anthropic Claude',
    openai: 'OpenAI',
  };
  return names[provider];
}
