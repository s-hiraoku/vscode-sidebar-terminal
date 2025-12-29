
import { describe, it, expect } from 'vitest';
import { LRUCache } from '../../../../utils/LRUCache';

describe('LRUCache', () => {
  it('should store and retrieve values', () => {
    const cache = new LRUCache<string, number>(3);
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
  });

  it('should respect maxSize and evict least recently used items', () => {
    const cache = new LRUCache<string, number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3); // 'a' should be evicted

    expect(cache.has('a')).toBe(false);
    expect(cache.has('b')).toBe(true);
    expect(cache.has('c')).toBe(true);
  });

  it('should update item "freshness" on get', () => {
    const cache = new LRUCache<string, number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    
    // Access 'a', making it MRU
    cache.get('a');
    
    cache.set('c', 3); // 'b' should be evicted instead of 'a'

    expect(cache.has('b')).toBe(false);
    expect(cache.has('a')).toBe(true);
    expect(cache.has('c')).toBe(true);
  });

  it('should support delete and clear', () => {
    const cache = new LRUCache<string, number>(10);
    cache.set('a', 1);
    cache.delete('a');
    expect(cache.has('a')).toBe(false);

    cache.set('b', 2);
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('should overwrite existing keys', () => {
    const cache = new LRUCache<string, number>(10);
    cache.set('a', 1);
    cache.set('a', 2);
    expect(cache.get('a')).toBe(2);
    expect(cache.size).toBe(1);
  });
});
