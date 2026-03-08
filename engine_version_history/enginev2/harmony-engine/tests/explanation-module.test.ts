import { describe, expect, it } from 'vitest';
import { CandidateLattice } from '../src/core/harmony-types.js';
import { ExplanationModule } from '../src/harmonizer/explanation-module.js';
import { make_measure, make_note, make_score } from './helpers/sample-score.js';

function c(roman: string, fn: 'tonic' | 'subdominant' | 'dominant') {
  return {
    local_key: 'C major',
    mode: 'major' as const,
    roman_numeral: roman,
    function: fn,
    root: roman === 'V' ? 'G' : roman === 'IV' ? 'F' : 'C',
    root_accidental: 'none' as const,
    quality: roman === 'V7' ? 'dominant7' as const : 'major' as const,
    inversion: 'root',
    extensions: [],
    alterations: [],
    confidence: 0.8,
    difficulty: 'intermediate' as const,
    source: 'rule' as const,
    explanation: roman,
    melody_coverage: 0.8,
    beat_alignment: 0.8,
    function_fit: 0.8,
    style_fit: 0.7,
  };
}

describe('ExplanationModule', () => {
  it('generates function role, melody relation and alternatives', async () => {
    const score = make_score([
      make_measure(1, [make_note('G', 0), make_note('B', 1), make_note('D', 2), make_note('C', 3)]),
      make_measure(2, [make_note('C', 0), make_note('E', 1), make_note('G', 2), make_note('C', 3)]),
    ]);

    const sequence = [c('V', 'dominant'), c('I', 'tonic')];
    const lattice = new CandidateLattice(
      [[0, 4], [4, 8]],
      [[c('V', 'dominant'), c('IV', 'subdominant')], [c('I', 'tonic'), c('vi', 'tonic') as any]],
    );

    const module = new ExplanationModule();
    const explanation = await module.generate({
      score,
      chord_sequence: sequence as any,
      lattice,
      span_index: 1,
      phrase_boundaries: [[0, 8]],
      key: 'C',
      mode: 'major',
    });

    expect(explanation.function_role).toContain('C major');
    expect(explanation.melody_notes_analysis.length).toBeGreaterThan(0);
    expect(explanation.alternatives.length).toBeGreaterThanOrEqual(1);
    expect(explanation.one_liner.length).toBeGreaterThan(0);
  });
});
