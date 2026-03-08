import { describe, expect, it } from 'vitest';
import { CandidateLattice } from '../src/core/harmony-types.js';
import { ErrorAwareDecodingStrategy } from '../src/decoder/error-aware-decoding-strategy.js';
import type { ChordCandidate } from '../src/core/harmony-types.js';
import type { OMRConfidenceReport } from '../src/omr/omr-interface.js';

function candidate(roman: string, confidence: number): ChordCandidate {
  return {
    local_key: 'C major',
    mode: 'major',
    roman_numeral: roman,
    function: roman === 'V' ? 'dominant' : roman === 'IV' ? 'subdominant' : 'tonic',
    root: roman === 'V' ? 'G' : roman === 'IV' ? 'F' : 'C',
    root_accidental: 'none',
    quality: 'major',
    inversion: 'root',
    extensions: [],
    alterations: [],
    confidence,
    difficulty: 'intermediate',
    source: 'rule',
    explanation: roman,
    melody_coverage: 0.8,
    beat_alignment: 0.8,
    function_fit: 0.8,
    style_fit: 0.7,
  };
}

function report(confidence: number): OMRConfidenceReport {
  return {
    overall_confidence: confidence,
    measure_confidences: { 1: confidence },
    note_confidences: {
      '1:0.100:0': confidence,
      '1:1.100:1': confidence,
      '1:2.100:2': confidence,
    },
    risk_regions: [],
    alternative_interpretations: {},
  };
}

describe('ErrorAwareDecodingStrategy', () => {
  it('reduces candidate confidence in low-quality regions', () => {
    const lattice = new CandidateLattice(
      [[0, 1], [1, 2]],
      [[candidate('I', 0.9)], [candidate('V', 0.9)]],
    );

    const strategy = new ErrorAwareDecodingStrategy();
    const before = lattice.get_candidates(0)[0].confidence;

    strategy._adjust_candidate_weights(lattice, [{ time: 0.2, confidence: 0.5 }, { time: 1.2, confidence: 0.5 }]);
    const after = lattice.get_candidates(0)[0].confidence;

    expect(after).toBeLessThan(before);
  });

  it('boosts stable chords in low confidence spans', () => {
    const lattice = new CandidateLattice(
      [[0, 1]],
      [[candidate('I', 0.5), candidate('ii', 0.5)]],
    );

    const strategy = new ErrorAwareDecodingStrategy();
    strategy._prefer_stable_chords_in_low_quality(lattice, [0.4]);

    const stable = lattice.get_candidates(0).find((c) => c.roman_numeral === 'I')!;
    const unstable = lattice.get_candidates(0).find((c) => c.roman_numeral === 'ii')!;

    expect(stable.confidence).toBeGreaterThan(unstable.confidence);
  });

  it('returns top-3 alternatives with beam decoding', () => {
    const lattice = new CandidateLattice(
      [[0, 1], [1, 2], [2, 3]],
      [
        [candidate('I', 0.8), candidate('IV', 0.6)],
        [candidate('V', 0.7), candidate('ii', 0.5)],
        [candidate('I', 0.8), candidate('vi', 0.5)],
      ],
    );

    // encourage I -> V -> I
    lattice.set_transition_score({ from_span_index: 0, from_candidate_index: 0, to_span_index: 1, to_candidate_index: 0 }, 0.9);
    lattice.set_transition_score({ from_span_index: 1, from_candidate_index: 0, to_span_index: 2, to_candidate_index: 0 }, 0.9);

    const strategy = new ErrorAwareDecodingStrategy();
    const result = strategy.apply(lattice, report(0.8), {
      key_sequence: [{ key: 'C', start_time: 0, end_time: 3 }],
      difficulty: 'intermediate',
      style: 'hymn',
      phrase_boundaries: [[0, 3]],
    });

    expect(result.alternatives.length).toBeGreaterThan(0);
    expect(result.alternatives.length).toBeLessThanOrEqual(3);
    expect(result.chord_sequence.length).toBe(3);
  });
});
