import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { CandidateLattice, HarmonyAnnotation } from '../src/core/harmony-types.js';
import { candidate_from_roman } from '../src/candidate/candidate-utils.js';

describe('HarmonyAnnotation', () => {
  it('converts to chord and roman numeral symbols', () => {
    const annotation = new HarmonyAnnotation({
      local_key: 'C major',
      mode: 'major',
      roman_numeral: 'V7',
      function: 'dominant',
      root: 'G',
      quality: 'dominant7',
      inversion: '5',
      extensions: ['9'],
      start_time: 4,
      end_time: 6,
      confidence: 0.88,
    });

    expect(annotation.to_chord_symbol()).toContain('G7');
    expect(annotation.to_roman_numeral_symbol()).toBe('V7/5');
  });
});

describe('CandidateLattice', () => {
  it('stores and returns candidates and transition scores', () => {
    const c1 = candidate_from_roman({
      roman_numeral: 'I',
      tonic: 'C',
      tonic_accidental: 'none',
      mode: 'major',
      difficulty: 'basic',
      source: 'rule',
    });
    const c2 = candidate_from_roman({
      roman_numeral: 'V',
      tonic: 'C',
      tonic_accidental: 'none',
      mode: 'major',
      difficulty: 'basic',
      source: 'rule',
    });

    expect(c1).not.toBeNull();
    expect(c2).not.toBeNull();

    const lattice = new CandidateLattice(
      [[0, 2], [2, 4]],
      [[c1!], [c2!]],
    );

    lattice.set_transition_score({
      from_span_index: 0,
      from_candidate_index: 0,
      to_span_index: 1,
      to_candidate_index: 0,
    }, 0.9);

    expect(lattice.get_candidates(0)).toHaveLength(1);
    expect(lattice.get_transition_score({
      from_span_index: 0,
      from_candidate_index: 0,
      to_span_index: 1,
      to_candidate_index: 0,
    })).toBeCloseTo(0.9);
  });

  it('Property: each span returns its own candidate list', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 6 }), (nSpans) => {
        const spans = Array.from({ length: nSpans }, (_, i) => [i, i + 1] as const);
        const rows = spans.map((_span, i) => {
          const candidate = candidate_from_roman({
            roman_numeral: i % 2 === 0 ? 'I' : 'V',
            tonic: 'C',
            tonic_accidental: 'none',
            mode: 'major',
            difficulty: 'basic',
            source: 'rule',
          });
          return candidate ? [candidate] : [];
        });

        const lattice = new CandidateLattice(spans, rows);
        for (let i = 0; i < nSpans; i++) {
          expect(lattice.get_candidates(i)).toEqual(rows[i]);
        }
      }),
      { numRuns: 100 },
    );
  });
});
