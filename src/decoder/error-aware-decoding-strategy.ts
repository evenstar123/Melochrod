import type { ChordCandidate, TimeSpan } from '../core/harmony-types.js';
import { CandidateLattice } from '../core/harmony-types.js';
import type { DecodeContext } from './global-decoder.js';
import type { OMRConfidenceReport } from '../omr/omr-interface.js';

export interface DecodedAlternative {
  path: ChordCandidate[];
  score: number;
}

export class ErrorAwareDecodingStrategy {
  _adjust_candidate_weights(
    lattice: CandidateLattice,
    scoreNoteConfidences: Array<{ time: number; confidence: number }>,
  ): void {
    for (let spanIndex = 0; spanIndex < lattice.time_spans.length; spanIndex++) {
      const span = lattice.time_spans[spanIndex];
      const noteConfs = scoreNoteConfidences
        .filter((sample) => sample.time >= span[0] && sample.time < span[1])
        .map((sample) => sample.confidence);

      const avgConfidence = noteConfs.length > 0
        ? noteConfs.reduce((sum, value) => sum + value, 0) / noteConfs.length
        : 0.8;

      for (const candidate of lattice.get_candidates(spanIndex)) {
        candidate.confidence *= avgConfidence;
      }
    }
  }

  _prefer_stable_chords_in_low_quality(lattice: CandidateLattice, spanConfidences: number[]): number[] {
    const lowQualitySpans: number[] = [];

    for (let spanIndex = 0; spanIndex < lattice.time_spans.length; spanIndex++) {
      const spanConfidence = spanConfidences[spanIndex] ?? 0.8;
      if (spanConfidence >= 0.6) continue;

      lowQualitySpans.push(spanIndex);
      for (const candidate of lattice.get_candidates(spanIndex)) {
        if (['I', 'IV', 'V', 'vi', 'i', 'iv', 'v', 'VI'].includes(candidate.roman_numeral)) {
          candidate.confidence *= 1.3;
        }
      }
    }

    return lowQualitySpans;
  }

  _prefer_sparse_rhythm_in_low_quality(lattice: CandidateLattice, lowQualitySpans: number[]): TimeSpan[] {
    const regions: TimeSpan[] = [];

    for (const index of lowQualitySpans) {
      const span = lattice.time_spans[index];
      if (!span) continue;

      if (regions.length === 0) {
        regions.push([span[0], span[1]]);
        continue;
      }

      const last = regions[regions.length - 1];
      if (Math.abs(last[1] - span[0]) < 1e-6) {
        regions[regions.length - 1] = [last[0], span[1]];
      } else {
        regions.push([span[0], span[1]]);
      }
    }

    return regions;
  }

  _decode_with_alternatives(lattice: CandidateLattice): DecodedAlternative[] {
    type BeamPath = { score: number; steps: Array<{ span: number; candidate: number }> };

    let beam: BeamPath[] = lattice.get_candidates(0).map((_candidate, index) => ({
      score: lattice.get_candidates(0)[index].confidence,
      steps: [{ span: 0, candidate: index }],
    }));

    for (let spanIndex = 1; spanIndex < lattice.time_spans.length; spanIndex++) {
      const expanded: BeamPath[] = [];
      const candidates = lattice.get_candidates(spanIndex);

      for (const path of beam) {
        const previous = path.steps[path.steps.length - 1];

        for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex++) {
          const transition = lattice.get_transition_score({
            from_span_index: previous.span,
            from_candidate_index: previous.candidate,
            to_span_index: spanIndex,
            to_candidate_index: candidateIndex,
          });

          const confidence = candidates[candidateIndex].confidence;
          expanded.push({
            score: path.score + transition + confidence,
            steps: [...path.steps, { span: spanIndex, candidate: candidateIndex }],
          });
        }
      }

      expanded.sort((a, b) => b.score - a.score);
      beam = expanded.slice(0, 3);
    }

    return beam.map((path) => ({
      score: path.score,
      path: path.steps.map((step) => lattice.get_candidates(step.span)[step.candidate]),
    }));
  }

  apply(
    lattice: CandidateLattice,
    report: OMRConfidenceReport,
    _context: DecodeContext,
  ): {
    chord_sequence: ChordCandidate[];
    alternatives: DecodedAlternative[];
    low_quality_regions: TimeSpan[];
  } {
    const noteConfidenceSamples = Object.entries(report.note_confidences).map(([key, confidence]) => {
      const [, beat] = key.split(':');
      return {
        time: Number(beat) || 0,
        confidence,
      };
    });

    this._adjust_candidate_weights(lattice, noteConfidenceSamples);

    const spanConfidences = lattice.time_spans.map((span) => {
      const center = (span[0] + span[1]) / 2;
      const sample = noteConfidenceSamples.filter((entry) => Math.abs(entry.time - center) < (span[1] - span[0]) / 2);
      if (sample.length === 0) return report.overall_confidence;
      return sample.reduce((sum, entry) => sum + entry.confidence, 0) / sample.length;
    });

    const lowQualitySpans = this._prefer_stable_chords_in_low_quality(lattice, spanConfidences);
    const lowQualityRegions = this._prefer_sparse_rhythm_in_low_quality(lattice, lowQualitySpans);
    const alternatives = this._decode_with_alternatives(lattice);

    return {
      chord_sequence: alternatives[0]?.path ?? [],
      alternatives,
      low_quality_regions: lowQualityRegions,
    };
  }
}
