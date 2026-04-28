import { describe, it, expect, vi } from 'vitest';
import { CircuitBreaker, CircuitState, CircuitBreakerOpenError } from './CircuitBreaker';

describe('CircuitBreaker', () => {
  it('should start in CLOSED state', () => {
    const cb = new CircuitBreaker();
    expect(cb.getState()).toBe(CircuitState.CLOSED);
  });

  it('should execute successfully and stay CLOSED', async () => {
    const cb = new CircuitBreaker();
    const result = await cb.execute(async () => 'success');
    expect(result).toBe('success');
    expect(cb.getState()).toBe(CircuitState.CLOSED);
  });

  it('should transition to OPEN after threshold failures', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3 });
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    for (let i = 0; i < 3; i++) {
      try {
        await cb.execute(fn);
      } catch {
        // expected
      }
    }

    expect(cb.getState()).toBe(CircuitState.OPEN);
  });

  it('should throw CircuitBreakerOpenError when OPEN', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1 });
    
    try {
      await cb.execute(async () => {
        throw new Error('fail');
      });
    } catch {
      // expected
    }

    await expect(cb.execute(async () => 'success')).rejects.toThrow(CircuitBreakerOpenError);
  });

  it('should transition to HALF_OPEN after reset timeout', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeout: 0 });
    
    try {
      await cb.execute(async () => {
        throw new Error('fail');
      });
    } catch {
      // expected
    }

    // Wait for reset timeout
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(cb.getState()).toBe(CircuitState.HALF_OPEN);
  });

  it('should close circuit on success in HALF_OPEN', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeout: 0 });
    
    try {
      await cb.execute(async () => {
        throw new Error('fail');
      });
    } catch {
      // expected
    }

    await new Promise(resolve => setTimeout(resolve, 10));
    
    await cb.execute(async () => 'success');
    
    expect(cb.getState()).toBe(CircuitState.CLOSED);
  });
});
