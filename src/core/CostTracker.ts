import type { APIProvider } from '@mytypes/index.ts';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface GenerationCost {
  provider: APIProvider;
  model: string;
  tokens: TokenUsage;
  estimatedCost: number;
  timestamp: number;
  step: string;
}

interface ModelPricing {
  inputPrice: number;
  outputPrice: number;
}

const PRICING: Record<string, ModelPricing> = {
  'gemini-1.5-flash': { inputPrice: 0.35, outputPrice: 1.05 },
  'gemini-1.5-pro': { inputPrice: 3.5, outputPrice: 10.5 },
  'gemini-2.0-flash': { inputPrice: 0.35, outputPrice: 1.05 },
  'claude-3-haiku': { inputPrice: 0.25, outputPrice: 1.25 },
  'claude-3-sonnet': { inputPrice: 3.0, outputPrice: 15.0 },
  'claude-3-opus': { inputPrice: 15.0, outputPrice: 75.0 },
  'gpt-4o-mini': { inputPrice: 0.15, outputPrice: 0.60 },
  'gpt-4o': { inputPrice: 2.5, outputPrice: 10.0 },
  'gpt-4': { inputPrice: 30.0, outputPrice: 60.0 },
};

export class CostTracker {
  private history: GenerationCost[] = [];
  private maxHistorySize: number = 100;

  track(
    provider: APIProvider,
    model: string,
    inputTokens: number,
    outputTokens: number,
    step: string
  ): GenerationCost {
    const pricing = this.getPricing(model);
    const inputCost = (inputTokens / 1_000_000) * pricing.inputPrice;
    const outputCost = (outputTokens / 1_000_000) * pricing.outputPrice;
    const estimatedCost = inputCost + outputCost;

    const cost: GenerationCost = {
      provider,
      model,
      tokens: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
      estimatedCost,
      timestamp: Date.now(),
      step,
    };

    this.history.push(cost);
    
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    return cost;
  }

  getTotalCost(): number {
    return this.history.reduce((sum, cost) => sum + cost.estimatedCost, 0);
  }

  getCostByStep(): Record<string, number> {
    const byStep: Record<string, number> = {};
    for (const cost of this.history) {
      byStep[cost.step] = (byStep[cost.step] || 0) + cost.estimatedCost;
    }
    return byStep;
  }

  getCostByProvider(): Record<APIProvider, number> {
    const byProvider: Record<string, number> = {};
    for (const cost of this.history) {
      byProvider[cost.provider] = (byProvider[cost.provider] || 0) + cost.estimatedCost;
    }
    return byProvider as Record<APIProvider, number>;
  }

  getHistory(): GenerationCost[] {
    return [...this.history];
  }

  clear(): void {
    this.history = [];
  }

  private getPricing(model: string): ModelPricing {
    if (PRICING[model]) {
      return PRICING[model];
    }

    for (const [key, pricing] of Object.entries(PRICING)) {
      if (model.includes(key) || key.includes(model.replace(/-latest$/, ''))) {
        return pricing;
      }
    }

    return { inputPrice: 1.0, outputPrice: 3.0 };
  }
}

let globalTracker: CostTracker | null = null;

export function useCostTracker(): CostTracker {
  if (!globalTracker) {
    globalTracker = new CostTracker();
  }
  return globalTracker;
}
