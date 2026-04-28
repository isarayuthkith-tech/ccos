import { BaseProvider, ProviderRequest, StreamHandler, ParseError } from '@api/types';

export class OpenAIProvider extends BaseProvider {
  readonly provider = 'openai' as const;

  async generate(request: ProviderRequest): Promise<string> {
    const url = this.buildUrl();
    const body = this.buildRequestBody(request, false);

    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
    }, request.signal);

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    
    if (!text) {
      throw new ParseError('Empty response from OpenAI API');
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
        'Authorization': `Bearer ${this.config.apiKey}`,
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
          if (line.trim() === '' || !line.startsWith('data: ')) continue;
          
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            handler.onComplete();
            return;
          }

          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) {
              handler.onChunk({ text: delta, done: false });
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
    return base.endsWith('/chat/completions') ? base : base + '/chat/completions';
  }

  private buildRequestBody(request: ProviderRequest, stream: boolean): unknown {
    return {
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      top_p: this.config.topP,
      messages: [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: request.userMessage },
      ],
      stream,
    };
  }
}
