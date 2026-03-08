import type { ChordCandidate, TimeSpan } from '../core/harmony-types.js';
import { CandidateLattice } from '../core/harmony-types.js';

export interface RepairOperation {
  layer: 'melody_coverage' | 'transition' | 'cadence';
  span_index: number;
  from: string;
  to: string;
  reason: string;
}

export interface RepairResult {
  chord_sequence: ChordCandidate[];
  operations: RepairOperation[];
}

function candidate_label(candidate: ChordCandidate): string {
  return `${candidate.roman_numeral}(${candidate.root}${candidate.root_accidental === 'sharp' ? '#' : candidate.root_accidental === 'flat' ? 'b' : ''})`;
}

function is_phrase_ending(phraseBoundaries: TimeSpan[], span: TimeSpan): boolean {
  return phraseBoundaries.some((boundary) => Math.abs(boundary[1] - span[1]) < 0.25);
}

function is_phrase_start(phraseBoundaries: TimeSpan[], span: TimeSpan): boolean {
  return phraseBoundaries.some((boundary) => Math.abs(boundary[0] - span[0]) < 0.25);
}

function is_final_phrase_ending(phraseBoundaries: TimeSpan[], span: TimeSpan): boolean {
  const finalBoundary = phraseBoundaries[phraseBoundaries.length - 1];
  return !!finalBoundary && Math.abs(finalBoundary[1] - span[1]) < 0.25;
}

function is_primary_tonic(candidate: ChordCandidate): boolean {
  return candidate.roman_numeral === 'I' || candidate.roman_numeral === 'i';
}

function cadence_rank(candidate: ChordCandidate, finalEnding: boolean): number {
  if (is_primary_tonic(candidate)) return finalEnding ? 1 : 0.95;
  if (candidate.roman_numeral === 'V' || candidate.roman_numeral === 'V7') return finalEnding ? 0.7 : 0.85;
  if (candidate.function === 'tonic') return finalEnding ? 0.15 : 0.45;
  if (candidate.function === 'dominant') return finalEnding ? 0.3 : 0.65;
  return 0;
}

export class ThreeLayerRepairer {
  repair(
    chordSequence: ChordCandidate[],
    lattice: CandidateLattice,
    phraseBoundaries: TimeSpan[],
  ): RepairResult {
    const operations: RepairOperation[] = [];

    const layer1 = this._repair_melody_coverage(chordSequence, lattice, phraseBoundaries, operations);
    const layer2 = this._repair_transitions(layer1, lattice, operations);
    const layer3 = this._repair_cadences(layer2, lattice, phraseBoundaries, operations);

    return { chord_sequence: layer3, operations };
  }

  private _repair_melody_coverage(
    chordSequence: ChordCandidate[],
    lattice: CandidateLattice,
    phraseBoundaries: TimeSpan[],
    operations: RepairOperation[],
  ): ChordCandidate[] {
    const result = [...chordSequence];

    for (let spanIndex = 0; spanIndex < result.length; spanIndex++) {
      const chord = result[spanIndex];
      const span = lattice.time_spans[spanIndex];
      const finalEnding = is_final_phrase_ending(phraseBoundaries, span);
      const protectedOpening = is_phrase_start(phraseBoundaries, span) && is_primary_tonic(chord);
      const protectedCadence = is_phrase_ending(phraseBoundaries, span) && cadence_rank(chord, finalEnding) >= 0.8;
      if (protectedOpening || protectedCadence) {
        continue;
      }
      if (chord.melody_coverage >= 0.7) {
        continue;
      }

      const replacement = lattice
        .get_candidates(spanIndex)
        .slice()
        .sort((a, b) => b.melody_coverage - a.melody_coverage)[0];

      if (replacement && replacement.melody_coverage > chord.melody_coverage) {
        result[spanIndex] = {
          ...replacement,
          explanation: `${replacement.explanation} [Layer1 repair: improve strong-beat coverage.]`,
        };
        operations.push({
          layer: 'melody_coverage',
          span_index: spanIndex,
          from: candidate_label(chord),
          to: candidate_label(replacement),
          reason: 'Strong-beat melody coverage below 0.7.',
        });
      }
    }

    return result;
  }

  private _repair_transitions(
    chordSequence: ChordCandidate[],
    lattice: CandidateLattice,
    operations: RepairOperation[],
  ): ChordCandidate[] {
    const result = [...chordSequence];

    for (let spanIndex = 0; spanIndex < result.length - 1; spanIndex++) {
      const from = result[spanIndex];
      const to = result[spanIndex + 1];
      const fromIndex = lattice.get_candidates(spanIndex).findIndex((c) => c === from || c.roman_numeral === from.roman_numeral);
      const toIndex = lattice.get_candidates(spanIndex + 1).findIndex((c) => c === to || c.roman_numeral === to.roman_numeral);

      const currentScore = lattice.get_transition_score({
        from_span_index: spanIndex,
        from_candidate_index: Math.max(0, fromIndex),
        to_span_index: spanIndex + 1,
        to_candidate_index: Math.max(0, toIndex),
      });

      if (currentScore >= 0.05) {
        continue;
      }

      const alternatives = lattice.get_candidates(spanIndex + 1);
      let best = to;
      let bestScore = currentScore;

      for (let candidateIndex = 0; candidateIndex < alternatives.length; candidateIndex++) {
        const score = lattice.get_transition_score({
          from_span_index: spanIndex,
          from_candidate_index: Math.max(0, fromIndex),
          to_span_index: spanIndex + 1,
          to_candidate_index: candidateIndex,
        });

        if (score > bestScore) {
          bestScore = score;
          best = alternatives[candidateIndex];
        }
      }

      if (best !== to) {
        result[spanIndex + 1] = {
          ...best,
          explanation: `${best.explanation} [Layer2 repair: improve transition probability.]`,
        };
        operations.push({
          layer: 'transition',
          span_index: spanIndex + 1,
          from: candidate_label(to),
          to: candidate_label(best),
          reason: `Transition score ${currentScore.toFixed(3)} below threshold.`,
        });
      }
    }

    return result;
  }

  private _repair_cadences(
    chordSequence: ChordCandidate[],
    lattice: CandidateLattice,
    phraseBoundaries: TimeSpan[],
    operations: RepairOperation[],
  ): ChordCandidate[] {
    const result = [...chordSequence];

    for (let spanIndex = 0; spanIndex < result.length; spanIndex++) {
      const span = lattice.time_spans[spanIndex];
      if (!is_phrase_ending(phraseBoundaries, span)) {
        continue;
      }

      const chord = result[spanIndex];
      const finalEnding = is_final_phrase_ending(phraseBoundaries, span);
      const alreadyStable = cadence_rank(chord, finalEnding) >= (finalEnding ? 0.95 : 0.8);
      if (alreadyStable) {
        continue;
      }

      const replacement = lattice
        .get_candidates(spanIndex)
        .filter((candidate) => cadence_rank(candidate, finalEnding) > 0)
        .sort((a, b) => {
          const cadenceDelta = cadence_rank(b, finalEnding) - cadence_rank(a, finalEnding);
          if (Math.abs(cadenceDelta) > 1e-6) return cadenceDelta;
          return b.confidence - a.confidence;
        })[0];

      if (!replacement) {
        continue;
      }

      result[spanIndex] = {
        ...replacement,
        explanation: `${replacement.explanation} [Layer3 repair: enforce stable cadence.]`,
      };
      operations.push({
        layer: 'cadence',
        span_index: spanIndex,
        from: candidate_label(chord),
        to: candidate_label(replacement),
        reason: finalEnding
          ? 'Final cadence must resolve to primary tonic.'
          : 'Phrase ending lacked stable cadential support.',
      });
    }

    return result;
  }
}
