import type { ChordCandidate } from '../core/harmony-types.js';
import type { CandidateRouterContext, RetrievalProvider } from './types.js';
import { candidate_from_roman } from './candidate-utils.js';
import { HarmonicSemanticFeatureExtractor } from '../rag/harmonic-semantic-feature-extractor.js';

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

export class RetrievalRouter {
  private readonly featureExtractor: HarmonicSemanticFeatureExtractor;
  private readonly provider?: RetrievalProvider;

  constructor(provider?: RetrievalProvider) {
    this.provider = provider;
    this.featureExtractor = new HarmonicSemanticFeatureExtractor();
  }

  async generate(context: CandidateRouterContext): Promise<ChordCandidate[]> {
    if (!this.provider) {
      return [];
    }

    const features = this.featureExtractor.extract(
      context.score,
      context.time_span,
      context.phrase_boundaries,
    );

    const hits = await this.provider.hybrid_search(features, context);
    if (hits.length === 0) {
      return [];
    }

    const tonic = parse_tonic(context.key_context.key);
    const candidates: ChordCandidate[] = [];

    for (const hit of hits.slice(0, 5)) {
      for (const chordLabel of hit.chords.slice(0, 3)) {
        const candidate = candidate_from_roman({
          roman_numeral: chordLabel,
          tonic: tonic.tonic,
          tonic_accidental: tonic.accidental,
          mode: context.key_context.mode,
          difficulty: context.difficulty,
          source: 'retrieval',
          confidence: Math.max(0.45, Math.min(0.95, hit.score)),
          explanation: `Retrieved from similar phrase ${hit.id} with semantic score ${hit.score.toFixed(2)}.`,
          melody_coverage: Math.min(1, 0.55 + hit.score * 0.25),
          beat_alignment: 0.65,
          function_fit: 0.6,
          style_fit: 0.65,
        });
        if (candidate) {
          candidates.push(candidate);
        }
      }
    }

    return candidates;
  }
}
