import { describe, expect, it, vi } from 'vitest';
import { HarmonyCache } from '../src/perf/harmony-cache.js';

describe('HarmonyCache', () => {
  it('stores and retrieves values', () => {
    const cache = new HarmonyCache();
    const key = cache.generate_melody_cache_key({ melody: [60, 62, 64] });
    cache.set_melody_result(key, { value: 42 });

    expect(cache.get_melody_result<{ value: number }>(key)?.value).toBe(42);
  });

  it('evicts least recently used entries when full', () => {
    const cache = new HarmonyCache({ result_cache_size: 2, ttl_ms: 10_000 });
    const k1 = cache.generate_melody_cache_key('k1');
    const k2 = cache.generate_melody_cache_key('k2');
    const k3 = cache.generate_melody_cache_key('k3');

    cache.set_melody_result(k1, 1);
    cache.set_melody_result(k2, 2);
    cache.set_melody_result(k3, 3);

    expect(cache.get_melody_result<number>(k1)).toBeUndefined();
    expect(cache.get_melody_result<number>(k2)).toBe(2);
    expect(cache.get_melody_result<number>(k3)).toBe(3);
    expect(cache.get_stats().result.evictions).toBeGreaterThan(0);
  });

  it('expires entries by TTL', () => {
    vi.useFakeTimers();
    const cache = new HarmonyCache({ ttl_ms: 50 });
    const key = cache.generate_prompt_cache_key('prompt');

    cache.set_llm_response(key, { ok: true });
    vi.advanceTimersByTime(60);

    expect(cache.get_llm_response(key)).toBeUndefined();
    vi.useRealTimers();
  });

  it('tracks hit and miss statistics for cached lookups', () => {
    const cache = new HarmonyCache();
    const key = cache.generate_melody_cache_key({ melody: [60, 62, 64] });

    expect(cache.get_melody_result(key)).toBeUndefined();
    cache.set_melody_result(key, { value: 42 });
    expect(cache.get_melody_result<{ value: number }>(key)?.value).toBe(42);

    const stats = cache.get_stats();
    expect(stats.result.misses).toBeGreaterThan(0);
    expect(stats.result.hits).toBeGreaterThan(0);
  });
});
