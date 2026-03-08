import { describe, expect, it } from 'vitest';
import { CandidateLattice } from '../src/core/harmony-types.js';
import { InteractiveEditAPI } from '../src/harmonizer/interactive-edit-api.js';
import { make_measure, make_note, make_score } from './helpers/sample-score.js';
import type { ChordCandidate } from '../src/core/harmony-types.js';

function chord(roman: string, confidence = 0.7): ChordCandidate {
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

describe('InteractiveEditAPI', () => {
  const score = make_score([
    make_measure(1, [make_note('C', 0), make_note('E', 1), make_note('G', 2), make_note('C', 3)]),
    make_measure(2, [make_note('F', 0), make_note('A', 1), make_note('C', 2), make_note('A', 3)]),
    make_measure(3, [make_note('G', 0), make_note('B', 1), make_note('D', 2), make_note('G', 3)]),
    make_measure(4, [make_note('C', 0), make_note('E', 1), make_note('G', 2), make_note('C', 3)]),
  ]);

  const spans: Array<readonly [number, number]> = [[0, 4], [4, 8], [8, 12], [12, 16]];
  const row0 = [chord('I', 0.8), chord('IV', 0.6)];
  const row1 = [chord('ii', 0.6), chord('V', 0.8)];
  const row2 = [chord('V', 0.7), chord('I', 0.65)];
  const row3 = [chord('I', 0.8), chord('vi', 0.5) as any];

  const lattice = new CandidateLattice(spans, [row0, row1, row2, row3]);
  lattice.set_transition_score({ from_span_index: 0, from_candidate_index: 0, to_span_index: 1, to_candidate_index: 1 }, 0.9);
  lattice.set_transition_score({ from_span_index: 1, from_candidate_index: 1, to_span_index: 2, to_candidate_index: 0 }, 0.9);
  lattice.set_transition_score({ from_span_index: 2, from_candidate_index: 0, to_span_index: 3, to_candidate_index: 0 }, 0.9);

  const initial = [row0[0], row1[0], row2[0], row3[0]];

  it('replace_chord updates sequence around target measure', () => {
    const api = new InteractiveEditAPI();
    const result = api.replace_chord(score, initial, lattice, 2, row1[1]);

    expect(result.updated_sequence[1].roman_numeral).toBe('V');
    expect(result.affected_measures.length).toBeGreaterThan(0);
  });

  it('get_alternatives returns top-3 contextual candidates', () => {
    const api = new InteractiveEditAPI();
    const alternatives = api.get_alternatives(score, initial, lattice, 2);

    expect(alternatives.length).toBeGreaterThan(0);
    expect(alternatives.length).toBeLessThanOrEqual(3);
  });

  it('local_regenerate only changes local range', async () => {
    const api = new InteractiveEditAPI();
    const result = await api.local_regenerate(score, initial, lattice, 2, 3);

    expect(result.updated_sequence[0].roman_numeral).toBe(initial[0].roman_numeral);
    expect(result.updated_sequence[3]).toBeDefined();
  });

  it('sync_repeat_phrases updates phrases in same repeat group', () => {
    const api = new InteractiveEditAPI();
    const result = api.sync_repeat_phrases(score, initial, lattice, [[0, 8], [8, 16]], 1);

    expect(result.updated_sequence.length).toBe(initial.length);
    expect(result.coherence_score).toBeGreaterThanOrEqual(0);
  });
});
