import { describe, it, expect, vi } from 'vitest';
import { ImageStore } from './ImageStore';

// Mock crypto.subtle.digest for consistent hashing
const mockDigest = vi.fn();
vi.stubGlobal('crypto', {
  subtle: { digest: mockDigest },
});

describe('ImageStore.computeHash', () => {
  it('should compute SHA-256 hash', async () => {
    const store = new ImageStore();
    
    // Mock SHA-256 to return predictable value
    mockDigest.mockResolvedValue(new Uint8Array([0xab, 0xcd, 0xef]).buffer);
    
    // Access private method via any
    const hash = await (store as unknown as { computeHash(base64: string): Promise<string> }).computeHash('test');
    
    expect(hash).toBeDefined();
    expect(hash.length).toBe(6); // 3 bytes * 2 hex chars
  });
});
