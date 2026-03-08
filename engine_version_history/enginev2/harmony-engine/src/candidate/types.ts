import type { Score } from '../core/types.js';
import type { ChordCandidate, DifficultyLevel, SupportedMode, TimeSpan } from '../core/harmony-types.js';

export interface KeyContext {
  key: string;
  mode: SupportedMode;
  confidence: number;
  start_time: number;
  end_time: number;
}

export interface CandidateRouterContext {
  score: Score;
  time_span: TimeSpan;
  span_index: number;
  key_context: KeyContext;
  difficulty: DifficultyLevel;
  style: string;
  phrase_boundaries: TimeSpan[];
  functional_state?: string;
}

export interface RetrievalHit {
  id: string;
  score: number;
  chords: string[];
  metadata?: Record<string, unknown>;
}

export interface RetrievalProvider {
  hybrid_search(
    features: object,
    context: CandidateRouterContext,
  ): Promise<RetrievalHit[]>;
}

export interface SymbolicModel {
  predict_candidates(context: CandidateRouterContext): {
    candidates: ChordCandidate[];
    confidence: number;
  };
}

export interface LLMProvider {
  predict_candidates(context: CandidateRouterContext): Promise<ChordCandidate[]>;
}
