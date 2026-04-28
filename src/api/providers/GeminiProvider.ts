import { BaseProvider, ProviderRequest, StreamHandler, ParseError } from '@api/types';
import type { StreamChunk } from '@mytypes/index.ts';

export class GeminiProvider extends BaseProvider {
  readonly provider = 'gemini' as const;

  async generate(request: ProviderRequest): Promise<string> {
    const url = this.buildUrl('generateContent');
    const body = this.buildRequestBody(request);

    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, request.signal);

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    if (!text) {
      throw new ParseError('Empty response from Gemini API');
    }

    return text;
  }

  async generateStream(request: ProviderRequest, handler: StreamHandler): Promise<void> {
    const url = this.buildUrl('streamGenerateContent', true);
    const body = this.buildRequestBody(request);

    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
            const part = json.candidates?.[0]?.content?.parts?.[0];
            if (part?.text) {
              handler.onChunk({ text: part.text, done: false });
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

  private buildUrl(method: string, stream: boolean = false): string {
    const base = this.config.providerUrl.replace(/\/$/, '');
    const streamParam = stream ? '&alt=sse' : '';
    return `${base}/models/${this.config.model}:${method}?key=${this.config.apiKey}${streamParam}`;
  }

  private buildRequestBody(request: ProviderRequest): unknown {
    return {
      contents: [{
        role: 'user',
        parts: [{ text: request.userMessage }]
      }],
      systemInstruction: {
        parts: [{ text: request.systemPrompt }]
      },
      generationConfig: {
        temperature: this.config.temperature,
        maxOutputTokens: this.config.maxTokens,
        topP: this.config.topP,
      }
    };
  }
}
