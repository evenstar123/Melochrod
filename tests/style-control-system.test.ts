import { describe, expect, it } from 'vitest';
import type { ChordCandidate } from '../src/core/harmony-types.js';
import { StyleControlSystem } from '../src/harmonizer/style-control-system.js';

function c(roman: string, quality: ChordCandidate['quality'], extensions: string[] = []): ChordCandidate {
  return {
    local_key: 'C major',
    mode: 'major',
    roman_numeral: roman,
    function: roman.includes('V') ? 'dominant' : 'tonic',
    root: roman.includes('V') ? 'G' : 'C',
    root_accidental: 'none',
    quality,
    inversion: 'root',
    extensions,
    alterations: [],
    confidence: 0.6,
    difficulty: 'intermediate',
    source: 'rule',
    explanation: roman,
    melody_coverage: 0.8,
    beat_alignment: 0.8,
    function_fit: 0.7,
    style_fit: 0.5,
  };
}

describe('StyleControlSystem', () => {
  it('pop profile prefers I-V-vi-IV progression', () => {
    const style = new StyleControlSystem();
    const popIVi = style.get_transition_probability('pop', 'V', 'vi') ?? 0;
    const popVii = style.get_transition_probability('pop', 'V', 'ii') ?? 0;
    expect(popIVi).toBeGreaterThan(popVii);
  });

  it('hymn profile emphasizes authentic cadence transitions', () => {
    const style = new StyleControlSystem();
    const hymnCadence = style.get_transition_probability('hymn', 'V', 'I') ?? 0;
    const hymnWeak = style.get_transition_probability('hymn', 'V', 'vi') ?? 0;
    expect(hymnCadence).toBeGreaterThan(hymnWeak);
  });

  it('jazz-lite profile boosts extended chords while hymn penalizes them', () => {
    const style = new StyleControlSystem();
    const base = [c('Imaj7', 'major7', ['9'])];
    const jazzWeighted = style.apply_style_weighting('jazz-lite', base)[0];
    const hymnWeighted = style.apply_style_weighting('hymn', base)[0];

    expect(jazzWeighted.confidence).toBeGreaterThan(hymnWeighted.confidence);
    expect(jazzWeighted.style_fit).toBeGreaterThan(hymnWeighted.style_fit);
  });
});

