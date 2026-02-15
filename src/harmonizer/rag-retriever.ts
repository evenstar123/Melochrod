/**
 * RAG 检索器
 *
 * 使用 text-embedding-v4 (DashScope) 将旋律特征向量化
 * 从 Hooktheory 片段库中检索最相似的和弦进行
 *
 * 支持按 mode 分片加载（lazy loading），大幅降低内存占用：
 *   - 全量加载：~550MB 常驻
 *   - 分片加载：最大 ~270MB（major 分片），按需加载
 */

import OpenAI from 'openai';
import { readFileSync, existsSync } from 'fs';

/** 片段数据结构（与 hooktheory_phrases.json 对齐） */
export interface PhraseEntry {
  song_id: string;
  artist: string;
  song: string;
  mode: string;
  chord_sequence: string[];
  melody_intervals: number[];
  embedding?: number[];
}

/** 检索结果 */
export interface RetrievalResult {
  phrase: PhraseEntry;
  similarity: number;
}

/** DashScope 客户端配置 */
interface RAGConfig {
  apiKey: string;
  /** 片段数据路径 */
  phrasesPath?: string;
  /** 预计算的嵌入缓存路径 */
  embeddingCachePath?: string;
  /** 检索时返回的最大结果数 */
  topK?: number;
}

/**
 * 余弦相似度
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * 将片段转为可嵌入的文本描述
 */
function phraseToText(phrase: PhraseEntry): string {
  const parts: string[] = [];
  parts.push(`mode:${phrase.mode}`);
  if (phrase.melody_intervals.length > 0) {
    const contour = phrase.melody_intervals.map(i =>
      i > 0 ? `+${i}` : i < 0 ? `${i}` : '0'
    ).join(',');
    parts.push(`intervals:[${contour}]`);
  }
  parts.push(`chords:[${phrase.chord_sequence.join(' ')}]`);
  return parts.join(' ');
}

/** Embedding 维度（text-embedding-v4） */
const EMBEDDING_DIM = 1024;

/** 单个 mode 分片的数据 */
interface ModeShard {
  mode: string;
  phrases: PhraseEntry[];
  embeddingBuffer: Float32Array | null;
  /** JSON 模式的 embeddings（回退用） */
  phraseEmbeddings: number[][];
}

export class RAGRetriever {
  private client: OpenAI;
  private topK: number;
  private initialized = false;
  private dataDir = '';

  /**
   * 加载策略：
   *   'sharded'  — 按 mode 分片，按需加载（推荐，省内存）
   *   'monolith' — 全量加载到内存（旧模式，兼容）
   *   'fallback' — 无预计算 embedding，实时 embed（极慢）
   */
  private loadStrategy: 'sharded' | 'monolith' | 'fallback' = 'fallback';

  /** 分片模式：当前加载的 shard（LRU = 1，只保留最近使用的 mode） */
  private currentShard: ModeShard | null = null;

  /** 全量模式（旧兼容）的数据 */
  private allPhrases: PhraseEntry[] = [];
  private allEmbeddingBuffer: Float32Array | null = null;
  private allPhraseEmbeddings: number[][] = [];

  constructor(config: RAGConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    });
    this.topK = config.topK ?? 5;
  }

  /**
   * 加载片段数据和预计算的 embedding
   *
   * 加载优先级:
   *   1. 分片二进制: phrase_meta_{mode}.json + phrase_embeddings_{mode}.bin（最省内存）
   *   2. 全量二进制: phrase_meta.json + phrase_embeddings.bin（兼容旧格式）
   *   3. JSON 格式:  phrase_embeddings.json（2.7GB，可能因 V8 字符串限制失败）
   *   4. 无 embedding: hooktheory_phrases.json（回退，检索时实时 embed，极慢）
   */
  loadPhrases(phrasesPath: string): void {
    this.dataDir = phrasesPath.replace(/[/\\][^/\\]+$/, '');

    // 1. 检查分片文件是否存在（至少有 major 分片）
    const shardMetaPath = `${this.dataDir}/phrase_meta_major.json`;
    const shardBinPath = `${this.dataDir}/phrase_embeddings_major.bin`;
    if (existsSync(shardMetaPath) && existsSync(shardBinPath)) {
      this.loadStrategy = 'sharded';
      console.log('Mode-sharded embeddings detected, will load on demand (lazy)');
      this.initialized = true;
      return;
    }

    // 2. 尝试全量二进制格式（phrase_meta.json + phrase_embeddings.bin）
    const metaPath = `${this.dataDir}/phrase_meta.json`;
    const binPath = `${this.dataDir}/phrase_embeddings.bin`;
    if (existsSync(metaPath) && existsSync(binPath)) {
      try {
        const t0 = Date.now();
        this.allPhrases = JSON.parse(readFileSync(metaPath, 'utf-8'));
        const binBuf = readFileSync(binPath);
        this.allEmbeddingBuffer = new Float32Array(
          binBuf.buffer, binBuf.byteOffset, binBuf.byteLength / 4
        );
        this.allPhraseEmbeddings = [];
        this.loadStrategy = 'monolith';
        const loadMs = Date.now() - t0;
        console.log(`Loaded ${this.allPhrases.length} phrases with binary embeddings (${loadMs}ms)`);
        this.initialized = true;
        return;
      } catch (err) {
        console.warn('Failed to load binary embeddings, falling back:', (err as Error).message);
      }
    }

    // 3. 尝试 JSON 格式（phrase_embeddings.json）
    const embeddingsPath = phrasesPath.replace('hooktheory_phrases.json', 'phrase_embeddings.json');
    if (existsSync(embeddingsPath)) {
      try {
        const raw = readFileSync(embeddingsPath, 'utf-8');
        const data = JSON.parse(raw);
        this.allPhrases = data.phrases;
        this.allPhraseEmbeddings = data.embeddings;
        this.allEmbeddingBuffer = null;
        this.loadStrategy = 'monolith';
        console.log(`Loaded ${this.allPhrases.length} phrases with precomputed embeddings (JSON)`);
        this.initialized = true;
        return;
      } catch (err) {
        console.warn('Failed to load JSON embeddings (file too large?), falling back:', (err as Error).message);
      }
    }

    // 4. 回退：加载纯片段数据（检索时需要实时 embed 候选片段）
    const raw = readFileSync(phrasesPath, 'utf-8');
    const allPhrases: PhraseEntry[] = JSON.parse(raw);
    this.allPhrases = allPhrases.filter(
      p => p.chord_sequence.length > 0 && p.melody_intervals.length > 0
    );
    this.allPhraseEmbeddings = [];
    this.allEmbeddingBuffer = null;
    this.loadStrategy = 'fallback';
    console.log(`Loaded ${this.allPhrases.length} phrases (no precomputed embeddings, will embed on-the-fly)`);
    this.initialized = true;
  }

  /**
   * 按需加载指定 mode 的分片数据
   */
  private loadModeShard(mode: string): ModeShard {
    // 已缓存则直接返回
    if (this.currentShard?.mode === mode) {
      return this.currentShard;
    }

    const metaPath = `${this.dataDir}/phrase_meta_${mode}.json`;
    const binPath = `${this.dataDir}/phrase_embeddings_${mode}.bin`;

    if (!existsSync(metaPath) || !existsSync(binPath)) {
      // 该 mode 没有分片文件，返回空分片
      console.warn(`No shard found for mode "${mode}", returning empty`);
      const empty: ModeShard = { mode, phrases: [], embeddingBuffer: null, phraseEmbeddings: [] };
      this.currentShard = empty;
      return empty;
    }

    const t0 = Date.now();

    // 释放旧分片（让 GC 回收）
    if (this.currentShard) {
      console.log(`Unloading shard "${this.currentShard.mode}"`);
      this.currentShard.embeddingBuffer = null;
      this.currentShard.phrases = [];
      this.currentShard = null;
    }

    const phrases: PhraseEntry[] = JSON.parse(readFileSync(metaPath, 'utf-8'));
    const binBuf = readFileSync(binPath);
    const embeddingBuffer = new Float32Array(
      binBuf.buffer, binBuf.byteOffset, binBuf.byteLength / 4
    );

    const shard: ModeShard = { mode, phrases, embeddingBuffer, phraseEmbeddings: [] };
    this.currentShard = shard;

    const loadMs = Date.now() - t0;
    const sizeMB = (binBuf.byteLength / 1024 / 1024).toFixed(1);
    console.log(`Loaded shard "${mode}": ${phrases.length} phrases, ${sizeMB} MB (${loadMs}ms)`);

    return shard;
  }

  /**
   * 用 Float32Array 直接计算余弦相似度（避免创建中间数组）
   */
  private cosineSimilarityWithBuffer(
    queryEmb: number[],
    buffer: Float32Array,
    phraseIndex: number,
  ): number {
    const offset = phraseIndex * EMBEDDING_DIM;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < EMBEDDING_DIM; i++) {
      const a = queryEmb[i];
      const b = buffer[offset + i];
      dot += a * b;
      normA += a * a;
      normB += b * b;
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }

  /**
   * 调用 text-embedding-v4 获取嵌入向量
   */
  async getEmbedding(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: 'text-embedding-v4',
      input: text,
    });
    return response.data[0].embedding;
  }

  /**
   * 批量获取嵌入向量
   */
  async getEmbeddings(texts: string[]): Promise<number[][]> {
    const batchSize = 10;
    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const response = await this.client.embeddings.create({
        model: 'text-embedding-v4',
        input: batch,
      });
      for (const item of response.data) {
        results.push(item.embedding);
      }
    }

    return results;
  }

  /**
   * 检索最相似的和弦进行片段
   */
  async retrieve(query: string, mode: string): Promise<RetrievalResult[]> {
    if (!this.initialized) {
      throw new Error('RAGRetriever not initialized. Call loadPhrases() first.');
    }

    if (this.loadStrategy === 'sharded') {
      return this.retrieveSharded(query, mode);
    }
    return this.retrieveMonolith(query, mode);
  }

  /**
   * 分片模式检索：加载对应 mode 的分片，全量余弦相似度
   */
  private async retrieveSharded(query: string, mode: string): Promise<RetrievalResult[]> {
    const shard = this.loadModeShard(mode);
    if (shard.phrases.length === 0) return [];

    // 1 次 API 调用获取查询 embedding
    const queryEmbedding = await this.getEmbedding(query);

    // 分片内所有数据都是同一 mode，无需过滤，直接全量计算
    const results: RetrievalResult[] = shard.phrases.map((phrase, i) => ({
      phrase,
      similarity: shard.embeddingBuffer
        ? this.cosineSimilarityWithBuffer(queryEmbedding, shard.embeddingBuffer, i)
        : cosineSimilarity(queryEmbedding, shard.phraseEmbeddings[i]),
    }));

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, this.topK);
  }

  /**
   * 全量模式检索（旧兼容 + fallback）
   */
  private async retrieveMonolith(query: string, mode: string): Promise<RetrievalResult[]> {
    // 按 mode 过滤
    const indices: number[] = [];
    for (let i = 0; i < this.allPhrases.length; i++) {
      if (this.allPhrases[i].mode === mode) {
        indices.push(i);
      }
    }
    if (indices.length === 0) return [];

    const candidates = indices.map(i => this.allPhrases[i]);
    const hasEmbeddings = this.allEmbeddingBuffer !== null || this.allPhraseEmbeddings.length > 0;

    // fallback 模式：候选太多时按旋律长度粗筛
    let filteredIndices = indices;
    if (!hasEmbeddings && filteredIndices.length > 200) {
      const intervalMatch = query.match(/intervals:\[([^\]]*)\]/);
      const queryIntervalCount = intervalMatch
        ? intervalMatch[1].split(',').filter(s => s.length > 0).length
        : 0;
      filteredIndices.sort((a, b) => {
        const diffA = Math.abs(this.allPhrases[a].melody_intervals.length - queryIntervalCount);
        const diffB = Math.abs(this.allPhrases[b].melody_intervals.length - queryIntervalCount);
        return diffA - diffB;
      });
      filteredIndices = filteredIndices.slice(0, 200);
    }

    const filteredCandidates = filteredIndices.map(i => this.allPhrases[i]);

    // 获取查询 embedding
    const queryEmbedding = await this.getEmbedding(query);

    let results: RetrievalResult[];

    if (this.allEmbeddingBuffer) {
      results = filteredCandidates.map((phrase, i) => ({
        phrase,
        similarity: this.cosineSimilarityWithBuffer(queryEmbedding, this.allEmbeddingBuffer!, filteredIndices[i]),
      }));
    } else if (this.allPhraseEmbeddings.length > 0) {
      results = filteredCandidates.map((phrase, i) => ({
        phrase,
        similarity: cosineSimilarity(queryEmbedding, this.allPhraseEmbeddings[filteredIndices[i]]),
      }));
    } else {
      // 实时 embed
      const candidateTexts = filteredCandidates.map(phraseToText);
      const finalEmbeddings = await this.getEmbeddings(candidateTexts);
      results = filteredCandidates.map((phrase, i) => ({
        phrase,
        similarity: cosineSimilarity(queryEmbedding, finalEmbeddings[i]),
      }));
    }

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, this.topK);
  }

  /**
   * 批量检索（多个查询）
   */
  async retrieveBatch(
    queries: string[],
    mode: string
  ): Promise<RetrievalResult[][]> {
    const results: RetrievalResult[][] = [];
    for (const query of queries) {
      const result = await this.retrieve(query, mode);
      results.push(result);
    }
    return results;
  }
}
