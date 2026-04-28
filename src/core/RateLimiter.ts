export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export class RateLimiter {
  private requests: number[] = [];
  private config: RateLimitConfig;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = {
      maxRequests: 10,
      windowMs: 60000, // 1 minute
      ...config,
    };
  }

  canProceed(): boolean {
    this.cleanup();
    return this.requests.length < this.config.maxRequests;
  }

  tryAcquire(): boolean {
    if (!this.canProceed()) {
      return false;
    }
    
    this.requests.push(Date.now());
    return true;
  }

  getRemaining(): number {
    this.cleanup();
    return Math.max(0, this.config.maxRequests - this.requests.length);
  }

  getResetTime(): number {
    if (this.requests.length === 0) {
      return 0;
    }
    
    const oldestRequest = this.requests[0];
    return Math.max(0, oldestRequest + this.config.windowMs - Date.now());
  }

  private cleanup(): void {
    const cutoff = Date.now() - this.config.windowMs;
    this.requests = this.requests.filter(time => time > cutoff);
  }
}

export class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private maxTokens: number;
  private refillRate: number; // tokens per ms

  constructor(maxTokens: number, refillRate: number) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
    this.refillRate = refillRate;
  }

  tryConsume(tokens: number = 1): boolean {
    this.refill();
    
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    
    return false;
  }

  getTokens(): number {
    this.refill();
    return this.tokens;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = elapsed * this.refillRate;
    
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}
