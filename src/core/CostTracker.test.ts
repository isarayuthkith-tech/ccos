import { describe, it, expect, beforeEach } from 'vitest';
import { CostTracker } from './CostTracker';

describe('CostTracker', () => {
  let tracker: CostTracker;

  beforeEach(() => {
    tracker = new CostTracker();
  });

  it('should track generation cost', () => {
    const cost = tracker.track('gemini', 'gemini-1.5-flash', 1000, 500, 'analysis');
    
    expect(cost.provider).toBe('gemini');
    expect(cost.model).toBe('gemini-1.5-flash');
    expect(cost.tokens.inputTokens).toBe(1000);
    expect(cost.tokens.outputTokens).toBe(500);
    expect(cost.tokens.totalTokens).toBe(1500);
    expect(cost.step).toBe('analysis');
    expect(cost.estimatedCost).toBeGreaterThan(0);
  });

  it('should calculate total cost', () => {
    tracker.track('gemini', 'gemini-1.5-flash', 1000, 500, 'analysis');
    tracker.track('claude', 'claude-3-sonnet', 2000, 1000, 'generation');
    
    const total = tracker.getTotalCost();
    expect(total).toBeGreaterThan(0);
  });

  it('should calculate cost by step', () => {
    tracker.track('gemini', 'gemini-1.5-flash', 1000, 500, 'analysis');
    tracker.track('gemini', 'gemini-1.5-flash', 2000, 1000, 'analysis');
    tracker.track('claude', 'claude-3-sonnet', 1000, 500, 'generation');
    
    const byStep = tracker.getCostByStep();
    expect(byStep.analysis).toBeGreaterThan(0);
    expect(byStep.generation).toBeGreaterThan(0);
  });

  it('should calculate cost by provider', () => {
    tracker.track('gemini', 'gemini-1.5-flash', 1000, 500, 'analysis');
    tracker.track('claude', 'claude-3-sonnet', 2000, 1000, 'generation');
    
    const byProvider = tracker.getCostByProvider();
    expect(byProvider.gemini).toBeGreaterThan(0);
    expect(byProvider.claude).toBeGreaterThan(0);
  });

  it('should clear history', () => {
    tracker.track('gemini', 'gemini-1.5-flash', 1000, 500, 'analysis');
    tracker.clear();
    
    expect(tracker.getTotalCost()).toBe(0);
    expect(tracker.getHistory()).toHaveLength(0);
  });

  it('should maintain max history size', () => {
    // Add more than 100 entries
    for (let i = 0; i < 110; i++) {
      tracker.track('gemini', 'gemini-1.5-flash', 100, 100, 'analysis');
    }
    
    expect(tracker.getHistory()).toHaveLength(100);
  });

  it('should handle unknown models with default pricing', () => {
    const cost = tracker.track('openai', 'unknown-model', 1000, 500, 'generation');
    expect(cost.estimatedCost).toBeGreaterThan(0);
  });
});
