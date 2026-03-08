import { describe, expect, it } from 'vitest';
import { KeySequenceAnalyzer } from '../src/analyzer/key-sequence-analyzer.js';
import { ModeUnificationConfig } from '../src/harmonizer/mode-unification-config.js';
import { HybridRetrievalStrategy } from '../src/harmonizer/hybrid-retrieval-strategy.js';
import { make_measure, make_note, make_score } from './helpers/sample-score.js';

describe('Mode unification', () => {
  it('maps non-standard mode names to supported modes', () => {
    const config = new ModeUnificationConfig();
    expect(config.map_to_supported_mode('ionian')).toBe('major');
    expect(config.map_to_supported_mode('aeolian')).toBe('minor');
    expect(config.map_to_supported_mode('locrian')).toBe('phrygian');
  });

  it('detects closest supported mode from scale pitch classes', () => {
    const config = new ModeUnificationConfig();
    expect(config.closest_supported_mode_from_scale([0, 2, 4, 5, 7, 9, 11])).toBe('major');
    expect(config.closest_supported_mode_from_scale([0, 2, 3, 5, 7, 8, 10])).toBe('minor');
    expect(config.closest_supported_mode_from_scale([0, 2, 3, 5, 7, 9, 10])).toBe('dorian');
    expect(config.closest_supported_mode_from_scale([0, 2, 4, 6, 7, 9, 11])).toBe('lydian');
    expect(config.closest_supported_mode_from_scale([0, 2, 4, 5, 7, 9, 10])).toBe('mixolydian');
    expect(config.closest_supported_mode_from_scale([0, 1, 3, 5, 7, 8, 10])).toBe('phrygian');
  });

  it('outputs mode information from key sequence analyzer on a modal-leaning melody', () => {
    const score = make_score([
      make_measure(1, [make_note('C', 0), make_note('D', 1), make_note('E', 2), make_note('F', 3, { accidental: 'sharp' })]),
      make_measure(2, [make_note('G', 0), make_note('A', 1), make_note('B', 2), make_note('C', 3)]),
    ]);

    const analyzer = new KeySequenceAnalyzer();
    const result = analyzer.analyze(score, 8);

    expect(['major', 'lydian']).toContain(result[0].mode);
    expect(result[0].key).toBe('C');
  });

  it('uses normalized mode in RAG symbolic filtering', () => {
    const strategy = new HybridRetrievalStrategy();
    const corpus = [
      {
        id: 'a',
        key: 'C',
        mode: 'minor',
        style: 'pop',
        time_signature: '4/4',
        phrase_length: 8,
        harmonic_density: 2,
        scale_degree_ngrams: ['1-2-3'],
        beat_pattern: '1-0-1-0',
        interval_contour: '++-',
        embedding: [1, 0, 0],
        chords: ['i', 'iv', 'V'],
      },
      {
        id: 'b',
        key: 'C',
        mode: 'major',
        style: 'pop',
        time_signature: '4/4',
        phrase_length: 8,
        harmonic_density: 2,
        scale_degree_ngrams: ['1-2-3'],
        beat_pattern: '1-0-1-0',
        interval_contour: '++-',
        embedding: [1, 0, 0],
        chords: ['I', 'IV', 'V'],
      },
    ];

    const filtered = strategy._symbolic_filter({
      key: 'C',
      mode: 'aeolian',
      style: 'pop',
      time_signature: '4/4',
      phrase_length: 8,
      harmonic_density: 2,
      scale_degree_ngrams: ['1-2-3'],
      beat_pattern: '1-0-1-0',
      interval_contour: '++-',
      embedding: [1, 0, 0],
    }, corpus as any);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('a');
  });
});
