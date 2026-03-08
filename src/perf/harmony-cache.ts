import { createHash } from 'node:crypto';

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  evictions: number;
}

interface CacheEntry<T> {
  value: T;
  expires_at: number;
}

class LRUCacheWithTTL<T> {
  private readonly store = new Map<string, CacheEntry<T>>();

  constructor(
    private readonly max_size: number,
    private readonly default_ttl_ms: number,
    private readonly stats: CacheStats,
  ) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      this.stats.misses += 1;
      return undefined;
    }

    if (entry.expires_at < Date.now()) {
      this.store.delete(key);
      this.stats.misses += 1;
      return undefined;
    }

    // LRU bump: reinsert at the end.
    this.store.delete(key);
    this.store.set(key, entry);
    this.stats.hits += 1;
    return entry.value;
  }

  set(key: string, value: T, ttl_ms?: number): void {
    const expiresAt = Date.now() + (ttl_ms ?? this.default_ttl_ms);

    if (this.store.has(key)) {
      this.store.delete(key);
    }

    this.store.set(key, { value, expires_at: expiresAt });
    this.stats.sets += 1;

    while (this.store.size > this.max_size) {
      const oldest = this.store.keys().next().value as string | undefined;
      if (!oldest) break;
      this.store.delete(oldest);
      this.stats.evictions += 1;
    }
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}

export interface HarmonyCacheConfig {
  embedding_cache_size?: number;
  result_cache_size?: number;
  rag_cache_size?: number;
  llm_cache_size?: number;
  ttl_ms?: number;
}

export class HarmonyCache {
  private readonly embedding_stats: CacheStats = { hits: 0, misses: 0, sets: 0, evictions: 0 };
  private readonly result_stats: CacheStats = { hits: 0, misses: 0, sets: 0, evictions: 0 };
  private readonly rag_stats: CacheStats = { hits: 0, misses: 0, sets: 0, evictions: 0 };
  private readonly llm_stats: CacheStats = { hits: 0, misses: 0, sets: 0, evictions: 0 };

  private readonly query_embedding_cache: LRUCacheWithTTL<number[]>;
  private readonly melody_result_cache: LRUCacheWithTTL<unknown>;
  private readonly rag_top_k_cache: LRUCacheWithTTL<unknown>;
  private readonly llm_response_cache: LRUCacheWithTTL<unknown>;

  constructor(config: HarmonyCacheConfig = {}) {
    const ttl = config.ttl_ms ?? 10 * 60 * 1000;

    this.query_embedding_cache = new LRUCacheWithTTL(config.embedding_cache_size ?? 2048, ttl, this.embedding_stats);
    this.melody_result_cache = new LRUCacheWithTTL(config.result_cache_size ?? 512, ttl, this.result_stats);
    this.rag_top_k_cache = new LRUCacheWithTTL(config.rag_cache_size ?? 1024, ttl, this.rag_stats);
    this.llm_response_cache = new LRUCacheWithTTL(config.llm_cache_size ?? 1024, ttl, this.llm_stats);
  }

  _generate_cache_key(payload: unknown): string {
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  generate_melody_cache_key(payload: unknown): string {
    return this._generate_cache_key({ type: 'melody', payload });
  }

  generate_prompt_cache_key(prompt: string): string {
    return this._generate_cache_key({ type: 'prompt', prompt });
  }

  generate_rag_cache_key(query: string, mode: string, top_k: number): string {
    return this._generate_cache_key({ type: 'rag', query, mode, top_k });
  }

  generate_embedding_cache_key(query: string): string {
    return this._generate_cache_key({ type: 'embedding', query });
  }

  get_query_embedding(key: string): number[] | undefined {
    return this.query_embedding_cache.get(key);
  }

  set_query_embedding(key: string, value: number[], ttl_ms?: number): void {
    this.query_embedding_cache.set(key, value, ttl_ms);
  }

  get_melody_result<T>(key: string): T | undefined {
    return this.melody_result_cache.get(key) as T | undefined;
  }

  set_melody_result<T>(key: string, value: T, ttl_ms?: number): void {
    this.melody_result_cache.set(key, value as unknown, ttl_ms);
  }

  get_rag_result<T>(key: string): T | undefined {
    return this.rag_top_k_cache.get(key) as T | undefined;
  }

  set_rag_result<T>(key: string, value: T, ttl_ms?: number): void {
    this.rag_top_k_cache.set(key, value as unknown, ttl_ms);
  }

  get_llm_response<T>(key: string): T | undefined {
    return this.llm_response_cache.get(key) as T | undefined;
  }

  set_llm_response<T>(key: string, value: T, ttl_ms?: number): void {
    this.llm_response_cache.set(key, value as unknown, ttl_ms);
  }

  clear_all(): void {
    this.query_embedding_cache.clear();
    this.melody_result_cache.clear();
    this.rag_top_k_cache.clear();
    this.llm_response_cache.clear();
  }

  get_stats(): Record<string, CacheStats & { size: number }> {
    return {
      embedding: { ...this.embedding_stats, size: this.query_embedding_cache.size() },
      result: { ...this.result_stats, size: this.melody_result_cache.size() },
      rag: { ...this.rag_stats, size: this.rag_top_k_cache.size() },
      llm: { ...this.llm_stats, size: this.llm_response_cache.size() },
    };
  }
}
