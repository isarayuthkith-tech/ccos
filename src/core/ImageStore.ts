import type { ImageData } from '@mytypes/index.ts';

const DB_NAME = 'CCOS_Images';
const DB_VERSION = 1;
const STORE_NAME = 'images';
const MAX_CACHE_SIZE = 50;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

interface CachedImage extends ImageData {
  accessTime: number;
  size: number;
}

export class ImageStore {
  private db: IDBDatabase | null = null;
  private memoryCache: Map<string, CachedImage> = new Map();
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    
    this.initPromise = this.openDatabase();
    return this.initPromise;
  }

  private openDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'hash' });
          store.createIndex('accessTime', 'accessTime', { unique: false });
        }
      };
    });
  }

  async addImage(image: ImageData): Promise<string> {
    await this.init();
    
    const hash = await this.computeHash(image.base64);
    const size = this.estimateSize(image);
    
    if (size > MAX_IMAGE_SIZE) {
      throw new Error(`Image too large: ${(size / 1024 / 1024).toFixed(2)}MB (max ${MAX_IMAGE_SIZE / 1024 / 1024}MB)`);
    }

    const cached: CachedImage = {
      ...image,
      hash,
      accessTime: Date.now(),
      size,
    };

    this.memoryCache.set(hash, cached);
    this.evictIfNeeded();

    await this.saveToIndexedDB(cached);

    return hash;
  }

  async getImage(hash: string): Promise<ImageData | null> {
    const memoryHit = this.memoryCache.get(hash);
    if (memoryHit) {
      memoryHit.accessTime = Date.now();
      return memoryHit;
    }

    await this.init();
    const dbImage = await this.getFromIndexedDB(hash);
    
    if (dbImage) {
      this.memoryCache.set(hash, dbImage);
      this.evictIfNeeded();
      return dbImage;
    }

    return null;
  }

  async removeImage(hash: string): Promise<void> {
    this.memoryCache.delete(hash);
    await this.deleteFromIndexedDB(hash);
  }

  async clear(): Promise<void> {
    this.memoryCache.clear();
    await this.clearIndexedDB();
  }

  async getAllHashes(): Promise<string[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve([]);
      
      const transaction = this.db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAllKeys();

      request.onsuccess = () => resolve(request.result as string[]);
      request.onerror = () => reject(request.error);
    });
  }

  private evictIfNeeded(): void {
    if (this.memoryCache.size <= MAX_CACHE_SIZE) return;

    const entries = Array.from(this.memoryCache.entries());
    entries.sort((a, b) => a[1].accessTime - b[1].accessTime);
    
    const toRemove = entries.slice(0, entries.length - MAX_CACHE_SIZE);
    for (const [hash] of toRemove) {
      this.memoryCache.delete(hash);
    }
  }

  async computeHash(base64: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(base64);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private estimateSize(image: ImageData): number {
    return Math.ceil(image.base64.length * 0.75);
  }

  private saveToIndexedDB(image: CachedImage): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve();
      
      const transaction = this.db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(image);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private getFromIndexedDB(hash: string): Promise<CachedImage | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve(null);
      
      const transaction = this.db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(hash);

      request.onsuccess = () => {
        if (request.result) {
          this.updateAccessTime(hash);
        }
        resolve(request.result || null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  private updateAccessTime(hash: string): void {
    if (!this.db) return;
    
    const transaction = this.db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(hash);

    request.onsuccess = () => {
      const data = request.result;
      if (data) {
        data.accessTime = Date.now();
        store.put(data);
      }
    };
  }

  private deleteFromIndexedDB(hash: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve();
      
      const transaction = this.db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(hash);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private clearIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve();
      
      const transaction = this.db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

let globalStore: ImageStore | null = null;

export function useImageStore(): ImageStore {
  if (!globalStore) {
    globalStore = new ImageStore();
  }
  return globalStore;
}
