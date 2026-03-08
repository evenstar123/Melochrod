import type { ChordCandidate, TimeSpan } from '../core/harmony-types.js';
import type { Score } from '../core/types.js';
import { CandidateLattice } from '../core/harmony-types.js';
import { measure_start_time } from '../core/music-time.js';
import { RepeatPhraseAnalyzer } from './repeat-phrase-analyzer.js';

export interface EditResult {
  updated_sequence: ChordCandidate[];
  affected_measures: number[];
  coherence_score: number;
  warnings: string[];
}

export class InteractiveEditAPI {
  private readonly repeat_analyzer = new RepeatPhraseAnalyzer();
  private readonly correction_log: Array<{
    span_index: number;
    from: string;
    to: string;
  }> = [];

  replace_chord(
    score: Score,
    sequence: ChordCandidate[],
    lattice: CandidateLattice,
    measure_number: number,
    replacement: ChordCandidate,
  ): EditResult {
    const spanIndex = this.find_span_by_measure(score, lattice.time_spans, measure_number);
    const updated = [...sequence];
    const old = updated[spanIndex];
    updated[spanIndex] = replacement;

    // Re-evaluate adjacent ±2 spans with local best transition fit.
    for (let i = Math.max(0, spanIndex - 2); i <= Math.min(updated.length - 1, spanIndex + 2); i++) {
      if (i === spanIndex) continue;
      updated[i] = this.best_local_candidate(lattice, updated, i);
    }

    this.correction_log.push({ span_index: spanIndex, from: old.roman_numeral, to: replacement.roman_numeral });

    return {
      updated_sequence: updated,
      affected_measures: this.affected_measures(score, lattice.time_spans, [spanIndex - 2, spanIndex + 2]),
      coherence_score: this.compute_coherence(updated, lattice),
      warnings: [],
    };
  }

  get_alternatives(
    score: Score,
    sequence: ChordCandidate[],
    lattice: CandidateLattice,
    measure_number: number,
  ): ChordCandidate[] {
    const spanIndex = this.find_span_by_measure(score, lattice.time_spans, measure_number);
    const prev = spanIndex > 0 ? sequence[spanIndex - 1] : null;
    const next = spanIndex < sequence.length - 1 ? sequence[spanIndex + 1] : null;

    return lattice.get_candidates(spanIndex)
      .map((candidate, candidateIndex) => {
        let scoreValue = candidate.confidence;
        if (prev) {
          const prevIndex = lattice.get_candidates(spanIndex - 1).findIndex((chord) => chord.roman_numeral === prev.roman_numeral);
          if (prevIndex >= 0) {
            scoreValue += lattice.get_transition_score({
              from_span_index: spanIndex - 1,
              from_candidate_index: prevIndex,
              to_span_index: spanIndex,
              to_candidate_index: candidateIndex,
            });
          }
        }
        if (next) {
          const nextIndex = lattice.get_candidates(spanIndex + 1).findIndex((chord) => chord.roman_numeral === next.roman_numeral);
          if (nextIndex >= 0) {
            scoreValue += lattice.get_transition_score({
              from_span_index: spanIndex,
              from_candidate_index: candidateIndex,
              to_span_index: spanIndex + 1,
              to_candidate_index: nextIndex,
            });
          }
        }

        return { candidate, score: scoreValue };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((entry) => entry.candidate);
  }

  async local_regenerate(
    score: Score,
    sequence: ChordCandidate[],
    lattice: CandidateLattice,
    start_measure: number,
    end_measure: number,
  ): Promise<EditResult> {
    const startSpan = this.find_span_by_measure(score, lattice.time_spans, start_measure);
    const endSpan = this.find_span_by_measure(score, lattice.time_spans, end_measure);

    const updated = [...sequence];
    for (let spanIndex = startSpan; spanIndex <= endSpan; spanIndex++) {
      updated[spanIndex] = this.best_local_candidate(lattice, updated, spanIndex);
    }

    return {
      updated_sequence: updated,
      affected_measures: this.affected_measures(score, lattice.time_spans, [startSpan, endSpan]),
      coherence_score: this.compute_coherence(updated, lattice),
      warnings: [],
    };
  }

  sync_repeat_phrases(
    score: Score,
    sequence: ChordCandidate[],
    lattice: CandidateLattice,
    phrase_boundaries: TimeSpan[],
    source_measure: number,
  ): EditResult {
    const groups = this.repeat_analyzer.detect_repeats(score, phrase_boundaries, 0.8);
    const sourceSpan = this.find_span_by_measure(score, lattice.time_spans, source_measure);
    const sourcePhrase = phrase_boundaries.findIndex((phrase) => lattice.time_spans[sourceSpan][0] >= phrase[0] && lattice.time_spans[sourceSpan][1] <= phrase[1]);

    const targetGroup = groups.find((group) => group.phrase_indices.includes(sourcePhrase));
    if (!targetGroup) {
      return {
        updated_sequence: sequence,
        affected_measures: [source_measure],
        coherence_score: this.compute_coherence(sequence, lattice),
        warnings: ['No repeat phrase group found for selected measure.'],
      };
    }

    const updated = this.repeat_analyzer.apply_consistency(sequence, lattice.time_spans, phrase_boundaries, [targetGroup]);
    const affectedSpans = targetGroup.phrase_indices.flatMap((phraseIndex) => this.span_indexes_for_phrase(lattice.time_spans, phrase_boundaries[phraseIndex]));

    return {
      updated_sequence: updated,
      affected_measures: this.affected_measures(score, lattice.time_spans, [Math.min(...affectedSpans), Math.max(...affectedSpans)]),
      coherence_score: this.compute_coherence(updated, lattice),
      warnings: [],
    };
  }

  private best_local_candidate(lattice: CandidateLattice, sequence: ChordCandidate[], spanIndex: number): ChordCandidate {
    const candidates = lattice.get_candidates(spanIndex);
    if (candidates.length === 0) {
      return sequence[spanIndex];
    }

    let best = candidates[0];
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex++) {
      const candidate = candidates[candidateIndex];
      let score = candidate.confidence;

      if (spanIndex > 0) {
        const prev = sequence[spanIndex - 1];
        const prevIndex = lattice.get_candidates(spanIndex - 1).findIndex((item) => item.roman_numeral === prev.roman_numeral);
        if (prevIndex >= 0) {
          score += lattice.get_transition_score({
            from_span_index: spanIndex - 1,
            from_candidate_index: prevIndex,
            to_span_index: spanIndex,
            to_candidate_index: candidateIndex,
          });
        }
      }

      if (spanIndex < sequence.length - 1) {
        const next = sequence[spanIndex + 1];
        const nextIndex = lattice.get_candidates(spanIndex + 1).findIndex((item) => item.roman_numeral === next.roman_numeral);
        if (nextIndex >= 0) {
          score += lattice.get_transition_score({
            from_span_index: spanIndex,
            from_candidate_index: candidateIndex,
            to_span_index: spanIndex + 1,
            to_candidate_index: nextIndex,
          });
        }
      }

      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }

    return best;
  }

  private find_span_by_measure(score: Score, spans: TimeSpan[], measureNumber: number): number {
    const measure = score.measures.find((item) => item.number === measureNumber);
    if (!measure) return 0;

    const start = measure_start_time(score, measure.number);
    const index = spans.findIndex((span) => start >= span[0] - 1e-6 && start < span[1] + 1e-6);
    return index >= 0 ? index : 0;
  }

  private compute_coherence(sequence: ChordCandidate[], lattice: CandidateLattice): number {
    if (sequence.length <= 1) return 1;

    let total = 0;
    let count = 0;

    for (let i = 0; i < sequence.length - 1; i++) {
      const fromIndex = lattice.get_candidates(i).findIndex((candidate) => candidate.roman_numeral === sequence[i].roman_numeral);
      const toIndex = lattice.get_candidates(i + 1).findIndex((candidate) => candidate.roman_numeral === sequence[i + 1].roman_numeral);
      if (fromIndex < 0 || toIndex < 0) continue;

      total += lattice.get_transition_score({
        from_span_index: i,
        from_candidate_index: fromIndex,
        to_span_index: i + 1,
        to_candidate_index: toIndex,
      });
      count += 1;
    }

    return count > 0 ? total / count : 0.5;
  }

  private affected_measures(score: Score, spans: TimeSpan[], range: [number, number]): number[] {
    const [startIndex, endIndex] = range;
    const selected = spans
      .slice(Math.max(0, startIndex), Math.min(spans.length, endIndex + 1))
      .map((span) => span[0]);

    const measures = new Set<number>();
    for (const measure of score.measures) {
      const start = measure_start_time(score, measure.number);
      if (selected.some((value) => Math.abs(value - start) < 4.01 && value >= start - 1e-6)) {
        measures.add(measure.number);
      }
    }

    return [...measures].sort((a, b) => a - b);
  }

  private span_indexes_for_phrase(time_spans: TimeSpan[], phrase: TimeSpan): number[] {
    const indexes: number[] = [];
    for (let i = 0; i < time_spans.length; i++) {
      const span = time_spans[i];
      if (span[0] >= phrase[0] - 1e-6 && span[1] <= phrase[1] + 1e-6) {
        indexes.push(i);
      }
    }
    return indexes;
  }
}
