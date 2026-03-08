import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { CandidateLattice } from '../src/core/harmony-types.js';
import { ThreeLayerRepairer } from '../src/repair/three-layer-repairer.js';
import type { ChordCandidate } from '../src/core/harmony-types.js';

function c(roman: string, fn: ChordCandidate['function'], coverage: number, confidence = 0.6): ChordCandidate {
  return {
    local_key: 'C major',
    mode: 'major',
    roman_numeral: roman,
    function: fn,
    root: roman.startsWith('V') ? 'G' : roman.startsWith('IV') ? 'F' : 'C',
    root_accidental: 'none',
    quality: roman === 'V7' ? 'dominant7' : 'major',
    inversion: 'root',
    extensions: [],
    alterations: [],
    confidence,
    difficulty: 'intermediate',
    source: 'rule',
    explanation: roman,
    melody_coverage: coverage,
    beat_alignment: 0.7,
    function_fit: 0.7,
    style_fit: 0.6,
  };
}

describe('ThreeLayerRepairer', () => {
  it('repairs low melody coverage candidates', () => {
    const row0 = [c('I', 'tonic', 0.4), c('I', 'tonic', 0.9, 0.8)];
    const row1 = [c('ii', 'subdominant', 0.5), c('V', 'dominant', 0.8)];

    const lattice = new CandidateLattice([[0, 1], [1, 2]], [row0, row1]);
    const repairer = new ThreeLayerRepairer();
    const result = repairer.repair([row0[0], row1[0]], lattice, [[0, 2]]);

    expect(result.chord_sequence[0].melody_coverage).toBeGreaterThanOrEqual(0.9);
    expect(result.operations.some((op) => op.layer === 'melody_coverage')).toBe(true);
  });

  it('repairs low-probability transitions', () => {
    const row0 = [c('I', 'tonic', 0.8)];
    const row1 = [c('ii', 'subdominant', 0.7), c('V', 'dominant', 0.7)];

    const lattice = new CandidateLattice([[0, 1], [1, 2]], [row0, row1]);
    lattice.set_transition_score({ from_span_index: 0, from_candidate_index: 0, to_span_index: 1, to_candidate_index: 0 }, 0.01);
    lattice.set_transition_score({ from_span_index: 0, from_candidate_index: 0, to_span_index: 1, to_candidate_index: 1 }, 0.8);

    const repairer = new ThreeLayerRepairer();
    const result = repairer.repair([row0[0], row1[0]], lattice, [[0, 2]]);

    expect(result.chord_sequence[1].roman_numeral).toBe('V');
    expect(result.operations.some((op) => op.layer === 'transition')).toBe(true);
  });

  it('repairs cadence at phrase endings', () => {
    const row0 = [c('I', 'tonic', 0.8)];
    const row1 = [c('ii', 'subdominant', 0.8), c('I', 'tonic', 0.6, 0.9)];

    const lattice = new CandidateLattice([[0, 1], [1, 2]], [row0, row1]);
    const repairer = new ThreeLayerRepairer();
    const result = repairer.repair([row0[0], row1[0]], lattice, [[0, 2]]);

    expect(['tonic', 'dominant']).toContain(result.chord_sequence[1].function);
    expect(result.chord_sequence).toHaveLength(2);
  });

  it('Property: repaired sequence improves or keeps average melody coverage', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 5 }), (n) => {
        const spans = Array.from({ length: n }, (_, i) => [i, i + 1] as const);
        const rows = spans.map((_span, i) => [
          c(i % 2 === 0 ? 'I' : 'ii', i % 2 === 0 ? 'tonic' : 'subdominant', 0.3),
          c(i % 2 === 0 ? 'I' : 'V', i % 2 === 0 ? 'tonic' : 'dominant', 0.85),
        ]);

        const lattice = new CandidateLattice(spans, rows);
        const original = rows.map((row) => row[0]);

        const repairer = new ThreeLayerRepairer();
        const result = repairer.repair(original, lattice, [[0, n]]);

        const originalAvg = original.reduce((sum, item) => sum + item.melody_coverage, 0) / n;
        const repairedAvg = result.chord_sequence.reduce((sum, item) => sum + item.melody_coverage, 0) / n;

        expect(repairedAvg).toBeGreaterThanOrEqual(originalAvg);
      }),
      { numRuns: 80 },
    );
  });
});
