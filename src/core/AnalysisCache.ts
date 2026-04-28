import { ImageStore } from './ImageStore';
import type { AnalysisResult, PsychologyBlueprint, ImageData } from '@mytypes/index.ts';

interface CacheEntry<T> {
  data: T;
  imageHashes: string[];
  timestamp: number;
  modelUsed: string;
  ttl: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
}

const DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_CACHE_SIZE = 50;

export class AnalysisCache {
  private analysisCache: Map<string, CacheEntry<AnalysisResult>> = new Map();
  private blueprintCache: Map<string, CacheEntry<PsychologyBlueprint>> = new Map();
  private stats: CacheStats = { hits: 0, misses: 0, evictions: 0, size: 0 };
  private maxSize: number;
  private defaultTtl: number;

  constructor(options: { maxSize?: number; defaultTtl?: number } = {}) {
    this.maxSize = options.maxSize || MAX_CACHE_SIZE;
    this.defaultTtl = options.defaultTtl || DEFAULT_TTL;
    this.loadFromStorage();
  }

  private generateKey(hashes: string[]): string {
    return hashes.sort().join('|');
  }

  async getAnalysis(images: ImageData[]): Promise<AnalysisResult | null> {
    const imageStore = new ImageStore();
    const hashes: string[] = [];

    for (const image of images) {
      const hash = await imageStore.computeHash(image.base64);
      hashes.push(hash);
    }

    const key = this.generateKey(hashes);
    const entry = this.analysisCache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.analysisCache.delete(key);
      this.stats.evictions++;
      this.stats.misses++;
      this.saveToStorage();
      return null;
    }

    const currentHashes = new Set(hashes);
    const cachedHashes = new Set(entry.imageHashes);

    if (currentHashes.size !== cachedHashes.size ||
        ![...currentHashes].every(h => cachedHashes.has(h))) {
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.data;
  }

  async setAnalysis(
    images: ImageData[],
    result: AnalysisResult,
    modelUsed: string,
    ttl?: number
  ): Promise<void> {
    const imageStore = new ImageStore();
    const hashes: string[] = [];

    for (const image of images) {
      const hash = await imageStore.computeHash(image.base64);
      hashes.push(hash);
    }

    if (this.analysisCache.size >= this.maxSize) {
      const oldestKey = this.findOldestEntry(this.analysisCache);
      if (oldestKey) {
        this.analysisCache.delete(oldestKey);
        this.stats.evictions++;
      }
    }

    const key = this.generateKey(hashes);
    const entry: CacheEntry<AnalysisResult> = {
      data: result,
      imageHashes: hashes,
      timestamp: Date.now(),
      modelUsed,
      ttl: ttl || this.defaultTtl,
    };

    this.analysisCache.set(key, entry);
    this.stats.size = this.analysisCache.size;
    this.saveToStorage();
  }

  getBlueprint(analysisKey: string): PsychologyBlueprint | null {
    const entry = this.blueprintCache.get(analysisKey);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.blueprintCache.delete(analysisKey);
      this.stats.evictions++;
      this.stats.misses++;
      this.saveToStorage();
      return null;
    }

    this.stats.hits++;
    return entry.data;
  }

  setBlueprint(
    analysisKey: string,
    blueprint: PsychologyBlueprint,
    modelUsed: string,
    ttl?: number
  ): void {
    if (this.blueprintCache.size >= this.maxSize) {
      const oldestKey = this.findOldestEntry(this.blueprintCache);
      if (oldestKey) {
        this.blueprintCache.delete(oldestKey);
        this.stats.evictions++;
      }
    }

    const entry: CacheEntry<PsychologyBlueprint> = {
      data: blueprint,
      imageHashes: [],
      timestamp: Date.now(),
      modelUsed,
      ttl: ttl || this.defaultTtl,
    };

    this.blueprintCache.set(analysisKey, entry);
    this.stats.size = this.blueprintCache.size;
    this.saveToStorage();
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  clear(): void {
    this.analysisCache.clear();
    this.blueprintCache.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0, size: 0 };
    this.saveToStorage();
  }

  private findOldestEntry<T>(cache: Map<string, CacheEntry<T>>): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of cache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  private saveToStorage(): void {
    try {
      const data = {
        analysis: Array.from(this.analysisCache.entries()),
        blueprints: Array.from(this.blueprintCache.entries()),
        stats: this.stats,
      };
      localStorage.setItem('ccos_analysis_cache', JSON.stringify(data));
    } catch {
    }
  }

  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem('ccos_analysis_cache');
      if (data) {
        const parsed = JSON.parse(data);
        this.analysisCache = new Map(parsed.analysis || []);
        this.blueprintCache = new Map(parsed.blueprints || []);
        this.stats = parsed.stats || { hits: 0, misses: 0, evictions: 0, size: 0 };
      }
    } catch {
    }
  }
}

let globalCache: AnalysisCache | null = null;

export function useAnalysisCache(): AnalysisCache {
  if (!globalCache) {
    globalCache = new AnalysisCache();
  }
  return globalCache;
}
