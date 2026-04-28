import { BaseProvider, ProviderRequest, StreamHandler, ParseError } from '@api/types';

export class ClaudeProvider extends BaseProvider {
  readonly provider = 'claude' as const;

  async generate(request: ProviderRequest): Promise<string> {
    const url = this.buildUrl();
    const body = this.buildRequestBody(request, false);

    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    }, request.signal);

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    
    if (!text) {
      throw new ParseError('Empty response from Claude API');
    }

    return text;
  }

  async generateStream(request: ProviderRequest, handler: StreamHandler): Promise<void> {
    const url = this.buildUrl();
    const body = this.buildRequestBody(request, true);

    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    }, request.signal);

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            handler.onComplete();
            return;
          }

          try {
            const json = JSON.parse(data);
            if (json.type === 'content_block_delta' && json.delta?.text) {
              handler.onChunk({ text: json.delta.text, done: false });
            }
          } catch {
          }
        }
      }
    } catch (error) {
      handler.onError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    } finally {
      reader.releaseLock();
    }

    handler.onComplete();
  }

  private buildUrl(): string {
    const base = this.config.providerUrl.replace(/\/$/, '');
    return base.endsWith('/messages') ? base : base + '/messages';
  }

  private buildRequestBody(request: ProviderRequest, stream: boolean): unknown {
    return {
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      top_p: this.config.topP,
      system: request.systemPrompt,
      messages: [{
        role: 'user',
        content: request.userMessage,
      }],
      stream,
    };
  }
}
