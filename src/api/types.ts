import type { StreamChunk, APIProvider, GenerationConfig } from '@mytypes';

export interface ProviderRequest {
  systemPrompt: string;
  userMessage: string;
  config: GenerationConfig;
  signal?: AbortSignal;
}

export interface StreamHandler {
  onChunk: (chunk: StreamChunk) => void;
  onError: (error: Error) => void;
  onComplete: () => void;
}

export abstract class BaseProvider {
  protected readonly config: GenerationConfig;
  private maxRetries: number = 3;

  constructor(config: GenerationConfig) {
    this.config = config;
  }

  abstract readonly provider: APIProvider;

  abstract generate(request: ProviderRequest): Promise<string>;
  abstract generateStream(request: ProviderRequest, handler: StreamHandler): Promise<void>;

  protected async fetchWithRetry(
    url: string,
    options: RequestInit,
    signal?: AbortSignal
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(url, { ...options, signal });
        
        if (!response.ok) {
          const error = await this.parseError(response);
          throw new ProviderAPIError(error.message, response.status, this.provider, this.isRetryable(response.status));
        }

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (error instanceof ProviderAPIError && !error.retryable) {
          throw error;
        }

        if (signal?.aborted) {
          throw new Error('AbortError');
        }

        if (attempt < this.maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          await this.sleep(delay);
        }
      }
    }

    throw new ProviderAPIError(
      `Failed after ${this.maxRetries} retries: ${lastError?.message}`,
      0,
      this.provider,
      false
    );
  }

  private isRetryable(status: number): boolean {
    return status === 429 || status >= 500;
  }

  private async parseError(response: Response): Promise<{ message: string }> {
    try {
      const data = await response.json();
      return { message: data.error?.message || response.statusText };
    } catch {
      return { message: response.statusText };
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class ProviderAPIError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly provider: APIProvider,
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = 'ProviderAPIError';
  }
}

export class ParseError extends Error {
  constructor(message: string, public readonly rawContent?: string) {
    super(message);
    this.name = 'ParseError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public readonly issues: string[]) {
    super(message);
    this.name = 'ValidationError';
  }
}
