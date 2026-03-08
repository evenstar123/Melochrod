import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { CandidateLattice } from '../src/core/harmony-types.js';
import { GlobalDecoder } from '../src/decoder/global-decoder.js';
import type { ChordCandidate } from '../src/core/harmony-types.js';

function candidate(
  roman: string,
  fn: ChordCandidate['function'],
  confidence: number,
  melodyCoverage: number,
): ChordCandidate {
  return {
    local_key: 'C major',
    mode: 'major',
    roman_numeral: roman,
    function: fn,
    root: roman.includes('V') ? 'G' : roman.includes('IV') ? 'F' : 'C',
    root_accidental: 'none',
    quality: roman === 'V7' ? 'dominant7' : 'major',
    inversion: 'root',
    extensions: [],
    alterations: [],
    confidence,
    difficulty: 'intermediate',
    source: 'rule',
    explanation: roman,
    melody_coverage: melodyCoverage,
    beat_alignment: 0.8,
    function_fit: 0.8,
    style_fit: 0.6,
  };
}

describe('GlobalDecoder', () => {
  it('Viterbi finds best path in a small lattice', () => {
    const span0 = [candidate('I', 'tonic', 0.8, 0.9), candidate('IV', 'subdominant', 0.6, 0.4)];
    const span1 = [candidate('V', 'dominant', 0.9, 0.8), candidate('I', 'tonic', 0.7, 0.5)];
    const span2 = [candidate('I', 'tonic', 0.9, 0.9), candidate('V', 'dominant', 0.5, 0.4)];

    const lattice = new CandidateLattice(
      [[0, 1], [1, 2], [2, 3]],
      [span0, span1, span2],
    );

    // Encourage I -> V -> I
    lattice.set_transition_score({ from_span_index: 0, from_candidate_index: 0, to_span_index: 1, to_candidate_index: 0 }, 0.95);
    lattice.set_transition_score({ from_span_index: 1, from_candidate_index: 0, to_span_index: 2, to_candidate_index: 0 }, 0.95);

    const decoder = new GlobalDecoder({ algorithm: 'viterbi' });
    const result = decoder.decode(lattice, {
      key_sequence: [{ key: 'C', start_time: 0, end_time: 3 }],
      difficulty: 'intermediate',
      style: 'hymn',
      phrase_boundaries: [[0, 3]],
    });

    expect(result.chord_sequence.map((c) => c.roman_numeral)).toEqual(['I', 'V', 'I']);
  });

  it('Beam search returns path with expected length', () => {
    const lattice = new CandidateLattice(
      [[0, 1], [1, 2], [2, 3], [3, 4]],
      [
        [candidate('I', 'tonic', 0.8, 0.8)],
        [candidate('IV', 'subdominant', 0.7, 0.6), candidate('V', 'dominant', 0.8, 0.9)],
        [candidate('V', 'dominant', 0.8, 0.8)],
        [candidate('I', 'tonic', 0.9, 0.9)],
      ],
    );

    const decoder = new GlobalDecoder({ algorithm: 'beam', beam_width: 3 });
    const result = decoder.decode(lattice, {
      key_sequence: [{ key: 'C', start_time: 0, end_time: 4 }],
      difficulty: 'intermediate',
      style: 'pop',
      phrase_boundaries: [[0, 4]],
    });

    expect(result.chord_sequence).toHaveLength(4);
  });

  it('applies repeat consistency expectations in objective', () => {
    const lattice = new CandidateLattice(
      [[0, 1], [1, 2]],
      [
        [candidate('I', 'tonic', 0.7, 0.7)],
        [candidate('IV', 'subdominant', 0.7, 0.7), candidate('I', 'tonic', 0.68, 0.68)],
      ],
    );

    const decoder = new GlobalDecoder({ algorithm: 'viterbi' });
    const withoutRepeat = decoder.decode(lattice, {
      key_sequence: [{ key: 'C', start_time: 0, end_time: 2 }],
      difficulty: 'basic',
      style: 'hymn',
      phrase_boundaries: [[0, 2]],
    });

    const withRepeat = decoder.decode(lattice, {
      key_sequence: [{ key: 'C', start_time: 0, end_time: 2 }],
      difficulty: 'basic',
      style: 'hymn',
      phrase_boundaries: [[0, 2]],
      repeat_expectations: {
        1: { roman_numeral: 'I', weight: 5.0 },
      },
    });

    expect(['IV', 'I']).toContain(withoutRepeat.chord_sequence[1].roman_numeral);
    expect(withRepeat.chord_sequence[1].roman_numeral).toBe('I');
  });

  it('Property: decoded sequence respects lattice structure', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 6 }), (nSpans) => {
        const spans = Array.from({ length: nSpans }, (_, i) => [i, i + 1] as const);
        const rows = spans.map((_span, i) => [
          candidate(i % 2 === 0 ? 'I' : 'V', i % 2 === 0 ? 'tonic' : 'dominant', 0.8, 0.7),
          candidate('IV', 'subdominant', 0.6, 0.5),
        ]);

        const lattice = new CandidateLattice(spans, rows);
        const decoder = new GlobalDecoder({ algorithm: 'viterbi' });
        const result = decoder.decode(lattice, {
          key_sequence: [{ key: 'C', start_time: 0, end_time: nSpans }],
          difficulty: 'basic',
          style: 'hymn',
          phrase_boundaries: [[0, nSpans]],
        });

        expect(result.chord_sequence).toHaveLength(nSpans);
        result.chord_sequence.forEach((chord, idx) => {
          expect(rows[idx]).toContain(chord);
        });
      }),
      { numRuns: 80 },
    );
  });
});
