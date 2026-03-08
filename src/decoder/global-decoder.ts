import type { ChordCandidate, DifficultyLevel, TimeSpan } from '../core/harmony-types.js';
import { CandidateLattice } from '../core/harmony-types.js';
import { DifficultyController } from '../harmonizer/difficulty-controller.js';
import { StyleControlSystem } from '../harmonizer/style-control-system.js';

export interface DecoderKeyContext {
  key: string;
  start_time: number;
  end_time: number;
}

export interface DecodeContext {
  key_sequence: DecoderKeyContext[];
  difficulty: DifficultyLevel;
  style: string;
  phrase_boundaries: TimeSpan[];
  /** Optional repeat-phrase expectations: spanIndex -> expected roman numeral. */
  repeat_expectations?: Record<number, { roman_numeral: string; weight: number }>;
}

export interface DecodeResult {
  chord_sequence: ChordCandidate[];
  total_score: number;
}

export interface GlobalDecoderConfig {
  algorithm?: 'viterbi' | 'beam';
  beam_width?: number;
  transition_probability_matrix?: Record<string, Record<string, number>>;
  style_controller?: StyleControlSystem;
}

function select_key_for_span(keySequence: DecoderKeyContext[], span: TimeSpan): DecoderKeyContext | null {
  const mid = (span[0] + span[1]) / 2;
  return keySequence.find((key) => mid >= key.start_time && mid < key.end_time) ?? null;
}

function is_phrase_ending(phraseBoundaries: TimeSpan[], span: TimeSpan): boolean {
  return phraseBoundaries.some((boundary) => Math.abs(boundary[1] - span[1]) < 0.25);
}

export class GlobalDecoder {
  private readonly algorithm: 'viterbi' | 'beam';
  private readonly beam_width: number;
  private readonly transition_probability_matrix: Record<string, Record<string, number>>;
  private readonly difficulty_controller: DifficultyController;
  private readonly style_controller: StyleControlSystem;

  constructor(config: GlobalDecoderConfig = {}) {
    this.algorithm = config.algorithm ?? 'viterbi';
    this.beam_width = config.beam_width ?? 4;
    this.transition_probability_matrix = config.transition_probability_matrix ?? {};
    this.difficulty_controller = new DifficultyController();
    this.style_controller = config.style_controller ?? new StyleControlSystem();
  }

  decode(lattice: CandidateLattice, context: DecodeContext): DecodeResult {
    if (this.algorithm === 'beam') {
      return this._beam_search_decode(lattice, context);
    }
    return this._viterbi_decode(lattice, context);
  }

  private _compute_local_score(
    candidate: ChordCandidate,
    spanIndex: number,
    lattice: CandidateLattice,
    context: DecodeContext,
  ): number {
    const keyContext = select_key_for_span(context.key_sequence, lattice.time_spans[spanIndex]);
    const keyMatch = keyContext && candidate.local_key.startsWith(keyContext.key) ? 1 : 0.55;

    const difficultyWeights = this.difficulty_controller.adjust_weights(context.difficulty);
    const difficultyMatch = candidate.difficulty === context.difficulty ? 1 : 0.6;
    const styleMatch = context.style === 'jazz-lite'
      ? Math.min(1, candidate.style_fit + (candidate.extensions.length > 0 ? 0.2 : 0))
      : candidate.style_fit;

    const melodyCoverage = candidate.melody_coverage;
    const beatAlignment = candidate.beat_alignment;
    const repeatExpectation = context.repeat_expectations?.[spanIndex];
    const repeatConsistency = repeatExpectation
      ? (candidate.roman_numeral === repeatExpectation.roman_numeral ? repeatExpectation.weight : -repeatExpectation.weight * 0.5)
      : 0;

    // 0.4 + 0.2 + 0.2 + 0.1 + 0.1
    return (
      0.4 * melodyCoverage +
      0.2 * keyMatch +
      0.2 * beatAlignment +
      0.1 * difficultyMatch +
      0.1 * styleMatch +
      0.05 * (difficultyWeights.function_fit ?? 0) +
      0.1 * repeatConsistency
    );
  }

  private _compute_transition_score(
    fromCandidate: ChordCandidate,
    toCandidate: ChordCandidate,
    query: { from_span_index: number; from_candidate_index: number; to_span_index: number; to_candidate_index: number },
    lattice: CandidateLattice,
    context: DecodeContext,
  ): number {
    const progression = this.functional_progression(fromCandidate.function, toCandidate.function);
    const phraseEnding = is_phrase_ending(context.phrase_boundaries, lattice.time_spans[query.to_span_index]);
    const cadenceTendency = phraseEnding
      ? (toCandidate.function === 'tonic' || toCandidate.function === 'dominant' ? 1 : 0.3)
      : 0.5;

    const bassSmoothness = this.bass_smoothness(fromCandidate, toCandidate);

    const historical = this.transition_probability_matrix[fromCandidate.roman_numeral]?.[toCandidate.roman_numeral]
      ?? lattice.get_transition_score(query)
      ?? 0.3;
    const styleTransition = this.style_controller.get_transition_probability(
      context.style,
      fromCandidate.roman_numeral,
      toCandidate.roman_numeral,
    ) ?? historical;

    const keyContinuity = fromCandidate.local_key === toCandidate.local_key ? 1 : 0.25;

    // 0.3 + 0.2 + 0.2 + 0.2 + 0.1
    return (
      0.3 * progression +
      0.2 * cadenceTendency +
      0.2 * bassSmoothness +
      0.2 * (0.4 * historical + 0.6 * styleTransition) +
      0.1 * keyContinuity
    );
  }

  private _viterbi_decode(lattice: CandidateLattice, context: DecodeContext): DecodeResult {
    const spans = lattice.time_spans.length;
    const dp: number[][] = [];
    const backPointer: Array<Array<number | null>> = [];

    for (let spanIndex = 0; spanIndex < spans; spanIndex++) {
      const rowLength = lattice.get_candidates(spanIndex).length;
      dp.push(Array(rowLength).fill(Number.NEGATIVE_INFINITY));
      backPointer.push(Array(rowLength).fill(null));
    }

    const firstCandidates = lattice.get_candidates(0);
    for (let i = 0; i < firstCandidates.length; i++) {
      dp[0][i] = this._compute_local_score(firstCandidates[i], 0, lattice, context);
    }

    for (let spanIndex = 1; spanIndex < spans; spanIndex++) {
      const candidates = lattice.get_candidates(spanIndex);
      const previousCandidates = lattice.get_candidates(spanIndex - 1);

      for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex++) {
        let bestScore = Number.NEGATIVE_INFINITY;
        let bestPrev: number | null = null;

        for (let prevIndex = 0; prevIndex < previousCandidates.length; prevIndex++) {
          const transitionScore = this._compute_transition_score(
            previousCandidates[prevIndex],
            candidates[candidateIndex],
            {
              from_span_index: spanIndex - 1,
              from_candidate_index: prevIndex,
              to_span_index: spanIndex,
              to_candidate_index: candidateIndex,
            },
            lattice,
            context,
          );

          const score = dp[spanIndex - 1][prevIndex] + transitionScore;
          if (score > bestScore) {
            bestScore = score;
            bestPrev = prevIndex;
          }
        }

        dp[spanIndex][candidateIndex] = bestScore + this._compute_local_score(candidates[candidateIndex], spanIndex, lattice, context);
        backPointer[spanIndex][candidateIndex] = bestPrev;
      }
    }

    const lastRow = dp[spans - 1];
    let bestFinalIndex = 0;
    for (let i = 1; i < lastRow.length; i++) {
      if (lastRow[i] > lastRow[bestFinalIndex]) {
        bestFinalIndex = i;
      }
    }

    const sequence: ChordCandidate[] = [];
    let currentIndex: number | null = bestFinalIndex;
    for (let spanIndex = spans - 1; spanIndex >= 0; spanIndex--) {
      if (currentIndex === null) {
        break;
      }
      sequence.unshift(lattice.get_candidates(spanIndex)[currentIndex]);
      currentIndex = backPointer[spanIndex][currentIndex];
    }

    return {
      chord_sequence: sequence,
      total_score: lastRow[bestFinalIndex],
    };
  }

  private _beam_search_decode(lattice: CandidateLattice, context: DecodeContext): DecodeResult {
    type BeamPath = { score: number; path: Array<{ span: number; candidate: number }> };

    let beam: BeamPath[] = lattice.get_candidates(0).map((_candidate, index) => ({
      score: this._compute_local_score(lattice.get_candidates(0)[index], 0, lattice, context),
      path: [{ span: 0, candidate: index }],
    }));

    for (let spanIndex = 1; spanIndex < lattice.time_spans.length; spanIndex++) {
      const expanded: BeamPath[] = [];
      const candidates = lattice.get_candidates(spanIndex);

      for (const beamPath of beam) {
        const previous = beamPath.path[beamPath.path.length - 1];
        const fromCandidate = lattice.get_candidates(previous.span)[previous.candidate];

        for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex++) {
          const toCandidate = candidates[candidateIndex];

          const transition = this._compute_transition_score(
            fromCandidate,
            toCandidate,
            {
              from_span_index: previous.span,
              from_candidate_index: previous.candidate,
              to_span_index: spanIndex,
              to_candidate_index: candidateIndex,
            },
            lattice,
            context,
          );

          const local = this._compute_local_score(toCandidate, spanIndex, lattice, context);
          expanded.push({
            score: beamPath.score + transition + local,
            path: [...beamPath.path, { span: spanIndex, candidate: candidateIndex }],
          });
        }
      }

      expanded.sort((a, b) => b.score - a.score);
      beam = expanded.slice(0, this.beam_width);
    }

    const best = beam[0];
    return {
      chord_sequence: best.path.map((step) => lattice.get_candidates(step.span)[step.candidate]),
      total_score: best.score,
    };
  }

  private functional_progression(fromFunction: string, toFunction: string): number {
    const table: Record<string, Record<string, number>> = {
      tonic: { tonic: 0.4, subdominant: 0.9, dominant: 0.75 },
      subdominant: { dominant: 0.95, tonic: 0.35, subdominant: 0.45 },
      dominant: { tonic: 1.0, dominant: 0.3, subdominant: 0.25 },
      cadence_preparation: { dominant: 0.9, cadence_resolution: 0.9 },
      cadence_resolution: { tonic: 0.95, subdominant: 0.5 },
      transition: { tonic: 0.5, subdominant: 0.5, dominant: 0.5 },
    };

    return table[fromFunction]?.[toFunction] ?? 0.4;
  }

  private bass_smoothness(fromCandidate: ChordCandidate, toCandidate: ChordCandidate): number {
    const fromPc = fromCandidate.root.charCodeAt(0);
    const toPc = toCandidate.root.charCodeAt(0);
    const distance = Math.abs(fromPc - toPc);
    return Math.max(0, 1 - distance / 6);
  }
}
