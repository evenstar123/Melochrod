import { describe, expect, it } from 'vitest';
import { DifficultyController } from '../src/harmonizer/difficulty-controller.js';
import type { ChordCandidate } from '../src/core/harmony-types.js';

const candidates: ChordCandidate[] = [
  {
    local_key: 'C major',
    mode: 'major',
    roman_numeral: 'I',
    function: 'tonic',
    root: 'C',
    root_accidental: 'none',
    quality: 'major',
    inversion: 'root',
    extensions: [],
    alterations: [],
    confidence: 0.7,
    difficulty: 'basic',
    source: 'rule',
    explanation: '',
    melody_coverage: 0.8,
    beat_alignment: 0.8,
    function_fit: 0.8,
    style_fit: 0.6,
  },
  {
    local_key: 'C major',
    mode: 'major',
    roman_numeral: 'V/ii',
    function: 'dominant',
    root: 'A',
    root_accidental: 'none',
    quality: 'dominant7',
    inversion: 'first',
    extensions: ['9'],
    alterations: ['#11'],
    confidence: 0.7,
    difficulty: 'advanced',
    source: 'rule',
    explanation: '',
    melody_coverage: 0.8,
    beat_alignment: 0.8,
    function_fit: 0.8,
    style_fit: 0.6,
  },
];

describe('DifficultyController', () => {
  it('filters out complex chords for basic difficulty', () => {
    const controller = new DifficultyController();
    const filtered = controller.filter(candidates, 'basic');

    expect(filtered).toHaveLength(1);
    expect(filtered[0].roman_numeral).toBe('I');
  });

  it('allows richer chords for advanced difficulty', () => {
    const controller = new DifficultyController();
    const filtered = controller.filter(candidates, 'advanced');

    expect(filtered).toHaveLength(2);
  });

  it('adjusts scoring weights by difficulty level', () => {
    const controller = new DifficultyController();
    const basicWeights = controller.adjust_weights('basic');
    const advancedWeights = controller.adjust_weights('advanced');

    expect(basicWeights.melody_coverage).toBeGreaterThan(advancedWeights.melody_coverage);
    expect(advancedWeights.style_fit).toBeGreaterThan(basicWeights.style_fit);
  });
});
