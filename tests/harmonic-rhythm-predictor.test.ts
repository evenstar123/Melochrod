import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { HarmonicRhythmPredictor } from '../src/analyzer/harmonic-rhythm-predictor.js';
import { make_measure, make_note, make_score } from './helpers/sample-score.js';

function sampleScore() {
  return make_score([
    make_measure(1, [make_note('C', 0, { duration: 'half' }), make_note('E', 2), make_note('G', 3)]),
    make_measure(2, [make_note('F', 0), make_note('A', 1), make_note('C', 2), make_note('G', 3)]),
    make_measure(3, [make_note('G', 0, { duration: 'half' }), make_note('B', 2), make_note('D', 3)]),
    make_measure(4, [make_note('C', 0, { duration: 'whole' })]),
  ]);
}

describe('HarmonicRhythmPredictor', () => {
  it('basic difficulty creates sparser rhythm than advanced', () => {
    const predictor = new HarmonicRhythmPredictor();
    const score = sampleScore();

    const basic = predictor.predict({
      score,
      difficulty: 'basic',
      phrase_boundaries: [[0, 16]],
    });

    const advanced = predictor.predict({
      score,
      difficulty: 'advanced',
      phrase_boundaries: [[0, 16]],
    });

    expect(basic.length).toBeLessThan(advanced.length);
  });

  it('respects phrase boundaries', () => {
    const predictor = new HarmonicRhythmPredictor();
    const score = sampleScore();

    const spans = predictor.predict({
      score,
      difficulty: 'intermediate',
      phrase_boundaries: [[0, 8], [8, 16]],
    });

    expect(spans.some((span) => Math.abs(span[1] - 8) < 0.01)).toBe(true);
  });

  it('Property: spans cover piece contiguously without gaps', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 8 }), (nMeasures) => {
        const measures = Array.from({ length: nMeasures }, (_, i) =>
          make_measure(i + 1, [make_note('C', 0), make_note('E', 1), make_note('G', 2), make_note('C', 3)]),
        );

        const score = make_score(measures);
        const predictor = new HarmonicRhythmPredictor();
        const total = nMeasures * 4;

        const spans = predictor.predict({
          score,
          difficulty: 'intermediate',
          phrase_boundaries: [[0, total]],
        });

        expect(spans[0][0]).toBeCloseTo(0, 6);
        expect(spans[spans.length - 1][1]).toBeCloseTo(total, 6);

        for (let i = 1; i < spans.length; i++) {
          expect(spans[i][0]).toBeCloseTo(spans[i - 1][1], 6);
        }
      }),
      { numRuns: 60 },
    );
  });
});
