import type { Score } from '../core/types.js';
import type { ChordCandidate } from '../core/harmony-types.js';
import type { DecodeContext, DecodeResult } from '../decoder/global-decoder.js';
import { CandidateLattice } from '../core/harmony-types.js';
import { GlobalDecoder } from '../decoder/global-decoder.js';
import { scoreToABC } from '../converter/ir-to-abc.js';

export interface EmbeddingFallbackInput {
  rule_candidates: ChordCandidate[];
  transition_matrix?: Record<string, Record<string, number>>;
}

export interface EmbeddingFallbackResult {
  candidates: ChordCandidate[];
  used_transition_matrix: boolean;
  warnings: string[];
}

export interface LLMFallbackInput {
  lattice: CandidateLattice;
  context: DecodeContext;
}

export interface LLMFallbackResult {
  decoded: DecodeResult;
  explanation: string;
  warnings: string[];
}

export interface OMRFallbackInput {
  preprocessed_preview?: string;
}

export interface OMRFallbackResult {
  user_message: string;
  preview?: string;
  warnings: string[];
}

export interface RenderingFallbackInput {
  musicxml: string;
  score?: Score;
}

export interface RenderingFallbackResult {
  musicxml: string;
  abc: string;
  warnings: string[];
}

function is_conservative(candidate: ChordCandidate): boolean {
  if (candidate.extensions.length > 0 || candidate.alterations.length > 0) {
    return false;
  }
  return ['major', 'minor', 'dominant7'].includes(candidate.quality);
}

export class DegradationStrategy {
  embedding_service_fallback(input: EmbeddingFallbackInput): EmbeddingFallbackResult {
    const normalized = input.rule_candidates.map((candidate) => ({
      ...candidate,
      source: 'rule' as const,
      confidence: Math.max(candidate.confidence, 0.55),
    }));

    return {
      candidates: normalized,
      used_transition_matrix: Boolean(input.transition_matrix),
      warnings: [
        'Embedding service unavailable; switched to rule candidates and transition matrix scoring.',
      ],
    };
  }

  llm_service_fallback(input: LLMFallbackInput): LLMFallbackResult {
    const conservativeRows = input.lattice.candidates.map((row) => {
      const conservative = row.filter(is_conservative);
      if (conservative.length > 0) {
        return conservative;
      }
      return row.slice(0, Math.min(2, row.length));
    });

    const conservativeLattice = new CandidateLattice(
      input.lattice.time_spans,
      conservativeRows,
      input.lattice.to_transition_score_map(),
    );

    const decoder = new GlobalDecoder({ algorithm: 'viterbi' });
    const decoded = decoder.decode(conservativeLattice, input.context);

    return {
      decoded,
      explanation: 'LLM unavailable; used conservative dynamic-programming harmonization with template explanations.',
      warnings: [
        'LLM service unavailable; explanation depth reduced to template mode.',
      ],
    };
  }

  omr_service_fallback(input: OMRFallbackInput = {}): OMRFallbackResult {
    return {
      user_message: 'OMR service temporarily unavailable. Please upload a clearer image or retry with higher contrast.',
      preview: input.preprocessed_preview,
      warnings: [
        'OMR fallback activated; only preprocessing preview is available.',
      ],
    };
  }

  rendering_service_fallback(input: RenderingFallbackInput): RenderingFallbackResult {
    const abc = input.score ? scoreToABC(input.score) : '';
    return {
      musicxml: input.musicxml,
      abc,
      warnings: [
        'Rendering service unavailable; returned MusicXML and ABC text formats.',
      ],
    };
  }
}

