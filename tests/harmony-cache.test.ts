import { describe, expect, it, vi } from 'vitest';
import { HarmonyCache } from '../src/perf/harmony-cache.js';
import { HarmonyEnginePipeline } from '../src/harmonizer/harmony-engine-pipeline.js';
import { make_measure, make_note, make_score } from './helpers/sample-score.js';

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
});

describe('HarmonyEnginePipeline cache integration', () => {
  it('reuses cached intermediate results on repeated runs', async () => {
    const score1 = make_score([
      make_measure(1, [make_note('C', 0), make_note('E', 1), make_note('G', 2), make_note('C', 3)]),
      make_measure(2, [make_note('F', 0), make_note('A', 1), make_note('C', 2), make_note('G', 3)]),
    ]);
    const score2 = make_score([
      make_measure(1, [make_note('C', 0), make_note('E', 1), make_note('G', 2), make_note('C', 3)]),
      make_measure(2, [make_note('F', 0), make_note('A', 1), make_note('C', 2), make_note('G', 3)]),
    ]);

    const cache = new HarmonyCache();
    const pipeline = new HarmonyEnginePipeline({ cache });
    await pipeline.run(score1, { difficulty: 'basic', style: 'hymn' });
    await pipeline.run(score2, { difficulty: 'basic', style: 'hymn' });

    const stats = pipeline.get_cache_stats();
    expect(stats.result.hits).toBeGreaterThan(0);
  });
});

