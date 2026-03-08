import { describe, expect, it } from 'vitest';
import { RepeatPhraseAnalyzer } from '../src/harmonizer/repeat-phrase-analyzer.js';
import { make_measure, make_note, make_score } from './helpers/sample-score.js';
import type { ChordCandidate } from '../src/core/harmony-types.js';

function chord(roman: string): ChordCandidate {
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
    confidence: 0.8,
    difficulty: 'intermediate',
    source: 'rule',
    explanation: roman,
    melody_coverage: 0.8,
    beat_alignment: 0.8,
    function_fit: 0.8,
    style_fit: 0.7,
  };
}

describe('RepeatPhraseAnalyzer', () => {
  it('detects repeated phrase groups and applies consistency', () => {
    const score = make_score([
      make_measure(1, [make_note('C', 0), make_note('D', 1), make_note('E', 2), make_note('G', 3)]),
      make_measure(2, [make_note('C', 0), make_note('D', 1), make_note('E', 2), make_note('G', 3)]),
      make_measure(3, [make_note('F', 0), make_note('E', 1), make_note('D', 2), make_note('C', 3)]),
      make_measure(4, [make_note('C', 0), make_note('D', 1), make_note('E', 2), make_note('G', 3)]),
    ]);

    const phraseBoundaries: Array<readonly [number, number]> = [[0, 4], [4, 8], [8, 12], [12, 16]];
    const analyzer = new RepeatPhraseAnalyzer();
    const groups = analyzer.detect_repeats(score, phraseBoundaries, 0.8);

    expect(groups.length).toBeGreaterThan(0);

    const sequence = [chord('I'), chord('V'), chord('ii'), chord('IV')];
    const timeSpans: Array<readonly [number, number]> = [[0, 4], [4, 8], [8, 12], [12, 16]];
    const updated = analyzer.apply_consistency(sequence, timeSpans, phraseBoundaries, [
      {
        group_id: 'manual',
        phrase_indices: [0, 1],
        similarity_score: 0.9,
        context_differs: false,
      },
    ]);

    // at least one repeated phrase should align with reference phrase chord
    const anySynced = updated.some((item, idx) => item.roman_numeral === sequence[0].roman_numeral && idx !== 0);
    expect(anySynced).toBe(true);
  });

  it('allows cadence variation when contexts differ', () => {
    const analyzer = new RepeatPhraseAnalyzer();
    const groups = [{
      group_id: 'g1',
      phrase_indices: [0, 1],
      similarity_score: 0.9,
      context_differs: true,
    }];

    const sequence = [chord('I'), chord('V'), chord('ii'), chord('IV')];
    const timeSpans: Array<readonly [number, number]> = [[0, 2], [2, 4], [4, 6], [6, 8]];
    const phraseBoundaries: Array<readonly [number, number]> = [[0, 4], [4, 8]];

    const updated = analyzer.apply_consistency(sequence, timeSpans, phraseBoundaries, groups as any);

    // final chord in second phrase should remain target phrase cadence when context differs
    expect(updated[3].roman_numeral).toBe(sequence[3].roman_numeral);
  });
});
