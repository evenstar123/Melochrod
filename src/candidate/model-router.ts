import type { ChordCandidate } from '../core/harmony-types.js';
import { candidate_from_roman } from './candidate-utils.js';
import type { CandidateRouterContext, LLMProvider, SymbolicModel } from './types.js';

function parse_tonic(input: string): { tonic: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'; accidental: 'none' | 'sharp' | 'flat' } {
  const m = input.trim().match(/^([A-G])([b#]?)/);
  if (!m) {
    return { tonic: 'C', accidental: 'none' };
  }

  return {
    tonic: m[1] as 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G',
    accidental: m[2] === '#' ? 'sharp' : m[2] === 'b' ? 'flat' : 'none',
  };
}

export class ModelRouter {
  private readonly symbolic_model?: SymbolicModel;
  private readonly llm_provider?: LLMProvider;
  private readonly confidence_threshold: number;

  constructor(options: {
    symbolic_model?: SymbolicModel;
    llm_provider?: LLMProvider;
    confidence_threshold?: number;
  } = {}) {
    this.symbolic_model = options.symbolic_model;
    this.llm_provider = options.llm_provider;
    this.confidence_threshold = options.confidence_threshold ?? 0.72;
  }

  async generate(context: CandidateRouterContext): Promise<ChordCandidate[]> {
    const symbolic = this.symbolic_model?.predict_candidates(context);
    if (symbolic && symbolic.candidates.length > 0 && symbolic.confidence >= this.confidence_threshold) {
      return symbolic.candidates.map((candidate) => ({
        ...candidate,
        source: 'model',
        explanation: candidate.explanation || 'Predicted by local symbolic model.',
      }));
    }

    if (this.llm_provider) {
      const llmCandidates = await this.llm_provider.predict_candidates(context);
      if (llmCandidates.length > 0) {
        return llmCandidates.map((candidate) => ({
          ...candidate,
          source: 'model',
          confidence: Math.max(candidate.confidence, symbolic?.confidence ?? 0.4),
          explanation: candidate.explanation || 'Predicted by model fallback (LLM).',
        }));
      }
    }

    // Conservative fallback to keep lattice non-empty in low-confidence regions.
    const tonic = parse_tonic(context.key_context.key);
    const fallbackRomans = context.key_context.mode === 'minor' ? ['i', 'iv', 'V'] : ['I', 'IV', 'V'];

    return fallbackRomans
      .map((roman) => candidate_from_roman({
        roman_numeral: roman,
        tonic: tonic.tonic,
        tonic_accidental: tonic.accidental,
        mode: context.key_context.mode,
        difficulty: context.difficulty,
        source: 'model',
        confidence: 0.42,
        explanation: 'Conservative model fallback candidate.',
        melody_coverage: 0.45,
        beat_alignment: 0.55,
        function_fit: 0.5,
        style_fit: 0.5,
      }))
      .filter((candidate): candidate is ChordCandidate => candidate !== null);
  }
}
