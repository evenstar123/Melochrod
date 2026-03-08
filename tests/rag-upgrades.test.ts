import { describe, expect, it } from 'vitest';
import { HarmonicSemanticFeatureExtractor } from '../src/rag/harmonic-semantic-feature-extractor.js';
import { HybridRetrievalStrategy } from '../src/harmonizer/hybrid-retrieval-strategy.js';
import { make_measure, make_note, make_score } from './helpers/sample-score.js';

describe('RAG upgrades', () => {
  it('extracts harmonic semantic features', () => {
    const score = make_score([
      make_measure(1, [make_note('C', 0), make_note('E', 1), make_note('G', 2), make_note('C', 3)]),
      make_measure(2, [make_note('D', 0), make_note('F', 1), make_note('A', 2), make_note('G', 3)]),
    ]);

    const extractor = new HarmonicSemanticFeatureExtractor();
    const features = extractor.extract(score, [0, 4], [[0, 8]]);

    expect(features.backbone_notes.length).toBeGreaterThan(0);
    expect(features.phrase_position).toBeDefined();
    expect(features.melody_stability).toBeGreaterThanOrEqual(0);
    expect(features.melody_stability).toBeLessThanOrEqual(1);
  });

  it('symbolic filter reduces candidate set', () => {
    const strategy = new HybridRetrievalStrategy();

    const corpus = [
      {
        id: 'a', key: 'C', mode: 'major', style: 'pop', time_signature: '4/4', phrase_length: 8, harmonic_density: 2,
        scale_degree_ngrams: ['1-5-6'], beat_pattern: '1001', interval_contour: 'up-down',
        embedding: [1, 0], chords: ['I', 'V'],
      },
      {
        id: 'b', key: 'D', mode: 'minor', style: 'hymn', time_signature: '3/4', phrase_length: 6, harmonic_density: 1,
        scale_degree_ngrams: ['2-4-5'], beat_pattern: '1100', interval_contour: 'down',
        embedding: [0, 1], chords: ['i', 'iv'],
      },
    ];

    const filtered = strategy._symbolic_filter({
      key: 'C',
      mode: 'major',
      style: 'pop',
      time_signature: '4/4',
      scale_degree_ngrams: ['1-5-6'],
      beat_pattern: '1001',
      interval_contour: 'up-down',
      embedding: [1, 0],
    }, corpus);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('a');
  });

  it('fuses sparse and dense results into ranked output', () => {
    const strategy = new HybridRetrievalStrategy();
    const corpus = [
      {
        id: 'a', key: 'C', mode: 'major', style: 'pop', time_signature: '4/4', phrase_length: 8, harmonic_density: 2,
        scale_degree_ngrams: ['1-5-6'], beat_pattern: '1001', interval_contour: 'up-down',
        embedding: [1, 0], chords: ['I', 'V'],
      },
      {
        id: 'b', key: 'C', mode: 'major', style: 'pop', time_signature: '4/4', phrase_length: 8, harmonic_density: 2,
        scale_degree_ngrams: ['1-4-5'], beat_pattern: '1010', interval_contour: 'flat',
        embedding: [0.4, 0.6], chords: ['IV', 'V'],
      },
    ];

    const results = strategy.search({
      key: 'C',
      mode: 'major',
      style: 'pop',
      time_signature: '4/4',
      phrase_length: 8,
      harmonic_density: 2,
      scale_degree_ngrams: ['1-5-6'],
      beat_pattern: '1001',
      interval_contour: 'up-down',
      embedding: [1, 0],
    }, corpus, 2);

    expect(results).toHaveLength(2);
    expect(results[0].fused_score).toBeGreaterThanOrEqual(results[1].fused_score);
  });
});
