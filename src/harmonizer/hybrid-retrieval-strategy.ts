import { ModeUnificationConfig } from './mode-unification-config.js';

export interface HybridSegment {
  id: string;
  key: string;
  mode: string;
  style: string;
  time_signature: string;
  phrase_length: number;
  harmonic_density: number;
  scale_degree_ngrams: string[];
  beat_pattern: string;
  interval_contour: string;
  embedding: number[];
  chords: string[];
}

export interface HybridQuery {
  key?: string;
  mode?: string;
  style?: string;
  time_signature?: string;
  phrase_length?: number;
  harmonic_density?: number;
  scale_degree_ngrams: string[];
  beat_pattern: string;
  interval_contour: string;
  embedding: number[];
}

export interface HybridSearchResult {
  segment: HybridSegment;
  sparse_score: number;
  dense_score: number;
  fused_score: number;
}

function cosine_similarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) {
    return 0;
  }

  return dot / denom;
}

export class HybridRetrievalStrategy {
  private readonly mode_config: ModeUnificationConfig;

  constructor(mode_config = new ModeUnificationConfig()) {
    this.mode_config = mode_config;
  }

  select_embedding_shard_mode(mode: string): string {
    return this.mode_config.map_to_supported_mode(mode);
  }

  search(query: HybridQuery, corpus: HybridSegment[], top_k = 5): HybridSearchResult[] {
    const filtered = this._symbolic_filter(query, corpus);
    const sparse = this._sparse_search(query, filtered, top_k * 3);
    const dense = this._dense_search(query, filtered, top_k * 3);
    return this._fuse_results(sparse, dense, top_k);
  }

  _symbolic_filter(query: HybridQuery, corpus: HybridSegment[]): HybridSegment[] {
    const normalizedQueryMode = query.mode ? this.mode_config.map_to_supported_mode(query.mode) : undefined;

    return corpus.filter((segment) => {
      if (query.key && segment.key !== query.key) return false;
      if (normalizedQueryMode && this.mode_config.map_to_supported_mode(segment.mode) !== normalizedQueryMode) return false;
      if (query.style && segment.style !== query.style) return false;
      if (query.time_signature && segment.time_signature !== query.time_signature) return false;
      if (query.phrase_length && Math.abs(segment.phrase_length - query.phrase_length) > 4) return false;
      if (query.harmonic_density && Math.abs(segment.harmonic_density - query.harmonic_density) > 2) return false;
      return true;
    });
  }

  _sparse_search(query: HybridQuery, corpus: HybridSegment[], top_k: number): Array<{ segment: HybridSegment; score: number }> {
    const queryNgrams = new Set(query.scale_degree_ngrams);

    const scored = corpus.map((segment) => {
      const overlap = segment.scale_degree_ngrams.filter((ngram) => queryNgrams.has(ngram)).length;
      const ngramScore = queryNgrams.size > 0 ? overlap / queryNgrams.size : 0;

      const beatScore = segment.beat_pattern === query.beat_pattern ? 1 : this.partial_pattern_score(segment.beat_pattern, query.beat_pattern);
      const contourScore = segment.interval_contour === query.interval_contour ? 1 : this.partial_pattern_score(segment.interval_contour, query.interval_contour);

      const score = 0.45 * ngramScore + 0.3 * beatScore + 0.25 * contourScore;
      return { segment, score };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, top_k);
  }

  _dense_search(query: HybridQuery, corpus: HybridSegment[], top_k: number): Array<{ segment: HybridSegment; score: number }> {
    const scored = corpus.map((segment) => ({
      segment,
      score: cosine_similarity(query.embedding, segment.embedding),
    }));

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, top_k);
  }

  _fuse_results(
    sparse: Array<{ segment: HybridSegment; score: number }>,
    dense: Array<{ segment: HybridSegment; score: number }>,
    top_k: number,
  ): HybridSearchResult[] {
    const sparseMap = new Map(sparse.map((item) => [item.segment.id, item]));
    const denseMap = new Map(dense.map((item) => [item.segment.id, item]));

    const ids = new Set([...sparseMap.keys(), ...denseMap.keys()]);
    const fused: HybridSearchResult[] = [];

    for (const id of ids) {
      const sparseItem = sparseMap.get(id);
      const denseItem = denseMap.get(id);
      const segment = sparseItem?.segment ?? denseItem?.segment;
      if (!segment) {
        continue;
      }

      const sparseScore = sparseItem?.score ?? 0;
      const denseScore = denseItem?.score ?? 0;
      const fusedScore = 0.4 * sparseScore + 0.6 * denseScore;

      fused.push({
        segment,
        sparse_score: sparseScore,
        dense_score: denseScore,
        fused_score: fusedScore,
      });
    }

    return fused
      .sort((a, b) => b.fused_score - a.fused_score)
      .slice(0, top_k);
  }

  private partial_pattern_score(a: string, b: string): number {
    if (!a || !b) return 0;

    const minLength = Math.min(a.length, b.length);
    let matches = 0;
    for (let i = 0; i < minLength; i++) {
      if (a[i] === b[i]) {
        matches += 1;
      }
    }

    return matches / Math.max(a.length, b.length);
  }
}
